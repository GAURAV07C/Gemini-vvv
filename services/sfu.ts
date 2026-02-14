
/**
 * Senior Engineer's SFU Service (Mediasoup Architecture)
 * 
 * Flow:
 * 1. Get Router RTP Capabilities from Server
 * 2. Create Device and Load Capabilities
 * 3. Create Send Transport (for Local Mic/Cam)
 * 4. Create Receive Transport (for Remote Streams)
 */

export class SFUService {
  private device: any = null; // In real app, this is from 'mediasoup-client'
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producers: Map<string, any> = new Map();
  private consumers: Map<string, any> = new Map();

  constructor(private onRemoteTrack: (track: MediaStreamTrack, peerId: string) => void) {}

  // Mocking the Mediasoup device initialization
  async initializeDevice(routerRtpCapabilities: any) {
    console.log("[SFU] Initializing Device with Router Capabilities...");
    this.device = { loaded: true, rtpCapabilities: routerRtpCapabilities };
    return this.device;
  }

  async createSendTransport(transportOptions: any) {
    console.log("[SFU] Creating Send Transport...");
    // Mocking transport object with a close method to avoid TypeErrors
    this.sendTransport = { 
      ...transportOptions, 
      close: () => console.log("[SFU] Send Transport closed") 
    };
  }

  async createRecvTransport(transportOptions: any) {
    console.log("[SFU] Creating Recv Transport...");
    // Mocking transport object with a close method to avoid TypeErrors
    this.recvTransport = { 
      ...transportOptions, 
      close: () => console.log("[SFU] Recv Transport closed") 
    };
  }

  async produce(track: MediaStreamTrack, type: 'video' | 'audio') {
    console.log(`[SFU] Producing ${type} track to server...`);
    const producerId = `prod_${Math.random().toString(36).substr(2, 5)}`;
    this.producers.set(type, { id: producerId, track });
    return producerId;
  }

  async consume(producerId: string, peerId: string) {
    console.log(`[SFU] Consuming producer ${producerId} from peer ${peerId}`);
    // Simulated track from server using a silent video generator
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);
    }
    const track = (canvas as any).captureStream(10).getVideoTracks()[0];
    this.onRemoteTrack(track, peerId);
  }

  close() {
    // Using double optional chaining for robust cleanup in mock environment
    this.sendTransport?.close?.();
    this.recvTransport?.close?.();
    this.producers.clear();
    this.consumers.clear();
  }
}
