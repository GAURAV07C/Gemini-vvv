
export enum CallStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED'
}

export interface UserSession {
  userId: string;
  roomId: string;
  displayName: string;
  lastActive: number;
  isHost: boolean;
}

export interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  isVideoOn: boolean;
  isAudioOn: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  isControlGranted?: boolean;
  isHost: boolean;
  networkQuality?: 'excellent' | 'good' | 'poor';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

export interface RecentRoom {
  roomId: string;
  displayName: string;
  isHost: boolean;
  timestamp: number;
}
