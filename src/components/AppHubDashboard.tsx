import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Library, 
  Settings, 
  Search, 
  Filter, 
  Play, 
  PenTool, 
  Code2, 
  Terminal, 
  Database,
  Globe,
  MoreVertical,
  Plus
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { AppManifest } from '../types';
import { AppUploader } from './AppUploader';

const mockData = {
  stats: {
    totalApps: 12,
    activeProjects: 5,
    totalPrompts: 847
  },
  apps: [
    {
      id: '1',
      name: 'geppy-app-hub',
      version: '2.0.0',
      description: 'A modern dashboard for managing AI-generated projects and prompts.',
      status: 'Live',
      category: 'Dashboard',
      techStack: ['React', 'Tailwind', 'Vite'],
      lastUpdated: '2 hours ago'
    },
    {
      id: '2',
      name: 'nexus-chat-ui',
      version: '1.2.4',
      description: 'Real-time chat interface with AI agent integration and markdown support.',
      status: 'Live',
      category: 'Communication',
      techStack: ['React', 'WebSockets', 'Node.js'],
      lastUpdated: '1 day ago'
    },
    {
      id: '3',
      name: 'data-viz-engine',
      version: '0.9.0',
      description: 'D3.js powered analytics dashboard for visualizing complex datasets.',
      status: 'Draft',
      category: 'Analytics',
      techStack: ['React', 'D3.js', 'Tailwind'],
      lastUpdated: '3 days ago'
    },
    {
      id: '4',
      name: 'synth-wave-maker',
      version: '1.0.1',
      description: 'Browser-based synthesizer and sequencer using Web Audio API.',
      status: 'Draft',
      category: 'Audio',
      techStack: ['TypeScript', 'Web Audio'],
      lastUpdated: '1 week ago'
    }
  ]
};

const TechIcon = ({ tech }: { tech: string }) => {
  switch (tech.toLowerCase()) {
    case 'react': return <Code2 size={14} className="text-cyan-400" />;
    case 'tailwind': return <PenTool size={14} className="text-teal-400" />;
    case 'node.js': return <Terminal size={14} className="text-green-500" />;
    case 'websockets': return <Globe size={14} className="text-blue-400" />;
    case 'd3.js': return <Database size={14} className="text-orange-400" />;
    default: return <Terminal size={14} className="text-slate-400" />;
  }
};

export const AppHubDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [apps, setApps] = useState<AppManifest[]>([]);
  const navigate = useNavigate();

  const loadApps = async () => {
    const loadedApps = await storageService.getAllApps();
    setApps(loadedApps.sort((a, b) => b.updatedAt - a.updatedAt));
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

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || app.status === activeFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const categories = ['All', 'Draft', 'Published', 'Archived'];

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-violet-500/30">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Code2 size={18} className="text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">App Hub</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <NavItem icon={<FolderKanban size={18} />} label="My Apps" />
          <NavItem icon={<Library size={18} />} label="Prompt Library" />
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <NavItem icon={<Settings size={18} />} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search apps, prompts, or projects..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-600"
              />
            </div>
            
            <div className="relative hidden sm:block">
              <select 
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-800 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-violet-500 transition-all cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                ))}
              </select>
              <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex items-center gap-4 ml-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <span className="text-xs font-medium">JG</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Apps" value={apps.length} trend="In your fleet" />
              <StatCard title="Active Projects" value={apps.filter(a => a.status === 'published').length} trend="Published apps" />
              <StatCard title="Prompts Generated" value={mockData.stats.totalPrompts} trend="+124 this month" />
            </div>

            {/* App Uploader */}
            <div className="mb-8">
              <AppUploader onUploadComplete={loadApps} />
            </div>

            {/* App Grid Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Applications</h2>
                <button 
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-violet-900/20"
                >
                  <Plus size={16} />
                  Create New App
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredApps.map(app => (
                  <AppCard key={app.id} app={app} />
                ))}
              </div>
              
              {filteredApps.length === 0 && (
                <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                  <p className="text-slate-500">No applications found matching your criteria.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

// Sub-components

const NavItem = ({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
    active 
      ? 'bg-violet-500/10 text-violet-400 font-medium' 
      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
  }`}>
    {icon}
    <span className="text-sm">{label}</span>
  </button>
);

const StatCard = ({ title, value, trend }: { title: string, value: number | string, trend: string }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-700"></div>
    <h3 className="text-slate-400 text-sm font-medium mb-2">{title}</h3>
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
      <span className="text-xs text-emerald-400 font-medium">{trend}</span>
    </div>
  </div>
);

const AppCard = ({ app }: { app: AppManifest }) => {
  const navigate = useNavigate();
  const isLive = app.status === 'published';
  
  // Extract tech stack from dependencies if available
  const techStack = app.blueprint?.features.flatMap(f => f.dependencies || []) || [];
  const uniqueTech = Array.from(new Set(techStack)).slice(0, 3);
  if (uniqueTech.length === 0) uniqueTech.push('React', 'Tailwind');
  
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
      {/* Subtle gradient hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors flex items-center gap-2">
            {app.name}
          </h3>
          <span className="text-xs font-mono text-slate-500">v{app.version}</span>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isLive 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          {app.status}
        </div>
      </div>
      
      <p className="text-sm text-slate-400 mb-6 flex-1 line-clamp-2 relative z-10">
        {app.description}
      </p>
      
      <div className="mt-auto relative z-10">
        <div className="flex items-center gap-2 mb-5">
          {uniqueTech.map((tech, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md" title={tech}>
              <TechIcon tech={tech} />
              <span className="text-[10px] font-medium text-slate-300">{tech}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
          <span className="text-xs text-slate-500">{new Date(app.updatedAt).toLocaleDateString()}</span>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">
              <Settings size={14} />
              Manage
            </button>
            <button 
              onClick={() => navigate(`/app/${app.id}`)}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-violet-900/20"
            >
              <Play size={14} className="fill-current" />
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
