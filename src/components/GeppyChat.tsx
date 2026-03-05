import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, RefreshCw, Copy, Check, Search, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { chatService } from '../services/chatService';
import { storageService } from '../services/storageService';
import { updateFileInZip } from '../services/extractionService';
import { AppManifest } from '../types';
import { GenerateContentResponse } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

interface GeppyChatProps {
  mode?: 'floating' | 'embedded';
  className?: string;
  initialApp?: AppManifest | null;
}

export const GeppyChat: React.FC<GeppyChatProps> = ({ mode = 'floating', className = '', initialApp }) => {
  const [isOpen, setIsOpen] = useState(mode === 'embedded');
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [currentApp, setCurrentApp] = useState<AppManifest | null>(initialApp || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (initialApp) {
      setCurrentApp(initialApp);
      return;
    }

    const fetchCurrentApp = async () => {
      if (location.pathname.startsWith('/app/')) {
        const id = location.pathname.split('/')[2];
        if (id) {
          const app = await storageService.getApp(id);
          setCurrentApp(app || null);
        }
      } else {
        setCurrentApp(null);
      }
    };
    fetchCurrentApp();
  }, [location.pathname, initialApp]);

  const initChat = () => {
    const session = chatService.createSession(currentApp);
    setChatSession(session);
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: currentApp 
        ? `Hi! I'm Geppy! 🚀 Let's talk about **${currentApp.name}**. Need help with new features, prompts, or debugging?`
        : "Hi! I'm Geppy! 🚀 Tell me your app idea, and I'll help you flesh it out and generate the perfect prompts to build it!"
    }]);
  };

  useEffect(() => {
    if (isOpen || mode === 'embedded') {
      initChat();
    }
  }, [currentApp]); 

  useEffect(() => {
    if ((isOpen || mode === 'embedded') && !chatSession) {
      initChat();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || !chatSession) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setInput('');
    setIsTyping(true);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isStreaming: true }]);

    try {
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
        text: "Oops! Something went wrong. Let's try that again." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyzeApp = () => {
    if (!currentApp) return;
    
    const blueprintStr = currentApp.blueprint 
      ? JSON.stringify(currentApp.blueprint, null, 2)
      : "No blueprint available yet. The app might not have been analyzed from a ZIP file.";

    const prompt = `Please do a full analysis of the functionality and usability of my app named "${currentApp.name}". 
Here is the current blueprint/DNA of the app:
\`\`\`json
${blueprintStr}
\`\`\`
Please provide insights on its current features, potential usability improvements, and any suggestions for what I should add next.`;

    handleSend(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (mode === 'embedded') {
    return (
      <div className={`flex flex-col h-full bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-geppy-blue text-white p-4 border-b-4 border-geppy-darkBlue flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-geppy-darkBlue">
              <Bot size={24} className="text-geppy-blue" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Geppy Chat</h3>
              <p className="text-xs text-white/80 font-bold">Prompt Building Wizard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={initChat} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Reset Chat">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} currentApp={currentApp} messagesEndRef={messagesEndRef} />

        {/* Input */}
        <div className="p-4 bg-white border-t-4 border-slate-100 shrink-0 flex flex-col gap-3">
          {currentApp && (
            <div className="flex items-center justify-between bg-geppy-blue/10 p-2 rounded-xl border-2 border-geppy-blue/20">
              <span className="text-xs font-bold text-geppy-darkBlue truncate flex-1">
                Context: {currentApp.name}
              </span>
              <button 
                onClick={handleAnalyzeApp}
                disabled={isTyping}
                className="flex items-center gap-1 bg-geppy-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
              >
                <Search size={14} />
                Analyze App
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentApp ? `Ask about ${currentApp.name}...` : "Describe your app idea..."}
              className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 pr-12 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/20 transition-all resize-none min-h-[60px] max-h-[150px]"
              rows={2}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-3 bottom-3 p-2 bg-geppy-blue text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-geppy-blue transition-all active:scale-90"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Shift + Enter for new line
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 bg-geppy-blue text-white rounded-full flex items-center justify-center shadow-xl border-4 border-geppy-darkBlue border-b-[8px] active:border-b-4 active:translate-y-1 transition-all z-40 ${isOpen ? 'scale-0' : 'scale-100'} ${className}`}
      >
        <MessageSquare size={28} />
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-6 right-6 ${isExpanded ? 'w-[calc(100vw-3rem)] max-w-[1000px] h-[calc(100vh-3rem)] max-h-[900px]' : 'w-[450px] h-[600px] max-h-[80vh]'} bg-white rounded-[32px] border-4 border-geppy-darkBlue border-b-[12px] shadow-2xl flex flex-col transition-all duration-300 z-50 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        
        {/* Header */}
        <div className="bg-geppy-blue text-white p-4 rounded-t-[24px] border-b-4 border-geppy-darkBlue flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-geppy-darkBlue">
              <Bot size={24} className="text-geppy-blue" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Geppy Chat</h3>
              <p className="text-xs text-white/80 font-bold">Prompt Building Wizard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={initChat} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Reset Chat">
              <RefreshCw size={18} />
            </button>
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/20 rounded-full transition-colors" title={isExpanded ? "Collapse" : "Expand"}>
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} currentApp={currentApp} messagesEndRef={messagesEndRef} />

        {/* Input */}
        <div className="p-4 bg-white border-t-4 border-slate-100 rounded-b-[24px] shrink-0 flex flex-col gap-3">
          {currentApp && (
            <div className="flex items-center justify-between bg-geppy-blue/10 p-2 rounded-xl border-2 border-geppy-blue/20">
              <span className="text-xs font-bold text-geppy-darkBlue truncate flex-1">
                Context: {currentApp.name}
              </span>
              <button 
                onClick={handleAnalyzeApp}
                disabled={isTyping}
                className="flex items-center gap-1 bg-geppy-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
              >
                <Search size={14} />
                Analyze App
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentApp ? `Ask about ${currentApp.name}...` : "Describe your app idea..."}
              className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 pr-12 text-slate-700 focus:outline-none focus:border-geppy-blue focus:ring-4 focus:ring-geppy-blue/20 transition-all resize-none min-h-[60px] max-h-[150px]"
              rows={2}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-3 bottom-3 p-2 bg-geppy-blue text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-geppy-blue transition-all active:scale-90"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Shift + Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};

const ChatMessages: React.FC<{ messages: Message[], currentApp: AppManifest | null, messagesEndRef: React.RefObject<HTMLDivElement> }> = ({ messages, currentApp, messagesEndRef }) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${msg.role === 'user' ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-geppy-orange border-geppy-darkBlue text-white'}`}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div className={`max-w-[80%] rounded-2xl p-4 border-2 ${
            msg.role === 'user' 
              ? 'bg-white border-slate-200 rounded-tr-none' 
              : 'bg-white border-geppy-orange/30 rounded-tl-none shadow-sm'
          }`}>
            {msg.role === 'user' ? (
              <p className="text-slate-700 whitespace-pre-wrap">{msg.text}</p>
            ) : (
              <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-300 prose-pre:border-2 prose-pre:border-slate-800 prose-pre:rounded-xl">
                <ReactMarkdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)(?::(.+))?/.exec(className || '');
                      const language = match ? match[1] : '';
                      const filename = match && match[2] ? match[2] : '';
                      
                      return !inline ? (
                        <span className="relative group block font-sans my-4">
                          <span className="flex items-center justify-between bg-slate-800 px-4 py-2 rounded-t-xl border-b border-slate-700 w-full">
                            <span className="text-xs font-mono text-slate-400">{filename || language || 'code'}</span>
                            <span className="flex items-center gap-2">
                              {filename && currentApp && (
                                <ApplyButton 
                                  app={currentApp} 
                                  filename={filename} 
                                  code={String(children).replace(/\n$/, '')} 
                                />
                              )}
                              <CopyButton text={String(children).replace(/\n$/, '')} />
                            </span>
                          </span>
                          <code className={`${className} block p-4 overflow-x-auto rounded-b-xl bg-slate-900 text-sm`} {...props}>
                            {children}
                          </code>
                        </span>
                      ) : (
                        <code className="bg-slate-100 text-geppy-orange px-1 py-0.5 rounded font-mono text-xs" {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
                {msg.isStreaming && <span className="inline-block w-2 h-4 bg-geppy-orange animate-pulse ml-1 align-middle"></span>}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all active:scale-90 border border-slate-700"
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
};

const ApplyButton = ({ app, filename, code }: { app: AppManifest, filename: string, code: string }) => {
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const archive = await storageService.getArchive(app.id);
      if (!archive) {
        alert("No source ZIP attached to this app.");
        return;
      }
      
      const updatedArchive = await updateFileInZip(archive, filename, code);
      await storageService.saveArchive(app.id, updatedArchive);
      
      // Update app version
      const parts = app.version.split('.');
      if (parts.length === 3) {
        parts[2] = (parseInt(parts[2]) + 1).toString();
      }
      const updatedApp = {
        ...app,
        version: parts.join('.'),
        updatedAt: Date.now()
      };
      await storageService.saveApp(updatedApp);
      
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } catch (error) {
      console.error("Failed to apply code:", error);
      alert("Failed to apply code to the archive.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <button
      onClick={handleApply}
      disabled={isApplying || applied}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-all active:scale-95 ${
        applied 
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
          : 'bg-geppy-blue/20 text-geppy-blue hover:bg-geppy-blue/30 border border-geppy-blue/30'
      }`}
      title="Apply to Codebase"
    >
      {isApplying ? (
        <RefreshCw size={12} className="animate-spin" />
      ) : applied ? (
        <Check size={12} />
      ) : (
        <Send size={12} />
      )}
      {applied ? 'Applied!' : 'Apply to Codebase'}
    </button>
  );
};
