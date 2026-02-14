
import React, { useState } from 'react';
import { RecentRoom } from '../types';

interface SetupScreenProps {
  onJoin: (roomId: string, name: string, isHost: boolean) => void;
  recentRooms: RecentRoom[];
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onJoin, recentRooms }) => {
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && (isCreating || roomId.trim())) {
      const finalRoomId = isCreating 
        ? Math.random().toString(36).substr(2, 6).toUpperCase() 
        : roomId.trim().toUpperCase();
      onJoin(finalRoomId, name.trim(), isCreating);
    }
  };

  const handleRejoin = (room: RecentRoom) => {
    onJoin(room.roomId.toUpperCase(), room.displayName, room.isHost);
  };

  return (
    <div className="w-full max-w-lg flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      <div className="glass-effect p-8 rounded-[2.5rem] shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] rounded-full pointer-events-none"></div>
        
        <div className="mb-10 text-center">
           <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none mb-2">Secure Connection</h2>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
             Enterprise-grade P2P video communication.
           </p>
        </div>

        <div className="flex gap-1 bg-slate-900/50 p-1.5 rounded-2xl mb-8 border border-white/5">
          <button 
            onClick={() => setIsCreating(true)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${isCreating ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white'}`}
          >
            Create Room
          </button>
          <button 
            onClick={() => setIsCreating(false)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${!isCreating ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white'}`}
          >
            Join Existing
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 ml-1">Identity</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-700 text-sm font-bold"
              placeholder="Enter your display name"
            />
          </div>
          
          {!isCreating && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 ml-1">Room Access Code</label>
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-700 font-mono text-sm font-bold"
                placeholder="XXXXXX"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-4 rounded-2xl transition-all shadow-xl hover:shadow-blue-500/30 active:scale-95 text-xs uppercase tracking-widest mt-4"
          >
            {isCreating ? 'Launch Session' : 'Establish Link'}
          </button>
        </form>
      </div>

      {recentRooms.length > 0 && (
        <div className="glass-effect p-6 rounded-[2rem] border border-white/5">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-500/70 mb-4 px-1">Quick Resume</h3>
          <div className="space-y-2">
            {recentRooms.map((room, idx) => (
              <button
                key={`${room.roomId}-${idx}`}
                onClick={() => handleRejoin(room)}
                className="w-full bg-slate-800/20 hover:bg-slate-800/60 border border-white/5 hover:border-blue-500/30 p-4 rounded-2xl flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs ${room.isHost ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-700/20 text-gray-500'}`}>
                    <i className={`fas ${room.isHost ? 'fa-crown' : 'fa-user'}`}></i>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-gray-200 group-hover:text-white transition-colors">
                      <span className="font-mono text-blue-400 tracking-wider uppercase">{room.roomId}</span>
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Connected as {room.displayName}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center group-hover:border-blue-500/30 transition-all">
                  <i className="fas fa-arrow-right text-[10px] text-gray-700 group-hover:text-blue-500 transition-all"></i>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupScreen;
