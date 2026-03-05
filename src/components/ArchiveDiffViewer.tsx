import React, { useState } from 'react';
import { FeatureDNA } from '../types';
import { DiffEngine } from '../utils/DiffEngine';
import { Copy, Check, PlusCircle, Edit3, Skull } from 'lucide-react';

interface ArchiveDiffViewerProps {
  oldFeatures: FeatureDNA[];
  newFeatures: FeatureDNA[];
  onAccept: () => void;
  onCancel: () => void;
  readOnly?: boolean;
}

export const ArchiveDiffViewer: React.FC<ArchiveDiffViewerProps> = ({ oldFeatures, newFeatures, onAccept, onCancel, readOnly }) => {
  const diff = DiffEngine.compare(oldFeatures, newFeatures);
  const [activeTab, setActiveTab] = useState<'added' | 'modified' | 'graveyard'>('modified');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-3xl font-bold text-geppy-darkBlue mb-2">Codebase Diff</h3>
          <p className="text-slate-500 font-bold">Review changes before committing to the Hub.</p>
        </div>
        {!readOnly && (
          <div className="flex gap-4">
            <button onClick={onCancel} className="px-6 py-2 rounded-full font-bold text-slate-500 hover:bg-slate-100 border-2 border-transparent transition-colors">
              Cancel
            </button>
            <button onClick={onAccept} className="bg-geppy-blue text-white px-8 py-2 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all">
              Accept Changes
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-8 border-b-4 border-slate-100 pb-4 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('modified')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border-4 transition-all whitespace-nowrap ${activeTab === 'modified' ? 'bg-geppy-orange/10 border-geppy-orange text-geppy-orange' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Edit3 size={20} />
          Modified ({diff.modified.length})
        </button>
        <button 
          onClick={() => setActiveTab('added')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border-4 transition-all whitespace-nowrap ${activeTab === 'added' ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <PlusCircle size={20} />
          Added ({diff.added.length})
        </button>
        <button 
          onClick={() => setActiveTab('graveyard')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold border-4 transition-all whitespace-nowrap ${activeTab === 'graveyard' ? 'bg-slate-800 border-geppy-darkBlue text-white' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Skull size={20} />
          Graveyard ({diff.graveyard.length})
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === 'modified' && diff.modified.length === 0 && <p className="text-slate-500 font-bold text-center py-8">No modified features.</p>}
        {activeTab === 'modified' && diff.modified.map(({ oldFeature, newFeature }) => (
          <div key={newFeature.id} className="border-4 border-geppy-orange/30 rounded-2xl p-6 bg-geppy-orange/5">
            <h4 className="text-xl font-bold text-geppy-darkBlue mb-2">{newFeature.name}</h4>
            <p className="text-slate-600 mb-4">{newFeature.behavior}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Old DNA</div>
                <pre className="bg-slate-200 text-slate-600 p-4 rounded-xl overflow-x-auto font-mono text-xs max-h-64">
                  <code>{oldFeature.codeSnippet}</code>
                </pre>
              </div>
              <div>
                <div className="text-xs font-bold text-geppy-orange uppercase mb-2">New DNA</div>
                <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto font-mono text-xs max-h-64 border-2 border-geppy-orange/50">
                  <code>{newFeature.codeSnippet}</code>
                </pre>
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'added' && diff.added.length === 0 && <p className="text-slate-500 font-bold text-center py-8">No added features.</p>}
        {activeTab === 'added' && diff.added.map(feature => (
          <div key={feature.id} className="border-4 border-emerald-200 rounded-2xl p-6 bg-emerald-50">
            <h4 className="text-xl font-bold text-emerald-800 mb-2">{feature.name}</h4>
            <p className="text-emerald-600 mb-4">{feature.behavior}</p>
            <div className="text-xs font-bold text-emerald-600 uppercase mb-2">New DNA</div>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto font-mono text-xs max-h-64 border-2 border-emerald-500/50">
              <code>{feature.codeSnippet}</code>
            </pre>
          </div>
        ))}

        {activeTab === 'graveyard' && diff.graveyard.length === 0 && <p className="text-slate-500 font-bold text-center py-8">No features in the graveyard.</p>}
        {activeTab === 'graveyard' && diff.graveyard.map(feature => (
          <div key={feature.id} className="border-4 border-slate-300 rounded-2xl p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xl font-bold text-slate-700">{feature.name}</h4>
              <button 
                onClick={() => handleCopy(feature.codeSnippet, feature.id)}
                className="flex items-center gap-2 bg-geppy-darkBlue text-white px-4 py-2 rounded-full font-bold text-sm border-2 border-geppy-darkBlue border-b-4 active:border-b-2 active:translate-y-[2px] transition-all"
              >
                {copiedId === feature.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedId === feature.id ? 'Copied!' : 'RE-ADD DNA'}</span>
              </button>
            </div>
            
            {feature.removalReason && (
              <div className="mb-4 p-3 bg-white border-2 border-slate-200 rounded-xl">
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
            
            <p className="text-slate-500 mb-4">{feature.behavior}</p>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Lost DNA</div>
            <pre className="bg-slate-800 text-slate-400 p-4 rounded-xl overflow-x-auto font-mono text-xs max-h-64 opacity-80">
              <code>{feature.codeSnippet}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
