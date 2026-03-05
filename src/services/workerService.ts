import { AppBlueprint, FeatureDNA } from "../types";
import ArchiveWorker from "../workers/archiveProcessor.worker?worker";

export interface WorkerProgress {
  status: string;
  progress: number;
}

export const workerService = {
  processArchive: async (
    file: Blob, 
    analyze: boolean, 
    onProgress?: (p: WorkerProgress) => void,
    oldFeatures?: FeatureDNA[],
    customApiKey?: string
  ): Promise<{ fileMap: Record<string, string>, blueprint?: AppBlueprint, analysisError?: string }> => {
    return new Promise(async (resolve, reject) => {
      const worker = new ArchiveWorker();
      
      // Prioritize the Custom API Key if provided by the user
      let apiKey = customApiKey;
      let keySource = "Custom (User)";

      // If no custom key, fall back to System/Environment keys
      if (!apiKey || apiKey.trim() === '') {
        apiKey = process.env.GEMINI_API_KEY || 
                 import.meta.env.VITE_GEMINI_API_KEY || 
                 import.meta.env.GEMINI_API_KEY || 
                 (window as any).GEMINI_API_KEY;
        keySource = "System (Env)";
      }

      if (apiKey) {
        apiKey = apiKey.trim();
        // Recursively remove wrapping quotes until none are left
        while ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
          apiKey = apiKey.slice(1, -1);
        }
        
        // Additional cleanup for common copy-paste errors
        apiKey = apiKey.replace(/\\n/g, '').replace(/\n/g, '').trim();
      }

      // If analysis is requested, we check if we have a valid key.
      // Relaxed check: just ensure it's a non-empty string
      const hasValidKey = !!apiKey && apiKey.length > 0;
      const shouldAnalyze = analyze && hasValidKey;

      if (analyze) {
        if (hasValidKey) {
            console.log(`Starting AI analysis using ${keySource} API Key.`);
        } else {
            // User requested silence about API keys during import.
            console.log("No API Key found. Skipping AI analysis (as expected).");
        }
      }

      // Timeout handler to detect worker hangs
      let timeoutId: any;
      const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          reject(new Error("Worker timed out (no response for 300s). Please check your connection or file size."));
          worker.terminate();
        }, 300000); // 300 seconds timeout
      };

      resetTimeout();

      worker.onmessage = (e) => {
        resetTimeout();
        const { type, status, progress, fileMap, blueprint, error, analysisError } = e.data;

        if (type === 'PROGRESS' && onProgress) {
          onProgress({ status, progress });
        } else if (type === 'SUCCESS') {
          if (timeoutId) clearTimeout(timeoutId);
          resolve({ fileMap, blueprint, analysisError });
          worker.terminate();
        } else if (type === 'ERROR') {
          if (timeoutId) clearTimeout(timeoutId);
          reject(new Error(error));
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
        worker.terminate();
      };

      try {
        const arrayBuffer = await file.arrayBuffer();
        worker.postMessage({ 
          type: 'START',
          file: arrayBuffer, 
          apiKey, 
          analyze: shouldAnalyze, 
          oldFeatures 
        }, [arrayBuffer]);
      } catch (err) {
        reject(err);
        worker.terminate();
      }
    });
  }
};
