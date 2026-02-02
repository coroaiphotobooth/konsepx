export enum ModelChoice {
  FLASH = "GEMINI_2_5_FLASH",
  PRO = "GEMINI_3_PRO"
}

export enum AspectRatio {
  PORTRAIT = "9:16",
  LANDSCAPE = "16:9",
  PRINT_PORTRAIT = "3:4",
  PRINT_LANDSCAPE = "4:3"
}

export interface GalleryItem {
  id: string;
  createdAt: number;
  modelChoice: ModelChoice;
  aspectRatio: AspectRatio;
  prompt: string;
  title: string;
  group?: string; 
  
  // V2 Optimization: Google Drive Integration
  fileId?: string;       // ID File di Google Drive
  thumbnailUrl?: string; // URL Thumbnail kecil
  downloadUrl?: string;  // URL View/Download asli
  
  // Legacy (V1): Base64 Data (Deprecated for list view)
  resultDataUrl?: string; 
}

export interface GenerateRequest {
  images: string[]; // Base64 strings
  prompt: string;
  aspectRatio: AspectRatio;
  modelChoice: ModelChoice;
}

export interface GenerateResponse {
  resultBase64: string;
  mimeType: string;
  timing: number;
}