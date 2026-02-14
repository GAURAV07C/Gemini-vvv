
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserSession, CallStatus, Participant, ChatMessage } from '../types';
import VideoTile from './VideoTile';
import Controls from './Controls';
import ParticipantsPanel from './ParticipantsPanel';
import ChatPanel from './ChatPanel';
import { WebRTCService } from '../services/webrtc';
import { SignalingService, SignalPayload } from '../services/socket';

interface Toast {
  id: string;
  message: string;
  icon: string;
  type: 'host-action' | 'system';
}

interface MeetingRoomProps {
  session: UserSession;
  onLeave: () => void;
  onStatusChange: (status: CallStatus) => void;
}

const MeetingRoom: React.FC<MeetingRoomProps> = ({ session, onLeave, onStatusChange }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const peers = useRef<Map<string, WebRTCService>>(new Map());
  const sigService = useRef<SignalingService>(SignalingService.getInstance());
  const localStreamRef = useRef<MediaStream | null>(null);

  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);

  const addToast = useCallback((message: string, icon: string = 'fa-crown') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, icon, type: 'host-action' }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const broadcastMetadata = useCallback((audio?: boolean, video?: boolean) => {
    sigService.current.sendSignal({
      type: 'METADATA', senderId: session.userId, senderName: session.displayName,
      roomId: session.roomId, data: { 
        audio: audio !== undefined ? audio : !isMutedRef.current, 
        video: video !== undefined ? video : !isVideoOffRef.current 
      }
    });
  }, [session]);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { console.warn("Audio feedback blocked."); }
  }, []);

  const toggleMic = useCallback((forced?: boolean) => {
    setIsMuted(prev => {
      const next = forced !== undefined ? forced : !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
      }
      return next;
    });
  }, []);

  const toggleVideo = useCallback((forced?: boolean) => {
    setIsVideoOff(prev => {
      const next = forced !== undefined ? forced : !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !next);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    broadcastMetadata(!isMuted, !isVideoOff);
  }, [isMuted, isVideoOff, broadcastMetadata]);

  const toggleCamera = async () => {
    if (!localStreamRef.current) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextMode } },
        audio: true
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoOffRef.current;

      for (const peer of peers.current.values()) {
        await peer.replaceVideoTrack(newVideoTrack);
      }

      const updatedStream = new MediaStream([newVideoTrack, ...localStreamRef.current.getAudioTracks()]);
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream;
      setFacingMode(nextMode);
      return true;
    } catch (err) { 
      console.error("Camera switch failed", err); 
      return false;
    }
  };

  const handleSignaling = useCallback(async (msg: SignalPayload) => {
    switch (msg.type) {
      case 'JOIN':
        if (msg.senderId !== session.userId) {
          const shouldOffer = session.userId < msg.senderId;
          createPeer(msg.senderId, msg.senderName, shouldOffer);
          if (session.isHost) broadcastMetadata();
        }
        break;
      case 'OFFER':
        const peerOffer = createPeer(msg.senderId, msg.senderName, false);
        const answer = await peerOffer.handleOffer(msg.data);
        sigService.current.sendSignal({
          type: 'ANSWER', senderId: session.userId, senderName: session.displayName,
          roomId: session.roomId, targetId: msg.senderId, data: answer
        });
        break;
      case 'ANSWER':
        peers.current.get(msg.senderId)?.handleAnswer(msg.data);
        break;
      case 'CANDIDATE':
        peers.current.get(msg.senderId)?.addIceCandidate(msg.data);
        break;
      case 'METADATA':
        setParticipants(prev => {
          const idx = prev.findIndex(p => p.id === msg.senderId);
          const newData = {
            id: msg.senderId, name: msg.senderName, isLocal: false, 
            isVideoOn: msg.data.video, isAudioOn: msg.data.audio, isHost: false,
            isControlGranted: true
          };
          if (idx === -1) return [...prev, newData];
          const next = [...prev];
          next[idx] = { ...next[idx], ...newData };
          return next;
        });
        break;
      case 'REMOTE_COMMAND':
        if (msg.targetId === session.userId) {
          const action = msg.data.action;
          playNotificationSound();
          if (action === 'toggleMic') {
            const currentMuted = isMutedRef.current;
            toggleMic();
            addToast(`Host has ${currentMuted ? 'unmuted' : 'muted'} your microphone`, currentMuted ? 'fa-microphone' : 'fa-microphone-slash');
          } else if (action === 'toggleVideo') {
            const currentVideoOff = isVideoOffRef.current;
            toggleVideo();
            addToast(`Host has ${currentVideoOff ? 'started' : 'stopped'} your camera`, currentVideoOff ? 'fa-video' : 'fa-video-slash');
          } else if (action === 'switchCamera') {
            await toggleCamera();
            addToast(`Host has remotely switched your active camera`, 'fa-camera-rotate');
          }
        }
        break;
      case 'LEAVE':
        peers.current.get(msg.senderId)?.close();
        peers.current.delete(msg.senderId);
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(msg.senderId);
          return next;
        });
        setParticipants(prev => prev.filter(p => p.id !== msg.senderId));
        break;
    }
  }, [session, toggleMic, toggleVideo, playNotificationSound, addToast]);

  useEffect(() => {
    sigService.current.updateCallback(handleSignaling);
  }, [handleSignaling]);

  const createPeer = (targetId: string, name: string, shouldOffer: boolean) => {
    let peer = peers.current.get(targetId);
    if (!peer) {
      peer = new WebRTCService(
        (stream) => {
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(targetId, stream);
            return next;
          });
        },
        (candidate) => sigService.current.sendSignal({
          type: 'CANDIDATE', senderId: session.userId, senderName: session.displayName,
          roomId: session.roomId, targetId, data: candidate
        })
      );
      peers.current.set(targetId, peer);
    }
    if (localStreamRef.current) peer.addTracks(localStreamRef.current);
    
    setParticipants(prev => {
      if (prev.find(p => p.id === targetId)) return prev;
      return [...prev, { id: targetId, name, isLocal: false, isVideoOn: true, isAudioOn: true, isHost: false }];
    });

    if (shouldOffer) {
      peer.createOffer().then(offer => {
        sigService.current.sendSignal({
          type: 'OFFER', senderId: session.userId, senderName: session.displayName,
          roomId: session.roomId, targetId, data: offer
        });
      });
    }
    return peer;
  };

  useEffect(() => {
    const init = async () => {
      onStatusChange(CallStatus.CONNECTING);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter(d => d.kind === 'videoinput').length > 1);
        setParticipants([{ id: session.userId, name: session.displayName, isLocal: true, isVideoOn: true, isAudioOn: true, isHost: session.isHost }]);
        sigService.current.joinRoom(session.roomId, session.userId, session.displayName, session.isHost, handleSignaling);
        onStatusChange(CallStatus.CONNECTED);
      } catch (e) { onStatusChange(CallStatus.DISCONNECTED); }
    };
    init();
    return () => {
      sigService.current.leaveRoom();
      peers.current.forEach(p => p.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const remoteScreenParticipant = participants.find(p => p.isScreenSharing && !p.isLocal);
  const isInTheaterMode = isScreenSharing || !!remoteScreenParticipant;

  return (
    <div className="w-full h-full flex flex-col items-center relative overflow-hidden bg-[#0a0f1d]">
      
      {/* Dynamic Toast Notification System */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 items-center pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-auto">
            <div className="bg-blue-600/90 backdrop-blur-2xl border border-blue-400/30 px-6 py-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4 text-white min-w-[320px]">
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shadow-inner">
                <i className={`fas ${toast.icon} text-xs text-blue-200`}></i>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-200/70">Room Authority</span>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                </div>
                <span className="text-sm font-bold tracking-tight text-white/95">{toast.message}</span>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto text-white/40 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={`w-full max-w-7xl flex-grow p-4 md:p-8 mb-24 flex gap-6 overflow-hidden h-full`}>
        <div className={`flex-grow grid gap-4 md:gap-6 ${isInTheaterMode ? 'grid-cols-4 grid-rows-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {isInTheaterMode && (
            <div className="col-span-4 row-span-3 lg:col-span-3 lg:row-span-4 h-full">
              <VideoTile 
                stream={isScreenSharing ? screenStream : (remoteScreenParticipant ? remoteStreams.get(remoteScreenParticipant.id) : null)} 
                label={isScreenSharing ? "Your Screen" : `${remoteScreenParticipant?.name}'s Screen`}
                isScreenSharing={true}
              />
            </div>
          )}
          <div className={`${isInTheaterMode ? 'col-span-1 row-span-1 h-[140px]' : 'h-[300px] md:h-[350px]'}`}>
            <VideoTile stream={localStream} label={`${session.displayName} (You)`} isLocal isVideoOff={isVideoOff} isMuted={isMuted} />
          </div>
          {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
            const pData = participants.find(p => p.id === peerId);
            if (isInTheaterMode && pData?.isScreenSharing && !isScreenSharing) return null; 
            return (
              <div key={peerId} className={`${isInTheaterMode ? 'col-span-1 row-span-1 h-[140px]' : 'h-[300px] md:h-[350px]'}`}>
                <VideoTile stream={stream} label={pData?.name || "Participant"} isMuted={!pData?.isAudioOn} isVideoOff={!pData?.isVideoOn} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 px-4 gap-3">
        <Controls 
          isMuted={isMuted} isVideoOff={isVideoOff} isScreenSharing={isScreenSharing} isHandRaised={false} showParticipants={showParticipants} 
          hasMultipleCameras={hasMultipleCameras}
          onToggleMute={() => toggleMic()}
          onToggleVideo={() => toggleVideo()} 
          onToggleScreenShare={() => {}} 
          onToggleHandRaise={() => {}} 
          onToggleParticipants={() => setShowParticipants(!showParticipants)} 
          onLeave={onLeave} 
          roomId={session.roomId} 
          participantCount={participants.length}
          onSwitchCamera={toggleCamera}
        />
      </div>
      <ParticipantsPanel 
        isOpen={showParticipants} 
        participants={participants} 
        onClose={() => setShowParticipants(false)} 
        isHost={session.isHost} 
        onRemoteCommand={(id, action) => sigService.current.sendSignal({ type: 'REMOTE_COMMAND', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, targetId: id, data: { action } })} 
      />
    </div>
  );
};

export default MeetingRoom;
