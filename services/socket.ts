
import { Peer, DataConnection } from 'peerjs';

export type SignalPayload = {
  type: 'JOIN' | 'LEAVE' | 'OFFER' | 'ANSWER' | 'CANDIDATE' | 'METADATA' | 'SCREEN_STATUS' | 'CHAT' | 'REACTION' | 'ACCESS_REQUEST' | 'ACCESS_GRANTED' | 'REMOTE_COMMAND';
  senderId: string;
  senderName: string;
  roomId: string;
  targetId?: string;
  data?: any;
};

export class SignalingService {
  private static instance: SignalingService;
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // Maps PeerID to Connection
  private userIdToPeerId: Map<string, string> = new Map(); // Maps UserID to PeerID
  private userIdToName: Map<string, string> = new Map(); // Maps UserID to Name
  private onMessageCallback: ((msg: SignalPayload) => void) | null = null;
  private userId: string = '';
  private userName: string = '';
  private roomId: string = '';

  static getInstance() {
    if (!this.instance) this.instance = new SignalingService();
    return this.instance;
  }

  joinRoom(roomId: string, userId: string, displayName: string, isHost: boolean, onMessage: (msg: SignalPayload) => void) {
    this.onMessageCallback = onMessage;
    this.userId = userId;
    this.userName = displayName;
    this.roomId = roomId.toUpperCase();

    const peerId = isHost ? `OMNI_ROOM_${this.roomId}` : `OMNI_USER_${userId}_${Math.floor(Math.random() * 10000)}`;
    
    this.peer = new Peer(peerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[Socket] Signaling ready. My Peer ID:', id);
      if (!isHost) {
        this.connectToHost();
      }
    });

    this.peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[Socket] Signaling Error:', err.type);
    });
  }

  private connectToHost() {
    if (!this.peer || this.peer.destroyed) return;
    const hostPeerId = `OMNI_ROOM_${this.roomId}`;
    const conn = this.peer.connect(hostPeerId, {
      metadata: { userId: this.userId, name: this.userName }
    });
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      const meta = conn.metadata as { userId?: string, name?: string };
      if (meta?.userId) {
        this.userIdToPeerId.set(meta.userId, conn.peer);
        if (meta.name) this.userIdToName.set(meta.userId, meta.name);
      }
      this.connections.set(conn.peer, conn);
      
      // Notify the other end about my arrival
      conn.send({
        type: 'JOIN',
        senderId: this.userId,
        senderName: this.userName,
        roomId: this.roomId
      });
    });

    conn.on('data', (data) => {
      const msg = data as SignalPayload;
      
      // Update local maps
      if (msg.senderId) {
        this.userIdToPeerId.set(msg.senderId, conn.peer);
        if (msg.senderName) this.userIdToName.set(msg.senderId, msg.senderName);
      }

      const isHost = this.peer?.id.startsWith('OMNI_ROOM_');
      
      if (isHost) {
        // If Host receives a targeted message for someone else, relay it
        if (msg.targetId && msg.targetId !== this.userId) {
          this.relayToTarget(msg);
          return;
        } 
        
        // If Host receives a JOIN, broadcast it to everyone else
        if (msg.type === 'JOIN' && !msg.targetId) {
          this.broadcastToOthers(msg, conn.peer);
          
          // CRITICAL: Host must also tell the NEWCOMER about everyone already in the room
          // 1. Send Host's identity to newcomer
          conn.send({
            type: 'JOIN',
            senderId: this.userId,
            senderName: this.userName,
            roomId: this.roomId
          });
          
          // 2. Send other participants' identities to newcomer
          this.userIdToPeerId.forEach((pid, uid) => {
            if (uid !== this.userId && uid !== msg.senderId) {
              conn.send({
                type: 'JOIN',
                senderId: uid,
                senderName: this.userIdToName.get(uid) || 'Participant',
                roomId: this.roomId
              });
            }
          });
        }
      }

      this.onMessageCallback?.(msg);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      for (const [uid, pid] of this.userIdToPeerId.entries()) {
        if (pid === conn.peer) {
            this.userIdToPeerId.delete(uid);
            this.userIdToName.delete(uid);
        }
      }
    });
  }

  private relayToTarget(msg: SignalPayload) {
    const peerId = this.userIdToPeerId.get(msg.targetId!);
    if (peerId) {
      const targetConn = this.connections.get(peerId);
      if (targetConn) targetConn.send(msg);
    }
  }

  private broadcastToOthers(msg: SignalPayload, skipPeerId: string) {
    this.connections.forEach((conn, pid) => {
      if (pid !== skipPeerId) conn.send(msg);
    });
  }

  sendSignal(payload: SignalPayload) {
    if (payload.targetId) {
      const peerId = this.userIdToPeerId.get(payload.targetId);
      if (peerId) {
        const target = this.connections.get(peerId);
        if (target) {
          target.send(payload);
          return;
        }
      }
    }
    // Default: Broadcast to all direct connections (for participants, this is just the host)
    this.connections.forEach(conn => conn.send(payload));
  }

  leaveRoom() {
    this.connections.forEach(c => c.close());
    this.connections.clear();
    this.userIdToPeerId.clear();
    this.userIdToName.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}
