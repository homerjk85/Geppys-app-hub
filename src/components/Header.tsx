import React, { useEffect, useState } from 'react';
import { RefreshCw, HardDrive } from 'lucide-react';
import { storageService } from '../services/storageService';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchUsage = async () => {
      const usage = await storageService.getStorageUsage();
      setStorageUsage(usage);
    };
    fetchUsage();
    
    // Set up an interval to refresh usage
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSyncing(false);
  };

  return (
    <header className="bg-white border-b-4 border-geppy-darkBlue px-8 py-4 flex items-center justify-between sticky top-0 z-10">
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img 
          src="https://storage.googleapis.com/geppyaiapp/Geppy%20App%20Hub/apphub.png" 
          alt="Geppy App Hub Logo" 
          className="w-12 h-12 object-contain rounded-xl border-2 border-geppy-darkBlue border-b-4 bg-white"
          referrerPolicy="no-referrer"
        />
        <h1 className="text-2xl font-bold text-geppy-darkBlue tracking-tight">Geppy App Hub</h1>
      </Link>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-600 bg-slate-100 px-4 py-2 rounded-full border-2 border-slate-200">
          <HardDrive size={18} />
          <span className="font-mono text-sm font-medium">{formatBytes(storageUsage)} used</span>
        </div>

        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-geppy-orange text-white px-6 py-3 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all disabled:opacity-70 disabled:active:border-b-[8px] disabled:active:translate-y-0"
        >
          <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
          <span>Global Sync</span>
        </button>
      </div>
    </header>
  );
};
