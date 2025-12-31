
import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface TranscriptionPanelProps {
  messages: Message[];
  currentTranscription: { text: string; role: 'user' | 'model' } | null;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ 
  messages, 
  currentTranscription 
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscription]);

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[400px]">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <i className="fa-solid fa-align-left text-blue-500"></i>
          Текст беседы
        </h3>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !currentTranscription && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 text-center">
            <i className="fa-solid fa-microphone-lines text-4xl opacity-20"></i>
            <p className="text-sm font-medium">Ожидание начала разговора...</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}

        {currentTranscription && (
          <div className={`flex ${currentTranscription.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm animate-pulse ${
              currentTranscription.role === 'user' 
                ? 'bg-blue-500 text-white rounded-tr-none' 
                : 'bg-slate-50 text-slate-600 rounded-tl-none border border-slate-200'
            }`}>
              <p className="text-sm italic leading-relaxed whitespace-pre-wrap">
                {currentTranscription.text}
                <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-bounce"></span>
              </p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
