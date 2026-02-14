
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
      console.log("[SFU-Engine] Remote track received:", event.track.kind);
      event.streams[0].getTracks().forEach(track => {
        if (!this.remoteStream.getTracks().find(t => t.id === track.id)) {
          this.remoteStream.addTrack(track);
        }
      });
      this.onTrackCallback(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) this.onIceCandidateCallback(event.candidate);
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'failed') this.pc.restartIce();
    };
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.processQueue();
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.pc.signalingState !== 'stable') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.processQueue();
    }
  }

  private async processQueue() {
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      if (cand) await this.pc.addIceCandidate(new RTCIceCandidate(cand));
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
      const alreadyExists = senders.find(s => s.track?.id === track.id || s.track?.kind === track.kind);
      if (!alreadyExists) {
        this.pc.addTrack(track, stream);
      }
    });
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack) {
    const videoSender = this.pc.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    }
  }

  close() {
    this.pc.getSenders().forEach(s => this.pc.removeTrack(s));
    this.pc.close();
  }
}
