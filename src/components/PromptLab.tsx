import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckSquare, Square, Wand2, Copy, Check, MessageSquare, Plus, Trash2, Send, Bot, User, Download, Lightbulb } from 'lucide-react';
import { AppManifest, AISuggestion } from '../types';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { chatService } from '../services/chatService';

interface PromptLabProps {
  app: AppManifest;
  customApiKey?: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

export const PromptLab: React.FC<PromptLabProps> = ({ app, customApiKey }) => {
  // State for Features (Left Column)
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // State for Objectives & Chat (Middle Column)
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for Output (Right Column)
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize Chat
  useEffect(() => {
    const session = chatService.createSession(app, customApiKey);
    setChatSession(session);
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `Hi! I'm Geppy. Let's plan the next iteration for **${app.name}**. What are we building today?`
    }]);
  }, [app, customApiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Feature Selection Logic ---
  const toggleFeature = (id: string) => {
    const newSet = new Set(selectedFeatures);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFeatures(newSet);
  };

  const toggleSuggestion = (id: string) => {
    const newSet = new Set(selectedSuggestions);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSuggestions(newSet);
  };

  // --- Objective Logic ---
  const addObjective = () => {
    if (newObjective.trim()) {
      setObjectives([...objectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const handleObjectiveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addObjective();
  };

  // --- Chat Logic ---
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatSession) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isStreaming: true }]);

    try {
      // We inject the current objectives into the context implicitly by the nature of the conversation,
      // but we could also explicitly prepend them if needed. For now, we rely on the chat flow.
      const stream = await chatSession.sendMessageStream({ message: userMsg.text });
      
      let fullText = '';
      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
          setMessages(prev => prev.map(msg => 
            msg.id === modelMsgId ? { ...msg, text: fullText } : msg
          ));
        }
      }
      
      setMessages(prev => prev.map(msg => 
        msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg
      ));
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: "I encountered an error. Please try again." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Generation Logic ---
  const handleGeneratePrompt = async () => {
    if (selectedFeatures.size === 0 && objectives.length === 0 && selectedSuggestions.size === 0) return;
    setIsGenerating(true);
    setCopied(false);
    
    try {
      let apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      if (apiKey) {
        apiKey = apiKey.trim();
        while ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
          apiKey = apiKey.slice(1, -1);
        }
      }

      if (!apiKey) {
        setGeneratedPrompt("### API Key Missing\n\nTo generate a Master Prompt with AI, you need to configure your Gemini API Key in the environment variables.\n\nHowever, you can still manually draft a prompt based on the selections above.");
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Gather Context
      const selectedFeaturesData = app.blueprint?.features.filter(f => selectedFeatures.has(f.id)) || [];
      const featuresContext = selectedFeaturesData.map(f => `- [Feature] ${f.name}: ${f.behavior}`).join('\n');
      
      const selectedSuggestionsData = [
        ...(app.blueprint?.featureSuggestions || []),
        ...(app.blueprint?.functionalitySuggestions || [])
      ].filter(s => selectedSuggestions.has(s.id));
      const suggestionsContext = selectedSuggestionsData.map(s => `- [Suggestion] ${s.title}: ${s.description}`).join('\n');

      const objectivesContext = objectives.map(o => `- [Objective] ${o}`).join('\n');
      
      // We also include the last few chat messages to capture the "vibe" or specific instructions discussed
      const recentChat = messages.slice(-4).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

      const prompt = `You are Geppy, an expert Technical Product Manager and Prompt Engineer.
I am preparing a "Master Prompt" to update the app "${app.name}".

Here is the context of what we want to achieve:

### 1. Existing Features to Iterate On:
${featuresContext || "(None selected)"}

### 2. New AI Suggestions to Implement:
${suggestionsContext || "(None selected)"}

### 3. Specific User Objectives:
${objectivesContext || "(None provided)"}

### 4. Recent Planning Conversation:
${recentChat}

---
**TASK:**
Generate a comprehensive, structured, and high-quality "Master Prompt" that I can copy and paste into an AI coding assistant (like Google AI Studio or a coding agent). 
This prompt should:
1. Clearly state the goal of this update.
2. Provide the necessary context about existing features.
3. List the new requirements/objectives in detail.
4. Include specific instructions on preventing hallucinations (e.g., "Do not remove existing features unless specified", "Maintain the current tech stack").
5. Be formatted in Markdown for easy reading and copying.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setGeneratedPrompt(response.text || '');
    } catch (error) {
      console.error("Failed to generate prompt:", error);
      setGeneratedPrompt("Error generating prompt. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!generatedPrompt) return;
    const blob = new Blob([generatedPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.name.toLowerCase().replace(/\s+/g, '-')}-prompt.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full gap-4">
      {/* --- LEFT COLUMN: Context & Features --- */}
      <div className="w-[25%] flex flex-col gap-4 min-w-[250px]">
        <div className="bg-white rounded-2xl border-4 border-geppy-darkBlue border-b-[8px] p-4 shadow-sm flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-geppy-blue" />
            <h3 className="font-bold text-geppy-darkBlue">Blueprint DNA</h3>
          </div>
          
          {/* Existing Features */}
          <div className="space-y-2 mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Existing Features</h4>
            {app.blueprint?.features.map(feature => (
              <div 
                key={feature.id}
                onClick={() => toggleFeature(feature.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2 ${
                  selectedFeatures.has(feature.id) 
                    ? 'bg-geppy-blue/10 border-geppy-blue text-geppy-darkBlue' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-geppy-blue/50'
                }`}
              >
                <div className="mt-0.5 text-geppy-blue shrink-0">
                  {selectedFeatures.has(feature.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{feature.name}</h4>
                  <p className="text-xs opacity-80 line-clamp-2">{feature.behavior}</p>
                </div>
              </div>
            ))}
            {(!app.blueprint || app.blueprint.features.length === 0) && (
              <div className="text-center text-slate-400 text-xs py-4">No features found.</div>
            )}
          </div>

          {/* AI Suggestions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Suggestions</h4>
            {[...(app.blueprint?.featureSuggestions || []), ...(app.blueprint?.functionalitySuggestions || [])].map(suggestion => (
              <div 
                key={suggestion.id}
                onClick={() => toggleSuggestion(suggestion.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2 ${
                  selectedSuggestions.has(suggestion.id) 
                    ? 'bg-purple-100 border-purple-500 text-purple-900' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300'
                }`}
              >
                <div className="mt-0.5 text-purple-600 shrink-0">
                  {selectedSuggestions.has(suggestion.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <Lightbulb size={12} className="text-purple-500" />
                    <h4 className="font-bold text-sm">{suggestion.title}</h4>
                  </div>
                  <p className="text-xs opacity-80 line-clamp-2">{suggestion.description}</p>
                </div>
              </div>
            ))}
            {(!app.blueprint?.featureSuggestions && !app.blueprint?.functionalitySuggestions) && (
              <div className="text-center text-slate-400 text-xs py-4">No suggestions available.</div>
            )}
          </div>
        </div>
      </div>

      {/* --- MIDDLE COLUMN: Planner & Chat --- */}
      <div className="w-[40%] flex flex-col gap-4 min-w-[350px]">
        {/* Objectives Section */}
        <div className="bg-white rounded-2xl border-4 border-geppy-darkBlue border-b-[8px] p-4 shadow-sm h-1/3 flex flex-col">
          <h3 className="font-bold text-geppy-darkBlue mb-2 flex items-center gap-2">
            <CheckSquare size={18} />
            Staged Objectives
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
            {objectives.map((obj, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 group">
                <span className="text-sm text-slate-700">{obj}</span>
                <button onClick={() => removeObjective(idx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {objectives.length === 0 && (
              <div className="text-center text-slate-400 text-xs py-8 italic">
                Add objectives manually or ask Geppy to help you plan.
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyDown={handleObjectiveKeyDown}
              placeholder="Add a specific goal..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-geppy-blue"
            />
            <button 
              onClick={addObjective}
              disabled={!newObjective.trim()}
              className="bg-geppy-blue text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-2xl border-4 border-geppy-darkBlue border-b-[8px] p-4 shadow-sm flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
            <Bot size={18} className="text-geppy-orange" />
            <h3 className="font-bold text-geppy-darkBlue text-sm">Geppy Planner</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-geppy-orange text-white'}`}>
                  {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                </div>
                <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-slate-100 text-slate-700 rounded-tr-none' 
                    : 'bg-orange-50 text-slate-800 border border-orange-100 rounded-tl-none'
                }`}>
                  {msg.role === 'user' ? (
                    msg.text
                  ) : (
                    <div className="prose prose-xs max-w-none">
                      <ReactMarkdown>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.isStreaming && <span className="inline-block w-1.5 h-3 bg-geppy-orange animate-pulse ml-1 align-middle"></span>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Brainstorm with Geppy..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-10 py-3 text-sm focus:outline-none focus:border-geppy-blue focus:ring-2 focus:ring-geppy-blue/10"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isTyping}
              className="absolute right-2 top-2 p-1.5 bg-geppy-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* --- RIGHT COLUMN: Output --- */}
      <div className="w-[35%] flex flex-col gap-4 min-w-[300px]">
        <div className="bg-white rounded-2xl border-4 border-geppy-darkBlue border-b-[8px] p-6 shadow-sm flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-geppy-darkBlue">Master Prompt</h3>
              <p className="text-xs text-slate-500">Ready for AI Studio</p>
            </div>
            <button
              onClick={handleGeneratePrompt}
              disabled={isGenerating || (selectedFeatures.size === 0 && objectives.length === 0 && selectedSuggestions.size === 0)}
              className="flex items-center gap-2 bg-geppy-orange text-white px-3 py-1.5 rounded-full text-sm font-bold border-2 border-geppy-darkBlue border-b-4 active:border-b-2 active:translate-y-[2px] transition-all disabled:opacity-50 disabled:active:border-b-4 disabled:active:translate-y-0"
            >
              <Wand2 size={14} className={isGenerating ? 'animate-pulse' : ''} />
              <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
            </button>
          </div>
          
          <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 overflow-y-auto font-mono text-xs text-slate-700 whitespace-pre-wrap relative group">
            {generatedPrompt ? (
              <>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-geppy-blue hover:border-geppy-blue transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-geppy-blue hover:border-geppy-blue transition-colors"
                    title="Download as Markdown"
                  >
                    <Download size={14} />
                  </button>
                </div>
                {generatedPrompt}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <Wand2 size={32} className="mb-3 opacity-20" />
                <p>Select features, add objectives, or chat with Geppy to build your plan.</p>
                <p className="mt-2 text-[10px] opacity-70">Then click Generate to create your Master Prompt.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
