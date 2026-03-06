import React, { useEffect, useState } from 'react';
import { storageService } from '../../services/storageService';
import { AppManifest } from '../../types';
import { Clock, ChevronRight } from 'lucide-react';

interface VersionTimelineProps {
  appId: string;
  onSelectSnapshot: (snapshot: { id: string; appId: string; timestamp: number; manifest: AppManifest } | null) => void;
  selectedSnapshotId: string | null;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({ appId, onSelectSnapshot, selectedSnapshotId }) => {
  const [snapshots, setSnapshots] = useState<{ id: string; appId: string; timestamp: number; manifest: AppManifest }[]>([]);

  useEffect(() => {
    const loadSnapshots = async () => {
      const loadedSnapshots = await storageService.getSnapshots(appId);
      setSnapshots(loadedSnapshots);
    };
    loadSnapshots();
  }, [appId]);

  if (snapshots.length === 0) {
    return (
      <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] p-6">
        <h3 className="text-xl font-bold text-geppy-darkBlue mb-2 flex items-center gap-2">
          <Clock size={24} />
          Version Timeline
        </h3>
        <p className="text-slate-500">No historical versions found. Save changes to create a snapshot.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[24px] border-4 border-geppy-darkBlue border-b-[8px] p-6">
      <h3 className="text-xl font-bold text-geppy-darkBlue mb-6 flex items-center gap-2">
        <Clock size={24} />
        Version Timeline
      </h3>
      
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
        
        {/* Current Version Node */}
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-geppy-darkBlue bg-geppy-orange text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
            <Clock size={16} strokeWidth={3} />
          </div>
          <div 
            className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedSnapshotId === null ? 'border-geppy-blue bg-geppy-blue/5 shadow-[4px_4px_0px_0px_rgba(0,102,255,0.2)]' : 'border-slate-200 bg-white hover:border-geppy-blue/50'}`}
            onClick={() => onSelectSnapshot(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-geppy-darkBlue">Current Version</span>
              <span className="text-xs font-mono text-slate-400">Now</span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2">The latest state of your application.</p>
          </div>
        </div>

        {/* Historical Snapshots */}
        {snapshots.map((snapshot, index) => (
          <div key={snapshot.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-geppy-darkBlue bg-white text-slate-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
              <span className="text-xs font-bold">{snapshots.length - index}</span>
            </div>
            <div 
              className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedSnapshotId === snapshot.id ? 'border-geppy-orange bg-geppy-orange/5 shadow-[4px_4px_0px_0px_rgba(255,138,0,0.2)]' : 'border-slate-200 bg-white hover:border-geppy-orange/50'}`}
              onClick={() => onSelectSnapshot(snapshot)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-geppy-darkBlue">v{snapshot.manifest.version}</span>
                <span className="text-xs font-mono text-slate-400">
                  {new Date(snapshot.timestamp).toLocaleDateString()} {new Date(snapshot.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">
                {snapshot.manifest.blueprint?.recentChanges || 'No changes recorded.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
