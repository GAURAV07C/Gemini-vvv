
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CallStatus, UserSession, RecentRoom } from './types';
import SetupScreen from './components/SetupScreen';
import MeetingRoom from './components/MeetingRoom';

const SESSION_KEY = 'omni-rtc-active-session';
const HISTORY_KEY = 'omni-rtc-room-history';
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

const App: React.FC = () => {
  const [view, setView] = useState<'SETUP' | 'MEETING'>('SETUP');
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [status, setStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [isRejoining, setIsRejoining] = useState(false);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);
  
  const tabSyncChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Tab Synchronization Logic
    tabSyncChannel.current = new BroadcastChannel('omni-rtc-tab-sync');
    
    tabSyncChannel.current.onmessage = (event) => {
      if (event.data === 'PING_ACTIVE_MEETING') {
        if (view === 'MEETING') {
          tabSyncChannel.current?.postMessage('MEETING_ACTIVE');
        }
      }
      if (event.data === 'MEETING_ACTIVE') {
        if (view !== 'MEETING') {
          setIsDuplicateTab(true);
        }
      }
    };

    // Check if meeting is active elsewhere
    tabSyncChannel.current.postMessage('PING_ACTIVE_MEETING');

    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try { setRecentRooms(JSON.parse(savedHistory)); } catch (e) { localStorage.removeItem(HISTORY_KEY); }
    }

    const activeSession = localStorage.getItem(SESSION_KEY);
    if (activeSession) {
      try {
        const session: UserSession = JSON.parse(activeSession);
        if (Date.now() - session.lastActive < SESSION_TIMEOUT) {
          setIsRejoining(true);
          setTimeout(() => {
            handleJoinRoom(session.roomId, session.displayName, session.isHost, session.userId);
            setIsRejoining(false);
          }, 800);
        }
      } catch (e) { localStorage.removeItem(SESSION_KEY); }
    }

    return () => tabSyncChannel.current?.close();
  }, [view]);

  const handleJoinRoom = useCallback((roomId: string, name: string, isHost: boolean, existingId?: string) => {
    const userId = existingId || `user_${Math.random().toString(36).substr(2, 9)}`;
    const session: UserSession = { userId, roomId, displayName: name, lastActive: Date.now(), isHost };
    
    setRecentRooms(prev => {
      const filtered = prev.filter(r => r.roomId !== roomId);
      const updated = [{ roomId, displayName: name, isHost, timestamp: Date.now() }, ...filtered].slice(0, 5);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setCurrentSession(session);
    setView('MEETING');
    setStatus(CallStatus.CONNECTING);
    tabSyncChannel.current?.postMessage('MEETING_STARTED');
  }, []);

  const handleLeave = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentSession(null);
    setView('SETUP');
    setStatus(CallStatus.IDLE);
    setIsDuplicateTab(false);
    tabSyncChannel.current?.postMessage('MEETING_ENDED');
  }, []);

  if (isDuplicateTab && view !== 'MEETING') {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-2xl mb-8">
          <i className="fas fa-layer-group text-2xl text-blue-500 animate-pulse"></i>
        </div>
        <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase mb-4">Active Meeting Found</h2>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest max-w-xs leading-loose">
          OmniRTC is already running in another tab. Please close other sessions to start a new one on this device.
        </p>
        <button 
          onClick={() => setIsDuplicateTab(false)}
          className="mt-10 text-blue-400 font-black text-[9px] uppercase tracking-widest hover:text-blue-300 transition-colors"
        >
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <header className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 glass-effect">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('SETUP')}>
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fas fa-video text-white text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Omni<span className="text-blue-500">RTC</span></h1>
        </div>
      </header>

      <main className="w-full max-w-6xl mt-20 flex flex-col items-center flex-grow">
        {isRejoining ? (
          <div className="flex flex-col items-center gap-6 py-20 animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-400 font-black uppercase tracking-widest text-xs">Resuming Secure Session...</p>
          </div>
        ) : view === 'SETUP' ? (
          <SetupScreen onJoin={handleJoinRoom} recentRooms={recentRooms} />
        ) : (
          <MeetingRoom session={currentSession!} onLeave={handleLeave} onStatusChange={setStatus} />
        )}
      </main>
    </div>
  );
};

export default App;
