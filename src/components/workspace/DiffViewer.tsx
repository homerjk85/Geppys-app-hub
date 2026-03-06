import React, { useState, useMemo } from 'react';
import { createTwoFilesPatch } from 'diff';
import * as Diff2Html from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import { FileCode2, AlertCircle } from 'lucide-react';

interface DiffViewerProps {
  originalFiles: Record<string, string>;
  currentFiles: Record<string, string>;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ originalFiles, currentFiles }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const changedFiles = useMemo(() => {
    const changes: { path: string; status: 'added' | 'removed' | 'modified' }[] = [];
    
    // Check for modified and removed files
    for (const path of Object.keys(originalFiles)) {
      if (!currentFiles[path]) {
        changes.push({ path, status: 'removed' });
      } else if (originalFiles[path] !== currentFiles[path]) {
        changes.push({ path, status: 'modified' });
      }
    }
    
    // Check for added files
    for (const path of Object.keys(currentFiles)) {
      if (!originalFiles[path]) {
        changes.push({ path, status: 'added' });
      }
    }
    
    return changes.sort((a, b) => a.path.localeCompare(b.path));
  }, [originalFiles, currentFiles]);

  // Auto-select first changed file
  React.useEffect(() => {
    if (changedFiles.length > 0 && !selectedFile) {
      setSelectedFile(changedFiles[0].path);
    }
  }, [changedFiles, selectedFile]);

  if (changedFiles.length === 0) {
    return (
      <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-slate-200">
          <FileCode2 size={32} />
        </div>
        <h3 className="text-xl font-bold text-geppy-darkBlue mb-2">No Code Changes</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          The current sandbox code perfectly matches the original ZIP import.
        </p>
      </div>
    );
  }

  const oldValue = selectedFile ? originalFiles[selectedFile] || '' : '';
  const newValue = selectedFile ? currentFiles[selectedFile] || '' : '';

  const diffHtml = useMemo(() => {
    if (!selectedFile) return '';
    const patch = createTwoFilesPatch(
      selectedFile,
      selectedFile,
      oldValue,
      newValue,
      'Original ZIP',
      'Sandbox Edits'
    );
    return Diff2Html.html(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side',
    });
  }, [selectedFile, oldValue, newValue]);

  return (
    <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] overflow-hidden flex flex-col h-[800px]">
      <div className="bg-slate-50 border-b-4 border-slate-200 p-4 shrink-0 flex items-center justify-between">
        <h3 className="text-xl font-bold text-geppy-darkBlue flex items-center gap-2">
          <FileCode2 size={24} className="text-geppy-blue" />
          Codebase Diff Visualizer
        </h3>
        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border-2 border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Additions
          </span>
          <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg border-2 border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Removals
          </span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* File List Sidebar */}
        <div className="w-64 bg-white border-r-4 border-slate-200 overflow-y-auto shrink-0 p-4 space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Changed Files ({changedFiles.length})</div>
          {changedFiles.map(({ path, status }) => (
            <button
              key={path}
              onClick={() => setSelectedFile(path)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-mono truncate transition-all border-2 ${
                selectedFile === path 
                  ? 'bg-geppy-blue/10 border-geppy-blue/30 text-geppy-darkBlue font-bold' 
                  : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'
              }`}
              title={path}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  status === 'added' ? 'bg-emerald-500' :
                  status === 'removed' ? 'bg-red-500' :
                  'bg-amber-500'
                }`} />
                <span className="truncate">{path.split('/').pop()}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Diff Viewer Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {selectedFile ? (
            <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-4 py-2 border-b-2 border-slate-200 font-mono text-sm font-bold text-slate-700 flex justify-between">
                <span>Original: {selectedFile}</span>
                <span>Current: {selectedFile}</span>
              </div>
              <div className="diff2html-container overflow-auto" dangerouslySetInnerHTML={{ __html: diffHtml }} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium">
              Select a file to view changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
