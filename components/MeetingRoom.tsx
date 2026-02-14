
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserSession, CallStatus, Participant, ChatMessage } from '../types';
import VideoTile from './VideoTile';
import Controls from './Controls';
import ParticipantsPanel from './ParticipantsPanel';
import ChatPanel from './ChatPanel';
import { WebRTCService } from '../services/webrtc';
import { SignalingService, SignalPayload } from '../services/socket';

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
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Map<string, string>>(new Map());
  
  const peers = useRef<Map<string, WebRTCService>>(new Map());
  const sigService = useRef<SignalingService>(SignalingService.getInstance());
  const localStreamRef = useRef<MediaStream | null>(null);

  const broadcastMetadata = useCallback((audioOverride?: boolean, videoOverride?: boolean) => {
    sigService.current.sendSignal({
      type: 'METADATA', senderId: session.userId, senderName: session.displayName,
      roomId: session.roomId, data: { 
        audio: audioOverride !== undefined ? audioOverride : !isMuted, 
        video: videoOverride !== undefined ? videoOverride : !isVideoOff 
      }
    });
  }, [isMuted, isVideoOff, session]);

  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      // Create new stream with opposite facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextMode } },
        audio: !isMuted
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      // Replace tracks in all peer connections
      for (const peer of peers.current.values()) {
        await peer.replaceVideoTrack(newVideoTrack);
      }

      // Update local state
      const updatedStream = new MediaStream([newVideoTrack, ...localStreamRef.current.getAudioTracks()]);
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream;
      setFacingMode(nextMode);

      // Stop old track
      oldVideoTrack.stop();
      
      console.log(`[MeetingRoom] Camera switched to: ${nextMode}`);
    } catch (err) {
      console.error("Camera switch failed:", err);
    }
  }, [facingMode, isMuted]);

  const handleSignaling = async (msg: SignalPayload) => {
    switch (msg.type) {
      case 'JOIN':
        if (msg.senderId !== session.userId) {
          const shouldOffer = session.userId < msg.senderId;
          createPeer(msg.senderId, msg.senderName, shouldOffer);
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
      case 'SCREEN_STATUS':
        setParticipants(prev => prev.map(p => 
          p.id === msg.senderId ? { ...p, isScreenSharing: msg.data } : p
        ));
        break;
      case 'METADATA':
        setParticipants(prev => {
          const exists = prev.find(p => p.id === msg.senderId);
          if (!exists) {
            return [...prev, {
              id: msg.senderId, name: msg.senderName, isLocal: false, 
              isVideoOn: msg.data.video, isAudioOn: msg.data.audio, isHost: false,
              isControlGranted: true // Mocking full access for demo purposes as requested
            }];
          }
          return prev.map(p => p.id === msg.senderId ? { ...p, isAudioOn: msg.data.audio, isVideoOn: msg.data.video } : p);
        });
        break;
      case 'CHAT':
        setMessages(prev => [...prev, { ...msg.data, isLocal: false }]);
        break;
      case 'REACTION':
        setReactions(prev => new Map(prev).set(msg.senderId, msg.data));
        break;
      case 'REMOTE_COMMAND':
        if (msg.targetId === session.userId) {
          if (msg.data.action === 'switchCamera') {
            await toggleCamera();
          } else if (msg.data.action === 'toggleMic') {
            const next = !isMuted; setIsMuted(next); 
            localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !next);
            broadcastMetadata(!next, !isVideoOff);
          } else if (msg.data.action === 'toggleVideo') {
            const next = !isVideoOff; setIsVideoOff(next); 
            localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !next);
            broadcastMetadata(!isMuted, !next);
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
  };

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
      return [...prev, { id: targetId, name: name || 'Participant', isLocal: false, isVideoOn: true, isAudioOn: true, isHost: false, isControlGranted: true }];
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

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        const screenVideoTrack = stream.getVideoTracks()[0];
        screenVideoTrack.onended = () => stopScreenSharing();
        for (const peer of peers.current.values()) {
          await peer.replaceVideoTrack(screenVideoTrack);
        }
        sigService.current.sendSignal({ type: 'SCREEN_STATUS', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, data: true });
      } else {
        await stopScreenSharing();
      }
    } catch (err) { console.error("Screen share failed", err); }
  };

  const stopScreenSharing = async () => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      for (const peer of peers.current.values()) {
        await peer.replaceVideoTrack(cameraTrack);
      }
    }
    sigService.current.sendSignal({ type: 'SCREEN_STATUS', senderId: session.userId, senderName: session.displayName, roomId: session.roomId, data: false });
  };

  useEffect(() => {
    const init = async () => {
      onStatusChange(CallStatus.CONNECTING);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        // Check for multiple cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1 || /Android|iPhone|iPad/i.test(navigator.userAgent));

        setParticipants([{ id: session.userId, name: session.displayName, isLocal: true, isVideoOn: true, isAudioOn: true, isHost: session.isHost }]);
        sigService.current.joinRoom(session.roomId, session.userId, session.displayName, session.isHost, handleSignaling);
        onStatusChange(CallStatus.CONNECTED);
        const timer = setInterval(() => broadcastMetadata(), 5000);
        return () => clearInterval(timer);
      } catch (e) { 
        console.error("Media init error:", e);
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

  const remoteScreenParticipant = participants.find(p => p.isScreenSharing && !p.isLocal);
  const isInTheaterMode = isScreenSharing || !!remoteScreenParticipant;

  return (
    <div className="w-full h-full flex flex-col items-center relative overflow-hidden">
      {isScreenSharing && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-blue-600/90 backdrop-blur-md border border-blue-400/30 px-6 py-2 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">You are presenting to everyone</span>
            </div>
            <div className="h-4 w-px bg-white/20"></div>
            <button onClick={toggleScreenShare} className="bg-red-500 hover:bg-red-400 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all shadow-lg active:scale-95">Stop Sharing</button>
          </div>
        </div>
      )}

      <div className={`w-full max-w-7xl flex-grow p-4 md:p-10 mb-24 flex gap-6 overflow-hidden h-full`}>
        <div className={`flex-grow grid gap-6 ${isInTheaterMode ? 'grid-cols-4 grid-rows-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {isInTheaterMode && (
            <div className="col-span-4 row-span-3 lg:col-span-3 lg:row-span-4 h-full">
              <VideoTile 
                stream={isScreenSharing ? screenStream : (remoteScreenParticipant ? remoteStreams.get(remoteScreenParticipant.id) : null)} 
                label={isScreenSharing ? "Your Screen" : `${remoteScreenParticipant?.name}'s Screen`}
                isScreenSharing={true}
              />
            </div>
          )}

          <div className={`${isInTheaterMode ? 'col-span-1 row-span-1 h-[120px] lg:h-auto' : 'h-[300px] md:h-[350px]'}`}>
            <VideoTile stream={localStream} label={`${session.displayName} (You)`} isLocal isVideoOff={isVideoOff} isMuted={isMuted} reaction={reactions.get(session.userId)} isSelfScreenSharing={isScreenSharing} />
          </div>

          {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
            const pData = participants.find(p => p.id === peerId);
            if (isInTheaterMode && pData?.isScreenSharing && !isScreenSharing) return null; 
            return (
              <div key={peerId} className={`${isInTheaterMode ? 'col-span-1 row-span-1 h-[120px] lg:h-auto' : 'h-[300px] md:h-[350px]'}`}>
                <VideoTile stream={stream} label={pData?.name || "Participant"} reaction={reactions.get(peerId)} isMuted={!pData?.isAudioOn} isVideoOff={!pData?.isVideoOn} isScreenSharing={pData?.isScreenSharing} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 px-4 gap-3">
        <Controls 
          isMuted={isMuted} isVideoOff={isVideoOff} isScreenSharing={isScreenSharing} isHandRaised={false} showParticipants={showParticipants} 
          hasMultipleCameras={hasMultipleCameras}
          onToggleMute={() => { 
            const next = !isMuted; setIsMuted(next); 
            localStream?.getAudioTracks().forEach(t => t.enabled = !next); 
            broadcastMetadata(!next, !isVideoOff); // Sync immediately
          }}
          onToggleVideo={() => { 
            const next = !isVideoOff; setIsVideoOff(next); 
            localStream?.getVideoTracks().forEach(t => t.enabled = !next); 
            broadcastMetadata(!isMuted, !next); // Sync immediately
          }} 
          onToggleScreenShare={toggleScreenShare} 
          onToggleHandRaise={() => {}} 
          onToggleParticipants={() => setShowParticipants(!showParticipants)} 
          onLeave={onLeave} 
          roomId={session.roomId} 
          participantCount={participants.length}
          onSwitchCamera={toggleCamera}
        />
        <button onClick={() => setShowChat(!showChat)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${showChat ? 'bg-blue-600 border-blue-400 shadow-xl' : 'bg-slate-900 border-white/10 hover:bg-slate-800'}`}>
          <i className="fas fa-comments text-blue-400 text-lg"></i>
        </button>
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
