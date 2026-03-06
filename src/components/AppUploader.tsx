import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, Sparkles, AlertTriangle, FileSearch, Github, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { AppManifest, AppBlueprint } from '../types';
import ArchiveWorker from '../workers/archiveProcessor.worker?worker';
import { analyzeZipFile, DiagnosticResult } from '../utils/fileDiagnostics';

export const AppUploader: React.FC<{ onUploadComplete?: () => void }> = ({ onUploadComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [uploadMode, setUploadMode] = useState<'zip' | 'github'>('zip');
  const [githubUrl, setGithubUrl] = useState('');
  const navigate = useNavigate();

  const runDiagnostics = async (file: File) => {
    setStatusText('Running diagnostics...');
    try {
      const result = await analyzeZipFile(file);
      setDiagnosticResult(result);
    } catch (e) {
      console.error("Diagnostic failed:", e);
    }
  };

  const processFile = async (file: File, sourceUrl?: string) => {
    setIsProcessing(true);
    setError(null);
    setDiagnosticResult(null);
    setStatusText('Initializing worker...');

    try {
      const worker = new ArchiveWorker();
      
      // Get and clean API Key
      let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (apiKey) {
        apiKey = apiKey.trim();
        while ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
          apiKey = apiKey.slice(1, -1);
        }
        apiKey = apiKey.replace(/\\n/g, '').replace(/\n/g, '').trim();
      }

      const shouldAnalyze = !!apiKey && apiKey.length > 10;
      if (!shouldAnalyze) {
        console.warn("GEMINI_API_KEY missing or invalid. Skipping AI analysis.");
      }

      // Timeout handler
      let timeoutId: any;
      const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setError("Worker timed out (no response for 60s). Please check your connection or file size.");
          setIsProcessing(false);
          worker.terminate();
          runDiagnostics(file);
        }, 60000);
      };

      resetTimeout();

      // Handle worker messages
      worker.onmessage = async (e) => {
        resetTimeout();
        const { type, status, progress, fileMap, blueprint, error: workerError } = e.data;

        if (type === 'PROGRESS') {
          setStatusText(`${status} (${progress}%)`);
        } else if (type === 'ERROR') {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('Worker error:', workerError);
          setError(workerError || 'Failed to process ZIP.');
          setIsProcessing(false);
          worker.terminate();
          runDiagnostics(file);
        } else if (type === 'SUCCESS') {
          if (timeoutId) clearTimeout(timeoutId);
          worker.terminate();
          
          if (!blueprint && shouldAnalyze) {
             // If we expected analysis but didn't get a blueprint (e.g. AI failure handled in worker)
             console.warn("Blueprint missing despite analysis request.");
          }

          try {
            setStatusText('Saving to Hub...');
            const newApp: AppManifest = {
              id: crypto.randomUUID(),
              name: file.name.replace('.zip', ''),
              description: blueprint?.appDescription || 'Imported via Geppy Architect (AI Analysis Skipped/Failed).',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: '1.0.0',
              status: 'draft',
              githubUrl: sourceUrl,
              blueprint: blueprint || undefined,
              changelog: [{
                version: '1.0.0',
                timestamp: Date.now(),
                changes: blueprint?.recentChanges || 'Initial import.',
                originalFilename: file.name
              }]
            };

            await storageService.saveApp(newApp);
            await storageService.saveArchive(newApp.id, file);

            if (onUploadComplete) {
              onUploadComplete();
            }
            navigate(`/app/${newApp.id}`);
          } catch (saveErr: any) {
            console.error('Save failed:', saveErr);
            setError(saveErr.message || 'Failed to save application.');
            setIsProcessing(false);
            runDiagnostics(file);
          }
        }
      };

      worker.onerror = (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('Worker error:', err);
        setError('Worker failed to start.');
        setIsProcessing(false);
        worker.terminate();
        runDiagnostics(file);
      };

      // Send file to worker
      const arrayBuffer = await file.arrayBuffer();
      worker.postMessage({ 
        type: 'START', 
        file: arrayBuffer, 
        apiKey, 
        analyze: shouldAnalyze 
      }, [arrayBuffer]);

    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Failed to initiate upload.');
      setIsProcessing(false);
      runDiagnostics(file);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    processFile(file);
  }, [navigate, onUploadComplete]);

  const handleGithubImport = async () => {
    if (!githubUrl) return;
    
    setIsProcessing(true);
    setError(null);
    setStatusText('Downloading from GitHub...');

    try {
      const response = await fetch(`/api/github/download?url=${encodeURIComponent(githubUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `GitHub download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = githubUrl.split('/').pop()?.replace('.git', '') + '.zip' || 'github-import.zip';
      const file = new File([blob], filename, { type: 'application/zip' });
      
      processFile(file, githubUrl);

    } catch (err: any) {
      console.error('GitHub import failed:', err);
      setError(err.message || 'Failed to import from GitHub.');
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setUploadMode('zip')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            uploadMode === 'zip' 
              ? 'bg-slate-50 text-geppy-darkBlue border-b-2 border-geppy-blue' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Upload size={16} />
          Upload ZIP
        </button>
        <button 
          onClick={() => setUploadMode('github')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            uploadMode === 'github' 
              ? 'bg-slate-50 text-geppy-darkBlue border-b-2 border-geppy-blue' 
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Github size={16} />
          Import from GitHub
        </button>
      </div>

      <div className="p-8">
        {uploadMode === 'zip' ? (
          <div 
            {...getRootProps()} 
            className={`relative overflow-hidden border-4 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all ${
              isDragActive ? 'border-geppy-blue bg-geppy-blue/5' : 'border-slate-300 hover:border-geppy-blue/50 hover:bg-slate-50'
            } ${isProcessing ? 'opacity-80 pointer-events-none' : ''}`}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center justify-center min-h-[160px]">
              {isProcessing ? (
                <>
                  <div className="relative mb-4">
                    <Loader2 size={48} className="text-geppy-blue animate-spin" />
                    <Sparkles size={20} className="text-geppy-orange absolute -top-2 -right-2 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-geppy-darkBlue mb-2">Analyzing Codebase</h3>
                  <p className="text-slate-500 font-mono text-sm">{statusText}</p>
                </>
              ) : (
                <>
                  <div className="bg-slate-100 p-4 rounded-full mb-4 text-slate-400 group-hover:text-geppy-blue transition-colors">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-geppy-darkBlue mb-2">
                    {isDragActive ? 'Drop ZIP here...' : 'Import App via ZIP'}
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Drag and drop a codebase ZIP. Geppy Architect will automatically extract its DNA and Style Manifest.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[260px] max-w-md mx-auto">
            {isProcessing ? (
               <>
                <div className="relative mb-4">
                  <Loader2 size={48} className="text-geppy-blue animate-spin" />
                  <Sparkles size={20} className="text-geppy-orange absolute -top-2 -right-2 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-geppy-darkBlue mb-2">Processing GitHub Repo</h3>
                <p className="text-slate-500 font-mono text-sm">{statusText}</p>
              </>
            ) : (
              <div className="w-full space-y-4">
                <div className="text-center mb-6">
                  <div className="bg-slate-100 p-4 rounded-full mb-4 text-slate-400 inline-block">
                    <Github size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-geppy-darkBlue">Import from GitHub</h3>
                  <p className="text-slate-500 text-sm mt-2">
                    Enter a public repository URL to import it directly.
                  </p>
                </div>
                
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/10 transition-all font-mono text-sm"
                  />
                </div>
                
                <button 
                  onClick={handleGithubImport}
                  disabled={!githubUrl}
                  className="w-full bg-geppy-darkBlue text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Github size={18} />
                  Import Repository
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 w-full text-left">
            <div className="px-4 py-3 bg-red-100 text-red-700 rounded-xl text-sm font-bold flex items-start gap-2">
              <AlertTriangle className="shrink-0 mt-0.5" size={16} />
              <div>
                <p>{error}</p>
              </div>
            </div>
            
            {diagnosticResult && (
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2 mb-2 text-slate-700 font-semibold">
                  <FileSearch size={16} />
                  <h4>Diagnostic Analysis</h4>
                </div>
                
                {diagnosticResult.issues.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    {diagnosticResult.issues.map((issue, i) => (
                      <li key={i} className="text-red-600">{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-green-600">File structure appears valid. The issue might be with the AI service or browser worker support.</p>
                )}
                
                <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div>Size: {(diagnosticResult.details.size / 1024 / 1024).toFixed(2)} MB</div>
                  <div>Type: {diagnosticResult.details.type || 'n/a'}</div>
                  {diagnosticResult.details.fileCount !== undefined && (
                    <div>Files: {diagnosticResult.details.fileCount}</div>
                  )}
                  {diagnosticResult.details.magicBytes && (
                    <div>Magic: 0x{diagnosticResult.details.magicBytes}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
