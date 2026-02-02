import { GalleryItem } from '../types';

// Key untuk menyimpan URL Script & Sheet ID di LocalStorage
// REVERTED TO V4 to match user's previous working configuration
const API_URL_KEY = 'COROAI_GAS_URL_V4';
const SHEET_ID_KEY = 'COROAI_SHEET_ID_V1';
const TAB_NAME_KEY = 'COROAI_TAB_NAME_V2'; 

// DEFAULT CONFIGURATION - REVERTED TO USER'S SCRIPT ID
const DEFAULT_SCRIPT_ID = "AKfycbwUro05PiooVD5zkHkjUYfAeQcSxwHZUvGql0_b3Vnl0yi6raPJGMowGAKUHTr2InDYeg";
const DEFAULT_URL = `https://script.google.com/macros/s/${DEFAULT_SCRIPT_ID}/exec`;

// Set defaults to empty string to avoid overriding backend defaults with wrong IDs
const DEFAULT_SHEET_ID = "";
const DEFAULT_TAB_NAME = ""; 

export const getApiUrl = (): string => {
  return localStorage.getItem(API_URL_KEY) || DEFAULT_URL;
};

export const setApiUrl = (url: string) => {
  localStorage.setItem(API_URL_KEY, url);
};

export const getSheetId = (): string => {
  return localStorage.getItem(SHEET_ID_KEY) || DEFAULT_SHEET_ID;
}

export const setSheetId = (id: string) => {
  localStorage.setItem(SHEET_ID_KEY, id);
}

export const getTabName = (): string => {
  return localStorage.getItem(TAB_NAME_KEY) || DEFAULT_TAB_NAME;
}

export const setTabName = (name: string) => {
  localStorage.setItem(TAB_NAME_KEY, name);
}

const getUrl = () => {
  const url = getApiUrl();
  if (!url) throw new Error("Google Script URL Error.");
  return url;
};

// --- HELPER: Handle Common Backend Errors ---
const handleBackendError = (data: any) => {
  if (data && data.error) {
    if (data.error.includes("getSheetByName") || data.error.includes("null") || data.error.includes("openById")) {
        throw new Error("Backend Error: Gagal membuka Spreadsheet/Tab. Periksa ID dan Nama Tab di Settings.");
    }
    if (data.error.includes("ScriptError")) {
        throw new Error("Backend Error: Terjadi kesalahan internal di Google Script.");
    }
    throw new Error(data.error);
  }
};

// --- API FUNCTIONS ---

export const getGalleryItems = async (page = 1, limit = 50): Promise<GalleryItem[]> => {
  try {
    const sid = getSheetId();
    const tab = getTabName();
    
    // Construct URL conditionally to support old scripts that might break with extra params
    let url = `${getUrl()}?action=get&t=${Date.now()}`;
    
    // Only append if pagination/config is active or needed
    if (page && page > 1) url += `&page=${page}`;
    if (limit && limit !== 50) url += `&limit=${limit}`;
    
    if (sid) url += `&sheetId=${encodeURIComponent(sid)}`;
    if (tab) url += `&tabName=${encodeURIComponent(tab)}`;
    
    console.log("Fetching from:", url); // Debug URL

    const response = await fetch(url, {
      method: 'GET',
    });
    
    const text = await response.text();

    let data;
    try {
        data = JSON.parse(text);
    } catch(e) {
        console.error("JSON Parse Error:", text);
        throw new Error(`Invalid JSON Response. Cek Console Browser.`);
    }

    handleBackendError(data);
    
    // ROBUST DATA EXTRACTION
    let items: GalleryItem[] = [];

    if (Array.isArray(data)) {
        items = data;
    } else if (data && Array.isArray(data.data)) {
        items = data.data; 
    } else if (data && Array.isArray(data.items)) {
        items = data.items;
    } else if (data && Array.isArray(data.result)) {
        items = data.result;
    }

    console.log(`Parsed ${items.length} items from backend.`);
    return items;

  } catch (error: any) {
    console.error("Failed to load gallery:", error);
    if (error.message && error.message.includes("Backend Error")) {
        throw error;
    }
    return [];
  }
};

export const saveGalleryItem = async (item: GalleryItem): Promise<GalleryItem> => {
  // Payload construction
  const payloadObj: any = {
    action: 'save',
    data: JSON.stringify(item)
  };
  
  // Optional params
  const sid = getSheetId();
  if (sid) payloadObj.sheetId = sid;
  
  const tab = getTabName();
  if (tab) payloadObj.tabName = tab;

  const payload = JSON.stringify(payloadObj);

  const url = getUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); 

  try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
        'Content-Type': 'text/plain;charset=utf-8', 
        },
        body: payload,
        signal: controller.signal
    });
    
    const text = await response.text();
    let resData;
    
    try {
        resData = JSON.parse(text);
        handleBackendError(resData);
    } catch (e: any) {
        if (e.message.includes("Backend Error")) throw e;
        // Old script might return non-JSON success message
        const lowerText = text.toLowerCase();
        if (lowerText.includes("error") || lowerText.includes("syntaxerror")) {
             throw new Error("Server Error: " + text.substring(0, 100));
        }
        // If not error and not JSON, assume success for compatibility
        return item;
    }

    return resData.data || resData.item || item;

  } catch (err: any) {
      if (err.name === 'AbortError') {
          throw new Error("Timeout: Upload ke Drive sedang berjalan di background.");
      }
      throw err;
  } finally {
      clearTimeout(timeoutId);
  }
};

export const deleteGalleryItem = async (id: string, fileId?: string): Promise<void> => {
  const sid = getSheetId();
  const tab = getTabName();
  
  let url = `${getUrl()}?action=delete&id=${encodeURIComponent(id)}`;
  if (sid) url += `&sheetId=${encodeURIComponent(sid)}`;
  if (tab) url += `&tabName=${encodeURIComponent(tab)}`;
  if (fileId) url += `&fileId=${encodeURIComponent(fileId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); 

  try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      const text = await response.text();
      try {
          const resData = JSON.parse(text);
          handleBackendError(resData);
      } catch (e: any) {
           if (e.message.includes("Backend Error")) throw e;
      }
  } catch (err: any) {
      throw err;
  } finally {
      clearTimeout(timeoutId);
  }
};

export const exportGalleryData = async () => "";
export const importGalleryData = async () => 0;