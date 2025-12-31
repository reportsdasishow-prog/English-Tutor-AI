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

      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const systemInstruction = `
        ${scenarioPrompt}
        The user is a Russian speaker learning English. 
        Focus on correcting common Slavic mistakes: 
        1. Dropping "a" or "the".
        2. Confusion between "to be" and other verbs.
        3. Present Perfect vs Past Simple usage.
        Be encouraging. Respond in English.
      `;

      this.sessionPromise = this.ai.live.connect({
        model: GEMINI_MODEL,
        callbacks: {
          onopen: () => {
            handlers.onStatusChange('connected');
            this.startMicStreaming(handlers);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              this.currentOutputTranscription += message.serverContent.outputTranscription.text;
              handlers.onTranscription(this.currentOutputTranscription, 'model', false);
            } else if (message.serverContent?.inputTranscription) {
              this.currentInputTranscription += message.serverContent.inputTranscription.text;
              handlers.onTranscription(this.currentInputTranscription, 'user', false);
            }

            if (message.serverContent?.turnComplete) {
              if (this.currentInputTranscription) handlers.onTranscription(this.currentInputTranscription, 'user', true);
              if (this.currentOutputTranscription) handlers.onTranscription(this.currentOutputTranscription, 'model', true);
              this.currentInputTranscription = '';
              this.currentOutputTranscription = '';
            }

            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && this.outputAudioContext) {
              this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
              const buffer = await decodeAudioData(decode(audioData), this.outputAudioContext, 24000, 1);
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(this.outputAudioContext.destination);
              source.addEventListener('ended', () => this.sources.delete(source));
              source.start(this.nextStartTime);
              this.nextStartTime += buffer.duration;
              this.sources.add(source);
            }

            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
              this.sources.clear();
              this.nextStartTime = 0;
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            handlers.onStatusChange('error', 'Ошибка соединения.');
          },
          onclose: () => handlers.onStatusChange('disconnected'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          }
        },
      });

    } catch (err) {
      handlers.onStatusChange('error', 'Доступ к микрофону отклонен.');
    }
  }

  private startMicStreaming(handlers: LiveSessionHandlers) {
    if (!this.stream || !this.inputAudioContext || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.analyser = this.inputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const updateAudioLevel = () => {
      if (this.analyser && handlers.onAudioLevel) {
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        handlers.onAudioLevel(average / 128);
        if (this.stream?.active) requestAnimationFrame(updateAudioLevel);
      }
    };
    updateAudioLevel();

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      this.sessionPromise?.then(session => {
        try { session.sendRealtimeInput({ media: pcmBlob }); } catch (err) {}
      });
    };

    source.connect(this.analyser);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
    source.connect(this.scriptProcessor);
  }

  async stopSession() {
    if (this.sessionPromise) {
      try { const session = await this.sessionPromise; session.close(); } catch (e) {}
    }
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    this.sessionPromise = null;
  }
}