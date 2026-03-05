import JSZip from 'jszip';
import ArchiveWorker from '../workers/archiveProcessor.worker?worker';

export const processZipUpload = (file: File | Blob): Promise<Record<string, string>> => {
  return new Promise((resolve, reject) => {
    const worker = new ArchiveWorker();
    
    worker.onmessage = (e) => {
      const { type, fileMap, error } = e.data;
      
      if (type === 'SUCCESS') {
        resolve(fileMap);
        worker.terminate();
      } else if (type === 'ERROR') {
        reject(new Error(error));
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    // Send the file to the worker for processing (no analysis, just extraction)
    file.arrayBuffer().then(buffer => {
      worker.postMessage({ 
        type: 'START', 
        file: buffer, 
        analyze: false 
      }, [buffer]);
    }).catch(err => {
      reject(err);
      worker.terminate();
    });
  });
};

export const updateFileInZip = async (archive: Blob, filePath: string, newContent: string): Promise<Blob> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(archive);
  
  // Find the actual path in the zip (might have a root folder)
  let actualPath = filePath;
  const paths = Object.keys(contents.files);
  
  // Try to find an exact match first
  if (!contents.files[actualPath]) {
    // Try to find a path that ends with the requested file path
    const match = paths.find(p => p.endsWith(filePath) || p.endsWith('/' + filePath));
    if (match) {
      actualPath = match;
    }
  }

  zip.file(actualPath, newContent);
  return await zip.generateAsync({ type: 'blob' });
};
