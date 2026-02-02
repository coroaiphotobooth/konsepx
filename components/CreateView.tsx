import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Wand2, Download, Save, RefreshCw, Clock, FlaskConical, Folder } from 'lucide-react';
import { AspectRatio, ModelChoice, GenerateResponse, GalleryItem } from '../types';
import { MODEL_LABELS, RATIO_LABELS } from '../constants';
import { resizeImage, compressBase64Image } from '../services/imageUtils';
import { generateConcept } from '../services/geminiService';
import { saveGalleryItem } from '../services/storageService';

// Simple ID generator helper inside component
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface CreateViewProps {
  onSaved: (item?: GalleryItem) => void;
  onError: (msg: string) => void;
  onNavigateToSample: (data: { prompt: string; aspectRatio: AspectRatio; modelChoice: ModelChoice }) => void;
  availableGroups: string[];
}

const CreateView: React.FC<CreateViewProps> = ({ onSaved, onError, onNavigateToSample, availableGroups }) => {
  // State
  const [images, setImages] = useState<string[]>([]); // DataURLs
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT);
  const [modelChoice, setModelChoice] = useState<ModelChoice>(ModelChoice.FLASH);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const remainingSlots = 10 - images.length;
      const filesToProcess = files.slice(0, remainingSlots);

      if (filesToProcess.length === 0) return;

      try {
        const resizedPromises = filesToProcess.map(file => resizeImage(file));
        const resizedImages = await Promise.all(resizedPromises);
        setImages(prev => [...prev, ...resizedImages]);
      } catch (err) {
        onError("Gagal memproses gambar. Pastikan format didukung.");
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setImages([]);
    setPrompt('');
    setResult(null);
    setIsSaved(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || images.length === 0) return;

    setIsGenerating(true);
    setResult(null);
    setIsSaved(false);

    try {
      const response = await generateConcept({
        images,
        prompt,
        aspectRatio,
        modelChoice
      });
      setResult(response);
    } catch (err: any) {
      onError(err.message || "Gagal melakukan generate.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInitSave = () => {
    if (!result) return;
    setSaveTitle('');
    setSelectedGroup('');
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!result) return;
    if (!saveTitle.trim()) {
        onError("Judul konsep tidak boleh kosong");
        return;
    }

    setIsSaving(true);
    
    try {
      // COMPRESS IMAGE BEFORE SAVING
      // Resize to max 800px width/height and quality 0.7
      const compressedImage = await compressBase64Image(result.resultBase64, 800, 0.7);

      const newItem: GalleryItem = {
        id: generateId(),
        createdAt: Date.now(),
        modelChoice,
        aspectRatio,
        prompt,
        resultDataUrl: compressedImage, // Save the compressed version
        title: saveTitle.trim(),
        group: selectedGroup || undefined // Simpan group
      };

      await saveGalleryItem(newItem);
      
      setIsSaved(true);
      setShowSaveModal(false);
      onSaved(newItem); // Trigger toast in parent and update state
    } catch (e) {
      console.error(e);
      onError("Gagal menyimpan ke database (Timeout/Network Error).");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = result.resultBase64;
    link.download = `coroai-concept-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isValid = prompt.trim().length > 0 && images.length > 0;

  return (
    <div className="h-full w-full flex flex-col lg:grid lg:grid-cols-2 gap-2 lg:gap-4 overflow-hidden">
      
      {/* 
        PANEL 1: SETTINGS 
        Mobile: Top Half (flex-1)
        Desktop: Left Half (col-span-1)
        Fit Logic: flex-1 ensures it shares space equally or fills available. min-h-0 prevents overflow.
      */}
      <div className="flex-1 flex flex-col min-h-0 bg-cyber-800/50 border border-cyber-700 rounded-xl overflow-hidden shadow-lg">
        
        {/* Scrollable Content Container (Hidden Scrollbar) */}
        <div className="flex-1 flex flex-col p-3 gap-3 min-h-0">
            
            {/* 1. UPLOAD (Horizontal List to save vertical space) */}
            <div className="flex-none space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-cyber-400 font-bold text-[10px] uppercase flex items-center gap-2">
                        <ImageIcon size={12} /> Referensi ({images.length}/10)
                    </h3>
                </div>
                
                {/* Horizontal Scroll Area */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 h-16 sm:h-20 items-center">
                    {/* Add Button */}
                    {images.length < 10 && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-none aspect-square h-full rounded-md border border-dashed border-cyber-500/50 hover:border-cyber-400 hover:bg-cyber-500/10 flex flex-col items-center justify-center text-cyber-500 transition-all"
                        >
                            <Upload size={18} />
                        </button>
                    )}

                    {images.map((img, idx) => (
                        <div key={idx} className="relative group flex-none aspect-square h-full rounded-md overflow-hidden border border-cyber-600 bg-black/40">
                            <img src={img} alt="upload" className="w-full h-full object-cover" />
                            <button 
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-0 right-0 p-1 bg-red-500/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    
                    {images.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-[10px] text-slate-500 italic border border-cyber-800 rounded-md h-full">
                            Geser & Upload Foto
                        </div>
                    )}
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    multiple 
                    accept="image/*"
                />
            </div>

            {/* 2. SETTINGS GRID */}
            <div className="flex-none grid grid-cols-2 gap-2">
                {/* Ratio */}
                <div className="space-y-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase block">Ratio</label>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`px-1 py-1.5 rounded border text-[10px] font-medium truncate text-center
                                    ${aspectRatio === ratio 
                                        ? 'border-cyber-500 bg-cyber-500/10 text-cyber-400' 
                                        : 'border-cyber-700 bg-cyber-900/40 text-slate-400'}`}
                            >
                                {RATIO_LABELS[ratio].split('(')[0].trim()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Model */}
                <div className="space-y-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase block">Model</label>
                    <div className="flex flex-col gap-1 h-full">
                        {Object.values(ModelChoice).map((model) => (
                            <button
                                key={model}
                                onClick={() => setModelChoice(model)}
                                className={`flex-1 px-1 rounded border text-[10px] font-medium flex items-center justify-center
                                    ${modelChoice === model 
                                        ? 'border-cyber-500 bg-cyber-500/10 text-cyber-400' 
                                        : 'border-cyber-700 bg-cyber-900/40 text-slate-400'}`}
                            >
                                {MODEL_LABELS[model].replace('Gemini ', '')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. PROMPT (Fills remaining space) */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase">Prompt</label>
                    {prompt && (
                        <button onClick={() => setPrompt('')} className="text-[10px] text-slate-500 hover:text-red-400">
                            Clear
                        </button>
                    )}
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Deskripsi konsep..."
                    className="flex-1 w-full bg-cyber-900/80 border border-cyber-700 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:border-cyber-500 outline-none resize-none placeholder-slate-600 custom-scrollbar"
                />
            </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="flex-none p-3 border-t border-cyber-700 bg-cyber-900/50 flex gap-2">
             <button
                onClick={handleReset}
                disabled={isGenerating}
                className="px-3 py-2 rounded-lg border border-cyber-700 text-slate-400 hover:text-white transition-all"
            >
                <RefreshCw size={16} />
            </button>
            <button
                onClick={handleGenerate}
                disabled={!isValid || isGenerating}
                className={`flex-1 px-4 py-2 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 text-sm
                    ${!isValid || isGenerating 
                        ? 'bg-slate-800 cursor-not-allowed text-slate-500' 
                        : 'bg-gradient-to-r from-cyber-600 to-blue-600 hover:shadow-cyber-500/25'}`}
            >
                {isGenerating ? (
                    <>
                        <RefreshCw size={14} className="animate-spin" /> Generating...
                    </>
                ) : (
                    <>
                        <Wand2 size={14} /> GENERATE
                    </>
                )}
            </button>
        </div>
      </div>

      {/* 
        PANEL 2: RESULT
        Mobile: Bottom Half (flex-1)
        Desktop: Right Half (col-span-1)
      */}
      <div className="flex-1 flex flex-col min-h-0 bg-cyber-800/50 border border-cyber-700 rounded-xl overflow-hidden relative shadow-2xl">
        
        {/* Main Image Canvas */}
        <div className="flex-1 bg-cyber-900/50 relative overflow-hidden flex items-center justify-center min-h-0">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            {result ? (
                <div className="relative w-full h-full p-2 flex items-center justify-center">
                    <img 
                        src={result.resultBase64} 
                        alt="Result" 
                        className="max-w-full max-h-full object-contain rounded-md shadow-lg border border-white/5"
                    />
                </div>
            ) : (
                <div className="text-center text-slate-500 p-4">
                    {isGenerating ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-cyber-500 border-t-transparent animate-spin"></div>
                            <p className="text-xs text-cyber-400 animate-pulse">Rendering...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center opacity-40">
                            <ImageIcon size={24} className="mb-2" />
                            <p className="text-xs">Preview</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Bottom Bar: Stats & Actions */}
        {result && (
            <div className="flex-none p-2 bg-cyber-900/90 backdrop-blur-md border-t border-cyber-700 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="text-cyber-400">{MODEL_LABELS[modelChoice].replace('Gemini ', '')}</span>
                    <span className="opacity-50">|</span>
                    <span>{RATIO_LABELS[aspectRatio].split('(')[0]}</span>
                    <span className="opacity-50">|</span>
                    <span className="flex items-center gap-0.5"><Clock size={10} /> {(result.timing / 1000).toFixed(1)}s</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* BUTTON BUAT SAMPLE */}
                     <button
                        onClick={() => onNavigateToSample({ prompt, aspectRatio, modelChoice })}
                        className="px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 bg-cyber-600/20 text-cyber-400 border border-cyber-500/30 hover:bg-cyber-500/30 transition-colors"
                        title="Gunakan prompt ini untuk membuat sample"
                    >
                        <FlaskConical size={12} /> BUAT SAMPLE
                    </button>

                    <button
                        onClick={handleInitSave}
                        disabled={isSaved}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1
                            ${isSaved ? 'text-green-500' : 'bg-cyber-500/10 text-cyber-400 border border-cyber-500/30'}`}
                    >
                        <Save size={12} /> {isSaved ? 'OK' : 'Save'}
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-3 py-1.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1"
                    >
                        <Download size={12} />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* SAVE MODAL */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 rounded-xl">
            <div className="bg-cyber-900 border border-cyber-500 rounded-xl p-4 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Save size={18} className="text-cyber-500"/> Simpan Konsep
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-cyber-400 font-bold uppercase block mb-1">Nama Project</label>
                        <input 
                            type="text" 
                            autoFocus
                            value={saveTitle}
                            onChange={(e) => setSaveTitle(e.target.value)}
                            placeholder="Judul..."
                            className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none"
                        />
                    </div>

                    <div>
                         <label className="text-[10px] text-cyber-400 font-bold uppercase block mb-1">Group (Folder)</label>
                         <div className="relative">
                            <select 
                                value={selectedGroup} 
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="w-full bg-cyber-800 border border-cyber-700 rounded-lg p-2 text-sm text-white focus:border-cyber-500 outline-none appearance-none"
                            >
                                <option value="">Tanpa Group</option>
                                {availableGroups.map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                             <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-cyber-500">
                                <Folder size={14} />
                             </div>
                         </div>
                    </div>

                    <div className="flex gap-2 justify-end mt-4">
                        <button onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 rounded text-xs text-slate-400">Batal</button>
                        <button onClick={handleConfirmSave} disabled={isSaving} className="px-4 py-1.5 rounded text-xs bg-cyber-500 text-white font-bold disabled:opacity-50">
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CreateView;