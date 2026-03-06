import React from 'react';
import { AppManifest, FeatureDNA } from '../../types';
import { Plus, Minus, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';

interface DNADiffViewerProps {
  currentManifest: AppManifest;
  snapshotManifest: AppManifest | null;
}

export const DNADiffViewer: React.FC<DNADiffViewerProps> = ({ currentManifest, snapshotManifest }) => {
  if (!snapshotManifest) {
    return (
      <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] p-6">
        <h3 className="text-xl font-bold text-geppy-darkBlue mb-4 flex items-center gap-2">
          <CheckCircle2 size={24} className="text-emerald-500" />
          Viewing Current State
        </h3>
        <p className="text-slate-500">Select a snapshot from the timeline to view the DNA diff.</p>
      </div>
    );
  }

  const currentFeatures = currentManifest.blueprint?.features || [];
  const snapshotFeatures = snapshotManifest.blueprint?.features || [];

  const addedFeatures = currentFeatures.filter(cf => !snapshotFeatures.some(sf => sf.id === cf.id));
  const removedFeatures = snapshotFeatures.filter(sf => !currentFeatures.some(cf => cf.id === sf.id));
  const modifiedFeatures = currentFeatures.filter(cf => {
    const sf = snapshotFeatures.find(s => s.id === cf.id);
    return sf && (sf.behavior !== cf.behavior || sf.codeSnippet !== cf.codeSnippet || sf.status !== cf.status);
  });

  const hasChanges = addedFeatures.length > 0 || removedFeatures.length > 0 || modifiedFeatures.length > 0;

  return (
    <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-geppy-darkBlue flex items-center gap-2">
          <AlertCircle size={24} className="text-geppy-orange" />
          DNA Diff Viewer
        </h3>
        <div className="text-sm font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-full border-2 border-slate-200">
          v{snapshotManifest.version} → v{currentManifest.version}
        </div>
      </div>

      {!hasChanges ? (
        <div className="text-center p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <p className="text-slate-500 font-medium">No functional changes detected between these versions.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Added Features */}
          {addedFeatures.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Plus size={16} strokeWidth={3} />
                Added Features ({addedFeatures.length})
              </h4>
              <div className="space-y-3">
                {addedFeatures.map(feature => (
                  <div key={feature.id} className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(16,185,129,0.2)]">
                    <div className="font-bold text-emerald-900 mb-1">{feature.name}</div>
                    <div className="text-sm text-emerald-700">{feature.behavior}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed Features */}
          {removedFeatures.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Minus size={16} strokeWidth={3} />
                Removed Features ({removedFeatures.length})
              </h4>
              <div className="space-y-3">
                {removedFeatures.map(feature => (
                  <div key={feature.id} className="bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)]">
                    <div className="font-bold text-red-900 mb-1 line-through opacity-75">{feature.name}</div>
                    <div className="text-sm text-red-700">{feature.behavior}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modified Features */}
          {modifiedFeatures.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Edit2 size={16} strokeWidth={3} />
                Modified Features ({modifiedFeatures.length})
              </h4>
              <div className="space-y-3">
                {modifiedFeatures.map(feature => {
                  const oldFeature = snapshotFeatures.find(sf => sf.id === feature.id);
                  return (
                    <div key={feature.id} className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(245,158,11,0.2)]">
                      <div className="font-bold text-amber-900 mb-2">{feature.name}</div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/50 p-3 rounded-lg border border-amber-200/50">
                          <div className="text-xs font-bold text-amber-600/70 mb-1 uppercase">Previous</div>
                          <div className="text-sm text-amber-800/70 line-clamp-3">{oldFeature?.behavior}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-300">
                          <div className="text-xs font-bold text-amber-600 mb-1 uppercase">Current</div>
                          <div className="text-sm text-amber-900 line-clamp-3">{feature.behavior}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
