import React, { useState, useEffect } from 'react';
import { LayoutGrid, PlusSquare, AlertTriangle, CheckCircle, FlaskConical, Lock, User, ArrowRight, Settings, Link as LinkIcon, Save, RefreshCw, Unplug, Database, TableProperties, RotateCcw } from 'lucide-react';
import CreateView from './components/CreateView';
import GalleryView from './components/GalleryView';
import SampleView from './components/SampleView';
import { AspectRatio, ModelChoice, GalleryItem } from './types';
import { getApiUrl, setApiUrl, getSheetId, setSheetId, getTabName, setTabName } from './services/storageService';

const App = () => {
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
  const [activeTab, setActiveTab] = useState<'create' | 'gallery' | 'sample'>('create');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Gallery Cache State (Lifting State Up)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [isGalleryLoaded, setIsGalleryLoaded] = useState(false);
  
  // Connection State
  const [connectionError, setConnectionError] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [scriptUrl, setScriptUrl] = useState('');
  const [currentSheetId, setCurrentSheetId] = useState('');
  const [currentTabName, setCurrentTabName] = useState('');

  // Groups Management State
  const GROUPS_STORAGE_KEY = 'COROAI_GROUPS_V2';

  const [groups, setGroups] = useState<string[]>(() => {
      try {
          const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
          if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) return parsed.sort();
          }
          return [];
      } catch (e) {
          console.error("Gagal load groups:", e);
          return [];
      }
  });

  // State to pass data
  const [sampleInitData, setSampleInitData] = useState<{
    prompt: string;
    aspectRatio: AspectRatio;
    modelChoice: ModelChoice;
  } | null>(null);

  const BG_IMAGE_URL = "https://lh3.googleusercontent.com/pw/AP1GczPehmtvnU2JsBugCFOC43m8HGhHABCbevbsBgBBJ0Z6KQ9Q278FgJnzycN-xIkTAPOW63-MukGDxAo5boVtc-hg43tr3_Xyg5tJ35Z-6XGQIRmdD89ZuoZRLt-utQ8UPc1ajLDp8JKknzjlutAH6TNlXw=w1850-h1033-s-no-gm?authuser=0";

  useEffect(() => {
      loadSettings();
      if (isLoggedIn && !getApiUrl()) setShowSettings(true);
  }, [isLoggedIn]);

  const loadSettings = () => {
      const storedUrl = getApiUrl();
      if (storedUrl) setScriptUrl(storedUrl);
      
      const storedSid = getSheetId();
      if (storedSid) setCurrentSheetId(storedSid);
      
      const storedTab = getTabName();
      if (storedTab) setCurrentTabName(storedTab);
  };

  // 1. AUTO-SAVE GROUPS
  useEffect(() => {
      const handle = requestAnimationFrame(() => {
          localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
      });
      return () => cancelAnimationFrame(handle);
  }, [groups]);

  // 2. AUTO-SYNC: Sync groups from items on load
  useEffect(() => {
      if (galleryItems.length > 0) {
          setGroups(prev => {
              const next = new Set(prev);
              let changed = false;
              galleryItems.forEach(item => {
                  if (item.group && item.group.trim()) {
                      if (!next.has(item.group)) {
                          next.add(item.group);
                          changed = true;
                      }
                  }
              });
              return changed ? Array.from(next).sort() : prev;
          });
      }
  }, [galleryItems]);

  const handleAddGroup = (name: string) => {
      if (!name) return;
      const cleanName = name.trim();
      setGroups(prev => {
          if (prev.includes(cleanName)) return prev;
          const newGroups = [...prev, cleanName].sort();
          return newGroups;
      });
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
      if (!newName.trim() || oldName === newName) return;
      setGroups(prev => {
          const next = prev.filter(g => g !== oldName);
          if (!next.includes(newName)) {
              next.push(newName);
          }
          return next.sort();
      });
  };

  const handleDeleteGroup = (name: string) => {
      setGroups(prev => prev.filter(g => g !== name));
      showToast(`Folder "${name}" dihapus.`, 'success');
  };

  const handleReScanGroups = () => {
      if (galleryItems.length === 0) {
          showToast("Belum ada foto untuk di-scan.", "error");
          return;
      }
      
      const foundGroups = new Set<string>();
      galleryItems.forEach(item => {
          if (item.group) foundGroups.add(item.group);
      });
      
      const newGroupList = Array.from(foundGroups).sort();
      setGroups(newGroupList);
      showToast(`Berhasil memulihkan ${newGroupList.length} folder dari data foto.`, 'success');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'coroai' && password === '321654') {
        setIsLoggedIn(true);
        setLoginError('');
    } else {
        setLoginError('Username atau Password salah');
    }
  };

  const saveSettings = () => {
      if (!scriptUrl.includes("script.google.com")) {
          showToast("URL tidak valid. Harus link Google Script.", "error");
          return;
      }
      setApiUrl(scriptUrl);
      if (currentSheetId.trim()) setSheetId(currentSheetId.trim());
      if (currentTabName.trim()) setTabName(currentTabName.trim());
      
      setConnectionError(false); // Reset error state on save
      setShowSettings(false);
      setIsGalleryLoaded(false); 
      setGalleryItems([]); // Clear current items to force reload
      showToast("Koneksi Database Tersimpan!", "success");
  };

  const handleResetDefaults = () => {
      // Clear localStorage keys specific to connection
      localStorage.removeItem('COROAI_GAS_URL_V5');
      localStorage.removeItem('COROAI_SHEET_ID_V1');
      localStorage.removeItem('COROAI_TAB_NAME_V2'); // New Key
      localStorage.removeItem('COROAI_TAB_NAME_V1'); // Cleanup old key
      
      // Reload defaults from code constants
      loadSettings();
      
      // Force UI update
      setTimeout(() => {
        setScriptUrl(getApiUrl());
        setCurrentSheetId(getSheetId());
        setCurrentTabName(getTabName());
        showToast("Pengaturan di-reset ke default system (Sheet1).", "success");
      }, 100);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaved = (newItem?: GalleryItem) => {
    if (newItem) {
        setGalleryItems(prev => [newItem, ...prev]);
        if (newItem.group) {
             handleAddGroup(newItem.group);
             showToast(`Disimpan ke folder "${newItem.group}"`, "success");
        } else {
             showToast("Berhasil disimpan!", "success");
        }
    } else {
        setIsGalleryLoaded(false); 
        showToast("Database disinkronkan.", "success");
    }
  };

  const handleNavigateToSample = (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => {
    setSampleInitData(data);
    setActiveTab('sample');
    showToast("Data disalin ke Buat Sample.", "success");
  };

  const handleTabChange = (tab: 'create' | 'gallery' | 'sample') => {
    if (tab === 'sample') setSampleInitData(null); 
    setActiveTab(tab);
  };

  // Callback from Gallery when connection fails
  const handleConnectionError = () => {
      setConnectionError(true);
      if (!showSettings) {
          showToast("Koneksi Gagal. Cek Settings.", "error");
      }
  };

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-cyber-900 text-white p-4 relative overflow-hidden font-sans">
            <div className="absolute inset-0 z-0">
                <img src={BG_IMAGE_URL} alt="Background" className="w-full h-full object-cover opacity-80"/>
                <div className="absolute inset-0 bg-cyber-900/60 backdrop-blur-sm"></div>
            </div>

            <div className="relative z-10 w-full max-w-sm">
                <div className="bg-cyber-800/60 backdrop-blur-md border border-cyber-500/30 rounded-2xl p-8 shadow-2xl shadow-cyber-500/10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-black tracking-wider text-white drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            <span className="text-cyber-500">COROAI</span> CREATOR
                        </h1>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-cyber-400 mt-2 font-medium opacity-80">
                            creative intelligence studio
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyber-500">
                                    <User size={16} />
                                </div>
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username"
                                    className="w-full pl-10 pr-4 py-3 bg-cyber-900/50 border border-cyber-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-cyber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyber-500">
                                    <Lock size={16} />
                                </div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-10 pr-4 py-3 bg-cyber-900/50 border border-cyber-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-cyber-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {loginError && (
                            <div className="text-red-400 text-xs text-center flex items-center justify-center gap-1 bg-red-900/20 py-2 rounded">
                                <AlertTriangle size={12} /> {loginError}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-cyber-600 to-cyber-500 hover:from-cyber-500 hover:to-cyber-400 text-white font-bold rounded-lg shadow-lg shadow-cyber-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-4 group"
                        >
                            LOGIN
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
  }

  // MAIN APP SCREEN
  return (
    <div className="h-screen w-screen overflow-hidden text-slate-50 font-sans selection:bg-cyber-500 selection:text-white flex flex-col relative bg-cyber-900">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
         <img src={BG_IMAGE_URL} alt="App Background" className="w-full h-full object-cover" />
      </div>

      <div className="relative z-10 flex flex-col h-full w-full">
          {/* HEADER */}
          <header className="h-16 flex-none bg-cyber-900/60 backdrop-blur-md border-b border-cyber-700/50">
            <div className="container mx-auto px-4 h-full flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                  <span className="text-cyber-500">COROAI</span> CREATOR
                </h1>
                <p className="text-[8px] sm:text-[10px] text-cyber-400/80 tracking-widest uppercase mt-0.5 font-medium">
                    creative intelligence studio
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <nav className="flex items-center gap-1 bg-cyber-900/70 p-1 rounded-lg border border-cyber-700/50 backdrop-blur-sm shadow-lg overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                  <button onClick={() => handleTabChange('create')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'create' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <PlusSquare size={16} /> <span className="hidden sm:inline">CREATE CONCEPT</span>
                  </button>
                   <button onClick={() => handleTabChange('sample')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'sample' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <FlaskConical size={16} /> <span className="hidden sm:inline">CREATE SAMPLE</span>
                  </button>
                  <button onClick={() => handleTabChange('gallery')} className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'gallery' ? 'bg-cyber-500 text-white' : 'text-slate-300 hover:text-white'}`}>
                    <LayoutGrid size={16} /> <span className="hidden sm:inline">GALLERY</span>
                  </button>
                </nav>
                <button 
                    onClick={() => setShowSettings(true)}
                    className={`p-2.5 rounded-lg border transition-all relative
                        ${connectionError 
                            ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse hover:bg-red-500/30' 
                            : 'bg-cyber-800 text-cyber-400 border-cyber-700 hover:bg-cyber-700 hover:text-white'}`}
                    title={connectionError ? "Koneksi Bermasalah (Klik untuk Perbaiki)" : "Database Settings"}
                >
                    {connectionError ? <Unplug size={18} /> : <Settings size={18} />}
                    {connectionError && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>}
                </button>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 overflow-hidden relative">
            <div className="h-full w-full container mx-auto px-4 py-4 md:py-6">
              {activeTab === 'create' ? (
                <CreateView 
                  onSaved={handleSaved} 
                  onError={(msg) => showToast(msg, 'error')}
                  onNavigateToSample={handleNavigateToSample}
                  availableGroups={groups}
                />
              ) : activeTab === 'sample' ? (
                <SampleView onError={(msg) => showToast(msg, 'error')} initialData={sampleInitData} />
              ) : (
                <GalleryView 
                  onCopyToast={(msg) => showToast(msg, 'success')} 
                  onNavigateToSample={handleNavigateToSample}
                  items={galleryItems}
                  setItems={setGalleryItems}
                  isLoaded={isGalleryLoaded}
                  setIsLoaded={setIsGalleryLoaded}
                  availableGroups={groups}
                  onAddGroup={(name) => { handleAddGroup(name); showToast(`Folder "${name}" dibuat.`, 'success'); }}
                  onDeleteGroup={handleDeleteGroup}
                  onRenameGroup={handleRenameGroup}
                  onConnectionError={handleConnectionError}
                />
              )}
            </div>
          </main>
          
          {/* FOOTER */}
          <footer className="flex-none py-2 bg-cyber-900/80 border-t border-cyber-700/30 text-center z-20 backdrop-blur-sm">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                © 2026 CoroAI System. creative intelligence studio
            </p>
          </footer>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 border backdrop-blur-md
          ${toast.type === 'success' ? 'bg-cyber-900/90 border-cyber-500 text-cyber-400' : 'bg-red-950/90 border-red-500 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-6 w-full max-w-md shadow-2xl relative flex flex-col max-h-[90vh]">
                 <button 
                    onClick={() => setShowSettings(false)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white p-2"
                 >
                     ✕
                 </button>
                 <div className="flex items-center gap-3 mb-4 text-cyber-500 flex-none">
                     <div className={`p-2 rounded-lg border ${connectionError ? 'bg-red-900/30 border-red-500 text-red-500' : 'bg-cyber-900 border-cyber-700'}`}>
                        {connectionError ? <Unplug size={24} /> : <Settings size={24}/>}
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-white">Setup Database</h3>
                        <p className="text-[10px] text-slate-400">Google Apps Script Configuration</p>
                     </div>
                 </div>
                 
                 <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                     <div className={`p-3 rounded border text-xs leading-relaxed ${connectionError ? 'bg-red-900/20 border-red-500/30 text-red-200' : 'bg-blue-900/20 border-blue-500/30 text-blue-200'}`}>
                        {connectionError ? (
                            <strong>KONEKSI GAGAL:</strong>
                        ) : (
                            <strong>PENTING:</strong>
                        )} 
                        Pastikan <b>"Nama Tab"</b> di bawah ini SAMA PERSIS dengan nama tab di Spreadsheet Anda (contoh: Sheet1, GalleryData, atau GalleryDataV2).
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-cyber-400 flex items-center gap-1">
                            <LinkIcon size={12} /> Google Script URL
                        </label>
                        <input 
                            type="text" 
                            value={scriptUrl}
                            onChange={(e) => setScriptUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..../exec"
                            className="w-full bg-black/40 border border-cyber-700 rounded p-3 text-sm text-white focus:border-cyber-500 outline-none font-mono"
                        />
                     </div>

                     <div className="space-y-1">
                        <label className="text-xs font-bold text-cyber-400 flex items-center gap-1">
                            <Database size={12} /> Spreadsheet ID
                        </label>
                        <input 
                            type="text" 
                            value={currentSheetId}
                            onChange={(e) => setCurrentSheetId(e.target.value)}
                            placeholder="1w-Mg0r..."
                            className="w-full bg-black/40 border border-cyber-700 rounded p-3 text-sm text-white focus:border-cyber-500 outline-none font-mono"
                        />
                     </div>

                     <div className="space-y-1">
                        <label className="text-xs font-bold text-cyber-400 flex items-center gap-1">
                            <TableProperties size={12} /> Nama Tab (Sheet Name)
                        </label>
                        <input 
                            type="text" 
                            value={currentTabName}
                            onChange={(e) => setCurrentTabName(e.target.value)}
                            placeholder="Sheet1"
                            className="w-full bg-black/40 border border-cyber-700 rounded p-3 text-sm text-white focus:border-cyber-500 outline-none font-mono"
                        />
                        <p className="text-[9px] text-slate-500">Cek nama tab di Spreadsheet Anda. Default sistem: <b>Sheet1</b>.</p>
                     </div>
                     
                     <div className="pt-2 border-t border-cyber-800 mt-2 grid grid-cols-2 gap-2">
                        <button 
                            onClick={handleReScanGroups}
                            className="w-full py-2 bg-cyber-900 hover:bg-cyber-800 border border-cyber-700 text-slate-300 text-xs rounded flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={12} /> Re-Scan Folder
                        </button>
                         <button 
                            onClick={handleResetDefaults}
                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-300 text-xs rounded flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={12} /> Reset Default
                        </button>
                     </div>
                 </div>

                 <div className="flex-none pt-4">
                     <button 
                        onClick={saveSettings}
                        className="w-full py-3 bg-cyber-600 hover:bg-cyber-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
                     >
                        <Save size={16} /> SIMPAN KONEKSI
                     </button>
                 </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default App;