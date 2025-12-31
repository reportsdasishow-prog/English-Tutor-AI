
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SCENARIOS, VOICES } from './constants';
import { Scenario, Message, ConnectionStatus } from './types';
import { GeminiLiveService } from './services/geminiLiveService';
import { ScenarioCard } from './components/ScenarioCard';
import { TranscriptionPanel } from './components/TranscriptionPanel';

const App: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPartial, setCurrentPartial] = useState<{ text: string; role: 'user' | 'model' } | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const serviceRef = useRef<GeminiLiveService>(new GeminiLiveService());

  const handleStatusChange = useCallback((newStatus: string, error?: string) => {
    console.log('Status update:', newStatus, error);
    switch (newStatus) {
      case 'connecting': 
        setStatus(ConnectionStatus.CONNECTING); 
        setErrorMessage(null);
        break;
      case 'connected': 
        setStatus(ConnectionStatus.CONNECTED); 
        setErrorMessage(null); 
        break;
      case 'disconnected': 
        setStatus(ConnectionStatus.DISCONNECTED); 
        setAudioLevel(0);
        setCurrentPartial(null);
        break;
      case 'error': 
        setStatus(ConnectionStatus.ERROR); 
        setErrorMessage(error || 'Произошла внутренняя ошибка'); 
        break;
    }
  }, []);

  const toggleSession = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      await serviceRef.current.stopSession();
      setStatus(ConnectionStatus.DISCONNECTED);
    } else {
      setMessages([]);
      setCurrentPartial(null);
      setErrorMessage(null);
      await serviceRef.current.startSession(
        selectedScenario.prompt,
        selectedVoice,
        {
          onTranscription: (text, role, isFinal) => {
            if (isFinal) {
              setMessages(prev => [...prev, {
                id: Math.random().toString(36),
                role,
                text,
                timestamp: Date.now()
              }]);
              setCurrentPartial(null);
            } else {
              setCurrentPartial({ text, role });
            }
          },
          onStatusChange: handleStatusChange,
          onAudioLevel: (lvl) => setAudioLevel(lvl)
        }
      );
    }
  };

  const openKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-microphone-lines"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900">LingoLive AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={openKeySelector}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold text-slate-600 transition-colors"
            >
              <i className="fa-solid fa-key mr-1"></i> API KEY
            </button>
            
            <select 
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={status !== ConnectionStatus.DISCONNECTED}
            >
              {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>

            <div className={`px-3 py-1 rounded-full flex items-center gap-2 border text-[10px] font-bold uppercase tracking-widest transition-colors ${
              status === ConnectionStatus.CONNECTED ? 'bg-green-50 border-green-200 text-green-700' :
              status === ConnectionStatus.CONNECTING ? 'bg-amber-50 border-amber-200 text-amber-700' :
              status === ConnectionStatus.ERROR ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' :
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-pulse' : 
                status === ConnectionStatus.ERROR ? 'bg-red-500' : 'bg-slate-300'
              }`}></span>
              {status === ConnectionStatus.CONNECTED ? 'В эфире' : 
               status === ConnectionStatus.CONNECTING ? 'Связь...' : 
               status === ConnectionStatus.ERROR ? 'Ошибка' : 'Ожидание'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-8">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SCENARIOS.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isSelected={selectedScenario.id === scenario.id}
                  onSelect={(id) => setSelectedScenario(SCENARIOS.find(s => s.id === id)!)}
                  disabled={status !== ConnectionStatus.DISCONNECTED}
                />
              ))}
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                status === ConnectionStatus.CONNECTED ? 'bg-blue-600 scale-105 shadow-blue-200 shadow-2xl' : 'bg-slate-100'
              }`}>
                {status === ConnectionStatus.CONNECTED ? (
                  <div className="flex items-end gap-1.5 h-12">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-2 bg-white rounded-full transition-all duration-75"
                        style={{ height: `${20 + (audioLevel * 100 * (0.4 + Math.random() * 0.6))}%` }}
                      ></div>
                    ))}
                  </div>
                ) : (
                  <i className={`fa-solid fa-microphone text-4xl ${status === ConnectionStatus.CONNECTING ? 'animate-pulse text-amber-500' : 'text-slate-300'}`}></i>
                )}
              </div>

              <div className="space-y-4">
                <button
                  onClick={toggleSession}
                  className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all ${
                    status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border-2 border-red-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                  }`}
                >
                  {status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING ? 'Завершить сессию' : 'Начать разговор'}
                </button>
                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                    <p className="text-xs text-red-600 font-medium">{errorMessage}</p>
                    {errorMessage.includes('Ключ API') && (
                      <button 
                        onClick={openKeySelector}
                        className="text-[10px] text-red-700 underline font-bold"
                      >
                        Выбрать другой ключ
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-50">
                <p className="text-[11px] text-slate-400 leading-relaxed uppercase tracking-wider font-bold">
                  Текущий режим: {selectedScenario.title}
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-7">
            <TranscriptionPanel messages={messages} currentTranscription={currentPartial} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
