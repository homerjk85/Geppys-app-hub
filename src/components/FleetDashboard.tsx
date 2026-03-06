import React, { useEffect, useState } from 'react';
import { Plus, Settings, ExternalLink, Box, HardDrive } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { storageService } from '../services/storageService';
import { AppManifest } from '../types';
import { AppUploader } from './AppUploader';

interface AppWithFootprint extends AppManifest {
  footprintBytes?: number;
}

export const FleetDashboard: React.FC = () => {
  const [apps, setApps] = useState<AppWithFootprint[]>([]);
  const navigate = useNavigate();

  const loadApps = async () => {
    const loadedApps = await storageService.getAllApps();
    
    // Load footprints
    const appsWithFootprints = await Promise.all(loadedApps.map(async (app) => {
      const archive = await storageService.getArchive(app.id);
      return {
        ...app,
        footprintBytes: archive ? archive.size : 0
      };
    }));

    // Sort by updated descending
    setApps(appsWithFootprints.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleCreateNew = async () => {
    const newApp: AppManifest = {
      id: crypto.randomUUID(),
      name: 'Untitled App',
      description: 'A new Geppy application.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      status: 'draft'
    };
    await storageService.saveApp(newApp);
    navigate(`/app/${newApp.id}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-bold text-geppy-darkBlue mb-2">Fleet Dashboard</h2>
          <p className="text-slate-500 text-lg">Manage and monitor your Geppy applications.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-geppy-blue text-white px-8 py-4 rounded-full font-bold text-lg border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all"
          >
            <Plus size={24} strokeWidth={3} />
            <span>Create New App</span>
          </button>
        </div>
      </div>

      <div className="mb-12">
        <AppUploader onUploadComplete={loadApps} />
      </div>

      {apps.length === 0 ? (
        <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-16 text-center flex flex-col items-center justify-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6 border-4 border-slate-200">
            <Box size={48} className="text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-geppy-darkBlue mb-4">No apps in your fleet</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Your workspace is empty. Create your first Geppy application or import a ZIP to get started.
          </p>
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-geppy-blue text-white px-6 py-3 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all"
          >
            <Plus size={20} strokeWidth={3} />
            <span>Create First App</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {apps.map(app => (
            <div 
              key={app.id} 
              onClick={() => navigate(`/app/${app.id}`)}
              className="group bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] active:border-b-[4px] active:translate-y-[8px] p-8 hover:-translate-y-2 transition-all duration-200 flex flex-col h-full cursor-pointer"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="bg-geppy-blue/10 text-geppy-blue p-4 rounded-2xl border-2 border-geppy-blue/20">
                  <Box size={32} />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border-2 ${
                  app.status === 'published' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                  app.status === 'archived' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                  'bg-geppy-orange/10 text-geppy-orange border-geppy-orange/20'
                }`}>
                  {app.status}
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-geppy-darkBlue mb-2 group-hover:text-geppy-blue transition-colors">
                {app.name}
              </h3>
              <p className="text-slate-500 mb-8 flex-grow line-clamp-2">
                {app.description}
              </p>
              
              <div className="flex flex-wrap items-center justify-between pt-6 border-t-2 border-slate-100 mt-auto gap-4">
                <div className="font-mono text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span>v{app.version}</span>
                  <span>•</span>
                  <span>{new Date(app.updatedAt).toLocaleDateString()}</span>
                  {app.footprintBytes !== undefined && app.footprintBytes > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-geppy-blue bg-geppy-blue/10 px-2 py-0.5 rounded-full">
                        <HardDrive size={12} />
                        {formatBytes(app.footprintBytes)}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Add settings modal or navigation
                    }}
                    className="p-2 text-slate-400 hover:text-geppy-darkBlue hover:bg-slate-100 rounded-full transition-all active:scale-90"
                    title="Settings"
                  >
                    <Settings size={18} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/${app.id}`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-geppy-blue/10 text-geppy-blue hover:bg-geppy-blue hover:text-white rounded-full font-bold transition-all active:scale-95"
                  >
                    <span>Open</span>
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
