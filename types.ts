
export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
