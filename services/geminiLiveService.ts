
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

      // Mandatory check for API key selection in this environment
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
        // Instructions: assume success after triggering the dialog
      }

      // Re-initialize to ensure the latest selected key is used
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const systemInstruction = `
        ${scenarioPrompt}
        The user is a Russian speaker learning English. 
        Keep responses helpful and use English only.
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

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
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
              source.start(this.nextStartTime);
              this.nextStartTime += audioBuffer.duration;
              this.sources.add(source);
              source.onended = () => this.sources.delete(source);
            }

            if (message.serverContent?.interrupted) {
              this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
              this.sources.clear();
              this.nextStartTime = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Gemini Live Error:', e);
            if (e?.message?.includes('entity was not found')) {
              handlers.onStatusChange('error', 'Ключ API не найден или не активен. Выберите другой.');
              window.aistudio?.openSelectKey();
            } else {
              handlers.onStatusChange('error', 'Произошла ошибка при подключении к ИИ.');
            }
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
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        },
      });

      const updateLevel = () => {
        if (this.analyser && handlers.onAudioLevel) {
          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          handlers.onAudioLevel(average / 128);
          if (this.stream?.active) requestAnimationFrame(updateLevel);
        }
      };
      setTimeout(updateLevel, 500);

    } catch (err) {
      handlers.onStatusChange('error', 'Ошибка доступа к микрофону или API.');
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
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.analyser);
    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  async stopSession() {
    if (this.sessionPromise) {
      const session = await this.sessionPromise;
      try { session.close(); } catch (e) {}
    }
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
    this.sessionPromise = null;
  }
}
