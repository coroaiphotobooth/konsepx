import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Wand2, Download, RefreshCw, Layers, SplitSquareHorizontal } from 'lucide-react';
import { AspectRatio, ModelChoice, GenerateResponse } from '../types';
import { MODEL_LABELS, RATIO_LABELS } from '../constants';
import { resizeImage, overlayImages, createBeforeAfter } from '../services/imageUtils';
import { generateConcept } from '../services/geminiService';

interface SampleViewProps {
  onError: (msg: string) => void;
  initialData?: {
    prompt: string;
    aspectRatio: AspectRatio;
    modelChoice: ModelChoice;
  } | null;
}

const SampleView: React.FC<SampleViewProps> = ({ onError, initialData }) => {
  // Input State
  const [images, setImages] = useState<string[]>([]); // Ref Images
  const [frameImage, setFrameImage] = useState<string | null>(null); // Overlay Frame
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT);
  const [modelChoice, setModelChoice] = useState<ModelChoice>(ModelChoice.FLASH);
  
  // Processing State
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Result State
  // We store the "Final" image (AI + Overlay) and the "Compare" image (Before + After)
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [compareImage, setCompareImage] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'single' | 'compare'>('single');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);

  // Effect to load initial data if provided (from CreateView)
  useEffect(() => {
    if (initialData) {
        setPrompt(initialData.prompt);
        setAspectRatio(initialData.aspectRatio);
        setModelChoice(initialData.modelChoice);
        // We leave images empty intentionally as requested
    }
  }, [initialData]);

  // Handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const remainingSlots = 1 - images.length; // Limit to 1 for Before/After logic simplicity, but let's keep array for robust prompt
      const filesToProcess = files.slice(0, 10); // Allow multiple for prompt context, but first one is used for "Before"

      if (filesToProcess.length === 0) return;

      try {
        const resizedPromises = filesToProcess.map(file => resizeImage(file, false)); // False = JPEG (Ref images)
        const resizedImages = await Promise.all(resizedPromises);
        setImages(prev => [...prev, ...resizedImages]);
      } catch (err) {
        onError("Gagal memproses gambar ref.");
      }
    }
  };

  const handleFrameUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        // Force preserveTransparency=true for Frame/Overlay to keep PNG alpha channel
        const base64 = await resizeImage(e.target.files[0], true);
        setFrameImage(base64);
      } catch (err) {
        onError("Gagal memproses gambar frame.");
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setImages([]);
    setFrameImage(null);
    setPrompt('');
    setFinalImage(null);
    setCompareImage(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || images.length === 0) return;

    setIsGenerating(true);
    setFinalImage(null);
    setCompareImage(null);
    setActiveResultTab('single');

    try {
      // 1. Generate AI Image
      const response: GenerateResponse = await generateConcept({
        images,
        prompt,
        aspectRatio,
        modelChoice
      });

      let processedImage = response.resultBase64;

      // 2. If Frame exists, Overlay it
      if (frameImage) {
        processedImage = await overlayImages(processedImage, frameImage);
      }

      setFinalImage(processedImage);

      // 3. Create Before/After Comparison
      // Use the first reference image as "Before"
      if (images.length > 0) {
        const compare = await createBeforeAfter(images[0], processedImage);
        setCompareImage(compare);
      }

    } catch (err: any) {
      onError(err.message || "Gagal melakukan generate.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (dataUrl: string | null, prefix: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `coroai-${prefix}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isValid = prompt.trim().length > 0 && images.length > 0;

  return (
    <div className="h-full w-full flex flex-col lg:grid lg:grid-cols-2 gap-2 lg:gap-4 overflow-hidden">
      
      {/* LEFT PANEL: INPUTS */}
      <div className="flex-1 flex flex-col min-h-0 bg-cyber-800/50 border border-cyber-700 rounded-xl overflow-hidden shadow-lg">
        <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-y-auto custom-scrollbar">
            
            {/* 1. REFERENCE & FRAME UPLOAD */}
            <div className="grid grid-cols-2 gap-2 flex-none">
                {/* Reference Images */}
                <div className="bg-cyber-900/40 p-2 rounded border border-cyber-700/50">
                     <h3 className="text-cyber-400 font-bold text-[10px] uppercase mb-2 flex items-center gap-1">
                        <ImageIcon size={12} /> Referensi
                    </h3>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar h-20 items-center">
                        {images.length < 5 && (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-none aspect-square h-full rounded-md border border-dashed border-cyber-500/50 hover:bg-cyber-500/10 text-cyber-500 flex items-center justify-center"
                            >
                                <Upload size={16} />
                            </button>
                        )}
                        {images.map((img, idx) => (
                            <div key={idx} className="relative flex-none aspect-square h-full rounded-md overflow-hidden bg-black">
                                <img src={img} alt="ref" className="w-full h-full object-cover" />
                                <button onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 p-0.5 bg-red-500 text-white"><X size={10}/></button>
                            </div>
                        ))}
                         <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple accept="image/*" />
                    </div>
                </div>

                {/* Frame Upload */}
                <div className="bg-cyber-900/40 p-2 rounded border border-cyber-700/50">
                    <h3 className="text-cyber-400 font-bold text-[10px] uppercase mb-2 flex items-center gap-1">
                        <Layers size={12} /> Upload Frame
                    </h3>
                    <div className="h-20 w-full flex items-center justify-center">
                        {frameImage ? (
                            <div className="relative h-full aspect-square group bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-slate-800">
                                {/* Use bg-pattern or checkboard to show transparency */}
                                <img src={frameImage} alt="frame" className="h-full w-full object-contain border border-cyber-600 rounded" />
                                <button onClick={() => setFrameImage(null)} className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full text-white shadow-sm hover:scale-110 transition-transform"><X size={10}/></button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => frameInputRef.current?.click()}
                                className="w-full h-full rounded-md border border-dashed border-cyber-500/50 hover:bg-cyber-500/10 text-cyber-500 flex flex-col items-center justify-center gap-1 text-[10px]"
                            >
                                <Upload size={16} />
                                <span>Pilih PNG</span>
                            </button>
                        )}
                        <input type="file" ref={frameInputRef} onChange={handleFrameUpload} className="hidden" accept="image/png" />
                    </div>
                </div>
            </div>

            {/* 2. SETTINGS */}
            <div className="flex-none grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase block">Ratio</label>
                    <div className="grid grid-cols-2 gap-1">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`px-1 py-1.5 rounded border text-[10px] font-medium truncate text-center
                                    ${aspectRatio === ratio ? 'border-cyber-500 bg-cyber-500/10 text-cyber-400' : 'border-cyber-700 bg-cyber-900/40 text-slate-400'}`}
                            >
                                {RATIO_LABELS[ratio].split('(')[0].trim()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase block">Model</label>
                    <div className="flex flex-col gap-1 h-full">
                        {Object.values(ModelChoice).map((model) => (
                            <button
                                key={model}
                                onClick={() => setModelChoice(model)}
                                className={`flex-1 px-1 rounded border text-[10px] font-medium flex items-center justify-center
                                    ${modelChoice === model ? 'border-cyber-500 bg-cyber-500/10 text-cyber-400' : 'border-cyber-700 bg-cyber-900/40 text-slate-400'}`}
                            >
                                {MODEL_LABELS[model].replace('Gemini ', '')}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. PROMPT */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-cyber-400 font-bold text-[10px] uppercase">Prompt</label>
                    {prompt && <button onClick={() => setPrompt('')} className="text-[10px] text-slate-500 hover:text-red-400">Clear</button>}
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Deskripsi konsep..."
                    className="flex-1 w-full bg-cyber-900/80 border border-cyber-700 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:border-cyber-500 outline-none resize-none placeholder-slate-600 custom-scrollbar"
                />
            </div>
        </div>

        {/* ACTIONS */}
        <div className="flex-none p-3 border-t border-cyber-700 bg-cyber-900/50 flex gap-2">
            <button onClick={handleReset} disabled={isGenerating} className="px-3 py-2 rounded-lg border border-cyber-700 text-slate-400 hover:text-white transition-all">
                <RefreshCw size={16} />
            </button>
            <button
                onClick={handleGenerate}
                disabled={!isValid || isGenerating}
                className={`flex-1 px-4 py-2 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 text-sm
                    ${!isValid || isGenerating ? 'bg-slate-800 cursor-not-allowed text-slate-500' : 'bg-gradient-to-r from-cyber-600 to-blue-600 hover:shadow-cyber-500/25'}`}
            >
                {isGenerating ? <><RefreshCw size={14} className="animate-spin" /> Processing...</> : <><Wand2 size={14} /> GENERATE SAMPLE</>}
            </button>
        </div>
      </div>

      {/* RIGHT PANEL: RESULTS */}
      <div className="flex-1 flex flex-col min-h-0 bg-cyber-800/50 border border-cyber-700 rounded-xl overflow-hidden relative shadow-2xl">
         {/* RESULT TABS */}
         <div className="flex-none border-b border-cyber-700 bg-cyber-900/60 flex">
            <button 
                onClick={() => setActiveResultTab('single')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors
                    ${activeResultTab === 'single' ? 'text-cyber-400 bg-cyber-800/50 border-b-2 border-cyber-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Layers size={14} /> Foto + Frame
            </button>
            <button 
                onClick={() => setActiveResultTab('compare')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors
                    ${activeResultTab === 'compare' ? 'text-cyber-400 bg-cyber-800/50 border-b-2 border-cyber-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <SplitSquareHorizontal size={14} /> Before / After
            </button>
         </div>

         {/* RESULT CANVAS */}
         <div className="flex-1 bg-cyber-900/50 relative overflow-hidden flex items-center justify-center min-h-0">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            {finalImage ? (
                <div className="relative w-full h-full p-4 flex items-center justify-center">
                    {activeResultTab === 'single' ? (
                        <img 
                            src={finalImage} 
                            alt="Final Result" 
                            className="max-w-full max-h-full object-contain rounded-md shadow-2xl border border-white/5"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center overflow-auto">
                             <img 
                                src={compareImage || ""} 
                                alt="Before After" 
                                className="max-w-full max-h-full object-contain rounded-md shadow-2xl border border-white/5"
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center text-slate-500 p-4">
                    {isGenerating ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-cyber-500 border-t-transparent animate-spin"></div>
                            <p className="text-xs text-cyber-400 animate-pulse">Compositing...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center opacity-40">
                            <ImageIcon size={24} className="mb-2" />
                            <p className="text-xs">Preview Area</p>
                        </div>
                    )}
                </div>
            )}
         </div>

         {/* RESULT ACTIONS */}
         {finalImage && (
            <div className="flex-none p-3 bg-cyber-900/90 backdrop-blur-md border-t border-cyber-700 flex items-center justify-between">
                <div className="text-[10px] text-slate-400">
                    Mode: <span className="text-cyber-400 font-bold">{activeResultTab === 'single' ? 'Hasil + Overlay' : 'Perbandingan'}</span>
                </div>
                <button
                    onClick={() => handleDownload(
                        activeResultTab === 'single' ? finalImage : compareImage, 
                        activeResultTab === 'single' ? 'result' : 'compare'
                    )}
                    className="px-4 py-2 rounded-lg font-bold text-xs bg-cyber-500 hover:bg-cyber-400 text-cyber-900 shadow-lg shadow-cyber-500/20 flex items-center gap-2 transition-all"
                >
                    <Download size={14} /> 
                    DOWNLOAD {activeResultTab === 'single' ? 'FOTO' : 'BEFORE/AFTER'}
                </button>
            </div>
         )}
      </div>
    </div>
  );
};

export default SampleView;