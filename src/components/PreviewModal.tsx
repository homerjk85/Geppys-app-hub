import React, { useState, useEffect, useMemo } from 'react';
import { X, Play, Settings, Download } from 'lucide-react';
import JSZip from 'jszip';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackPreview,
  useSandpack
} from '@codesandbox/sandpack-react';
import { GeppyMedicOverlay } from './GeppyMedicOverlay';
import { AppManifest } from '../types';
import { storageService } from '../services/storageService';
import { workerService } from '../services/workerService';

const SandpackListener = ({ onChange }: { onChange: (files: Record<string, string>) => void }) => {
  const { sandpack } = useSandpack();
  
  useEffect(() => {
    const currentFiles: Record<string, string> = {};
    for (const [path, fileObj] of Object.entries(sandpack.files)) {
      currentFiles[path] = fileObj.code;
    }
    onChange(currentFiles);
  }, [sandpack.files, onChange]);
  
  return null;
};

interface PreviewModalProps {
  app: AppManifest;
  onClose: () => void;
  customApiKey?: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ app, onClose, customApiKey }) => {
  const [fileMap, setFileMap] = useState<Record<string, string>>({});
  const [editedFiles, setEditedFiles] = useState<Record<string, string> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const defaultEnvVars = useMemo(() => {
    const key = customApiKey || process.env.GEMINI_API_KEY;
    return key ? `VITE_GEMINI_API_KEY=${key}` : 'VITE_GEMINI_API_KEY=\n';
  }, [customApiKey]);

  const [envVars, setEnvVars] = useState<string>(defaultEnvVars);
  const [showEnv, setShowEnv] = useState(false);

  useEffect(() => {
    const loadFileMap = async () => {
      const archive = await storageService.getArchive(app.id);
      if (archive) {
        try {
          const { fileMap: map } = await workerService.processArchive(archive, false);
          setFileMap(map);
        } catch (error) {
          console.error("Failed to process archive in worker:", error);
        }
      }
    };
    loadFileMap();
  }, [app.id]);

  const rootDir = useMemo(() => {
    const packageJsonPath = Object.keys(fileMap).find(p => p.endsWith('package.json'));
    return packageJsonPath ? packageJsonPath.replace('package.json', '') : '';
  }, [fileMap]);

  const sandpackFiles = useMemo(() => {
    if (Object.keys(fileMap).length === 0) return {};

    const files: Record<string, string> = {};
    for (const [path, content] of Object.entries(fileMap)) {
      let normalizedPath = path;
      if (rootDir && path.startsWith(rootDir)) {
        normalizedPath = path.substring(rootDir.length);
      }
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
      }
      files[normalizedPath] = content;
    }
    
    // Inject .env file
    if (envVars.trim()) {
      files['/.env'] = envVars;
    }
    
    return files;
  }, [fileMap, envVars, rootDir]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      
      // Start with original fileMap to preserve binary files or things Sandpack ignores
      const finalFiles = { ...fileMap };
      
      // Override with edited files if any
      if (editedFiles) {
        Object.entries(editedFiles).forEach(([path, content]) => {
          if (path === '/.env') return; // Don't export secrets
          
          const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
          const originalPath = rootDir + normalizedPath;
          finalFiles[originalPath] = content;
        });
      }
      
      // Re-package the final files into a new ZIP
      Object.entries(finalFiles).forEach(([path, content]) => {
        zip.file(path, content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.name.replace(/\s+/g, '-').toLowerCase()}-v${app.version}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate zip:', error);
      alert('Failed to generate zip file.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className="bg-white w-full h-full max-w-7xl rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-4 border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl border-2 border-geppy-darkBlue flex items-center justify-center text-lg font-bold text-white shadow-sm" style={{ backgroundColor: app.blueprint?.style?.primaryColor || '#0052FF' }}>
              {app.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-geppy-darkBlue">Live Preview: {app.name}</h3>
              <p className="text-sm font-medium text-slate-500">Test features before implementing</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={isDownloading || Object.keys(fileMap).length === 0}
              className="flex items-center gap-2 bg-geppy-orange text-white px-4 py-2 rounded-full font-bold border-2 border-geppy-darkBlue transition-all disabled:opacity-70 hover:bg-orange-600"
            >
              <Download size={16} className={isDownloading ? 'animate-bounce' : ''} />
              <span>{isDownloading ? 'Packaging...' : 'Download Modified App'}</span>
            </button>
            <button 
              onClick={() => setShowEnv(!showEnv)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold border-2 transition-all ${showEnv ? 'bg-geppy-blue text-white border-geppy-blue' : 'bg-white text-slate-600 border-slate-200 hover:border-geppy-blue hover:text-geppy-blue'}`}
            >
              <Settings size={16} />
              <span>API Keys / .env</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Env Sidebar */}
          {showEnv && (
            <div className="w-80 bg-slate-50 border-r-4 border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto">
              <h4 className="font-bold text-geppy-darkBlue mb-2">Environment Variables</h4>
              <p className="text-xs text-slate-500 mb-4">Add your API keys here to test the app. These are injected into a .env file in the sandbox.</p>
              <textarea 
                value={envVars}
                onChange={(e) => setEnvVars(e.target.value)}
                className="w-full flex-1 bg-white border-2 border-slate-200 rounded-xl p-4 text-sm font-mono text-slate-700 focus:outline-none focus:border-geppy-blue resize-none"
                placeholder="VITE_GEMINI_API_KEY=your_key_here&#10;OTHER_VAR=value"
              />
            </div>
          )}

          {/* Sandpack */}
          <div className="flex-1 bg-slate-100 relative">
            {Object.keys(sandpackFiles).length > 0 ? (
              <SandpackProvider template="vite-react-ts" files={sandpackFiles} theme="light">
                <SandpackLayout className="h-full rounded-none border-none">
                  <SandpackCodeEditor showTabs={true} className="h-full" />
                  <SandpackPreview showNavigator={true} className="h-full" />
                </SandpackLayout>
                <SandpackListener onChange={setEditedFiles} />
                <GeppyMedicOverlay blueprint={app.blueprint} apiKey={customApiKey || process.env.GEMINI_API_KEY} />
              </SandpackProvider>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-16 h-16 bg-geppy-blue/10 text-geppy-blue rounded-2xl flex items-center justify-center mb-4 border-2 border-geppy-blue/20">
                  <Play size={32} />
                </div>
                <h4 className="text-xl font-bold text-geppy-darkBlue mb-2">No Source Files</h4>
                <p className="text-slate-500 max-w-md">
                  Upload a source ZIP in the workspace to see the live preview of your application!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
