import { GoogleGenAI } from "@google/genai";
import { GenerateRequest, GenerateResponse } from '../types';
import { MODEL_MAPPING } from '../constants';

export const generateConcept = async (params: GenerateRequest): Promise<GenerateResponse> => {
  // MODE 1: Client-Side Generation
  // Digunakan jika process.env.API_KEY tersedia (misal: development lokal dengan file .env)
  if (process.env.API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = MODEL_MAPPING[params.modelChoice];

      // Prepare Content Parts
      const parts: any[] = [{ text: params.prompt }];
      params.images.forEach((imgDataUrl) => {
        const matches = imgDataUrl.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
            parts.push({
              inlineData: {
                data: matches[2],
                mimeType: matches[1]
              }
            });
        }
      });

      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: parts },
        config: {
          imageConfig: { aspectRatio: params.aspectRatio }
        }
      });
      const endTime = Date.now();

      // Extract Image
      let resultBase64 = '';
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
          const content = candidates[0].content;
          if (content && content.parts) {
              for (const part of content.parts) {
                  if (part.inlineData && part.inlineData.data) {
                      const mime = part.inlineData.mimeType || 'image/png';
                      resultBase64 = `data:${mime};base64,${part.inlineData.data}`;
                      break;
                  }
              }
          }
      }

      if (!resultBase64) {
          throw new Error('Gagal menghasilkan gambar (Empty Response from Client SDK).');
      }

      return {
        resultBase64: resultBase64,
        mimeType: 'image/png',
        timing: endTime - startTime
      };

    } catch (error: any) {
      console.error("Gemini Client SDK Error:", error);
      throw new Error(error.message || "Gagal menghubungkan ke Gemini (Client).");
    }
  }

  // MODE 2: Server-Side Generation (Vercel Proxy)
  // Digunakan jika process.env.API_KEY tidak ada (Deployment Production di Vercel)
  try {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: params.images,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        modelName: MODEL_MAPPING[params.modelChoice]
      }),
    });

    if (!response.ok) {
      let errorMsg = `Server Error (${response.status})`;
      try {
        const errData = await response.json();
        if (errData.error) errorMsg = errData.error;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data as GenerateResponse;

  } catch (error: any) {
    console.error("Gemini API Route Error:", error);
    let msg = error.message || "Gagal menghubungkan ke Server.";
    if (msg.includes('413')) msg = "Ukuran gambar terlalu besar untuk diproses server.";
    if (msg.includes('504')) msg = "Timeout: Server lambat merespon (Vercel limit).";
    throw new Error(msg);
  }
};