
import React from 'react';

interface ControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  showParticipants: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
  roomId: string;
  participantCount: number;
  screenShareSupported?: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  isMuted, isVideoOff, isScreenSharing, isHandRaised, showParticipants, 
  onToggleMute, onToggleVideo, onToggleScreenShare, onToggleHandRaise, onToggleParticipants, 
  onLeave, roomId, participantCount, screenShareSupported = true
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 bg-slate-900/90 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4 rounded-3xl border border-white/10 shadow-2xl">
      <div className="hidden lg:flex flex-col mr-4 pr-4 border-r border-white/10">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Room Code</span>
        <span className="text-blue-400 font-mono font-bold">{roomId}</span>
      </div>

      {/* Enhanced Mute Toggle */}
      <button 
        onClick={onToggleMute}
        className={`group w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 border ${
          isMuted 
          ? 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
          : 'bg-slate-800 border-white/5 hover:bg-slate-700 hover:border-white/10'
        }`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        <i className={`fas ${isMuted ? 'fa-microphone-slash text-red-500' : 'fa-microphone text-white'} text-lg transition-colors duration-300`}></i>
      </button>

      {/* Enhanced Video Toggle */}
      <button 
        onClick={onToggleVideo}
        className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 border ${
          isVideoOff 
          ? 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
          : 'bg-slate-800 border-white/5 hover:bg-slate-700 hover:border-white/10'
        }`}
        title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
      >
        <i className={`fas ${isVideoOff ? 'fa-video-slash text-red-500' : 'fa-video text-white'} text-lg`}></i>
      </button>

      <div className="relative">
        <button 
          onClick={onToggleScreenShare}
          disabled={!screenShareSupported}
          className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-800 hover:bg-slate-700'} ${!screenShareSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={screenShareSupported ? "Share Screen" : "Screen Sharing Unavailable"}
        >
          <i className={`fas fa-desktop text-white text-lg`}></i>
          {!screenShareSupported && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full border border-slate-900">
              <i className="fas fa-slash"></i>
            </span>
          )}
        </button>
      </div>

      <button 
        onClick={onToggleHandRaise}
        className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${isHandRaised ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-slate-800 hover:bg-slate-700'}`}
        title={isHandRaised ? "Lower Hand" : "Raise Hand"}
      >
        <i className={`fas fa-hand-paper text-white text-lg ${isHandRaised ? 'animate-bounce-short' : ''}`}></i>
      </button>

      <button 
        onClick={onToggleParticipants}
        className={`relative w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${showParticipants ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'}`}
        title="Participants"
      >
        <i className={`fas fa-users text-white text-lg`}></i>
        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900 font-bold">
          {participantCount}
        </span>
      </button>

      <button 
        onClick={() => {
            navigator.clipboard.writeText(roomId);
        }}
        className="hidden sm:flex w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition-all"
        title="Copy Link"
      >
        <i className="fas fa-link text-white text-lg"></i>
      </button>

      <button 
        onClick={onLeave}
        className="bg-red-600 hover:bg-red-700 text-white px-5 md:px-7 py-2 md:py-3 rounded-2xl font-bold transition-all shadow-lg hover:shadow-red-500/20 md:ml-2 text-sm md:text-base active:scale-95"
      >
        Leave
      </button>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-short {
          animation: bounce-short 1s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Controls;
