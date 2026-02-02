import { ModelChoice, AspectRatio } from './types';

// Model Mapping constants
export const MODEL_MAPPING: Record<ModelChoice, string> = {
  [ModelChoice.FLASH]: 'gemini-2.5-flash-image',
  [ModelChoice.PRO]: 'gemini-3-pro-image-preview',
};

// Friendly Names for UI
export const MODEL_LABELS: Record<ModelChoice, string> = {
  [ModelChoice.FLASH]: 'Gemini 2.5 Flash',
  [ModelChoice.PRO]: 'Gemini 3 Pro',
};

export const RATIO_LABELS: Record<AspectRatio, string> = {
  [AspectRatio.PORTRAIT]: '9:16 (Portrait)',
  [AspectRatio.LANDSCAPE]: '16:9 (Landscape)',
  [AspectRatio.PRINT_PORTRAIT]: '3:4 (Print Portrait)',
  [AspectRatio.PRINT_LANDSCAPE]: '4:3 (Print Landscape)',
};

// Max dimension for client-side resizing
export const MAX_IMAGE_DIMENSION = 1024;
export const JPEG_QUALITY = 0.8;