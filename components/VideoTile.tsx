
import React, { useRef, useEffect, useState } from 'react';

interface VideoTileProps {
  stream: MediaStream | null | undefined;
  label: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ 
  stream, label, isLocal, isMuted, isVideoOff, isScreenSharing
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      console.debug(`[VideoTile] Processing stream for ${label}`, stream.id);
      
      // Update srcObject ONLY if it's different to prevent flickers
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      const attemptPlay = async () => {
        try {
          await video.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn(`[VideoTile] Play failure for ${label}:`, err);
          // Auto-retry if initial play fails (browser policy usually blocks)
          setTimeout(() => {
             video.play()
               .then(() => setIsPlaying(true))
               .catch(() => console.debug("[VideoTile] Secondary play attempt failed"));
          }, 1500);
        }
      };

      if (!isVideoOff || isScreenSharing) {
        attemptPlay();
      }
    } else {
      video.srcObject = null;
      setIsPlaying(false);
    }
  }, [stream, isVideoOff, isScreenSharing, label]);

  return (
    <div className="relative h-full w-full bg-[#050810] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group transition-all duration-500">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        onLoadedData={() => setIsPlaying(true)}
        className={`w-full h-full transition-all duration-700 ${isScreenSharing ? 'object-contain' : 'object-cover'} ${(!isPlaying || isVideoOff) && !isScreenSharing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      />

      {/* Connection State / Loader Overlay */}
      {stream && !isPlaying && !isVideoOff && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.3em] animate-pulse">Syncing Feed...</p>
          </div>
        </div>
      )}

      {/* Placeholder for Camera Off */}
      {(isVideoOff || !stream) && !isScreenSharing && (
        <div className="absolute inset-0 z-10 bg-[#050810] flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-slate-900/50 rounded-[2rem] flex items-center justify-center text-slate-700 border border-white/5 shadow-inner">
                <i className={`fas ${!stream ? 'fa-spinner fa-spin' : 'fa-video-slash'} text-3xl`}></i>
            </div>
            <div className="mt-6 flex flex-col items-center gap-1">
                <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em]">
                  {stream ? 'Camera Disabled' : 'Establishing Peer Link'}
                </p>
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-blue-500/20 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-500/20 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1 h-1 bg-blue-500/20 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
            </div>
        </div>
      )}

      {/* Label Overlay */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="bg-[#050810]/80 backdrop-blur-2xl border border-white/10 px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl">
          <div className="flex items-center gap-2">
             <i className={`fas ${isMuted ? 'fa-microphone-slash text-red-500' : 'fa-microphone text-green-500'} text-[10px]`}></i>
             {!isMuted && !isLocal && (
                <div className="flex gap-0.5 items-end h-3">
                   <div className="w-0.5 bg-green-500/40 animate-[voice-bar_0.5s_infinite_ease-in-out]"></div>
                   <div className="w-0.5 bg-green-500/60 animate-[voice-bar_0.7s_infinite_ease-in-out]"></div>
                   <div className="w-0.5 bg-green-500/40 animate-[voice-bar_0.6s_infinite_ease-in-out]"></div>
                </div>
             )}
          </div>
          <span className="text-white text-[10px] font-black uppercase tracking-widest truncate max-w-[140px]">{label}</span>
        </div>
      </div>

      <style>{`
        @keyframes voice-bar {
          0%, 100% { height: 4px; }
          50% { height: 12px; }
        }
      `}</style>
    </div>
  );
};

export default VideoTile;
