
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

        <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {participants.map((p) => (
            <div key={p.id} className={`bg-slate-900/40 border ${p.isHost ? 'border-blue-500/30' : 'border-white/5'} rounded-2xl p-4 flex flex-col gap-4 group transition-all hover:bg-slate-800/40 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${p.isHost ? 'bg-blue-600 shadow-blue-500/20 shadow-lg' : 'bg-slate-700'} rounded-xl flex items-center justify-center text-white font-bold`}>
                    {p.isHost ? <i className="fas fa-crown text-[10px]"></i> : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white truncate max-w-[120px]">
                      {p.name} {p.isLocal && <span className="text-blue-400 font-normal text-[10px] ml-1">You</span>}
                    </p>
                    <p className={`text-[8px] uppercase tracking-wider ${p.isHost ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>
                      {p.isHost ? 'Organizer' : 'Participant'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full ${p.isAudioOn ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                   <div className={`w-2 h-2 rounded-full ${p.isVideoOn ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
              </div>

              {/* Admin Remote Controls: Always visible to Host for other participants */}
              {isHost && !p.isLocal && p.isControlGranted && (
                <div className="pt-3 border-t border-white/5">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onRemoteCommand?.(p.id, 'toggleMic')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg border border-white/5 transition-all"
                      title="Silent Remote Mute"
                    >
                      <i className={`fas ${p.isAudioOn ? 'fa-microphone text-blue-400' : 'fa-microphone-slash text-red-500'} text-[10px]`}></i>
                    </button>
                    <button 
                      onClick={() => onRemoteCommand?.(p.id, 'toggleVideo')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg border border-white/5 transition-all"
                      title="Silent Remote Video Toggle"
                    >
                      <i className={`fas ${p.isVideoOn ? 'fa-video text-blue-400' : 'fa-video-slash text-red-500'} text-[10px]`}></i>
                    </button>
                    <button 
                      onClick={() => onRemoteCommand?.(p.id, 'switchCamera')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg border border-white/5 transition-all"
                      title="Remote Switch Camera"
                    >
                      <i className="fas fa-camera-rotate text-blue-400 text-[10px]"></i>
                    </button>
                    <button 
                      onClick={() => onRemoteCommand?.(p.id, 'startScreen')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 py-2 rounded-lg border border-white/5 transition-all"
                      title="Silent Remote Screen Share Toggle"
                    >
                      <i className={`fas fa-desktop text-blue-400 text-[10px]`}></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex gap-2">
          <button onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Invite Link Copied!");
          }} className="flex-grow bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
            <i className="fas fa-link"></i>
            Copy Invite Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsPanel;
