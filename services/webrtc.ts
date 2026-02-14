
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
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
    console.log("[WebRTC] Initializing new PeerConnection...");
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.onTrackCallback = onTrack;
    this.onIceCandidateCallback = onIceCandidate;
    this.setupListeners();
  }

  private setupListeners() {
    this.pc.ontrack = (event) => {
      console.log(`[WebRTC-TRACK] Track received: kind=${event.track.kind}, id=${event.track.id}`);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      const existingTrack = this.remoteStream.getTracks().find(t => t.kind === event.track.kind);
      if (existingTrack) {
        console.log(`[WebRTC-TRACK] Replacing existing ${event.track.kind} track`);
        this.remoteStream.removeTrack(existingTrack);
      }
      
      this.remoteStream.addTrack(event.track);
      
      // CRITICAL: We pass a NEW MediaStream instance to trigger React re-render.
      // Objects are mutable; passing the same reference won't trigger state updates.
      const freshStream = new MediaStream(this.remoteStream.getTracks());
      console.log("[WebRTC-STATE] Dispatched fresh MediaStream to UI");
      this.onTrackCallback(freshStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.debug("[WebRTC-ICE] Generated Candidate");
        this.onIceCandidateCallback(event.candidate);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC-ICE-STATE] ${this.pc.iceConnectionState}`);
      if (this.pc.iceConnectionState === 'failed') {
        console.warn("[WebRTC-ICE] Connection failed, attempting ICE restart...");
        this.pc.restartIce();
      }
    };

    this.pc.onsignalingstatechange = () => {
      console.log(`[WebRTC-SIGNAL-STATE] ${this.pc.signalingState}`);
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    console.log("[WebRTC-SDP] Created and set Local Offer");
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    console.log("[WebRTC-SDP] Handling Remote Offer...");
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log("[WebRTC-SDP] Created and set Local Answer");
    this.processQueue();
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    console.log("[WebRTC-SDP] Handling Remote Answer...");
    if (this.pc.signalingState !== 'stable') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.processQueue();
    }
  }

  private async processQueue() {
    console.debug(`[WebRTC-ICE] Processing ${this.candidateQueue.length} queued candidates`);
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc.remoteDescription) {
      console.debug("[WebRTC-ICE] Queueing remote candidate (SDP not ready)");
      this.candidateQueue.push(candidate);
    } else {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  addTracks(stream: MediaStream) {
    if (!stream) return;
    const senders = this.pc.getSenders();
    stream.getTracks().forEach((track) => {
      const alreadyExists = senders.find(s => s.track?.kind === track.kind);
      if (!alreadyExists) {
        console.log(`[WebRTC-TRACK] Adding local ${track.kind} track to peer`);
        this.pc.addTrack(track, stream);
      } else {
        console.log(`[WebRTC-TRACK] Replacing local ${track.kind} track`);
        alreadyExists.replaceTrack(track);
      }
    });
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack) {
    const videoSender = this.pc.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      console.log(`[WebRTC-TRACK] hot-swapping video track to ${newTrack.label}`);
      await videoSender.replaceTrack(newTrack);
    } else {
      console.warn("[WebRTC-TRACK] No video sender found to replace");
    }
  }

  close() {
    console.log("[WebRTC] Closing PeerConnection...");
    this.pc.getSenders().forEach(s => {
      try { this.pc.removeTrack(s); } catch(e) {}
    });
    this.pc.close();
  }
}
