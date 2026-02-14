
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
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      const videoTracks = stream.getVideoTracks();
      setHasVideoTrack(videoTracks.length > 0);
      
      if (video.srcObject !== stream) {
        console.debug(`[VideoTile] Binding stream to ${label}. Tracks:`, stream.getTracks().length);
        video.srcObject = stream;
      }
      
      const play = async () => {
        try {
          // Muted autoplay is always allowed by browsers
          if (!video.paused) return;
          await video.play();
          console.debug(`[VideoTile] Play success: ${label}`);
        } catch (err) {
          console.warn(`[VideoTile] Play blocked for ${label}:`, err);
        }
      };

      if (!isVideoOff || isScreenSharing) {
        play();
      }
    } else {
      video.srcObject = null;
      setIsPlaying(false);
      setHasVideoTrack(false);
    }
  }, [stream, isVideoOff, isScreenSharing, label]);

  // Handler for when the stream actually starts rendering pixels
  const handlePlaying = () => {
    console.log(`[VideoTile] Content actively playing for: ${label}`);
    setIsPlaying(true);
  };

  const showLoader = stream && !isPlaying && !isVideoOff && hasVideoTrack;

  return (
    <div className="relative h-full w-full bg-[#050810] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group transition-all">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        onPlaying={handlePlaying}
        onLoadedMetadata={handlePlaying}
        className={`w-full h-full transition-all duration-700 ${isScreenSharing ? 'object-contain' : 'object-cover'} ${(!isPlaying || isVideoOff) && !isScreenSharing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      />

      {showLoader && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0f1d]/60 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-[3px] border-blue-500/20 rounded-full"></div>
              <div className="absolute top-0 w-12 h-12 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] animate-pulse">Synchronizing Feed</p>
          </div>
        </div>
      )}

      {(isVideoOff || !stream) && !isScreenSharing && (
        <div className="absolute inset-0 z-10 bg-[#050810] flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-900/50 rounded-[2rem] flex items-center justify-center text-slate-700 border border-white/5">
                <i className={`fas ${!stream ? 'fa-circle-notch fa-spin' : 'fa-video-slash'} text-2xl`}></i>
            </div>
            <p className="mt-4 text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">
              {stream ? 'Camera Off' : 'Connecting Peer'}
            </p>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-20">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <i className={`fas ${isMuted ? 'fa-microphone-slash text-red-500' : 'fa-microphone text-green-500'} text-[10px]`}></i>
            {!isMuted && isPlaying && !isLocal && (
              <div className="flex gap-0.5 items-end h-2.5">
                <div className="w-0.5 bg-green-500/50 animate-[vbar_0.5s_infinite_ease-in-out]"></div>
                <div className="w-0.5 bg-green-500/70 animate-[vbar_0.8s_infinite_ease-in-out_0.2s]"></div>
                <div className="w-0.5 bg-green-500/50 animate-[vbar_0.6s_infinite_ease-in-out_0.1s]"></div>
              </div>
            )}
          </div>
          <span className="text-white text-[9px] font-black uppercase tracking-widest truncate max-w-[120px]">{label}</span>
        </div>
      </div>

      <style>{`
        @keyframes vbar {
          0%, 100% { height: 3px; }
          50% { height: 10px; }
        }
      `}</style>
    </div>
  );
};

export default VideoTile;
