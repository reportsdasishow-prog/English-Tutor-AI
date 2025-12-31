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

  const serviceRef = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    serviceRef.current = new GeminiLiveService();
    return () => {
      serviceRef.current?.stopSession();
    };
  }, []);

  const handleTranscription = useCallback((text: string, role: 'user' | 'model') => {
    setCurrentPartial({ text, role });
    // Reset timer to commit the message if silence follows?
    // In Live API, turnComplete handles the commit logic
  }, []);

  const handleStatusChange = useCallback((newStatus: string, error?: string) => {
    switch (newStatus) {
      case 'connecting': setStatus(ConnectionStatus.CONNECTING); break;
      case 'connected': setStatus(ConnectionStatus.CONNECTED); setErrorMessage(null); break;
      case 'disconnected': 
        setStatus(ConnectionStatus.DISCONNECTED); 
        setAudioLevel(0);
        setCurrentPartial(null);
        break;
      case 'error': setStatus(ConnectionStatus.ERROR); setErrorMessage(error || 'Ошибка подключения'); break;
    }
  }, []);

  // Sync turnComplete to commit partials to full messages list
  useEffect(() => {
    // This is a simplified logic. In a real app, turnComplete message from onmessage
    // should trigger adding to the `messages` array.
    // For now, we will handle it in the callback provided to the service.
  }, []);

  const toggleSession = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      await serviceRef.current?.stopSession();
    } else {
      setMessages([]);
      setCurrentPartial(null);
      await serviceRef.current?.startSession(
        selectedScenario.prompt,
        selectedVoice,
        {
          onTranscription: (text, role) => {
            handleTranscription(text, role);
            // If the text is empty, it might mean turn ended
            if (!text && currentPartial) {
              setMessages(prev => [...prev, {
                id: Math.random().toString(36),
                role: currentPartial.role,
                text: currentPartial.text,
                timestamp: Date.now()
              }]);
              setCurrentPartial(null);
            }
          },
          onStatusChange: handleStatusChange,
          onAudioLevel: (lvl) => setAudioLevel(lvl)
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-microphone-lines text-sm"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">LingoLive AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/50 rounded-lg border border-slate-200">
                <i className="fa-solid fa-volume-high text-slate-400 text-xs"></i>
                <select 
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-xs font-semibold text-slate-700 cursor-pointer"
                  disabled={status !== ConnectionStatus.DISCONNECTED}
                >
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
             </div>

            <div className={`px-3 py-1 rounded-full flex items-center gap-2 border ${
              status === ConnectionStatus.CONNECTED ? 'bg-green-50 border-green-200 text-green-700' :
              status === ConnectionStatus.CONNECTING ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' :
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
              }`}></span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {status === ConnectionStatus.CONNECTED ? 'В эфире' : 
                 status === ConnectionStatus.CONNECTING ? 'Подключение' : 'Ожидание'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-graduation-cap text-blue-500"></i>
                Сценарий обучения
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SCENARIOS.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    isSelected={selectedScenario.id === scenario.id}
                    onSelect={(id) => setSelectedScenario(SCENARIOS.find(s => s.id === id)!)}
                    disabled={status !== ConnectionStatus.DISCONNECTED}
                  />
                ))}
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center space-y-6">
              <div className="relative inline-block">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                  status === ConnectionStatus.CONNECTED ? 'bg-blue-600 scale-110 shadow-2xl shadow-blue-200' : 'bg-slate-100'
                }`}>
                  {status === ConnectionStatus.CONNECTED ? (
                    <div className="flex items-end gap-1.5 h-12">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div 
                          key={i} 
                          className="w-1.5 bg-white rounded-full transition-all duration-75"
                          style={{ height: `${15 + (audioLevel * 85 * (0.5 + Math.random() * 0.5))}%` }}
                        ></div>
                      ))}
                    </div>
                  ) : (
                    <i className={`fa-solid fa-microphone text-4xl ${
                      status === ConnectionStatus.CONNECTING ? 'text-amber-500 animate-pulse' : 'text-slate-300'
                    }`}></i>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {status === ConnectionStatus.CONNECTED ? 'Слушаю вас...' : 
                   status === ConnectionStatus.CONNECTING ? 'Устанавливаю связь...' : 'Готовы к практике?'}
                </h3>
                <p className="text-sm text-slate-500">
                  {status === ConnectionStatus.CONNECTED 
                    ? 'Говорите на английском, я помогу с ошибками.' 
                    : 'Выберите сценарий и нажмите кнопку ниже.'}
                </p>
              </div>

              <button
                onClick={toggleSession}
                className={`w-full py-4 px-8 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-95 ${
                  status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border-2 border-red-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200'
                }`}
              >
                {status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING ? (
                  <><i className="fa-solid fa-stop mr-2"></i> Остановить</>
                ) : (
                  <><i className="fa-solid fa-play mr-2"></i> Начать урок</>
                )}
              </button>

              {errorMessage && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100 animate-shake">
                  {errorMessage}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-7">
            <TranscriptionPanel 
              messages={messages} 
              currentTranscription={currentPartial} 
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
