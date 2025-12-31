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
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <i className="fa-solid fa-align-left text-blue-500"></i>
          Журнал разговора
        </h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-slate-200">
          Синхронно
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && !currentTranscription && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
               <i className="fa-solid fa-microphone-lines text-2xl opacity-20"></i>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-600">Ожидание начала разговора</p>
              <p className="text-xs text-slate-400 max-w-[200px]">Текст вашей беседы будет появляться здесь в реальном времени.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
            }`}>
              <div className="text-[10px] opacity-60 mb-1 uppercase font-bold tracking-tighter">
                {msg.role === 'user' ? 'Вы' : 'Lingo AI'}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}

        {currentTranscription && (
          <div className={`flex ${currentTranscription.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm transition-all duration-300 ${
              currentTranscription.role === 'user' 
                ? 'bg-blue-500/90 text-white rounded-tr-none' 
                : 'bg-slate-50 text-slate-600 rounded-tl-none border border-slate-200 italic'
            }`}>
               <div className="text-[10px] opacity-60 mb-1 uppercase font-bold tracking-tighter">
                {currentTranscription.role === 'user' ? 'Вы (говорите...)' : 'Lingo AI (печатает...)'}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {currentTranscription.text}
                <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse align-middle"></span>
              </p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
         <div className="text-[10px] text-center text-slate-400">
            <i className="fa-solid fa-shield-halved mr-1"></i>
            Конфиденциально. Ваши данные не сохраняются после закрытия сессии.
         </div>
      </div>
    </div>
  );
};
