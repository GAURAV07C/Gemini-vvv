
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCService {
  public pc: RTCPeerConnection;
  private onTrackCallback: (stream: MediaStream) => void;
  private onIceCandidateCallback: (candidate: RTCIceCandidate) => void;
  private remoteStream: MediaStream | null = null;
  private candidateQueue: RTCIceCandidateInit[] = [];

  constructor(
    onTrack: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ) {
    console.log("[WebRTC] Creating new PeerConnection Instance");
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.onTrackCallback = onTrack;
    this.onIceCandidateCallback = onIceCandidate;
    this.setupListeners();
  }

  private setupListeners() {
    this.pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[WebRTC-FEED] Incoming track: ${track.kind} (${track.id})`);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      const existing = this.remoteStream.getTracks().find(t => t.kind === track.kind);
      if (existing) {
        this.remoteStream.removeTrack(existing);
      }
      
      this.remoteStream.addTrack(track);
      
      // We wrap the stream in a new instance to force React's shallow comparison to trigger a re-render.
      const streamToDispatch = new MediaStream(this.remoteStream.getTracks());
      console.log(`[WebRTC-UI] Dispatching stream to UI. Video tracks: ${streamToDispatch.getVideoTracks().length}`);
      this.onTrackCallback(streamToDispatch);
      
      track.onunmute = () => {
        console.log(`[WebRTC-FEED] Track unmuted/active: ${track.kind}`);
        this.onTrackCallback(new MediaStream(this.remoteStream?.getTracks() || []));
      };
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.debug("[WebRTC-ICE] New local candidate found");
        this.onIceCandidateCallback(event.candidate);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC-ICE-STATUS] ${this.pc.iceConnectionState.toUpperCase()}`);
      if (this.pc.iceConnectionState === 'failed') {
        console.warn("[WebRTC-ICE] Connection failed. Attempting restart...");
        this.pc.restartIce();
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[WebRTC-CONN-STATUS] ${this.pc.connectionState.toUpperCase()}`);
    };
  }

  async createOffer() {
    console.log("[WebRTC-SDP] Generating Local Offer...");
    const offer = await this.pc.createOffer({ 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: true 
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    console.log("[WebRTC-SDP] Processing Remote Offer...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.processQueue();
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    console.log("[WebRTC-SDP] Processing Remote Answer...");
    if (this.pc.signalingState !== 'stable') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.candidateQueue.length > 0) {
        console.log(`[WebRTC-ICE] Applying ${this.candidateQueue.length} queued candidates`);
        while (this.candidateQueue.length > 0) {
          const cand = this.candidateQueue.shift();
          if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc.remoteDescription) {
      this.candidateQueue.push(candidate);
    } else {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  addTracks(stream: MediaStream) {
    if (!stream) return;
    const senders = this.pc.getSenders();
    stream.getTracks().forEach((track) => {
      const sender = senders.find(s => s.track?.kind === track.kind);
      if (!sender) {
        console.log(`[WebRTC-TRACK] Adding new local ${track.kind} track`);
        this.pc.addTrack(track, stream);
      } else {
        console.log(`[WebRTC-TRACK] Replacing existing local ${track.kind} track`);
        sender.replaceTrack(track);
      }
    });
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack) {
    const videoSender = this.pc.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      console.log(`[WebRTC-TRACK] Swapping to track: ${newTrack.label}`);
      await videoSender.replaceTrack(newTrack);
    }
  }

  close() {
    console.log("[WebRTC] Terminating PeerConnection");
    this.pc.close();
  }
}
