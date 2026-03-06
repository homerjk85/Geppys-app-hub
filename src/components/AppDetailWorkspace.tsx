import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Play, Trash2, Code2, Layout, Database, Upload, FileArchive, Check, X, Lightbulb, Zap, Copy, Sparkles, Palette, Layers, History, LayoutDashboard, GitCompare, Image as ImageIcon, Plus, MessageSquare } from 'lucide-react';
import { storageService } from '../services/storageService';
import { processZipUpload } from '../services/extractionService';
import { auditService } from '../services/auditService';
import { AppManifest, AppBlueprint } from '../types';
import { ArchiveDiffViewer } from './ArchiveDiffViewer';
import { AppActionCenter } from './AppActionCenter';
import { GeppyChat } from './GeppyChat';
import { VersionTimeline } from './dashboard/VersionTimeline';
import { DNADiffViewer } from './dashboard/DNADiffViewer';

export const AppDetailWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AppManifest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasArchive, setHasArchive] = useState(false);
  const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);
  const [isUpdatingGithub, setIsUpdatingGithub] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [pendingBlueprint, setPendingBlueprint] = useState<AppBlueprint | null>(null);
  const [pendingArchive, setPendingArchive] = useState<File | null>(null);
  const [copiedSuggestionId, setCopiedSuggestionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prompt-dashboard' | 'style' | 'features' | 'history' | 'changes' | 'assets' | 'timeline'>('dashboard');
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ id: string; appId: string; timestamp: number; manifest: AppManifest } | null>(null);
  
  // Asset form state
  const [newAsset, setNewAsset] = useState({ type: 'image', name: '', url: '', className: '', content: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadApp = async () => {
      if (!id) return;
      const loadedApp = await storageService.getApp(id);
      if (loadedApp) {
        setApp(loadedApp);
        const archive = await storageService.getArchive(id);
        setHasArchive(!!archive);
      } else {
        navigate('/');
      }
    };
    loadApp();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!app) return;
    setIsSaving(true);
    await storageService.saveApp({
      ...app,
      updatedAt: Date.now()
    });
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleDelete = async () => {
    if (!app) return;
    await storageService.deleteApp(app.id);
    navigate('/');
  };

  const handleUpdateFromGithub = async () => {
    if (!app || !app.githubUrl) return;
    
    setIsUpdatingGithub(true);
    try {
      // 1. Download ZIP from GitHub Proxy
      const response = await fetch(`/api/github/download?url=${encodeURIComponent(app.githubUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `GitHub download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = app.githubUrl.split('/').pop()?.replace('.git', '') + '.zip' || 'github-update.zip';
      const file = new File([blob], filename, { type: 'application/zip' });

      // 2. Process the ZIP
      const fileMap = await processZipUpload(file);
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const newBlueprint = await auditService.analyzeCodebase(fileMap, app.blueprint?.features, apiKey);
      
      if (!app.blueprint) {
        // If there was no previous blueprint, just save it directly
        await storageService.saveArchive(app.id, file);
        const newVersion = incrementVersion(app.version);
        const updatedApp = {
          ...app,
          version: newVersion,
          description: newBlueprint.appDescription || app.description,
          updatedAt: Date.now(),
          blueprint: newBlueprint,
          changelog: [
            ...(app.changelog || []),
            {
              version: newVersion,
              timestamp: Date.now(),
              changes: newBlueprint.recentChanges || 'Updated from GitHub.',
              originalFilename: file.name
            }
          ]
        };
        await storageService.saveApp(updatedApp);
        setApp(updatedApp);
        setHasArchive(true);
        alert('App updated from GitHub successfully! Version bumped.');
      } else {
        // We have an old blueprint, show diff
        setPendingBlueprint(newBlueprint);
        setPendingArchive(file);
        setActiveTab('changes');
      }

    } catch (error: any) {
      console.error('Failed to update from GitHub:', error);
      alert(`Failed to update from GitHub: ${error.message}`);
    } finally {
      setIsUpdatingGithub(false);
    }
  };

  const handleUpdateArchive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !app) return;

    setIsUpdatingArchive(true);
    try {
      const fileMap = await processZipUpload(file);
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const newBlueprint = await auditService.analyzeCodebase(fileMap, app.blueprint?.features, apiKey);
      
      if (!app.blueprint) {
        // If there was no previous blueprint, just save it directly
        await storageService.saveArchive(app.id, file);
        const newVersion = incrementVersion(app.version);
        const updatedApp = {
          ...app,
          version: newVersion,
          description: newBlueprint.appDescription || app.description,
          updatedAt: Date.now(),
          blueprint: newBlueprint,
          changelog: [
            ...(app.changelog || []),
            {
              version: newVersion,
              timestamp: Date.now(),
              changes: newBlueprint.recentChanges || 'Initial blueprint generated.',
              originalFilename: file.name
            }
          ]
        };
        await storageService.saveApp(updatedApp);
        setApp(updatedApp);
        setHasArchive(true);
        alert('Archive updated successfully! Version bumped.');
      } else {
        // We have an old blueprint, show diff
        setPendingBlueprint(newBlueprint);
        setPendingArchive(file);
        setActiveTab('changes');
      }
    } catch (error) {
      console.error('Failed to update archive:', error);
      alert('Failed to analyze the new ZIP.');
    } finally {
      setIsUpdatingArchive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAcceptDiff = async () => {
    if (!app || !pendingBlueprint || !pendingArchive) return;
    
    setIsSaving(true);
    try {
      await storageService.saveArchive(app.id, pendingArchive);
      const newVersion = incrementVersion(app.version);
      const updatedApp = {
        ...app,
        version: newVersion,
        description: pendingBlueprint.appDescription || app.description,
        updatedAt: Date.now(),
        blueprint: {
          ...pendingBlueprint,
          previousFeatures: app.blueprint?.features || [],
          assets: [
            ...(app.blueprint?.assets || []),
            ...(pendingBlueprint.assets || []).filter(
              newAsset => !(app.blueprint?.assets || []).some(oldAsset => oldAsset.name === newAsset.name)
            )
          ]
        },
        changelog: [
          ...(app.changelog || []),
          {
            version: newVersion,
            timestamp: Date.now(),
            changes: pendingBlueprint.recentChanges || 'Updated archive.',
            originalFilename: pendingArchive.name
          }
        ]
      };
      await storageService.saveApp(updatedApp);
      setApp(updatedApp);
      setHasArchive(true);
      setPendingBlueprint(null);
      setPendingArchive(null);
    } catch (error) {
      console.error('Failed to save updates:', error);
      alert('Failed to save updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDiff = () => {
    setPendingBlueprint(null);
    setPendingArchive(null);
  };

  const incrementVersion = (version: string) => {
    const parts = version.split('.');
    if (parts.length === 3) {
      parts[2] = (parseInt(parts[2]) + 1).toString();
      return parts.join('.');
    }
    return version;
  };

  const handleCopySuggestion = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSuggestionId(id);
    setTimeout(() => setCopiedSuggestionId(null), 2000);
  };

  const handleAddAsset = () => {
    if (!app || !app.blueprint || !newAsset.name) return;
    if (newAsset.type !== 'button' && !newAsset.url) return;
    
    const asset = {
      ...newAsset,
      id: `asset-${Date.now()}`,
      type: newAsset.type as any
    };
    
    const updatedApp = {
      ...app,
      blueprint: {
        ...app.blueprint,
        assets: [...(app.blueprint.assets || []), asset]
      }
    };
    
    setApp(updatedApp);
    setNewAsset({ type: 'image', name: '', url: '', className: '', content: '' });
    // Auto-save when adding an asset
    storageService.saveApp(updatedApp);
  };

  const handleDeleteAsset = (assetId: string) => {
    if (!app || !app.blueprint) return;
    
    const updatedApp = {
      ...app,
      blueprint: {
        ...app.blueprint,
        assets: (app.blueprint.assets || []).filter(a => a.id !== assetId)
      }
    };
    
    setApp(updatedApp);
    storageService.saveApp(updatedApp);
  };

  if (!app) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-geppy-blue"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-88px)]">
      {/* Workspace Toolbar */}
      <div className="bg-white border-b-4 border-geppy-darkBlue px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <Link 
            to="/"
            className="p-2 bg-slate-100 text-geppy-darkBlue rounded-full border-2 border-geppy-darkBlue border-b-4 active:border-b-2 active:translate-y-[2px] hover:bg-slate-200 transition-all"
          >
            <ArrowLeft size={20} />
          </Link>
          
          <div>
            <input 
              type="text"
              value={app.name}
              onChange={(e) => setApp({ ...app, name: e.target.value })}
              className="text-2xl font-bold text-geppy-darkBlue bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-geppy-blue/50 rounded px-2 -ml-2"
            />
            <div className="flex items-center gap-3 mt-1 px-2">
              <span className="font-mono text-xs text-slate-500">ID: {app.id.split('-')[0]}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="font-mono text-xs text-slate-500">v{app.version}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <input 
            type="file" 
            accept=".zip" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleUpdateArchive}
          />
          
          {app.githubUrl && (
            <button 
              onClick={handleUpdateFromGithub}
              disabled={isUpdatingGithub || !!pendingBlueprint}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full font-bold border-4 border-slate-900 border-b-[8px] active:border-b-4 active:translate-y-1 transition-all disabled:opacity-70 disabled:active:border-b-[8px] disabled:active:translate-y-0"
              title={`Update from ${app.githubUrl}`}
            >
              <div className="bg-white text-slate-900 rounded-full p-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              </div>
              <span>{isUpdatingGithub ? 'Pulling...' : 'Update from GitHub'}</span>
            </button>
          )}

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUpdatingArchive || !!pendingBlueprint}
            className="flex items-center gap-2 bg-slate-100 text-geppy-darkBlue px-4 py-2 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all disabled:opacity-70 disabled:active:border-b-[8px] disabled:active:translate-y-0"
          >
            <Upload size={18} className={isUpdatingArchive ? 'animate-bounce' : ''} />
            <span>{isUpdatingArchive ? 'Analyzing...' : 'Update Source ZIP'}</span>
          </button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 bg-red-50 px-2 py-1 rounded-full border-2 border-red-200">
              <span className="text-sm font-bold text-red-600 px-2">Sure?</span>
              <button onClick={handleDelete} className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                <Check size={16} />
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-1 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-full font-bold transition-colors"
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          )}
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-slate-100 text-geppy-darkBlue px-6 py-2 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all"
          >
            <Save size={18} className={isSaving ? 'animate-pulse text-geppy-blue' : ''} />
            <span>{isSaving ? 'Saved!' : 'Save Draft'}</span>
          </button>

          <button className="flex items-center gap-2 bg-geppy-blue text-white px-6 py-2 rounded-full font-bold border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all">
            <Play size={18} fill="currentColor" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Workspace Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r-4 border-geppy-darkBlue p-4 flex flex-col gap-2 shrink-0 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4">Workspace</div>
          
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
            { id: 'prompt-dashboard', label: 'Prompt Dashboard', icon: <MessageSquare size={20} /> },
            { id: 'timeline', label: 'DNA Timeline', icon: <History size={20} /> },
            { id: 'changes', label: 'Version Changes', icon: <GitCompare size={20} /> },
            { id: 'style', label: 'Style Manifest', icon: <Palette size={20} /> },
            { id: 'assets', label: 'Assets & Buttons', icon: <ImageIcon size={20} /> },
            { id: 'features', label: 'Features & Preview', icon: <Layers size={20} /> },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${
                activeTab === tab.id 
                  ? 'bg-geppy-blue/10 text-geppy-blue border-2 border-geppy-blue/20' 
                  : 'text-slate-600 hover:bg-slate-100 border-2 border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 bg-slate-50 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            {activeTab === 'dashboard' && (
              <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-16 h-16 rounded-2xl border-4 border-geppy-darkBlue flex items-center justify-center text-2xl font-bold text-white shadow-sm"
                          style={{ backgroundColor: app.blueprint?.style?.primaryColor || '#0052FF' }}
                        >
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-geppy-darkBlue">App Dashboard</h3>
                          <p className="text-slate-500 font-medium">General configuration and metadata</p>
                        </div>
                      </div>
                      {hasArchive && (
                        <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold border-2 border-emerald-200 mt-2">
                          <FileArchive size={16} />
                          <span>Source ZIP Attached</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <textarea 
                          value={app.description}
                          onChange={(e) => setApp({ ...app, description: e.target.value })}
                          className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-4 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/20 transition-all min-h-[120px]"
                          placeholder="Describe your app..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Version</label>
                          <input 
                            type="text"
                            value={app.version}
                            onChange={(e) => setApp({ ...app, version: e.target.value })}
                            className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-4 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/20 transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                          <select 
                            value={app.status}
                            onChange={(e) => setApp({ ...app, status: e.target.value as any })}
                            className="w-full bg-slate-50 border-4 border-slate-200 rounded-2xl p-4 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/20 transition-all font-bold appearance-none"
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
            )}

            {activeTab === 'changes' && (
              <>
                {pendingBlueprint ? (
                  <ArchiveDiffViewer 
                    oldFeatures={app.blueprint?.features || []}
                    newFeatures={pendingBlueprint.features}
                    onAccept={handleAcceptDiff}
                    onCancel={handleCancelDiff}
                  />
                ) : app.blueprint?.previousFeatures ? (
                  <ArchiveDiffViewer 
                    oldFeatures={app.blueprint.previousFeatures}
                    newFeatures={app.blueprint.features}
                    onAccept={() => {}}
                    onCancel={() => {}}
                    readOnly={true}
                  />
                ) : (
                  <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 text-center text-slate-500 font-medium">
                    No version changes available. Upload a new ZIP to see the diff.
                  </div>
                )}
              </>
            )}

            {activeTab === 'timeline' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <VersionTimeline 
                    appId={app.id} 
                    onSelectSnapshot={setSelectedSnapshot} 
                    selectedSnapshotId={selectedSnapshot?.id || null} 
                  />
                </div>
                <div className="lg:col-span-2">
                  <DNADiffViewer 
                    currentManifest={app} 
                    snapshotManifest={selectedSnapshot?.manifest || null} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'prompt-dashboard' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-[calc(100vh-180px)]">
                {/* Chat Section */}
                <div className="h-full min-h-[600px]">
                   <GeppyChat mode="embedded" initialApp={app} className="h-full" />
                </div>

                {/* Suggestions Section */}
                <div className="overflow-y-auto pr-2 space-y-6">
                  {app.blueprint ? (
                    (app.blueprint.featureSuggestions?.length || app.blueprint.functionalitySuggestions?.length) ? (
                      <div className="space-y-6">
                        {/* Feature Suggestions */}
                        {app.blueprint.featureSuggestions && app.blueprint.featureSuggestions.length > 0 && (
                          <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="p-2 bg-geppy-orange/10 text-geppy-orange rounded-xl">
                                <Lightbulb size={24} />
                              </div>
                              <h3 className="text-xl font-bold text-geppy-darkBlue">Feature Ideas</h3>
                            </div>
                            <div className="space-y-4">
                              {app.blueprint.featureSuggestions.map((suggestion) => (
                                <div key={suggestion.id} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 hover:border-geppy-orange/50 transition-colors">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-slate-800">{suggestion.title}</h4>
                                    <button 
                                      onClick={() => handleCopySuggestion(suggestion.codeSnippet, suggestion.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-geppy-darkBlue transition-colors shrink-0 ml-2"
                                    >
                                      {copiedSuggestionId === suggestion.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      {copiedSuggestionId === suggestion.id ? 'Copied!' : 'Copy Prompt'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-slate-600">{suggestion.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Functionality Suggestions */}
                        {app.blueprint.functionalitySuggestions && app.blueprint.functionalitySuggestions.length > 0 && (
                          <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="p-2 bg-geppy-blue/10 text-geppy-blue rounded-xl">
                                <Zap size={24} />
                              </div>
                              <h3 className="text-xl font-bold text-geppy-darkBlue">App Improvements</h3>
                            </div>
                            <div className="space-y-4">
                              {app.blueprint.functionalitySuggestions.map((suggestion) => (
                                <div key={suggestion.id} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 hover:border-geppy-blue/50 transition-colors">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-bold text-slate-800">{suggestion.title}</h4>
                                    <button 
                                      onClick={() => handleCopySuggestion(suggestion.codeSnippet, suggestion.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-geppy-darkBlue transition-colors shrink-0 ml-2"
                                    >
                                      {copiedSuggestionId === suggestion.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      {copiedSuggestionId === suggestion.id ? 'Copied!' : 'Copy Prompt'}
                                    </button>
                                  </div>
                                  <p className="text-sm text-slate-600">{suggestion.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 text-center text-slate-500 font-medium">
                        No AI suggestions available for this version.
                      </div>
                    )
                  ) : (
                    <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 text-center text-slate-500 font-medium">
                      Upload a source ZIP to generate AI suggestions.
                    </div>
                  )}
                </div>
              </div>
            )}

                {activeTab === 'style' && (
                  <>
                    {app.blueprint ? (
                      <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-2xl font-bold text-geppy-darkBlue">Style Manifest</h3>
                          <span className="px-3 py-1 bg-geppy-orange/10 text-geppy-orange rounded-full text-sm font-bold border-2 border-geppy-orange/20">
                            Vibe: {app.blueprint.style.componentVibe}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-6 mb-6">
                          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                            <div className="text-sm font-bold text-slate-500 mb-1">Primary Color</div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full border-2 border-slate-300" style={{ backgroundColor: app.blueprint.style.primaryColor }}></div>
                              <span className="font-mono font-bold">{app.blueprint.style.primaryColor}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                            <div className="text-sm font-bold text-slate-500 mb-1">Secondary Color</div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full border-2 border-slate-300" style={{ backgroundColor: app.blueprint.style.secondaryColor }}></div>
                              <span className="font-mono font-bold">{app.blueprint.style.secondaryColor}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                            <div className="text-sm font-bold text-slate-500 mb-1">Border Radius</div>
                            <div className="font-mono font-bold">{app.blueprint.style.borderRadius}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-500 mb-2">Tailwind Config Snippet</div>
                          <pre className="bg-slate-900 text-slate-300 p-4 rounded-2xl overflow-x-auto font-mono text-sm border-4 border-slate-800">
                            <code>{app.blueprint.style.tailwindConfigSnippet}</code>
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 text-center text-slate-500 font-medium">
                        Upload a source ZIP to generate a style manifest.
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'assets' && (
                  <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-geppy-darkBlue">Assets & Buttons</h3>
                      <p className="text-slate-500 font-medium text-sm">Manage images, icons, and button previews</p>
                    </div>

                    {/* Add New Asset Form */}
                    <div className="bg-slate-50 p-6 rounded-2xl border-4 border-slate-200 mb-8">
                      <h4 className="font-bold text-slate-700 mb-4">Add New Asset</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Type</label>
                          <select 
                            value={newAsset.type}
                            onChange={(e) => setNewAsset({...newAsset, type: e.target.value})}
                            className="w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue font-bold"
                          >
                            <option value="image">Image</option>
                            <option value="button">Button</option>
                            <option value="icon">Icon</option>
                            <option value="favicon">Favicon</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Name</label>
                          <input 
                            type="text"
                            value={newAsset.name}
                            onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                            placeholder="e.g., Undo Button"
                            className="w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Image URL {newAsset.type === 'button' && '(Optional)'}</label>
                          <input 
                            type="text"
                            value={newAsset.url}
                            onChange={(e) => setNewAsset({...newAsset, url: e.target.value})}
                            placeholder="https://example.com/image.png"
                            className="w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue font-mono text-sm"
                          />
                        </div>
                        {newAsset.type === 'button' && (
                          <>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tailwind Classes (Optional)</label>
                              <input 
                                type="text"
                                value={newAsset.className}
                                onChange={(e) => setNewAsset({...newAsset, className: e.target.value})}
                                placeholder="e.g., w-12 h-12 rounded-full shadow-md"
                                className="w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue font-mono text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Button Content / Text (Optional)</label>
                              <input 
                                type="text"
                                value={newAsset.content || ''}
                                onChange={(e) => setNewAsset({...newAsset, content: e.target.value})}
                                placeholder="e.g., Submit, Undo, or Icon Name"
                                className="w-full bg-white border-2 border-slate-200 rounded-xl p-2.5 text-slate-700 focus:outline-none focus:border-geppy-blue font-mono text-sm"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={handleAddAsset}
                        disabled={!newAsset.name || (newAsset.type !== 'button' && !newAsset.url)}
                        className="flex items-center justify-center gap-2 w-full bg-geppy-blue text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        <Plus size={18} />
                        <span>Add Asset</span>
                      </button>
                    </div>

                    {/* Asset List */}
                    <div className="space-y-4">
                      {app.blueprint?.assets && app.blueprint.assets.length > 0 ? (
                        app.blueprint.assets.map((asset) => (
                          <div key={asset.id} className="flex items-center gap-6 p-4 bg-white border-2 border-slate-200 rounded-2xl group hover:border-geppy-blue/30 transition-colors">
                            <div className="w-24 h-24 shrink-0 bg-slate-100 rounded-xl border-2 border-slate-200 flex items-center justify-center overflow-hidden relative">
                              {asset.type === 'button' ? (
                                <button 
                                  className={asset.className || 'w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-500'}
                                  style={asset.url ? { backgroundImage: `url(${asset.url})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}}
                                >
                                  {!asset.url && (asset.content || 'Btn')}
                                </button>
                              ) : (
                                asset.url ? <img src={asset.url} alt={asset.name} className="max-w-full max-h-full object-contain" /> : <div className="text-xs text-slate-400">No Image</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase tracking-wider">
                                  {asset.type}
                                </span>
                                <h4 className="font-bold text-slate-800 truncate">{asset.name}</h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  readOnly
                                  value={asset.url || asset.className || asset.content || ''}
                                  className="flex-1 bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-mono text-slate-500 truncate"
                                />
                                <button 
                                  onClick={() => handleCopySuggestion(asset.url || asset.className || asset.content || '', asset.id)}
                                  className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors shrink-0"
                                  title="Copy"
                                >
                                  {copiedSuggestionId === asset.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                              </div>
                              {asset.type === 'button' && asset.className && (
                                <div className="mt-2 text-xs font-mono text-slate-400 truncate">
                                  classes: {asset.className}
                                </div>
                              )}
                            </div>
                            <button 
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Asset"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-500 font-medium">
                          No assets found or added yet. Upload a source ZIP to analyze for buttons and assets.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'features' && (
                  <>
                    {app.blueprint ? (
                      <AppActionCenter app={app} />
                    ) : (
                      <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8 text-center text-slate-500 font-medium">
                        Upload a source ZIP to extract features and preview.
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'history' && (
                  <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] p-8">
                    <h3 className="text-2xl font-bold text-geppy-darkBlue mb-6">Update History</h3>
                    <div className="space-y-4">
                      {(app.changelog || []).slice().reverse().map((log, idx) => (
                        <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-slate-200">
                          <div className="shrink-0 pt-1">
                            <span className="px-3 py-1 bg-geppy-blue/10 text-geppy-blue rounded-full text-sm font-bold border-2 border-geppy-blue/20">
                              v{log.version}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-500">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              {log.originalFilename && (
                                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {log.originalFilename}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-700">{log.changes}</p>
                          </div>
                        </div>
                      ))}
                      {(!app.changelog || app.changelog.length === 0) && (
                        <p className="text-slate-500 italic">No update history available.</p>
                      )}
                    </div>
                  </div>
                )}
          </div>
        </div>
      </div>
    </div>
  );
};
