
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import { GEMINI_MODEL } from '../constants';

export interface LiveSessionHandlers {
  onTranscription: (text: string, role: 'user' | 'model', isFinal: boolean) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void;
  onAudioLevel?: (level: number) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  async startSession(
    scenarioPrompt: string,
    voiceName: string,
    handlers: LiveSessionHandlers
  ) {
    try {
      handlers.onStatusChange('connecting');

      // Check if API key selection is needed for preview models in this environment
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
        // Proceeding as per instructions: assume success after trigger
      }

      // Initialize AI with the latest key
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Setup audio contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Ensure contexts are running
      if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
      if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const systemInstruction = `
        ${scenarioPrompt}
        The user is a Russian speaker learning English. 
        Focus on correcting common Slavic mistakes: 
        1. Dropping "a" or "the".
        2. Confusion between "to be" and other verbs.
        3. Present Perfect vs Past Simple usage.
        Be encouraging. Respond in English. If the user is stuck, give a hint in English.
      `;

      this.sessionPromise = this.ai.live.connect({
        model: GEMINI_MODEL,
        callbacks: {
          onopen: () => {
            handlers.onStatusChange('connected');
            this.startMicStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.outputTranscription) {
              this.currentOutputTranscription += message.serverContent.outputTranscription.text;
              handlers.onTranscription(this.currentOutputTranscription, 'model', false);
            } else if (message.serverContent?.inputTranscription) {
              this.currentInputTranscription += message.serverContent.inputTranscription.text;
              handlers.onTranscription(this.currentInputTranscription, 'user', false);
            }

            // Handle Turn Completion
            if (message.serverContent?.turnComplete) {
              if (this.currentInputTranscription) handlers.onTranscription(this.currentInputTranscription, 'user', true);
              if (this.currentOutputTranscription) handlers.onTranscription(this.currentOutputTranscription, 'model', true);
              this.currentInputTranscription = '';
              this.currentOutputTranscription = '';
            }

            // Handle Audio Data
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const base64Audio = part.inlineData?.data;
                if (base64Audio && this.outputAudioContext) {
                  this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                  const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    this.outputAudioContext,
                    24000,
                    1
                  );
                  const source = this.outputAudioContext.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(this.outputAudioContext.destination);
                  source.addEventListener('ended', () => {
                    this.sources.delete(source);
                  });

                  source.start(this.nextStartTime);
                  this.nextStartTime += audioBuffer.duration;
                  this.sources.add(source);
                }
              }
            }

            // Handle Interruption
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of this.sources.values()) {
                try { source.stop(); } catch(e) {}
              }
              this.sources.clear();
              this.nextStartTime = 0;
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            const errorMsg = e instanceof Error ? e.message : 'Ошибка соединения с API.';
            if (errorMsg.includes('Requested entity was not found')) {
               handlers.onStatusChange('error', 'Ключ API не найден. Пожалуйста, выберите платный проект.');
               window.aistudio?.openSelectKey();
            } else {
               handlers.onStatusChange('error', `Ошибка: ${errorMsg}`);
            }
          },
          onclose: (e) => {
            console.log('Gemini Live Closed:', e);
            handlers.onStatusChange('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        },
      });

      // Visualizer loop
      const updateLevel = () => {
        if (this.analyser && handlers.onAudioLevel) {
          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          handlers.onAudioLevel(average / 128); 
          if (this.stream?.active) requestAnimationFrame(updateLevel);
        }
      };
      
      setTimeout(updateLevel, 500);

    } catch (err: any) {
      console.error('Session Start Error:', err);
      handlers.onStatusChange('error', err.message || 'Не удалось запустить сессию.');
    }
  }

  private startMicStreaming() {
    if (!this.stream || !this.inputAudioContext || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        try {
          session.sendRealtimeInput({ media: pcmBlob });
        } catch (err) {
          // Ignore if session closed
        }
      });
    };

    source.connect(this.analyser);
    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  async stopSession() {
    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        session.close();
      } catch (e) {}
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();

    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    
    this.sessionPromise = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.stream = null;
    this.analyser = null;
    this.scriptProcessor = null;
  }
}
