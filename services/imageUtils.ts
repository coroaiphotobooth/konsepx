import { MAX_IMAGE_DIMENSION, JPEG_QUALITY } from '../constants';

/**
 * Resizes an image file to a maximum dimension while maintaining aspect ratio.
 * Returns a base64 string (including data URI prefix).
 * @param file The image file to resize.
 * @param preserveTransparency If true, outputs as PNG to keep alpha channel. Default is false (JPEG).
 */
export const resizeImage = (file: File, preserveTransparency = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_IMAGE_DIMENSION) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          }
        } else {
          if (height > MAX_IMAGE_DIMENSION) {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Determine output format
        const type = preserveTransparency ? 'image/png' : 'image/jpeg';
        const quality = type === 'image/jpeg' ? JPEG_QUALITY : undefined;

        const dataUrl = canvas.toDataURL(type, quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Compresses a Base64 string for storage efficiency.
 * Resizes to a smaller max dimension (e.g. 800px) and converts to JPEG.
 */
export const compressBase64Image = (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Canvas context failed"));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Force output as JPEG with lower quality for storage efficiency
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = base64Str;
  });
};

export const cleanBase64 = (dataUrl: string): string => {
  return dataUrl.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
};

/**
 * Merges two images: A base image and an overlay image.
 * The overlay is stretched to fit the base image dimensions.
 */
export const overlayImages = (baseDataUrl: string, overlayDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    baseImg.onload = () => {
      const overlayImg = new Image();
      overlayImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        // Draw Base
        ctx.drawImage(baseImg, 0, 0);
        // Draw Overlay (stretched to fit base)
        ctx.drawImage(overlayImg, 0, 0, baseImg.width, baseImg.height);

        resolve(canvas.toDataURL('image/png'));
      };
      overlayImg.onerror = reject;
      overlayImg.src = overlayDataUrl;
    };
    baseImg.onerror = reject;
    baseImg.src = baseDataUrl;
  });
};

/**
 * Creates a side-by-side comparison image.
 * Left: Original (Before) - CENTER CROPPED to match After ratio.
 * Right: Result (After).
 */
export const createBeforeAfter = (beforeDataUrl: string, afterDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const afterImg = new Image();
    afterImg.onload = () => {
      const beforeImg = new Image();
      beforeImg.onload = () => {
        // Target dimensions (based on the AI result)
        const targetWidth = afterImg.width;
        const targetHeight = afterImg.height;
        const targetRatio = targetWidth / targetHeight;

        // Source dimensions
        const sourceWidth = beforeImg.width;
        const sourceHeight = beforeImg.height;
        const sourceRatio = sourceWidth / sourceHeight;

        // Calculate Crop Coordinates (Center Crop)
        let sX = 0, sY = 0, sW = sourceWidth, sH = sourceHeight;

        if (sourceRatio > targetRatio) {
          // Source is wider than target: Crop width (cut sides)
          sW = sourceHeight * targetRatio;
          sX = (sourceWidth - sW) / 2;
        } else {
          // Source is taller than target: Crop height (cut top/bottom)
          sH = sourceWidth / targetRatio;
          sY = (sourceHeight - sH) / 2;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth * 2; // Double width
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Canvas context failed"));
          return;
        }

        // Draw Before (Cropped) -> Placed on Left
        // drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
        ctx.drawImage(beforeImg, sX, sY, sW, sH, 0, 0, targetWidth, targetHeight);
        
        // Draw After -> Placed on Right
        ctx.drawImage(afterImg, 0, 0, targetWidth, targetHeight, targetWidth, 0, targetWidth, targetHeight);

        // Optional: Draw a separator line
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(targetWidth - 2, 0, 4, targetHeight);

        resolve(canvas.toDataURL('image/png'));
      };
      beforeImg.onerror = reject;
      beforeImg.src = beforeDataUrl;
    };
    afterImg.onerror = reject;
    afterImg.src = afterDataUrl;
  });
};