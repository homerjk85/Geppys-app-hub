import React, { useState } from 'react';
import { Palette, Type, Layout, MousePointer2, Copy, Check, Sparkles, Layers } from 'lucide-react';
import { StyleDNA } from '../types';

interface StyleVisualizerProps {
  style: StyleDNA;
}

export const StyleVisualizer: React.FC<StyleVisualizerProps> = ({ style }) => {
  const [activeTab, setActiveTab] = useState<'palette' | 'components' | 'typography'>('palette');
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  // Helper to extract colors from tailwind snippet if possible, otherwise just use primary/secondary
  const extractColors = () => {
    const colors = [
      { name: 'Primary', value: style.primaryColor },
      { name: 'Secondary', value: style.secondaryColor },
    ];
    
    // Naive extraction of hex codes from snippet for demo purposes
    // In a real app, we might parse the JSON/JS object
    const hexRegex = /#([0-9A-F]{3}){1,2}/gi;
    const matches = style.tailwindConfigSnippet.match(hexRegex);
    if (matches) {
      matches.forEach((hex, idx) => {
        if (!colors.some(c => c.value.toLowerCase() === hex.toLowerCase())) {
          colors.push({ name: `Custom ${idx + 1}`, value: hex });
        }
      });
    }
    return colors;
  };

  const colors = extractColors();

  // Dynamic styles based on blueprint
  const containerStyle = {
    borderRadius: style.borderRadius,
  };

  const buttonStyle = {
    backgroundColor: style.primaryColor,
    color: '#ffffff',
    borderRadius: style.borderRadius,
  };

  const secondaryButtonStyle = {
    backgroundColor: style.secondaryColor,
    color: '#ffffff',
    borderRadius: style.borderRadius,
  };

  const outlineButtonStyle = {
    border: `2px solid ${style.primaryColor}`,
    color: style.primaryColor,
    borderRadius: style.borderRadius,
    backgroundColor: 'transparent',
  };

  return (
    <div className="bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b-4 border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-geppy-blue/10 text-geppy-blue rounded-2xl border-2 border-geppy-blue/20">
              <Palette size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-geppy-darkBlue">Brand & Style Visualizer</h3>
              <p className="text-slate-500 font-medium">Visual DNA: <span className="text-geppy-blue">{style.componentVibe}</span></p>
            </div>
          </div>
          <div className="flex bg-white p-1 rounded-xl border-2 border-slate-200 shadow-sm">
            {[
              { id: 'palette', icon: <Palette size={16} />, label: 'Palette' },
              { id: 'components', icon: <Layout size={16} />, label: 'Components' },
              { id: 'typography', icon: <Type size={16} />, label: 'Config' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-geppy-blue text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-8 min-h-[400px]">
        {activeTab === 'palette' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {colors.map((color, idx) => (
                <div key={idx} className="group cursor-pointer" onClick={() => handleCopyColor(color.value)}>
                  <div 
                    className="h-32 rounded-2xl shadow-sm border-4 border-white ring-2 ring-slate-100 mb-3 transition-transform group-hover:scale-105 relative flex items-center justify-center"
                    style={{ backgroundColor: color.value, borderRadius: style.borderRadius }}
                  >
                    {copiedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-[inherit] backdrop-blur-sm animate-in fade-in">
                        <Check className="text-white" size={32} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <div className="font-bold text-slate-700">{color.name}</div>
                      <div className="font-mono text-xs text-slate-400 uppercase">{color.value}</div>
                    </div>
                    <button className="p-2 text-slate-300 hover:text-geppy-blue transition-colors">
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-geppy-orange" />
                <span>Color Relationships</span>
              </h4>
              <div className="h-24 rounded-xl flex overflow-hidden border-2 border-slate-200">
                <div className="flex-1 flex items-center justify-center text-white/90 font-bold text-sm" style={{ backgroundColor: style.primaryColor }}>Primary</div>
                <div className="flex-1 flex items-center justify-center text-white/90 font-bold text-sm" style={{ backgroundColor: style.secondaryColor }}>Secondary</div>
                <div className="flex-1 flex items-center justify-center text-white/90 font-bold text-sm" style={{ backgroundColor: style.primaryColor, filter: 'brightness(1.2) saturate(0.8)' }}>Tint</div>
                <div className="flex-1 flex items-center justify-center text-white/90 font-bold text-sm" style={{ backgroundColor: style.primaryColor, filter: 'brightness(0.8) saturate(1.2)' }}>Shade</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Tactile Preview */}
            <div className="space-y-8">
              <div>
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-4">Buttons & Actions</h4>
                <div className="flex flex-wrap gap-4 items-center">
                  <button 
                    style={buttonStyle}
                    className="px-6 py-3 font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <MousePointer2 size={18} />
                    <span>Primary Action</span>
                  </button>
                  <button 
                    style={secondaryButtonStyle}
                    className="px-6 py-3 font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
                  >
                    Secondary
                  </button>
                  <button 
                    style={outlineButtonStyle}
                    className="px-6 py-3 font-semibold hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Outline
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-4">Form Elements</h4>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input 
                      type="text" 
                      placeholder="user@example.com"
                      className="w-full px-4 py-3 border-2 border-slate-200 focus:outline-none focus:ring-4 transition-all"
                      style={{ 
                        borderRadius: style.borderRadius,
                        borderColor: 'e2e8f0', // slate-200
                        // We can't easily inject dynamic focus ring color in inline styles, 
                        // but we can simulate the border color change
                      }} 
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 rounded text-geppy-blue focus:ring-geppy-blue" />
                    <span className="text-slate-600">Remember me</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Preview */}
            <div>
              <h4 className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-4">Card Component</h4>
              <div 
                className="bg-white border-2 border-slate-100 shadow-lg p-6 max-w-sm"
                style={containerStyle}
              >
                <div 
                  className="w-12 h-12 flex items-center justify-center mb-4 text-white"
                  style={{ 
                    backgroundColor: style.primaryColor,
                    borderRadius: style.borderRadius 
                  }}
                >
                  <Layers size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Dynamic Card</h3>
                <p className="text-slate-500 mb-6 leading-relaxed">
                  This card inherits the border radius ({style.borderRadius}) and primary color from your blueprint's style DNA.
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-400">Step 1 of 3</span>
                  <button 
                    className="text-sm font-bold hover:underline"
                    style={{ color: style.primaryColor }}
                  >
                    Learn more →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'typography' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 border-4 border-slate-800 overflow-hidden relative">
              <div className="absolute top-4 right-4 px-2 py-1 bg-slate-800 text-slate-400 text-xs font-mono rounded">tailwind.config.js</div>
              <pre className="font-mono text-sm text-blue-300 overflow-x-auto">
                <code>{style.tailwindConfigSnippet}</code>
              </pre>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Border Radius</div>
                <div className="text-3xl font-mono font-bold text-slate-700">{style.borderRadius}</div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Component Vibe</div>
                <div className="text-3xl font-bold text-slate-700 capitalize">{style.componentVibe}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
