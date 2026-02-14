
import React from 'react';
import { Participant } from '../types';

interface ParticipantsPanelProps {
  isOpen: boolean;
  participants: Participant[];
  onClose: () => void;
  isHost: boolean;
  onRemoteCommand?: (id: string, action: 'toggleMic' | 'toggleVideo' | 'startScreen' | 'switchCamera') => void;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ 
  isOpen, participants, onClose, isHost, onRemoteCommand 
}) => {
  return (
    <div className={`fixed right-0 top-20 bottom-0 w-full md:w-96 glass-effect border-l border-white/10 z-40 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <i className="fas fa-users text-blue-500"></i>
            Participants
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {participants.map((p) => (
            <div key={p.id} className={`bg-slate-900/40 border ${p.isHost ? 'border-blue-500/30' : 'border-white/5'} rounded-[1.5rem] p-4 flex flex-col gap-3 group transition-all hover:bg-slate-800/40 shadow-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 ${p.isHost ? 'bg-blue-600 shadow-blue-500/20 shadow-lg' : 'bg-slate-700/50'} rounded-2xl flex items-center justify-center text-white font-bold border border-white/5`}>
                    {p.isHost ? <i className="fas fa-crown text-[12px]"></i> : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate max-w-[100px]">
                        {p.name}
                        </p>
                        {!p.isVideoOn && (
                            <span className="text-[7px] font-black text-red-400 uppercase bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20 animate-pulse">
                                Video Off
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className={`text-[8px] uppercase tracking-wider font-black ${p.isHost ? 'text-blue-400' : 'text-gray-500'}`}>
                         {p.isHost ? 'Organizer' : 'Attendee'}
                       </span>
                       {p.isLocal && <span className="text-blue-400 font-normal text-[9px] bg-blue-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">You</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                   <div className="flex flex-col items-center gap-1" title={p.isAudioOn ? "Mic On" : "Muted"}>
                      <i className={`fas ${p.isAudioOn ? 'fa-microphone text-green-500' : 'fa-microphone-slash text-red-500'} text-[9px]`}></i>
                      <div className={`w-1 h-1 rounded-full ${p.isAudioOn ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                   </div>
                   <div className="w-[1px] h-4 bg-white/10"></div>
                   <div className="flex flex-col items-center gap-1" title={p.isVideoOn ? "Video On" : "Video Off"}>
                      <i className={`fas ${p.isVideoOn ? 'fa-video text-blue-400' : 'fa-video-slash text-red-500'} text-[9px]`}></i>
                      <div className={`w-1 h-1 rounded-full ${p.isVideoOn ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                   </div>
                </div>
              </div>

              {/* Host Controls Section - Only visible to host for other participants */}
              {isHost && !p.isLocal && (
                <div className="flex items-center gap-2 mt-1 pt-3 border-t border-white/5">
                  <button 
                    onClick={() => onRemoteCommand?.(p.id, 'toggleMic')}
                    className={`flex-1 h-10 rounded-xl border transition-all flex items-center justify-center gap-2 ${p.isAudioOn ? 'bg-slate-800 border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400' : 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20'}`}
                    title={p.isAudioOn ? "Mute Participant" : "Unmute Participant"}
                  >
                    <i className={`fas ${p.isAudioOn ? 'fa-microphone' : 'fa-microphone-slash'} text-[10px]`}></i>
                    <span className="text-[8px] font-black uppercase tracking-widest">{p.isAudioOn ? 'Mute' : 'Unmute'}</span>
                  </button>
                  <button 
                    onClick={() => onRemoteCommand?.(p.id, 'toggleVideo')}
                    className={`flex-1 h-10 rounded-xl border transition-all flex items-center justify-center gap-2 ${p.isVideoOn ? 'bg-slate-800 border-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-400' : 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20'}`}
                    title={p.isVideoOn ? "Turn Camera Off" : "Turn Camera On"}
                  >
                    <i className={`fas ${p.isVideoOn ? 'fa-video' : 'fa-video-slash'} text-[10px]`}></i>
                    <span className="text-[8px] font-black uppercase tracking-widest">{p.isVideoOn ? 'Stop' : 'Start'}</span>
                  </button>
                  <button 
                    onClick={() => onRemoteCommand?.(p.id, 'switchCamera')}
                    className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-all flex items-center justify-center"
                    title="Remote Switch Camera"
                  >
                    <i className="fas fa-camera-rotate text-blue-400 text-[10px]"></i>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <button onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            const btn = document.getElementById('invite-btn');
            if (btn) btn.innerText = "LINK COPIED!";
            setTimeout(() => { if (btn) btn.innerText = "COPY ROOM INVITE"; }, 2000);
          }} id="invite-btn" className="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white font-bold py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3">
            <i className="fas fa-link"></i>
            Copy Room Invite
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsPanel;
