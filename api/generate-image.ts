import { GoogleGenAI } from "@google/genai";

// A) FIX UTAMA: Pindah ke Node Runtime & Set Max Duration
export const config = {
  maxDuration: 60, // Izinkan proses hingga 60 detik (Vercel Pro/Hobby Node limit)
  api: {
    bodyParser: {
      sizeLimit: '12mb', // Batas payload upload (estimasi 3 gambar @ 3-4MB)
    },
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req: any, res: any) {
  const timings: Record<string, number> = {
    start: Date.now(),
  };

  // Helper untuk kirim error response
  const sendError = (status: number, message: string) => {
    res.status(status).json({ error: message });
  };

  if (req.method !== 'POST') {
    return sendError(405, 'Method not allowed');
  }

  try {
    timings.parseStart = Date.now();
    const { images, prompt, aspectRatio, modelName } = req.body;
    timings.parseEnd = Date.now();

    // 1. Security & Validation (Guardrails)
    if (!process.env.GEMINI_API_KEY) {
      return sendError(500, 'Server misconfiguration: API Key missing');
    }

    if (!prompt || typeof prompt !== 'string') {
      return sendError(400, 'Prompt is required');
    }

    // C) Validasi Multi-Image (1-3 Gambar)
    if (!images || !Array.isArray(images) || images.length === 0) {
      return sendError(400, 'Minimal 1 gambar referensi diperlukan.');
    }

    if (images.length > 3) {
      return sendError(400, 'Maksimal 3 gambar referensi (Subject, Outfit, Background).');
    }

    // C) Validasi Payload Size (Kasar)
    const payloadSize = JSON.stringify(images).length;
    if (payloadSize > 12 * 1024 * 1024) {
      return sendError(413, 'Total ukuran gambar terlalu besar. Mohon resize/kompres gambar sebelum upload.');
    }

    // 2. Prompt Engineering untuk Multi-Image
    // Aturan:
    // Img 1: Main Subject (Identity)
    // Img 2: Outfit Reference (If exists)
    // Img 3: Background/Environment (If exists)
    let finalPrompt = prompt;
    let roleDescription = "";
    
    if (images.length === 1) {
        roleDescription = " The provided image is the main visual reference/subject.";
    } else if (images.length === 2) {
        roleDescription = " Image 1 is the MAIN SUBJECT (preserve identity/face). Image 2 is the STYLE/BACKGROUND reference.";
    } else if (images.length >= 3) {
        roleDescription = " Image 1 is the MAIN SUBJECT (preserve identity/face). Image 2 is the OUTFIT/CLOTHING reference. Image 3 is the BACKGROUND/ENVIRONMENT reference.";
    }
    
    const systemInstruction = `You are a cinematic concept artist. ${roleDescription} Blend these elements naturally into a single cohesive high-quality image based on the following description: `;
    
    // Gabungkan instruction dengan prompt user
    const textPart = { text: systemInstruction + finalPrompt };

    // 3. Prepare Content Parts dengan Dynamic MimeType
    const parts: any[] = [textPart];

    images.forEach((imgDataUrl: string) => {
      // Deteksi MimeType (support png, jpeg, webp, heic)
      const match = imgDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      
      let mimeType = 'image/jpeg'; // Default fallback
      let base64Data = imgDataUrl;

      if (match && match.length === 3) {
          mimeType = match[1];
          base64Data = match[2];
      } else {
          // Jika dikirim raw base64 tanpa prefix (jarang terjadi di app ini tapi jaga-jaga)
          base64Data = imgDataUrl.replace(/^data:image\/\w+;base64,/, "");
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    });

    // 4. Initialize Gemini (Node Runtime)
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // D) Retry Logic untuk 503 / Overloaded
    let resultBase64 = '';
    let attempt = 0;
    const maxRetries = 2; // Total try = 1 + 2 = 3

    timings.geminiStart = Date.now();
    
    while (attempt <= maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: modelName || 'gemini-3-pro-image-preview',
          contents: { parts: parts },
          config: {
            imageConfig: { aspectRatio: aspectRatio }
          }
        });

        // Extract Image
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            const content = candidates[0].content;
            if (content && content.parts) {
                for (const part of content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        resultBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                        break;
                    }
                }
            }
        }
        
        // Jika sukses dan dapat gambar, keluar loop
        if (resultBase64) break;
        
        // Jika response sukses tapi kosong (jarang)
        throw new Error('No image generated by model (Empty Response)');

      } catch (err: any) {
        const msg = err.message || '';
        const isOverloaded = msg.includes('503') || msg.includes('overloaded') || msg.includes('resource exhausted');
        
        if (isOverloaded && attempt < maxRetries) {
          console.warn(`Gemini overloaded (Attempt ${attempt + 1}/${maxRetries + 1}). Retrying...`);
          // Backoff: 1000ms, 2000ms
          await wait(1000 * (attempt + 1));
          attempt++;
          continue;
        }
        
        // Jika error lain (400, 401, dll) atau sudah max retry, lempar error
        throw err;
      }
    }
    
    timings.geminiEnd = Date.now();

    if (!resultBase64) {
       return sendError(500, 'Gagal menghasilkan gambar setelah beberapa percobaan.');
    }

    // 5. Return Response
    const totalDuration = Date.now() - timings.start;
    
    res.status(200).json({
      resultBase64,
      mimeType: 'image/png',
      timing: totalDuration,
      debug: {
        parsing: timings.parseEnd - timings.parseStart,
        generation: timings.geminiEnd - timings.geminiStart,
        retries: attempt
      }
    });

  } catch (error: any) {
    console.error("Server Generation Error:", error);
    // Pastikan error message aman dan informatif
    const msg = error.message || 'Internal Server Error';
    const status = msg.includes('413') ? 413 : 500;
    res.status(status).json({ error: msg });
  }
}