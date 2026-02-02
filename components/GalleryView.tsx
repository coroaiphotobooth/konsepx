import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Trash2, Copy, Monitor, Maximize2, FlaskConical, RefreshCw, CloudOff, AlertTriangle, FolderPlus, Folder, Filter, Plus, ArrowLeft, LayoutGrid, FolderOpen, Pencil, Loader2, HardDrive, Image as ImageIcon, ChevronRight, ChevronDown, Terminal } from 'lucide-react';
import { GalleryItem, AspectRatio, ModelChoice } from '../types';
import { getGalleryItems, deleteGalleryItem, saveGalleryItem, getApiUrl, getSheetId, getTabName } from '../services/storageService';
import { MODEL_LABELS } from '../constants';

interface GalleryViewProps {
  onCopyToast: (msg: string) => void;
  onNavigateToSample: (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => void;
  items: GalleryItem[];
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>;
  isLoaded: boolean;
  setIsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  availableGroups: string[];
  onAddGroup: (name: string) => void;
  onDeleteGroup: (name: string) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  onConnectionError?: () => void;
}

const CACHE_KEY = 'COROAI_GALLERY_CACHE_V2';

// --- HELPERS ---
const getAspectRatioClass = (ratio: AspectRatio) => {
  switch (ratio) {
    case AspectRatio.PORTRAIT: return 'aspect-[9/16]';
    case AspectRatio.LANDSCAPE: return 'aspect-[16/9]';
    case AspectRatio.PRINT_PORTRAIT: return 'aspect-[3/4]';
    case AspectRatio.PRINT_LANDSCAPE: return 'aspect-[4/3]';
    default: return 'aspect-square';
  }
};

const safeModelLabel = (model: ModelChoice) => {
    const label = MODEL_LABELS[model];
    return label ? label.replace('Gemini ', '') : "Unknown";
};

const saveToCache = (items: GalleryItem[]) => {
    try {
        const lightweightItems = items.slice(0, 100).map(item => ({
            ...item,
            resultDataUrl: item.fileId ? undefined : item.resultDataUrl 
        }));
        localStorage.setItem(CACHE_KEY, JSON.stringify(lightweightItems));
    } catch (e: any) {
        console.warn("Cache error", e);
    }
};

const getDisplayUrl = (item: GalleryItem, size = 'w600') => {
    if (item.fileId) {
        return `https://drive.google.com/thumbnail?id=${item.fileId}&sz=${size}`;
    }
    if (item.resultDataUrl) {
        if (item.resultDataUrl.startsWith('data:')) return item.resultDataUrl;
        if (item.resultDataUrl.includes('drive.google.com') && item.resultDataUrl.includes('id=')) {
             const match = item.resultDataUrl.match(/id=([^&]+)/);
             if (match && match[1]) {
                return `https://drive.google.com/thumbnail?id=${match[1]}&sz=${size}`;
             }
        }
        return item.resultDataUrl;
    }
    return '';
};

// --- SUB-COMPONENTS ---

const DeleteButton = memo(({ id, fileId, onDelete }: { id: string, fileId?: string, onDelete: (id: string, fileId?: string) => void }) => {
    const [step, setStep] = useState<'idle' | 'confirm'>('idle');
    useEffect(() => {
        if (step === 'confirm') {
            const timer = setTimeout(() => setStep('idle'), 3000);
            return () => clearTimeout(timer);
        }
    }, [step]);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                if (step === 'idle') setStep('confirm');
                else onDelete(id, fileId);
            }}
            className={`py-1.5 px-2 rounded border transition-all flex items-center justify-center gap-1.5 text-[10px] font-medium w-full
                ${step === 'confirm' 
                    ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/80 hover:text-white hover:border-red-500'}`}
        >
            {step === 'confirm' ? <><AlertTriangle size={10} /> Yakin?</> : <><Trash2 size={10} /> Hapus</>}
        </button>
    );
});

