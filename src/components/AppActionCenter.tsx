import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Download, Code, Wand2, FileCode2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';
import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackPreview,
  useSandpack
} from '@codesandbox/sandpack-react';
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

interface AppActionCenterProps {
  app: AppManifest;
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
  customApiKey?: string;
}

import { useTailwind } from '../contexts/TailwindContext';

import { DiffViewer } from './workspace/DiffViewer';

export const AppActionCenter: React.FC<AppActionCenterProps> = ({ app, onAnalyze, isAnalyzing, customApiKey }) => {
  const [fileMap, setFileMap] = useState<Record<string, string>>({});
  const [editedFiles, setEditedFiles] = useState<Record<string, string> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'features' | 'diff'>('preview');
  const [envVars, setEnvVars] = useState<string>(customApiKey ? `VITE_GEMINI_API_KEY=${customApiKey}` : 'VITE_GEMINI_API_KEY=\n');
  const { injectVariables, scanFileMap } = useTailwind();

  useEffect(() => {
    if (customApiKey) {
      setEnvVars(prev => {
        if (prev.includes('VITE_GEMINI_API_KEY=') && !prev.includes(`VITE_GEMINI_API_KEY=${customApiKey}`)) {
           return `VITE_GEMINI_API_KEY=${customApiKey}`;
        }
        return prev;
      });
    }
  }, [customApiKey]);

  useEffect(() => {
    const loadFileMap = async () => {
      const archive = await storageService.getArchive(app.id);
      if (archive) {
        try {
          const { fileMap: map } = await workerService.processArchive(archive, false);
          setFileMap(map);
          scanFileMap(map);
        } catch (error) {
          console.error("Failed to process archive in worker:", error);
        }
      }
    };
    loadFileMap();
  }, [app.id, scanFileMap]);

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
      // Ensure it starts with a slash
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
      }
      files[normalizedPath] = content;
    }
    
    if (envVars.trim()) {
      files['/.env'] = envVars;
    }
    
    return injectVariables(files);
  }, [fileMap, envVars, rootDir, injectVariables]);

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
    <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-geppy-darkBlue">App Preview & Export</h3>
        <div className="flex items-center gap-4">
          {onAnalyze && (
            <button 
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="flex items-center gap-2 bg-geppy-blue/10 text-geppy-blue px-4 py-2 rounded-full font-bold border-2 border-geppy-blue/20 hover:bg-geppy-blue/20 transition-colors disabled:opacity-50"
            >
              <Wand2 size={16} className={isAnalyzing ? 'animate-spin' : ''} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Re-analyze'}</span>
            </button>
          )}
          <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-slate-200">
            <button
              onClick={() => setActiveTab('features')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'features' ? 'bg-white text-geppy-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Code size={16} className="inline mr-2" />
              Feature Cards
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'preview' ? 'bg-white text-geppy-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Play size={16} className="inline mr-2" />
              Sandbox Preview
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === 'diff' ? 'bg-white text-geppy-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileCode2 size={16} className="inline mr-2" />
              Code Diff
            </button>
          </div>
          <button
            onClick={handleDownload}
            disabled={isDownloading || Object.keys(fileMap).length === 0}
            className="flex items-center gap-2 bg-geppy-orange text-white px-6 py-2 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all disabled:opacity-70 disabled:active:border-b-[8px] disabled:active:translate-y-0"
          >
            <Download size={18} className={isDownloading ? 'animate-bounce' : ''} />
            <span>{isDownloading ? 'Packaging...' : 'Download Modified App'}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-50 border-4 border-slate-200 rounded-[24px] overflow-hidden min-h-[400px]">
        {activeTab === 'preview' ? (
          Object.keys(sandpackFiles).length > 0 ? (
            <div className="flex flex-col h-[600px] w-full">
              <div className="bg-white border-b-2 border-slate-200 p-4 shrink-0">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Environment Variables (.env)</label>
                <input 
                  type="text"
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  placeholder="VITE_GEMINI_API_KEY=your_key_here"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue font-mono text-sm"
                />
              </div>
              <div className="flex-1 min-h-0">
                <SandpackProvider template="vite-react-ts" files={sandpackFiles} theme="light">
                  <SandpackLayout className="h-full rounded-none border-none">
                    <SandpackCodeEditor showTabs={true} className="h-full" />
                    <SandpackPreview showNavigator={true} className="h-full" />
                  </SandpackLayout>
                  <SandpackListener onChange={setEditedFiles} />
                </SandpackProvider>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[400px]">
              <div className="w-16 h-16 bg-geppy-blue/10 text-geppy-blue rounded-2xl flex items-center justify-center mb-4 border-2 border-geppy-blue/20">
                <Play size={32} />
              </div>
              <h4 className="text-xl font-bold text-geppy-darkBlue mb-2">Sandbox Preview</h4>
              <p className="text-slate-500 max-w-md">
                Upload a source ZIP to see the live preview of your application!
              </p>
            </div>
          )
        ) : activeTab === 'diff' ? (
          <DiffViewer 
            originalFiles={sandpackFiles} 
            currentFiles={editedFiles || sandpackFiles} 
          />
        ) : (
          <div className="p-6 grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto">
            {app.blueprint?.features.map((feature) => (
              <div key={feature.id} className="bg-white rounded-[16px] border-2 border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-geppy-darkBlue">{feature.name}</h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border-2 ${
                    feature.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    feature.status === 'graveyard' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                    'bg-geppy-orange/10 text-geppy-orange border-geppy-orange/20'
                  }`}>
                    {feature.status}
                  </span>
                </div>
                {feature.status === 'graveyard' && feature.removalReason && (
                  <div className="mb-4 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason:</span>
                      <span className="text-sm font-bold text-slate-700">
                        {feature.removalReason === 'replaced' ? 'Replaced with better option' :
                         feature.removalReason === 'missing' ? 'Missing / Not found in code' :
                         feature.removalReason === 'user_requested' ? 'User requested removal' :
                         feature.removalReason === 'ai_assumed' ? 'Assumed deprecated by AI' :
                         feature.removalReason}
                      </span>
                    </div>
                    {feature.removalNotes && (
                      <p className="text-sm text-slate-600">{feature.removalNotes}</p>
                    )}
                  </div>
                )}
                <p className="text-slate-600 mb-4">{feature.behavior}</p>
                <div className="rounded-xl overflow-hidden border-2 border-slate-800">
                  <SyntaxHighlighter
                    language="typescript"
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem' }}
                  >
                    {feature.codeSnippet || '// No code snippet available'}
                  </SyntaxHighlighter>
                </div>
              </div>
            ))}
            {(!app.blueprint || app.blueprint.features.length === 0) && (
              <div className="text-center text-slate-500 py-12">
                No features found in the blueprint. Upload a source ZIP to analyze!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
