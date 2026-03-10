import React, { useState, useEffect } from 'react';
import { Moon, Sun, Clock, Baby, Utensils, RotateCcw, CheckCircle2, Check, Edit2, X, LogIn, LogOut } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Initialization ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  }
  
  const getEnv = (key) => {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
      if (typeof process !== 'undefined' && process.env) return process.env[key];
    } catch (e) {
      return undefined;
    }
  };

  const projectId = getEnv('VITE_FIREBASE_PROJECT_ID');

  return {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: projectId,
    storageBucket: projectId ? `${projectId}.appspot.com` : undefined,
    messagingSenderId: getEnv('VITE_FIREBASE_MSG_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
  };
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'xander-tracker';

export default function App() {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [imageError, setImageError] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sleepStart, setSleepStart] = useState(null);
  const [lastFeed, setLastFeed] = useState(null);
  const [isAsleep, setIsAsleep] = useState(false);

  const [editingSleep, setEditingSleep] = useState(false);
  const [tempSleepTime, setTempSleepTime] = useState('');
  const [editingFeed, setEditingFeed] = useState(false);
  const [tempFeedTime, setTempFeedTime] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // --- Authentication & Live Sync ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init failed", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'planner', 'shared_state');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSleepStart(data.sleepStart ? new Date(data.sleepStart) : null);
        setLastFeed(data.lastFeed ? new Date(data.lastFeed) : null);
        setIsAsleep(data.isAsleep || false);
      }
    }, (error) => {
      console.error("Error syncing data: ", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Helper functions ---
  const updateRemoteState = async (updates) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'planner', 'shared_state');
      await setDoc(docRef, updates, { merge: true });
    } catch (err) {
      console.error("Failed to save to cloud", err);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google login failed:", error);
      setAuthError("Google Login is restricted in this preview, but will work on your hosted app!");
    }
  };

  const logout = () => signOut(auth);

  const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
  const getDiffInMinutes = (start, end) => Math.floor((end.getTime() - start.getTime()) / 60000);
  
  const formatTime = (date) => {
    if (!date) return '--:--';
    // Force 12-hour AM/PM format regardless of user's system locale settings
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDuration = (minutes) => {
    if (minutes < 0) return '0 minutes';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const mStr = m === 1 ? ' minute' : ' minutes';
    return h > 0 ? `${h}h ${m}${mStr}` : `${m}${mStr}`;
  };

  const dateToInputTime = (date) => {
    if (!date) return '';
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const updateDateFromTime = (timeStr) => {
    if (!timeStr) return new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const newDate = new Date();
    newDate.setHours(hours, minutes, 0, 0);
    
    // If the constructed time is more than 5 minutes in the future,
    // the user definitely meant that time yesterday (fixes midnight crossover bug)
    const diffMs = newDate.getTime() - now.getTime();
    if (diffMs > 5 * 60000) {
      newDate.setDate(newDate.getDate() - 1);
    }
    
    return newDate;
  };

  // --- Handlers ---
  const toggleSleepState = () => {
    const newIsAsleep = !isAsleep;
    const newSleepStart = newIsAsleep ? new Date() : sleepStart;
    
    setIsAsleep(newIsAsleep);
    if (newIsAsleep) setSleepStart(newSleepStart);
    
    updateRemoteState({
      isAsleep: newIsAsleep,
      sleepStart: newSleepStart ? newSleepStart.getTime() : null
    });
  };

  const recordFeed = () => {
    const newLastFeed = new Date();
    setLastFeed(newLastFeed);
    updateRemoteState({ lastFeed: newLastFeed.getTime() });
  };

  const executeReset = () => {
    setSleepStart(null);
    setLastFeed(null);
    setIsAsleep(false);
    setConfirmReset(false);
    updateRemoteState({ sleepStart: null, lastFeed: null, isAsleep: false });
  };

  const handleEditSleep = () => {
    const newDate = updateDateFromTime(tempSleepTime);
    setSleepStart(newDate);
    setEditingSleep(false);
    updateRemoteState({ sleepStart: newDate.getTime() });
  };

  const handleEditFeed = () => {
    const newDate = updateDateFromTime(tempFeedTime);
    setLastFeed(newDate);
    setEditingFeed(false);
    updateRemoteState({ lastFeed: newDate.getTime() });
  };

  // --- Calculations ---
  const calculateSleepData = () => {
    if (!sleepStart) return null;

    const timeAsleep = getDiffInMinutes(sleepStart, currentTime);
    
    const cycles = [];
    // Increased from 6 to 48 cycles (36 hours worth) so it never runs out of upcoming milestones
    for (let i = 1; i <= 48; i++) {
      cycles.push({
        block: i,
        duration: i * 45,
        time: addMinutes(sleepStart, i * 45),
        isPast: timeAsleep >= i * 45
      });
    }

    const nextCycle = cycles.find(c => !c.isPast);
    return { timeAsleep, cycles, nextCycle };
  };

  const calculateFeedData = () => {
    if (!lastFeed) return null;

    const timeSinceFeed = getDiffInMinutes(lastFeed, currentTime);
    const twoHourTarget = addMinutes(lastFeed, 120);
    const threeHourTarget = addMinutes(lastFeed, 180);

    return { 
      timeSinceFeed, 
      twoHourTarget, 
      threeHourTarget,
      isOverdue2h: timeSinceFeed >= 120,
      isOverdue3h: timeSinceFeed >= 180
    };
  };

  const getRecommendations = (sleepData, feedData) => {
    if (!sleepData || !feedData || !isAsleep) return null;

    const getOptimalCycle = (targetTime) => {
      let optimal = sleepData.cycles[0];
      for (const cycle of sleepData.cycles) {
        if (cycle.time <= targetTime || getDiffInMinutes(cycle.time, targetTime) > -15) {
          optimal = cycle;
        } else {
          break; 
        }
      }
      return optimal;
    };

    return { 
      opt2h: getOptimalCycle(feedData.twoHourTarget), 
      opt3h: getOptimalCycle(feedData.threeHourTarget) 
    };
  };

  const sleepData = calculateSleepData();
  const feedData = calculateFeedData();
  const recommendations = getRecommendations(sleepData, feedData);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Header & Auth */}
        <div className="flex justify-between items-start">
          <div className="flex-1 text-center space-y-2">
            <div className="flex justify-center mb-2">
              {!imageError ? (
                <img 
                  src="A7R00029-2_1500px.jpg" 
                  alt="Xander" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-400 shadow-lg shadow-indigo-900/50"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Baby className="w-12 h-12 text-indigo-400" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Xander's Planner</h1>
            <p className="text-slate-400 text-sm">Optimise wake windows based on 45-minute cycles</p>
          </div>
        </div>

        {/* Google Auth Controls */}
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 flex flex-col items-center justify-center">
          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=random`} alt="Avatar" className="w-6 h-6 rounded-full" />
              <span>Synced as {user.displayName || user.email}</span>
              <button onClick={logout} className="p-1 text-slate-500 hover:text-red-400"><LogOut className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button onClick={loginWithGoogle} className="flex items-center gap-2 text-sm bg-white text-slate-900 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sync with Google
              </button>
              {authError && <span className="text-xs text-amber-400 text-center px-2">{authError}</span>}
              {!authError && <span className="text-xs text-green-400">Live sync active (Guest Mode)</span>}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={toggleSleepState}
            className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
              isAsleep 
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/50' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/50'
            }`}
          >
            {isAsleep ? <Sun className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
            <span className="font-semibold">{isAsleep ? 'Wake Up' : 'Go to Sleep'}</span>
          </button>
          
          <button
            onClick={recordFeed}
            className="p-4 rounded-2xl bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-900/50 flex flex-col items-center justify-center gap-2 transition-all"
          >
            <Utensils className="w-8 h-8" />
            <span className="font-semibold">Start Feed</span>
          </button>
        </div>

        {/* Status Dashboard */}
        <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700 shadow-xl space-y-5">
          <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="font-medium">Current Status</span>
            </div>
            <span className="text-sm font-medium text-slate-400">{formatTime(currentTime)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Sleep Status */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sleep</span>
              {isAsleep ? (
                <div>
                  <div className="text-2xl font-bold text-indigo-400">{formatDuration(sleepData?.timeAsleep || 0)}</div>
                  {editingSleep ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="time" 
                        autoFocus
                        value={tempSleepTime} 
                        onChange={(e) => setTempSleepTime(e.target.value)}
                        className="bg-slate-700 text-white px-2 py-1.5 rounded-md text-sm border border-slate-600 outline-none focus:border-indigo-500 w-[140px]"
                      />
                      <button onClick={handleEditSleep} className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-md text-green-400 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingSleep(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <span>Since {formatTime(sleepStart)}</span>
                      <button onClick={() => { setTempSleepTime(dateToInputTime(sleepStart)); setEditingSleep(true); }} className="p-1 hover:text-white transition-colors"><Edit2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-lg font-medium text-slate-300">Awake</div>
                  {sleepStart && <div className="text-xs text-slate-500 mt-1">Last slept at {formatTime(sleepStart)}</div>}
                </div>
              )}
            </div>

            {/* Feed Status */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Last Feed Started</span>
              {feedData ? (
                <div>
                  <div className={`text-2xl font-bold ${feedData.isOverdue3h ? 'text-red-400' : 'text-teal-400'}`}>
                    {formatDuration(feedData.timeSinceFeed)} ago
                  </div>
                  {editingFeed ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="time" 
                        autoFocus
                        value={tempFeedTime} 
                        onChange={(e) => setTempFeedTime(e.target.value)}
                        className="bg-slate-700 text-white px-2 py-1.5 rounded-md text-sm border border-slate-600 outline-none focus:border-teal-500 w-[140px]"
                      />
                      <button onClick={handleEditFeed} className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-md text-green-400 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingFeed(false)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <span>Started at {formatTime(lastFeed)}</span>
                      <button onClick={() => { setTempFeedTime(dateToInputTime(lastFeed)); setEditingFeed(true); }} className="p-1 hover:text-white transition-colors"><Edit2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-1">No feed recorded</div>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations / Next Actions */}
        {(isAsleep || feedData) && (
          <div className="bg-slate-800/50 rounded-3xl p-5 border border-slate-700/50 space-y-6">
            
            {/* Optimal Wake Times */}
            {isAsleep && feedData && recommendations && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Optimal Wake Windows
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className={`p-4 rounded-xl border ${recommendations.opt2h.isPast ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-indigo-900/30 border-indigo-500/30'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-indigo-300">For 2-Hour Feed</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Wake after {recommendations.opt2h.duration}-minute cycle
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{formatTime(recommendations.opt2h.time)}</div>
                        <div className="text-xs text-slate-400 mt-1">Feed due: {formatTime(feedData.twoHourTarget)}</div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${recommendations.opt3h.isPast ? 'bg-slate-800 border-slate-700 opacity-60' : 'bg-purple-900/30 border-purple-500/30'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-purple-300">For 3-Hour Feed</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Wake after {recommendations.opt3h.duration}-minute cycle
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{formatTime(recommendations.opt3h.time)}</div>
                        <div className="text-xs text-slate-400 mt-1">Feed due: {formatTime(feedData.threeHourTarget)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Sleep Cycles */}
            {isAsleep && sleepData && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Upcoming 45-minute Cycle Ends
                </h3>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {sleepData.cycles.filter(c => !c.isPast).slice(0, 3).map((cycle) => (
                    <div key={cycle.block} className="flex-shrink-0 bg-slate-800 rounded-lg p-3 border border-slate-700 min-w-[100px]">
                      <div className="text-xs text-slate-400 mb-1">{cycle.duration} {cycle.duration === 1 ? 'minute' : 'minutes'}</div>
                      <div className="text-lg font-semibold text-white">{formatTime(cycle.time)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Feeds */}
            {(!isAsleep && feedData) && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-teal-400" />
                  Next Feed Due
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border ${feedData.isOverdue2h ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="text-xs text-slate-400 mb-1">2 Hour Mark</div>
                    <div className={`text-lg font-semibold ${feedData.isOverdue2h ? 'text-red-400' : 'text-white'}`}>
                      {formatTime(feedData.twoHourTarget)}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${feedData.isOverdue3h ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="text-xs text-slate-400 mb-1">3 Hour Mark</div>
                    <div className={`text-lg font-semibold ${feedData.isOverdue3h ? 'text-red-400' : 'text-white'}`}>
                      {formatTime(feedData.threeHourTarget)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reset Data */}
        {(sleepStart || lastFeed) && (
          <div className="flex justify-center pt-8">
            {confirmReset ? (
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-4 shadow-lg">
                <span className="text-sm text-slate-300 font-medium">Clear all times?</span>
                <button onClick={executeReset} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/30 transition-colors">Yes, clear</button>
                <button onClick={() => setConfirmReset(false)} className="px-3 py-1 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors text-sm px-4 py-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Tracker
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}