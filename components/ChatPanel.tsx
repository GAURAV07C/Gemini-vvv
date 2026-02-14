
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, onSendReaction }) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const reactions = ['🔥', '👏', '🚀', '❤️', '😂', '💯'];

  return (
    <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Live Chat</h3>
        <span className="bg-blue-600/20 text-blue-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Encrypted</span>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
            <i className="fas fa-comment-dots text-2xl mb-2"></i>
            <p className="text-[10px] font-bold uppercase tracking-widest">No messages yet</p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.isLocal ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[8px] font-black text-gray-500 uppercase">{m.senderName}</span>
                <span className="text-[6px] text-gray-700">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`px-4 py-2.5 rounded-2xl text-xs max-w-[85%] ${m.isLocal ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-gray-300 rounded-tl-none'}`}>
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 space-y-4 bg-slate-950/40">
        <div className="flex justify-between px-2">
          {reactions.map(emoji => (
            <button 
              key={emoji} onClick={() => onSendReaction(emoji)}
              className="text-lg hover:scale-125 transition-transform p-1 grayscale hover:grayscale-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input 
            type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
            className="flex-grow bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            placeholder="Say something..."
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20">
            <i className="fas fa-paper-plane text-xs"></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
