
import React, { useRef, useEffect, useState } from 'react';

interface VideoTileProps {
  stream: MediaStream | null | undefined;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isSelfScreenSharing?: boolean;
  reaction?: string | null;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  stream, label, isLocal, isMuted, isVideoOff, 
  isScreenSharing, isSelfScreenSharing, reaction
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      // If camera is turned back on, force play
      if (!isVideoOff || isScreenSharing) {
        setIsSyncing(true);
        video.play()
          .then(() => setIsSyncing(false))
          .catch(e => {
            if (e.name !== 'AbortError') console.warn("[VideoTile] Play failed:", e);
            setIsSyncing(false);
          });
      } else {
        video.pause();
      }
    }
  }, [stream, isVideoOff, isScreenSharing]);

  return (
    <div className={`relative h-full w-full bg-[#050810] rounded-3xl overflow-hidden border border-white/5 transition-all duration-500 shadow-2xl group`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        className={`w-full h-full transition-all duration-700 ${isScreenSharing ? 'object-contain' : 'object-cover'} ${isVideoOff && !isScreenSharing ? 'opacity-0 scale-95 grayscale' : 'opacity-100 scale-100 grayscale-0'}`}
      />

      {/* Syncing Overlay */}
      {isSyncing && !isVideoOff && (
        <div className="absolute inset-0 z-20 bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {isVideoOff && !isScreenSharing && (
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center text-slate-500 border border-white/5 shadow-2xl relative">
                <i className="fas fa-video-slash text-2xl"></i>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                </div>
            </div>
            <p className="mt-5 text-white/20 text-[10px] font-black uppercase tracking-[0.6em] ml-[0.6em]">Stream Offline</p>
        </div>
      )}

      {isSelfScreenSharing && !isScreenSharing && (
        <div className="absolute top-4 left-4 z-40 bg-blue-600/40 backdrop-blur-lg px-3 py-1.5 rounded-xl border border-blue-500/30 flex items-center gap-2 shadow-xl">
           <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_#60a5fa]"></div>
           <span className="text-[9px] font-black text-blue-100 uppercase tracking-widest">Presenting</span>
        </div>
      )}

      <div className={`absolute bottom-4 left-4 z-20 transition-transform duration-300 group-hover:scale-105`}>
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl">
          <div className="relative">
            <i className={`fas ${isMuted ? 'fa-microphone-slash text-red-500' : 'fa-microphone text-green-500'} text-[11px]`}></i>
            {!isMuted && <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>}
          </div>
          <span className="text-white text-[10px] font-black uppercase tracking-wider truncate max-w-[120px]">{label}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoTile;
