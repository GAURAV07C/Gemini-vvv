
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
  const [screenShareSupported, setScreenShareSupported] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDuplicateSession, setIsDuplicateSession] = useState(false);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const peers = useRef<Map<string, WebRTCService>>(new Map());
  const sigService = useRef<SignalingService>(SignalingService.getInstance());
  const localStreamRef = useRef<MediaStream | null>(null);

  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const isScreenSharingRef = useRef(isScreenSharing);

  useEffect(() => { 
    isMutedRef.current = isMuted; 
    isScreenSharingRef.current = isScreenSharing;
    isVideoOffRef.current = isVideoOff;
  }, [isMuted, isScreenSharing, isVideoOff]);

  useEffect(() => {
    const hasAPI = !!(navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia);
    setScreenShareSupported(hasAPI && window.isSecureContext);
  }, []);

  const addToast = useCallback((message: string, icon: string = 'fa-crown') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, icon, type: 'host-action' }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const broadcastMetadata = useCallback((audio?: boolean, video?: boolean, screen?: boolean) => {
    sigService.current.sendSignal({
      type: 'METADATA', senderId: session.userId, senderName: session.displayName,
      roomId: session.roomId, data: { 
        audio: audio !== undefined ? audio : !isMutedRef.current, 
        video: video !== undefined ? video : !isVideoOffRef.current,
        screen: screen !== undefined ? screen : isScreenSharingRef.current
      }
    });
  }, [session]);

  const toggleMic = useCallback((forced?: boolean) => {
    setIsMuted(prev => {
      const next = forced !== undefined ? forced : !prev;
      if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
      return next;
    });
  }, []);

  const toggleVideo = useCallback((forced?: boolean) => {
    setIsVideoOff(prev => {
      const next = forced !== undefined ? forced : !prev;
      if (localStreamRef.current) localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !next);
      return next;
    });
  }, []);

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenShare();
        for (const peer of peers.current.values()) await peer.replaceVideoTrack(screenTrack);
        setScreenStream(stream);
        setIsScreenSharing(true);
        broadcastMetadata(undefined, undefined, true);
      } catch (err: any) {
        console.error("Screen share error:", err);
        if (err.name !== 'NotAllowedError') addToast("Failed to share screen", "fa-circle-xmark");
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = async () => {
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      for (const peer of peers.current.values()) await peer.replaceVideoTrack(cameraTrack);
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    broadcastMetadata(undefined, undefined, false);
  };

  const toggleCamera = async () => {
    if (!localStreamRef.current) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const audioTracks = localStreamRef.current.getAudioTracks();
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      setLocalStream(null);
      await new Promise(r => setTimeout(r, 400));
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextMode } }, audio: false });
      const newVideoTrack = newStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoOffRef.current;
      if (!isScreenSharingRef.current) {
        for (const peer of peers.current.values()) await peer.replaceVideoTrack(newVideoTrack);
      }
      const updatedStream = new MediaStream([newVideoTrack, ...audioTracks]);
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream;
      setFacingMode(nextMode);
      return true;
    } catch (e) {
      addToast(`Camera Swap Failed`, 'fa-camera-rotate');
      return false;
    }
  };

  const handleSignaling = useCallback(async (msg: SignalPayload) => {
    console.group(`[SIGNAL-RECEIVED] ${msg.type}`);
    console.log("FROM:", msg.senderName, `(${msg.senderId})`);
    if (msg.data) console.log("DATA:", JSON.stringify(msg.data, null, 2));
    console.groupEnd();

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
        sigService.current.sendSignal({ type: 'ANSWER', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, targetId: msg.senderId, data: answer });
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
          const newData = { id: msg.senderId, name: msg.senderName, isLocal: false, isVideoOn: msg.data.video, isAudioOn: msg.data.audio, isHost: false, isScreenSharing: !!msg.data.screen };
          if (idx === -1) return [...prev, newData];
          const next = [...prev];
          next[idx] = { ...next[idx], ...newData };
          return next;
        });
        break;
      case 'REMOTE_COMMAND':
        if (msg.targetId === session.userId) {
          if (msg.data.action === 'toggleMic') toggleMic();
          if (msg.data.action === 'toggleVideo') toggleVideo();
          if (msg.data.action === 'switchCamera') toggleCamera();
        }
        break;
      case 'LEAVE':
        peers.current.get(msg.senderId)?.close();
        peers.current.delete(msg.senderId);
        setRemoteStreams(prev => { const next = new Map(prev); next.delete(msg.senderId); return next; });
        setParticipants(prev => prev.filter(p => p.id !== msg.senderId));
        break;
    }
  }, [session, toggleMic, toggleVideo, broadcastMetadata]);

  const createPeer = (targetId: string, name: string, shouldOffer: boolean) => {
    let peer = peers.current.get(targetId);
    if (!peer) {
      console.log(`[Session] Linking with ${name}...`);
      peer = new WebRTCService(
        (stream) => {
          console.log(`[Session] Stream synchronized for ${name}`);
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.set(targetId, stream);
            return next;
          });
        },
        (candidate) => sigService.current.sendSignal({ type: 'CANDIDATE', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, targetId, data: candidate })
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
        sigService.current.sendSignal({ type: 'OFFER', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, targetId, data: offer });
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
        sigService.current.joinRoom(session.roomId, session.userId, session.displayName, session.isHost, handleSignaling, (err) => { if (err === 'id-taken') setIsDuplicateSession(true); });
        onStatusChange(CallStatus.CONNECTED);
      } catch (e) { 
        console.error("Initialization Failed:", e);
        onStatusChange(CallStatus.DISCONNECTED); 
      }
    };
    init();
    return () => {
      sigService.current.leaveRoom();
      peers.current.forEach(p => p.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (isDuplicateSession) return <div className="p-20 text-center text-red-500 font-black uppercase">Session Active Elsewhere</div>;

  const remoteScreenParticipant = participants.find(p => p.isScreenSharing && !p.isLocal);
  const isInTheaterMode = isScreenSharing || !!remoteScreenParticipant;

  return (
    <div className="w-full h-full flex flex-col items-center relative overflow-hidden bg-[#050810]">
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => <div key={t.id} className="bg-blue-600 px-6 py-3 rounded-2xl text-white shadow-2xl">{t.message}</div>)}
      </div>

      <div className="w-full max-w-7xl flex-grow p-4 md:p-8 mb-24 flex gap-6 overflow-hidden h-full">
        <div className={`flex-grow grid gap-4 ${isInTheaterMode ? 'grid-cols-4 grid-rows-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {isInTheaterMode && (
            <div className="col-span-4 row-span-3 lg:col-span-3 lg:row-span-4 h-full">
              <VideoTile 
                stream={isScreenSharing ? screenStream : remoteStreams.get(remoteScreenParticipant?.id || '')} 
                label={isScreenSharing ? "Your Screen" : `${remoteScreenParticipant?.name}'s Screen`}
                isScreenSharing={true}
              />
            </div>
          )}
          <div className={`${isInTheaterMode ? 'col-span-1 h-[140px]' : 'h-[320px]'}`}>
            <VideoTile stream={localStream} label={`${session.displayName} (You)`} isLocal isVideoOff={isVideoOff} isMuted={isMuted} />
          </div>
          {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
            const pData = participants.find(p => p.id === peerId);
            if (isInTheaterMode && pData?.isScreenSharing && !isScreenSharing) return null; 
            return (
              <div key={peerId} className={`${isInTheaterMode ? 'col-span-1 h-[140px]' : 'h-[320px]'}`}>
                <VideoTile stream={stream} label={pData?.name || "Participant"} isMuted={!pData?.isAudioOn} isVideoOff={!pData?.isVideoOn} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50">
        <Controls 
          isMuted={isMuted} isVideoOff={isVideoOff} isScreenSharing={isScreenSharing} isHandRaised={false} showParticipants={showParticipants} 
          hasMultipleCameras={hasMultipleCameras} onToggleMute={toggleMic} onToggleVideo={toggleVideo} onToggleScreenShare={toggleScreenShare} 
          onToggleHandRaise={() => {}} onToggleParticipants={() => setShowParticipants(!showParticipants)} onLeave={onLeave} 
          roomId={session.roomId} participantCount={participants.length} onSwitchCamera={toggleCamera} screenShareSupported={screenShareSupported}
        />
      </div>
      <ParticipantsPanel 
        isOpen={showParticipants} participants={participants} onClose={() => setShowParticipants(false)} isHost={session.isHost} 
        onRemoteCommand={(id, action) => sigService.current.sendSignal({ type: 'REMOTE_COMMAND', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, targetId: id, data: { action } })} 
      />
    </div>
  );
};

export default MeetingRoom;