const GalleryCard = memo(({ item, onMove, onSample, onDelete, onCopy }: { 
    item: GalleryItem, 
    onMove: (i: GalleryItem) => void, 
    onSample: (d: any) => void, 
    onDelete: (id: string, fileId?: string) => void,
    onCopy: (t: string) => void
}) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const displayUrl = getDisplayUrl(item, 'w500'); 

    const openFullImage = () => {
        const url = item.downloadUrl || (item.fileId ? `https://drive.google.com/uc?export=view&id=${item.fileId}` : item.resultDataUrl);
        if (url) window.open(url, '_blank');
    };

    return (
        <div className="bg-cyber-800/50 backdrop-blur-md border border-cyber-700/50 rounded-lg overflow-hidden flex flex-col group hover:border-cyber-500/50 transition-all hover:shadow-lg hover:shadow-cyber-500/10 h-full relative content-visibility-auto">
            <div className={`relative w-full ${getAspectRatioClass(item.aspectRatio)} bg-black overflow-hidden border-b border-cyber-700/30`}>
                {!imgLoaded && !imgError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cyber-900 animate-pulse z-0">
                        <ImageIcon size={24} className="text-cyber-800" />
                    </div>
                )}
                {imgError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-cyber-900 z-10 text-slate-500">
                        <AlertTriangle size={20} /> <span className="text-[10px] mt-1">Error</span>
                    </div>
                )}
                <img 
                    src={displayUrl} 
                    alt={item.title} 
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                    className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 z-20">
                    <button onClick={() => onMove(item)} className="p-1.5 bg-cyber-600/80 rounded-md text-white hover:bg-cyber-500 backdrop-blur-md shadow-lg"><FolderPlus size={14} /></button>
                    <button onClick={() => onSample({ prompt: item.prompt, aspectRatio: item.aspectRatio, modelChoice: item.modelChoice })} className="p-1.5 bg-cyber-600/80 rounded-md text-white hover:bg-cyber-500 backdrop-blur-md shadow-lg"><FlaskConical size={14} /></button>
                    <button onClick={openFullImage} className="p-1.5 bg-black/60 rounded-md text-cyber-400 hover:text-white backdrop-blur-md shadow-lg"><Maximize2 size={14} /></button>
                </div>
            </div>
            <div className="p-2.5 flex flex-col flex-1 gap-2">
                 <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm leading-tight truncate">{item.title || "Untitled"}</h3>
                    <div className="flex items-center gap-2 text-[9px] text-cyber-300 mt-1 font-mono opacity-80">
                        <span className="truncate"><Monitor size={8} className="inline mr-1"/>{safeModelLabel(item.modelChoice)}</span>
                    </div>
                 </div>
                 <div className="bg-cyber-900/40 p-2 rounded border border-cyber-700/30 flex-1">
                    <p className="text-[10px] text-slate-300 italic line-clamp-2">"{item.prompt}"</p>
                 </div>
                 <div className="grid grid-cols-2 gap-1.5 mt-auto">
                    <button onClick={() => onCopy(item.prompt)} className="py-1.5 px-2 rounded bg-cyber-700/30 text-cyber-300 border border-cyber-700/50 hover:bg-cyber-500/20 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-medium"><Copy size={10} /> Copy</button>
                    <DeleteButton id={item.id} fileId={item.fileId} onDelete={onDelete} />
                 </div>
            </div>
        </div>
    );
});

const SkeletonGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
        {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-cyber-800/30 border border-cyber-700/30 rounded-lg overflow-hidden flex flex-col h-full animate-pulse">
                <div className="aspect-[3/4] bg-cyber-700/20" />
                <div className="p-2 gap-2 flex flex-col">
                    <div className="h-4 bg-cyber-700/30 rounded w-3/4" />
                    <div className="h-10 bg-cyber-700/20 rounded w-full" />
                </div>
            </div>
        ))}
    </div>
);

// --- MAIN COMPONENT ---

