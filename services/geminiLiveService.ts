
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import { GEMINI_MODEL } from '../constants';

export interface LiveSessionHandlers {
  onTranscription: (text: string, role: 'user' | 'model') => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void;
  onAudioLevel?: (level: number) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async startSession(
    language: string,
    scenarioPrompt: string,
    handlers: LiveSessionHandlers
  ) {
    try {
      handlers.onStatusChange('connecting');

      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const systemInstruction = `
        ${scenarioPrompt}
        The user is a Russian speaker learning English. 
        Conduct the conversation in English.
        Be an encouraging and professional English tutor.
        If the user is struggling or asks for help, you can use Russian briefly to explain complex grammatical points or provide translations.
        Pay special attention to common mistakes made by Russian speakers: articles (a/the), prepositions, and present perfect vs past simple.
        Gently correct the user and provide a more natural alternative in English.
        Keep your responses natural but clear.
      `;

      this.sessionPromise = this.ai.live.connect({
        model: GEMINI_MODEL,
        callbacks: {
          onopen: () => {
            handlers.onStatusChange('connected');
            this.startMicStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              this.currentOutputTranscription += text;
              handlers.onTranscription(this.currentOutputTranscription, 'model');
            } else if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              this.currentInputTranscription += text;
              handlers.onTranscription(this.currentInputTranscription, 'user');
            }

            if (message.serverContent?.turnComplete) {
              this.currentInputTranscription = '';
              this.currentOutputTranscription = '';
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && this.outputAudioContext) {
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              
              const buffer = await decodeAudioData(
                decode(audioData),
                this.outputAudioContext,
                24000,
                1
              );

              const source = this.outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(this.outputAudioContext.destination);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime += buffer.duration;
              this.sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => s.stop());
              this.sources.clear();
              this.nextStartTime = 0;
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            handlers.onStatusChange('error', 'Ошибка подключения к серверу.');
          },
          onclose: () => {
            handlers.onStatusChange('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
      });

    } catch (err) {
      console.error('Failed to start session:', err);
      handlers.onStatusChange('error', 'Не удалось получить доступ к микрофону.');
    }
  }

  private startMicStreaming() {
    if (!this.stream || !this.inputAudioContext || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);

      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  async stopSession() {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      session.close();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }

    this.sources.forEach(s => s.stop());
    this.sources.clear();

    await this.inputAudioContext?.close();
    await this.outputAudioContext?.close();
  }
}
