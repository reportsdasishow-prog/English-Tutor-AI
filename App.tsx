
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { LANGUAGES, SCENARIOS } from './constants';
import { Language, Scenario, Message, ConnectionStatus } from './types';
import { GeminiLiveService } from './services/geminiLiveService';
import { ScenarioCard } from './components/ScenarioCard';
import { TranscriptionPanel } from './components/TranscriptionPanel';

const App: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(LANGUAGES[0]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPartial, setCurrentPartial] = useState<{ text: string; role: 'user' | 'model' } | null>(null);

  const serviceRef = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    serviceRef.current = new GeminiLiveService();
    return () => {
      serviceRef.current?.stopSession();
    };
  }, []);

  const handleTranscription = useCallback((text: string, role: 'user' | 'model') => {
    setCurrentPartial({ text, role });
  }, []);

  const handleStatusChange = useCallback((newStatus: string, error?: string) => {
    switch (newStatus) {
      case 'connecting': setStatus(ConnectionStatus.CONNECTING); break;
      case 'connected': setStatus(ConnectionStatus.CONNECTED); setErrorMessage(null); break;
      case 'disconnected': setStatus(ConnectionStatus.DISCONNECTED); break;
      case 'error': setStatus(ConnectionStatus.ERROR); setErrorMessage(error || 'Произошла ошибка'); break;
    }
  }, []);

  const toggleSession = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      await serviceRef.current?.stopSession();
      setStatus(ConnectionStatus.DISCONNECTED);
      setCurrentPartial(null);
    } else {
      setMessages([]);
      setCurrentPartial(null);
      await serviceRef.current?.startSession(
        selectedLanguage.name,
        selectedScenario.prompt,
        {
          onTranscription: handleTranscription,
          onStatusChange: handleStatusChange
        }
      );
    }
  };

  const getStatusText = (status: ConnectionStatus) => {
    switch (status) {
      case ConnectionStatus.CONNECTED: return 'ПОДКЛЮЧЕНО';
      case ConnectionStatus.CONNECTING: return 'ПОДКЛЮЧЕНИЕ...';
      case ConnectionStatus.ERROR: return 'ОШИБКА';
      default: return 'ОТКЛЮЧЕНО';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <i className="fa-solid fa-graduation-cap text-xl"></i>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              English Tutor AI
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full border border-slate-200">
              <span className="text-sm font-medium text-slate-600">Вариант английского:</span>
              <select 
                value={selectedLanguage.code}
                onChange={(e) => setSelectedLanguage(LANGUAGES.find(l => l.code === e.target.value)!)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-blue-600 cursor-pointer"
                disabled={status !== ConnectionStatus.DISCONNECTED}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' :
                status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-pulse' :
                status === ConnectionStatus.ERROR ? 'bg-red-500' : 'bg-slate-300'
              }`}></div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {getStatusText(status)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        <div className="lg:col-span-2 space-y-10">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <i className="fa-solid fa-map text-blue-500"></i>
                Выберите сценарий
              </h2>
              {status !== ConnectionStatus.DISCONNECTED && (
                <span className="text-sm text-slate-500 bg-slate-200 px-3 py-1 rounded-full animate-pulse">
                  Настройки заблокированы
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SCENARIOS.map(scenario => (
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

          <section className="bg-white rounded-[40px] p-10 shadow-2xl shadow-blue-100 border border-slate-100 text-center flex flex-col items-center">
            <div className="mb-8">
              <div className={`relative w-32 h-32 flex items-center justify-center rounded-full transition-all duration-500 ${
                status === ConnectionStatus.CONNECTED 
                  ? 'bg-blue-600 text-white scale-110' 
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {status === ConnectionStatus.CONNECTED && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-blue-400 opacity-30 animate-pulse-custom"></div>
                  </>
                )}
                <i className={`fa-solid ${status === ConnectionStatus.CONNECTED ? 'fa-microphone' : 'fa-microphone-slash'} text-5xl`}></i>
              </div>
            </div>

            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">
              {status === ConnectionStatus.CONNECTED 
                ? "Вы в эфире!" 
                : status === ConnectionStatus.CONNECTING 
                ? "Установка связи..." 
                : "Готовы к практике?"}
            </h3>
            
            <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
              {status === ConnectionStatus.CONNECTED 
                ? `Практикуем английский: ${selectedScenario.title}. Начинайте говорить в любое время!`
                : `Общайтесь с ИИ-репетитором носительского уровня, чтобы преодолеть языковой барьер.`}
            </p>

            {errorMessage && (
              <div className="mb-8 px-6 py-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                {errorMessage}
              </div>
            )}

            <button
              onClick={toggleSession}
              disabled={status === ConnectionStatus.CONNECTING}
              className={`px-12 py-5 rounded-full font-bold text-xl transition-all duration-300 shadow-xl flex items-center gap-4 ${
                status === ConnectionStatus.CONNECTED
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 hover:-translate-y-1'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:-translate-y-1'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status === ConnectionStatus.CONNECTED ? (
                <>
                  <i className="fa-solid fa-stop"></i>
                  Закончить сессию
                </>
              ) : status === ConnectionStatus.CONNECTING ? (
                <>
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                  Загрузка...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-play"></i>
                  Начать разговор
                </>
              )}
            </button>
          </section>
        </div>

        <div className="lg:col-span-1 h-fit sticky top-32">
          <TranscriptionPanel 
            messages={messages} 
            currentTranscription={currentPartial}
          />
        </div>
      </main>

      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="bg-white rounded-2xl p-4 shadow-2xl border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="text-xl">{selectedLanguage.flag}</span>
             <div>
               <div className="text-xs font-bold text-slate-400 uppercase leading-none">Статус</div>
               <div className="text-sm font-bold text-slate-800">{getStatusText(status)}</div>
             </div>
          </div>
          <button 
            onClick={toggleSession}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${
              status === ConnectionStatus.CONNECTED ? 'bg-red-500' : 'bg-blue-600'
            }`}
          >
            <i className={`fa-solid ${status === ConnectionStatus.CONNECTED ? 'fa-stop' : 'fa-play'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