const GalleryView: React.FC<GalleryViewProps> = ({ 
    onCopyToast, 
    onNavigateToSample,
    items,
    setItems,
    isLoaded,
    setIsLoaded,
    availableGroups,
    onAddGroup,
    onDeleteGroup,
    onRenameGroup,
    onConnectionError
}) => {
  // --- STATE ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingMsg, setProcessingMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'all'>('main');
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  
  // Debug State
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [groupToRename, setGroupToRename] = useState<{old: string, new: string} | null>(null);
  const [itemToMove, setItemToMove] = useState<GalleryItem | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // --- MEMOIZED GROUPING LOGIC ---
  const groupStats = useMemo(() => {
      const counts: Record<string, number> = {};
      let uncategorized = 0;
      items.forEach(item => {
          if (item.group) counts[item.group] = (counts[item.group] || 0) + 1;
          else uncategorized++;
      });
      return { counts, uncategorized };
  }, [items]);

  const folderPreviewImages = useMemo(() => {
      const previews: Record<string, string> = {};
      availableGroups.forEach(group => {
          const match = items.find(i => i.group === group);
          if (match) previews[group] = getDisplayUrl(match, 'w400');
      });
      return previews;
  }, [items, availableGroups]);

  // --- DATA LOADING ---

  const loadItems = useCallback(async (isRefresh = false) => {
    if (isSyncing || (!isRefresh && !hasMore)) return;

    if (isRefresh) {
        setIsSyncing(true);
        setPage(1);
        setLastError(null); // Clear error on new try
    } else {
        setLoadingMore(true);
    }

    try {
      const targetPage = isRefresh ? 1 : page;
      const limit = 50; 
      const newItems = await getGalleryItems(targetPage, limit);
      
      if (newItems.length < limit) setHasMore(false);
      else setHasMore(true);

      setItems(prev => {
          const combined = isRefresh ? newItems : [...prev, ...newItems];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          // SAFE SORT: Handle legacy data where createdAt might be string or missing
          const sorted = unique.sort((a, b) => {
              const dateA = Number(a.createdAt) || 0;
              const dateB = Number(b.createdAt) || 0;
              return dateB - dateA;
          });
          saveToCache(sorted);
          return sorted;
      });

      if (!isRefresh) setPage(p => p + 1);
      setIsLoaded(true);
    } catch (e: any) { 
        console.error("Sync error", e);
        setLastError(e.message || "Unknown Connection Error");
        if (onConnectionError && (e.message.includes("Backend Error") || e.message.includes("Failed to fetch") || e.message.includes("Script"))) {
            onConnectionError();
        } else {
             onCopyToast("Gagal memuat data gallery");
        }
    } finally { 
        setIsSyncing(false); 
        setLoadingMore(false);
    }
  }, [page, hasMore, isSyncing, setItems, setIsLoaded, onCopyToast, onConnectionError]);

  useEffect(() => {
    if (!isLoaded) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) setItems(parsed);
            } catch(e) {}
        }
        loadItems(true); 
    }
  }, []);

  // --- ACTIONS ---

  const handleDeleteItem = useCallback(async (id: string, fileId?: string) => {
    onCopyToast("Menghapus item...");
    setItems(prev => prev.filter(item => item.id !== id));
    try { 
        await deleteGalleryItem(id, fileId); 
    } catch (err: any) { 
        if (onConnectionError && err.message.includes("Backend")) onConnectionError();
    }
  }, [onCopyToast, setItems, onConnectionError]);

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt);
    onCopyToast("Prompt disalin!");
  }, [onCopyToast]);

  const handleRenameFolderConfirm = async () => {
      if (!groupToRename?.new.trim() || groupToRename.old === groupToRename.new) return setShowRenameGroupModal(false);
      const { old: oldName, new: newName } = groupToRename;
      setShowRenameGroupModal(false);
      setProcessingMsg("Update nama folder...");
      try {
          onRenameGroup(oldName, newName);
          const updatedItems = items.map(i => i.group === oldName ? { ...i, group: newName } : i);
          setItems(updatedItems);
          saveToCache(updatedItems);
          const changedItems = updatedItems.filter(i => i.group === newName);
          for (let i = 0; i < changedItems.length; i += 3) {
             await Promise.all(changedItems.slice(i, i + 3).map(item => saveGalleryItem(item)));
          }
          onCopyToast("Folder diubah!");
      } catch (e: any) { 
          if (onConnectionError && e.message.includes("Backend")) onConnectionError();
      } finally { setProcessingMsg(null); }
  };

  const handleMoveItem = async (targetGroup: string) => {
      if (!itemToMove) return;
      const updatedItem = { ...itemToMove, group: targetGroup || undefined };
      setItems(prev => prev.map(i => i.id === itemToMove.id ? updatedItem : i));
      setItemToMove(null);
      onCopyToast("Dipindahkan.");
      try { await saveGalleryItem(updatedItem); } catch (e: any) { 
          if (onConnectionError && e.message.includes("Backend")) onConnectionError();
      }
  };

  // --- RENDERERS ---

  const ItemsGrid = useCallback(({ displayItems }: { displayItems: GalleryItem[] }) => {
      if (displayItems.length === 0) {
          if (isSyncing && !isLoaded) return <SkeletonGrid />;
          return (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 w-full px-4">
                 <CloudOff size={48} className="mb-2"/> 
                 <p className="text-sm font-bold mt-2">Data Tidak Ditemukan</p>
                 
                 {/* DEBUG UI PANEL */}
                 <div className="mt-6 w-full max-w-lg bg-black/50 border border-cyber-700/50 rounded-lg p-4 text-left font-mono text-[10px] space-y-2">
                     <div className="flex items-center gap-2 text-cyber-400 border-b border-cyber-800 pb-2 mb-2">
                        <Terminal size={12} /> SYSTEM DIAGNOSTIC
                     </div>
                     <div className="grid grid-cols-[80px_1fr] gap-2">
                         <span className="text-slate-500">URL:</span>
                         <span className="text-slate-300 break-all">{getApiUrl()}</span>
                         
                         <span className="text-slate-500">Sheet ID:</span>
                         <span className="text-slate-300 break-all">{getSheetId()}</span>
                         
                         <span className="text-slate-500">Tab Name:</span>
                         <span className="text-cyber-300 font-bold">{getTabName()}</span>
                         
                         <span className="text-slate-500">Status:</span>
                         <span className={lastError ? "text-red-400 font-bold" : "text-green-400"}>
                             {lastError ? "CONNECTION FAILED" : "CONNECTED (Empty Data)"}
                         </span>
                     </div>
                     {lastError && (
                         <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 break-words whitespace-pre-wrap">
                             {lastError}
                         </div>
                     )}
                     <div className="pt-2 text-[9px] text-slate-600 text-center">
                         Jika Tab Name salah, ubah di Settings (Icon Gear).
                     </div>
                 </div>
            </div>
        );
      }
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-20">
            {displayItems.map((item) => (
                <GalleryCard 
                    key={item.id} 
                    item={item} 
                    onMove={setItemToMove}
                    onSample={onNavigateToSample}
                    onDelete={handleDeleteItem}
                    onCopy={handleCopyPrompt}
                />
            ))}
        </div>
      );
  }, [isSyncing, isLoaded, onNavigateToSample, handleDeleteItem, handleCopyPrompt, lastError]);

  const filteredItems = useMemo(() => {
      if (activeTab === 'all') return items;
      if (!openFolder) return [];
      if (openFolder === '__uncategorized__') return items.filter(i => !i.group);
      return items.filter(i => i.group === openFolder);
  }, [activeTab, openFolder, items]);

  return (
    <div className="h-full overflow-hidden flex flex-col relative">
      {processingMsg && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-200">
              <Loader2 size={48} className="text-cyber-500 animate-spin mb-4" /><h3 className="text-lg font-bold">Memproses...</h3><p className="text-sm text-cyber-400">{processingMsg}</p>
          </div>
      )}

      {/* HEADER NAV */}
      <div className="flex-none pb-4 border-b border-cyber-700/30 mb-4">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
              <button onClick={() => { setActiveTab('main'); setOpenFolder(null); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider pb-1 transition-all border-b-2 whitespace-nowrap ${activeTab === 'main' ? 'text-cyber-400 border-cyber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}><FolderOpen size={16} /> Main</button>
              <button onClick={() => { setActiveTab('all'); setOpenFolder(null); }} className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider pb-1 transition-all border-b-2 whitespace-nowrap ${activeTab === 'all' ? 'text-cyber-400 border-cyber-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}><LayoutGrid size={16} /> All Photos</button>
              
              {activeTab === 'main' && openFolder && (
                 <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-5 duration-300 whitespace-nowrap">
                     <div className="h-4 w-px bg-slate-700/50 mx-1"></div>
                     <div className="flex items-center gap-2 text-cyber-400 font-bold uppercase text-sm tracking-wider">
                        <ChevronRight size={14} className="text-slate-600" />
                        <FolderOpen size={16} />
                        <span>{openFolder === '__uncategorized__' ? 'Uncategorized' : openFolder}</span>
                     </div>
                 </div>
              )}

              <div className="ml-auto flex items-center gap-3 pl-4">
                 {isSyncing ? <div className="flex items-center gap-1.5 text-[10px] text-cyber-500 animate-pulse bg-cyber-900/50 px-2 py-1 rounded-full border border-cyber-800"><RefreshCw size={10} className="animate-spin" /> Sync</div> : <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full border border-slate-800"><HardDrive size={10} /> Ready</div>}
                 <button onClick={() => loadItems(true)} className="p-1.5 text-slate-500 hover:text-cyber-400 transition-colors"><RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} /></button>
              </div>
          </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative">
        {(!isLoaded && items.length === 0 && isSyncing) ? <SkeletonGrid /> : (
             <>
                {activeTab === 'main' && !openFolder && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 pt-4">
                        <button onClick={() => setShowAddGroupModal(true)} className="aspect-[4/3] rounded-xl border border-cyber-800 bg-cyber-900/20 hover:bg-cyber-800/40 hover:border-cyber-500 transition-all flex flex-col items-center justify-center gap-1 group">
                            <Plus size={32} className="text-cyber-700 group-hover:text-cyber-400 transition-all duration-300" />
                            <span className="text-[10px] font-medium tracking-widest text-cyber-700 group-hover:text-cyber-400 uppercase">New Folder</span>
                        </button>
                        {availableGroups.map(group => (
                            <div key={group} onClick={() => setOpenFolder(group)} className="relative aspect-[4/3] rounded-xl border border-cyber-700/50 bg-cyber-900/40 overflow-hidden cursor-pointer group hover:border-cyber-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all">
                                {folderPreviewImages[group] ? (
                                    <img src={folderPreviewImages[group]} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center bg-cyber-900"><Folder size={40} className="text-cyber-800 group-hover:text-cyber-600 transition-colors" /></div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-8 flex items-end justify-between gap-2">
                                    <h3 className="text-white font-bold text-sm truncate drop-shadow-md">{group}</h3>
                                    <span className="text-[9px] text-white/80 font-mono drop-shadow-md">{groupStats.counts[group] || 0} items</span>
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => { e.stopPropagation(); setGroupToRename({ old: group, new: group }); setShowRenameGroupModal(true); }} className="p-1.5 rounded-lg bg-black/60 text-slate-400 hover:text-white border border-white/10 backdrop-blur"><Pencil size={12} /></button>
                                </div>
                            </div>
                        ))}
                        {groupStats.uncategorized > 0 && (
                            <div onClick={() => setOpenFolder('__uncategorized__')} className="relative aspect-[4/3] rounded-xl border border-dashed border-slate-700 bg-slate-900/20 overflow-hidden cursor-pointer group hover:border-slate-500 transition-all">
                                <div className="absolute inset-0 flex items-center justify-center opacity-10"><Filter size={40} className="text-slate-500"/></div>
                                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-2">
                                    <h3 className="text-slate-400 font-medium text-sm truncate flex-1 italic">Uncategorized</h3>
                                    <span className="text-[9px] text-slate-500 font-mono px-1.5 py-0.5 rounded border border-white/5">{groupStats.uncategorized}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {(activeTab === 'all' || (activeTab === 'main' && openFolder)) && (
                    <div className="animate-in slide-in-from-right-5 fade-in duration-300 pt-2">
                         <ItemsGrid displayItems={filteredItems} />
                         {hasMore && activeTab === 'all' && (
                             <div className="flex justify-center py-8">
                                 <button 
                                    onClick={() => loadItems()} 
                                    disabled={loadingMore}
                                    className="px-6 py-2 bg-cyber-900 border border-cyber-700 rounded-full text-cyber-400 text-sm hover:bg-cyber-800 flex items-center gap-2"
                                 >
                                    {loadingMore ? <Loader2 size={16} className="animate-spin"/> : <ChevronDown size={16}/>}
                                    {loadingMore ? "Memuat..." : "Load More"}
                                 </button>
                             </div>
                         )}
                    </div>
                )}
             </>
        )}
      </div>

      {showAddGroupModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2"><FolderPlus size={16} className="text-cyber-500"/> Buat Group Baru</h3>
                    <input type="text" autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nama Group..." className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none mb-3" />
                    <div className="flex gap-2 justify-end"><button onClick={() => setShowAddGroupModal(false)} className="px-3 py-1.5 rounded text-xs text-slate-400">Batal</button><button onClick={() => { if(newGroupName.trim()) { onAddGroup(newGroupName.trim()); setNewGroupName(''); setShowAddGroupModal(false); }}} className="px-4 py-1.5 rounded text-xs bg-cyber-500 text-white font-bold">Buat</button></div>
               </div>
          </div>
      )}

      {showRenameGroupModal && groupToRename && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Pencil size={16} className="text-cyber-500"/> Ganti Nama Folder</h3>
                    <input type="text" autoFocus value={groupToRename.new} onChange={(e) => setGroupToRename(prev => prev ? {...prev, new: e.target.value} : null)} placeholder="Nama Baru..." className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none mb-3" />
                    <div className="flex gap-2 justify-end"><button onClick={() => setShowRenameGroupModal(false)} className="px-3 py-1.5 rounded text-xs text-slate-400">Batal</button><button onClick={handleRenameFolderConfirm} className="px-4 py-1.5 rounded text-xs bg-cyber-500 text-white font-bold">Simpan</button></div>
               </div>
          </div>
      )}

      {itemToMove && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-xs shadow-2xl">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2 truncate"><Folder size={16} className="text-cyber-500"/> Pindahkan Item</h3>
                    <div className="space-y-1 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                         <button onClick={() => handleMoveItem('')} className={`w-full text-left px-3 py-2 rounded text-xs hover:bg-cyber-800 flex items-center gap-2 ${!itemToMove.group ? 'text-cyber-400 font-bold bg-cyber-900' : 'text-slate-300'}`}><CloudOff size={12}/> Tanpa Group</button>
                         {availableGroups.map(g => (<button key={g} onClick={() => handleMoveItem(g)} className={`w-full text-left px-3 py-2 rounded text-xs hover:bg-cyber-800 flex items-center gap-2 ${itemToMove.group === g ? 'text-cyber-400 font-bold bg-cyber-900' : 'text-slate-300'}`}><Folder size={12}/> {g}</button>))}
                    </div>
                    <button onClick={() => setItemToMove(null)} className="w-full px-3 py-1.5 rounded text-xs text-slate-400 border border-cyber-800 hover:text-white">Batal</button>
               </div>
          </div>
      )}
    </div>
  );
};

export default GalleryView;