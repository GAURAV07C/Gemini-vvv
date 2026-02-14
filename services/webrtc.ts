
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCService {
  public pc: RTCPeerConnection;
  private onTrackCallback: (stream: MediaStream) => void;
  private onIceCandidateCallback: (candidate: RTCIceCandidate) => void;
  private remoteStream: MediaStream = new MediaStream();
  private candidateQueue: RTCIceCandidateInit[] = [];

  constructor(
    onTrack: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ) {
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.onTrackCallback = onTrack;
    this.onIceCandidateCallback = onIceCandidate;
    this.setupListeners();
  }

  private setupListeners() {
    this.pc.ontrack = (event) => {
      console.log("[WebRTC] Track detected:", event.track.kind);
      
      // Add track to our permanent remoteStream object
      if (event.streams && event.streams[0]) {
        // Many browsers provide the stream directly
        event.streams[0].getTracks().forEach(track => {
          if (!this.remoteStream.getTracks().includes(track)) {
            this.remoteStream.addTrack(track);
          }
        });
      } else {
        // Fallback: add individual track
        this.remoteStream.addTrack(event.track);
      }
      
      // Always notify the UI with our managed stream object
      this.onTrackCallback(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback(event.candidate);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] Connection State:", this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.pc.restartIce();
      }
    };
  }

  async createOffer() {
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);
      return offer;
    } catch (e) {
      console.error("[WebRTC] Create Offer Error:", e);
      throw e;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      // Process any candidates that arrived early
      while (this.candidateQueue.length > 0) {
        const cand = this.candidateQueue.shift();
        if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      
      return answer;
    } catch (e) {
      console.error("[WebRTC] Handle Offer Error:", e);
      throw e;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (this.pc.signalingState !== 'stable') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        while (this.candidateQueue.length > 0) {
          const cand = this.candidateQueue.shift();
          if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }
      }
    } catch (e) {
      console.error("[WebRTC] Handle Answer Error:", e);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (!this.pc.remoteDescription) {
        this.candidateQueue.push(candidate);
      } else {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.debug("[WebRTC] Candidate ignored:", e);
    }
  }

  addTracks(stream: MediaStream) {
    if (!stream) return;
    const currentTracks = this.pc.getSenders().map(s => s.track);
    stream.getTracks().forEach((track) => {
      if (!currentTracks.includes(track)) {
        this.pc.addTrack(track, stream);
      }
    });
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack) {
    const senders = this.pc.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    }
  }

  close() {
    this.pc.close();
  }
}
