import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart
} from 'recharts';
import { 
  Tv, 
  Wifi, 
  WifiOff, 
  Loader2, 
  Play,
  AlertCircle,
  ArrowLeft,
  Monitor,
  Maximize,
  Minimize,
  TrendingUp,
  Target,
  DollarSign,
  BarChart3,
  Newspaper,
  ExternalLink,
  Calendar,
  CloudSun,
  Wind,
  Droplets,
  Thermometer,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  CloudFog,
  Globe,
  Trophy
} from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { deriveBrazil, deriveToday, deriveBracket, wcResultLetter, flagUrl, fetchWcPendingUpdates, matchupKey, knockoutOrder, isLiveByClock, brasiliaTodayISO, fmtBrDate, WC_LIVE_REFRESH_MS, WCMatch } from '../lib/worldcup';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  limit
} from 'firebase/firestore';

interface Media {
  id: string;
  title: string;
  type: 'IMAGE_HERO' | 'VIDEO_FILE' | 'YOUTUBE' | 'DASHBOARD' | 'INSTAGRAM' | 'MONTHLY_GOAL' | 'CAROUSEL' | 'NEWS_CLIPPING' | 'NORTH_STAR' | 'WEATHER' | 'WEBSITE_EMBED' | 'FINAL_SPRINT' | 'SMART_SALES' | 'WC_BRAZIL' | 'WC_TODAY' | 'WC_BRACKET' | 'WC_RANKING';
  payload: any;
}

interface Sale {
  id: string;
  squad?: string;
  status?: string;
  pi?: string;
  investimento?: string;
  investimentoValor?: number;
  periodo?: string;
  sdr?: string;
  executivo?: string;
  cs?: string;
  soldAt?: number;
}

interface PlaylistItem {
  id?: string;
  media_id: string;
  duration: number;
}

interface Playlist {
  id: string;
  name: string;
  logoUrl?: string;
  items: PlaylistItem[];
}

// Safe localStorage helper
const safeStorage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage access denied');
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  }
};

// Country flag: prefers a real flag image (from ISO code) since emoji flags
// often don't render on Samsung/Tizen TV browsers. Falls back to emoji, then 🏳️.
const TeamFlag = ({ code, emoji, imgClass, emojiClass, size }: { code?: string; emoji?: string; imgClass?: string; emojiClass?: string; size?: string }) => {
  const [err, setErr] = useState(false);
  const url = flagUrl(code, size);
  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        className={`inline-block object-cover rounded-[3px] shadow-sm ${imgClass || ''}`}
      />
    );
  }
  return <span className={emojiClass}>{emoji || '🏳️'}</span>;
};

// North Star: % variation vs. the previous saved value. prev==null means the
// metric was never updated before (no badge). prev==0 → % is undefined, so we
// show the absolute delta instead (e.g. "+5").
const NSDelta = React.memo(({ prev, cur, size = 'text-base' }: { prev?: number | null; cur: number; size?: string }) => {
  if (prev == null) return null;
  const p = Number(prev) || 0;
  let dir: 1 | -1 | 0;
  let label: string;
  if (p === 0) {
    dir = cur > 0 ? 1 : 0;
    label = cur > 0 ? `+${cur}` : '0%';
  } else {
    const pct = Math.round(((cur - p) / p) * 100);
    dir = pct > 0 ? 1 : pct < 0 ? -1 : 0;
    label = `${pct > 0 ? '+' : ''}${pct}%`;
  }
  const cls = dir > 0
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : dir < 0
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/20'
      : 'bg-white/5 text-zinc-500 border-white/10';
  const arrow = dir > 0 ? '▲' : dir < 0 ? '▼' : '•';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-black ${size} ${cls}`}>
      <span className="text-[0.7em]">{arrow}</span>{label}
    </span>
  );
});

// Helper Components for Animations
const Counter = React.memo(({ value, className }: { value: number, className?: string }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, { duration: 2, ease: "easeOut" });
    return controls.stop;
  }, [value]);

  return <motion.span className={className}>{rounded}</motion.span>;
});

const Celebration = React.memo(() => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {/* Llama Rocket - Simplified */}
      <motion.div
        initial={{ bottom: -200, left: '-10%', rotate: 45 }}
        animate={{ 
          bottom: ['-20%', '120%'],
          left: ['-10%', '110%']
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 2
        }}
        className="absolute"
        style={{ willChange: 'transform' }}
      >
        <div className="relative flex flex-col items-center">
          <span className="text-9xl filter drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]">🦙</span>
          <span className="text-8xl -mt-12 rotate-45">🚀</span>
        </div>
      </motion.div>

      {/* Confetti / Jumping Elements - Reduced count */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            top: '110%', 
            left: `${Math.random() * 100}%`,
            scale: Math.random() * 0.5 + 0.5,
            rotate: 0,
            opacity: 1
          }}
          animate={{ 
            top: '-10%',
            left: `${(Math.random() - 0.5) * 20 + (i * 10)}%`,
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            opacity: [1, 1, 0]
          }}
          transition={{ 
            duration: Math.random() * 4 + 3,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "easeOut"
          }}
          className={`absolute w-3 h-3 rounded-sm ${
            ['bg-adsplay', 'bg-purple-500', 'bg-emerald-500', 'bg-yellow-400', 'bg-white'][i % 5]
          }`}
          style={{ willChange: 'transform' }}
        />
      ))}
    </div>
  );
});

const WeatherAnimation = React.memo(({ condition }: { condition: string }) => {
  const cond = condition.toLowerCase();
  const isRainy = cond.includes('chuva') || cond.includes('tempestade') || cond.includes('chuvisco') || cond.includes('rain') || cond.includes('raio') || cond.includes('thunderstorm');
  const isCloudy = cond.includes('nublado') || cond.includes('neblina') || cond.includes('parcialmente') || cond.includes('cloud');
  const isSunny = cond.includes('ensolarado') || cond.includes('limpo') || cond.includes('sol') || cond.includes('clear') || cond.includes('sunny');
  const isSnowy = cond.includes('neve') || cond.includes('snow');
  const isStormy = cond.includes('tempestade') || cond.includes('raio') || cond.includes('thunderstorm');

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Lightning Flash for Stormy Weather */}
      {isStormy && (
        <motion.div
          animate={{ opacity: [0, 0, 0.8, 0, 0.5, 0, 0] }}
          transition={{ duration: 7, repeat: Infinity, times: [0, 0.8, 0.82, 0.84, 0.86, 0.88, 1] }}
          className="absolute inset-0 bg-white/20 pointer-events-none z-10"
        />
      )}

      {/* Background Overlays for Atmosphere */}
      {isRainy && (
        <div className="absolute inset-0 bg-blue-950/40 transition-all duration-1000" />
      )}
      {isCloudy && (
        <div className="absolute inset-0 bg-zinc-900/60 transition-all duration-1000" />
      )}
      {isSunny && (
        <div className="absolute inset-0 bg-orange-500/5 transition-all duration-1000" />
      )}

      {/* Rain Animation - Further reduced for performance */}
      {isRainy && [...Array(30)].map((_, i) => (
        <motion.div
          key={`rain-${i}`}
          initial={{ top: -100, left: `${Math.random() * 100}%`, opacity: Math.random() * 0.4 + 0.1 }}
          animate={{ top: '120%' }}
          transition={{ 
            duration: Math.random() * 0.5 + 0.5, 
            repeat: Infinity, 
            delay: Math.random() * 2,
            ease: "linear"
          }}
          className="absolute w-[1px] h-10 bg-blue-300/20 rounded-full"
          style={{ transform: 'rotate(10deg)', willChange: 'transform' }}
        />
      ))}
      
      {/* Cloudy Animation - Reduced count */}
      {isCloudy && [...Array(6)].map((_, i) => (
        <motion.div
          key={`cloud-${i}`}
          initial={{ 
            left: '-30%', 
            top: `${Math.random() * 100}%`, 
            scale: Math.random() * 2 + 1,
            opacity: Math.random() * 0.2 + 0.05
          }}
          animate={{ left: '130%' }}
          transition={{ 
            duration: Math.random() * 60 + 60, 
            repeat: Infinity, 
            delay: Math.random() * 30,
            ease: "linear"
          }}
          className="absolute text-zinc-500"
          style={{ willChange: 'transform' }}
        >
          <Cloud size={250} fill="currentColor" className="blur-xl" />
        </motion.div>
      ))}

      {/* Sunny Animation */}
      {isSunny && (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            className="absolute -top-40 -right-40 text-yellow-400/10 blur-3xl"
          >
            <Sun size={1000} fill="currentColor" />
          </motion.div>
          <motion.div
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-yellow-500/5 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4"
          />
        </>
      )}

      {/* Snowy Animation - Reduced count */}
      {isSnowy && [...Array(20)].map((_, i) => (
        <motion.div
          key={`snow-${i}`}
          initial={{ top: -20, left: `${Math.random() * 100}%`, opacity: Math.random() * 0.4 + 0.1 }}
          animate={{ 
            top: '110%',
            left: `${(Math.random() - 0.5) * 15 + (i % 100)}%`,
            rotate: 360
          }}
          transition={{ 
            duration: Math.random() * 7 + 7, 
            repeat: Infinity, 
            delay: Math.random() * 7,
            ease: "linear"
          }}
          className="absolute text-white/30"
          style={{ willChange: 'transform' }}
        >
          <Snowflake size={Math.random() * 12 + 6} />
        </motion.div>
      ))}
    </div>
  );
});

const ProgressBar = React.memo(({ duration, currentIndex, onNext }: { duration: number, currentIndex: number, onNext: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onNext, duration);
    return () => clearTimeout(timer);
  }, [currentIndex, duration, onNext]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 z-[100]">
      <motion.div 
        key={currentIndex}
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]"
        style={{ willChange: 'width' }}
      />
    </div>
  );
});

// Media Specific Components
const MediaImageHero = React.memo(({ payload }: { payload: any }) => (
  <div className="w-full h-full relative overflow-hidden">
    <motion.img 
      src={payload.url} 
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
      alt=""
      style={{ willChange: 'transform' }}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
    <div className="absolute bottom-20 left-20 right-20 space-y-4">
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="space-y-2"
      >
        <h2 className="text-8xl font-black text-white tracking-tighter leading-none">
          {payload.title}
        </h2>
        <p className="text-5xl text-white/80 font-bold max-w-4xl leading-tight">
          {payload.subtitle}
        </p>
      </motion.div>
    </div>
  </div>
));

const MediaVideoFile = React.memo(({ payload }: { payload: any }) => (
  <div className="w-full h-full bg-black relative">
    <video 
      src={payload.url} 
      className="w-full h-full object-cover"
      autoPlay 
      muted 
      loop 
      playsInline
    />
    {(payload.title || payload.subtitle) && (
      <>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        <div className="absolute bottom-20 left-20 right-20 space-y-4">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-2"
          >
            {payload.title && (
              <h2 className="text-8xl font-black text-white tracking-tighter leading-none">
                {payload.title}
              </h2>
            )}
            {payload.subtitle && (
              <p className="text-5xl text-white/80 font-bold max-w-4xl leading-tight">
                {payload.subtitle}
              </p>
            )}
          </motion.div>
        </div>
      </>
    )}
  </div>
));

const MediaYouTube = React.memo(({ payload }: { payload: any }) => (
  <div className="w-full h-full bg-black">
    <iframe
      className="w-full h-full pointer-events-none"
      src={`https://www.youtube.com/embed/${payload.videoId}?autoplay=1&controls=0&mute=1&loop=1&playlist=${payload.videoId}`}
      allow="autoplay; encrypted-media"
    />
  </div>
));

const MediaDashboard = React.memo(({ payload }: { payload: any }) => (
  <iframe
    className="w-full h-full border-none"
    src={payload.url}
  />
));

const MediaInstagram = React.memo(({ payload }: { payload: any }) => (
  <div className="w-full h-full flex items-center justify-center bg-zinc-950">
    <div className="w-full max-w-[540px] h-full relative">
      <iframe
        className="w-full h-full border-none"
        src={`${payload.url.replace(/\/$/, '')}/embed`}
        allowTransparency
        allow="autoplay"
        loading="lazy"
      />
    </div>
  </div>
));

const MediaCarousel = React.memo(({ payload, carouselIndex }: { payload: any, carouselIndex: number }) => (
  <div className="w-full h-full relative bg-zinc-950 overflow-hidden">
    <AnimatePresence>
      {payload.images && payload.images.length > 0 && (
        <motion.img
          key={payload.images[carouselIndex]?.id || carouselIndex}
          src={payload.images[carouselIndex]?.url}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          alt=""
          style={{ willChange: 'opacity' }}
        />
      )}
    </AnimatePresence>
    
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
    
    <div className="absolute bottom-20 left-20 right-20 space-y-6">
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="space-y-4"
      >
        {payload.titleOnScreen && (
          <h2 className="text-8xl font-black text-white tracking-tighter leading-none">
            {payload.titleOnScreen}
          </h2>
        )}
        {payload.subtitle && (
          <p className="text-5xl text-white/80 font-bold max-w-4xl leading-tight">
            {payload.subtitle}
          </p>
        )}
      </motion.div>
      
      <div className="flex gap-2">
        {(payload.images || []).map((_: any, i: number) => (
          <div 
            key={i}
            className={`h-2 rounded-full transition-all duration-500 ${
              i === carouselIndex ? 'w-12 bg-white' : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  </div>
));

const MediaWebsiteEmbed = React.memo(({ payload, title }: { payload: any, title: string }) => (
  <div className="w-full h-full bg-[#050505] flex items-center justify-center p-24">
    <div className="w-full max-w-[80vw] space-y-12">
      <div className="flex justify-between items-end border-b border-white/10 pb-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
              <Globe size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-adsplay">Web View</span>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter leading-none">
            {title}<span className="text-adsplay">.</span>
          </h2>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-adsplay animate-pulse" />
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">
              Live Snapshot — {payload.url}
            </p>
          </div>
        </div>
      </div>

      <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-8 border-white/5 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] bg-zinc-900">
        {payload.screenshotUrl ? (
          <img 
            src={payload.screenshotUrl} 
            alt={title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-800">
            <Globe size={120} />
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5 rounded-[2rem]" />
      </div>
    </div>
  </div>
));

export function Player() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlDeviceId = searchParams.get('id');
  
  // No pairing: the player always plays the current playlist. An explicit
  // ?id=<deviceId> is optional and used only for monitoring (name + last_ping).
  const deviceId = urlDeviceId;
  const [deviceName, setDeviceName] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'ERROR'>('IDLE');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(() => safeStorage.get('adsplay_tv_prompt_dismissed') === 'true');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [globalWeather, setGlobalWeather] = useState<any>(null);
  const [showUI, setShowUI] = useState(true);
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide UI elements after inactivity
  useEffect(() => {
    const handleActivity = () => {
      setShowUI(true);
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
      uiTimerRef.current = setTimeout(() => setShowUI(false), 5000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity));
    
    handleActivity();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    };
  }, []);

  // Fetch global weather for the widget
  useEffect(() => {
    const q = query(collection(db, 'media'), where('type', '==', 'WEATHER'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Get the first weather media item for the global widget
        const firstWeather = snapshot.docs[0];
        setGlobalWeather(firstWeather.data().payload);
        
        // We only trigger updates when the specific media is actually being played
        // or via the global check below, but NOT on every snapshot change for all docs.
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) {
        setShowFullscreenPrompt(false);
        setPromptDismissed(true);
        safeStorage.set('adsplay_tv_prompt_dismissed', 'true');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Auto-show prompt after a delay if not in fullscreen
    const timer = setTimeout(() => {
      if (!document.fullscreenElement && !promptDismissed) {
        setShowFullscreenPrompt(true);
      }
    }, 10000); // 10 seconds delay to avoid flickering on load

    // Global click listener to try auto-fullscreen on any interaction
    const handleGlobalClick = async () => {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          // Ignore, expected if blocked
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('click', handleGlobalClick);
      clearTimeout(timer);
    };
  }, [promptDismissed]);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [wcMatches, setWcMatches] = useState<WCMatch[] | null>(null);
  const wcMatchesRef = useRef<WCMatch[] | null>(null);
  const wcUnsubRef = useRef<null | (() => void)>(null);
  const wcPrevScoresRef = useRef<Record<string, { h: number; a: number }>>({});
  const [wcGoal, setWcGoal] = useState<{ id: string; side: 'home' | 'away' } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const shouldUpdateNews = (lastUpdateMs?: number) => {
    if (!lastUpdateMs) return true;
    
    const now = new Date();
    // Monday 10am GMT-3 = 13:00 UTC
    const targetMonday = new Date(now);
    const day = targetMonday.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    targetMonday.setUTCDate(targetMonday.getUTCDate() + diff);
    targetMonday.setUTCHours(13, 0, 0, 0);
    
    if (now < targetMonday) {
      targetMonday.setUTCDate(targetMonday.getUTCDate() - 7);
    }
    
    return lastUpdateMs < targetMonday.getTime();
  };

  const fetchNews = async (media: Media) => {
    if (media.type !== 'NEWS_CLIPPING') return;
    
    // Only update if visible to save quota
    if (document.visibilityState !== 'visible') return;

    // Use manual news items if provided
    const manualNews = media.payload.newsItems || [];
    if (manualNews.length > 0) {
      setNewsItems(manualNews.filter((n: any) => n.title && n.source));
      return;
    }

    // Fallback to legacy manualNews if available
    const legacyManual = media.payload.manualNews || [];
    if (legacyManual.length > 0) {
      setNewsItems(legacyManual.filter((n: any) => n.title && n.source));
      return;
    }
    
    // Check if we already have valid news in the payload (cached AI news)
    const lastNews = media.payload.lastNews;
    const lastUpdate = media.payload.lastNewsUpdate;
    
    if (lastNews && lastNews.length > 0 && !shouldUpdateNews(lastUpdate)) {
      setNewsItems(lastNews);
      return;
    }

    if (isFetchingNews) return;
    setIsFetchingNews(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const keywords = media.payload.keywords || [];
      const website = media.payload.website || '';
      
      const prompt = `Encontre as 6 notícias mais recentes e relevantes sobre as seguintes palavras-chave: ${keywords.join(', ')}. 
      Considere também o site da empresa: ${website}. 
      Retorne as notícias em formato JSON com os campos: title, summary, source, date, url. 
      Seja objetivo e profissional.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        let items = Array.isArray(data) ? data : (data.news || data.articles || []);
        setNewsItems(items);
        
        // Persist to Firestore for other players and future use
        try {
          await updateDoc(doc(db, 'media', media.id), {
            'payload.lastNews': items,
            'payload.lastNewsUpdate': Date.now(),
            updatedAt: serverTimestamp()
          });
        } catch (updateErr) {
          console.error('Error updating news cache in Firestore:', updateErr);
        }
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      if (lastNews) setNewsItems(lastNews);
    } finally {
      setIsFetchingNews(false);
    }
  };

  const fetchWeather = async (media: Media) => {
    if (media.type !== 'WEATHER') return;
    
    // Only update if visible to save quota
    if (document.visibilityState !== 'visible') return;
    
    const lastUpdate = media.payload.lastWeatherUpdate;
    const cacheDuration = 4 * 60 * 60 * 1000; // 4 hours
    
    if (lastUpdate && (Date.now() - lastUpdate < cacheDuration)) {
      return;
    }

    if (isFetchingWeather) return;
    setIsFetchingWeather(true);
    
    // Add jitter (0-2 minutes) to prevent multiple devices updating at the same second
    const jitter = Math.floor(Math.random() * 120000);
    await new Promise(resolve => setTimeout(resolve, jitter));
    
    // Check again after jitter (in case another device updated it while we waited)
    const latestDoc = await getDoc(doc(db, 'media', media.id));
    const latestLastUpdate = latestDoc.data()?.payload?.lastWeatherUpdate;
    if (latestLastUpdate && (Date.now() - latestLastUpdate < cacheDuration)) {
      setIsFetchingWeather(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const city = media.payload.city || 'São Paulo';
      
      const prompt = `Retorne o clima atual e a previsão para os próximos 3 dias para a cidade de ${city}. 
      Retorne APENAS um JSON no seguinte formato:
      {
        "city": "Nome da Cidade",
        "currentTemp": number,
        "condition": "string (ex: Ensolarado, Nublado, Chuvoso)",
        "tempMax": number,
        "tempMin": number,
        "humidity": number,
        "windSpeed": number,
        "forecast": [
          { "day": "Nome do Dia", "tempMax": number, "tempMin": number, "condition": "string" },
          ... (3 dias)
        ]
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const weatherData = JSON.parse(response.text);
        
        // Persist to Firestore for other players and future use
        try {
          await updateDoc(doc(db, 'media', media.id), {
            'payload': { ...media.payload, ...weatherData, lastWeatherUpdate: Date.now() },
            updatedAt: serverTimestamp()
          });
        } catch (updateErr) {
          console.error('Error updating weather cache in Firestore:', updateErr);
        }
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Handle Connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Remote refresh: the admin bumps config/player.reloadAt to force every
  // connected TV to reload (picking up a new deploy). The first snapshot is
  // the baseline; only a NEWER value triggers a reload. A cache-busting query
  // param is used so even aggressive TV browsers fetch a fresh document.
  useEffect(() => {
    let baseline: number | null = null;
    const unsub = onSnapshot(doc(db, 'config', 'player'), (snap) => {
      const v = snap.exists() ? (Number(snap.data().reloadAt) || 0) : 0;
      if (baseline === null) { baseline = v; return; }
      if (v > baseline) {
        baseline = v;
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('_r', String(v));
          window.location.replace(url.toString());
        } catch (e) {
          window.location.reload();
        }
      }
    }, (err) => console.error('config/player subscription error:', err));
    return () => unsub();
  }, []);

  // 1.1 Handle Wake Lock (Prevent screen from turning off)
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // Add a small delay to ensure the document is fully ready and potentially has interaction
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (document.visibilityState !== 'visible') return;
          
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[Player] Screen Wake Lock is active');
          
          // Re-request if released by system
          wakeLock.addEventListener('release', () => {
            console.log('[Player] Wake Lock was released by system');
            if (status === 'PLAYING' && document.visibilityState === 'visible') {
              setTimeout(requestWakeLock, 5000); // Wait 5s before retrying
            }
          });
        }
      } catch (err: any) {
        // Only log error if it's not a NotAllowedError (which is common on first load without interaction)
        if (err.name !== 'NotAllowedError') {
          console.error(`[Player] Wake Lock Error: ${err.name}, ${err.message}`);
        } else {
          console.log('[Player] Wake Lock pending user interaction');
        }
      }
    };

    if (status === 'PLAYING') {
      requestWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'PLAYING') {
        requestWakeLock();
      }
    };

    const handleInteraction = () => {
      if (status === 'PLAYING') {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleInteraction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleInteraction);
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
          console.log('[Player] Screen Wake Lock released');
        });
      }
    };
  }, [status]);

  // 2. Device monitoring (optional — only when an explicit ?id= is provided).
  // No pairing: this just reflects the device name and pings last_ping so the
  // admin "Dispositivos" page can show which TVs are online.
  useEffect(() => {
    if (!deviceId) {
      setDeviceName('Player');
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'devices', deviceId), (docSnap) => {
      if (docSnap.exists()) {
        setDeviceName(docSnap.data().name || 'Player');
      }
    }, (err) => {
      console.error('Device read error:', err);
    });

    // Ping interval (every 30 seconds to save writes)
    const pingInterval = setInterval(() => {
      if (isOnline) {
        updateDoc(doc(db, 'devices', deviceId), {
          last_ping: serverTimestamp()
        }).catch(err => console.error('Ping error:', err));
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(pingInterval);
    };
  }, [deviceId, isOnline]);

  // 3. Fetch the current playlist — always. Priority: playlist scheduled for
  // today; fallback: the most recently created playlist so the TV never sits
  // idle when content exists.
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let playlistUnsub: (() => void) | null = null;
    let lastPlaylistId: string | null = null;

    const subscribeToPlaylist = (playlistId: string) => {
      if (playlistUnsub) {
        playlistUnsub();
        playlistUnsub = null;
      }
      playlistUnsub = onSnapshot(doc(db, 'playlists', playlistId), (plSnap) => {
        if (plSnap.exists()) {
          const newPlaylist = Object.assign({ id: plSnap.id }, plSnap.data()) as Playlist;
          const isNewPlaylist = lastPlaylistId !== newPlaylist.id;
          lastPlaylistId = newPlaylist.id;
          if (isNewPlaylist) {
            setCurrentIndex(0);
          } else {
            // Same playlist, items changed: keep position but clamp if needed
            setCurrentIndex(prev => Math.min(prev, Math.max(0, newPlaylist.items.length - 1)));
          }
          setPlaylist(newPlaylist);
          setStatus('PLAYING');
        } else {
          lastPlaylistId = null;
          setPlaylist(null);
          setStatus('IDLE');
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `playlists/${playlistId}`);
      });
    };

    const clearPlaylist = () => {
      if (playlistUnsub) {
        playlistUnsub();
        playlistUnsub = null;
      }
      lastPlaylistId = null;
      setPlaylist(null);
      setStatus('IDLE');
    };

    const loadFallback = async () => {
      // Nothing scheduled for today: play the most recently created playlist.
      try {
        const snap = await getDocs(collection(db, 'playlists'));
        if (!snap.empty) {
          const docs = snap.docs.slice().sort(
            (a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0)
          );
          subscribeToPlaylist(docs[0].id);
          return;
        }
      } catch (err) {
        console.error('Fallback playlist error:', err);
      }
      clearPlaylist();
    };

    const scheduleUnsub = onSnapshot(doc(db, 'schedule', today), (docSnap) => {
      const playlistId = docSnap.exists() ? docSnap.data().playlistId : null;
      if (playlistId) {
        subscribeToPlaylist(playlistId);
      } else {
        loadFallback();
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `schedule/${today}`);
    });

    return () => {
      scheduleUnsub();
      if (playlistUnsub) playlistUnsub();
    };
  }, []);

  // 5. Playback Loop
  const handleNext = React.useCallback(() => {
    if (!playlist) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
  }, [playlist]);

  // 6. Media Resolver (Real-time media fetch)
  const [currentMedia, setCurrentMedia] = useState<Media | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [sales, setSales] = useState<Sale[]>([]);
  const [newSaleId, setNewSaleId] = useState<string | null>(null);
  const knownSaleIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (currentMedia?.type === 'NEWS_CLIPPING') {
      fetchNews(currentMedia);
    } else if (currentMedia?.type === 'WEATHER') {
      fetchWeather(currentMedia);
    } else {
      setNewsItems([]);
    }
  }, [currentMedia?.id]);

  // World Cup: subscribe to the shared wc_matches collection (source of truth).
  // Subscribe ONCE (the first time a WC card appears) and keep the listener +
  // data warm for the rest of the session — so WC cards re-render instantly on
  // rotation (like the payload-only cards), with no "Carregando" cold start.
  const isWC = currentMedia?.type === 'WC_BRAZIL' || currentMedia?.type === 'WC_TODAY' || currentMedia?.type === 'WC_BRACKET';
  useEffect(() => {
    if (!isWC || wcUnsubRef.current) return; // already subscribed → stay warm
    wcUnsubRef.current = onSnapshot(collection(db, 'wc_matches'), (snap) => {
      const list = snap.docs.map(d => Object.assign({ id: d.id }, d.data()) as WCMatch);
      wcMatchesRef.current = list;

      // Goal detection: a match whose score went up since the last snapshot.
      const prev = wcPrevScoresRef.current;
      const next: Record<string, { h: number; a: number }> = {};
      let goal: { id: string; side: 'home' | 'away' } | null = null;
      for (const m of list) {
        const h = Number(m.homeScore) || 0, a = Number(m.awayScore) || 0;
        next[m.id!] = { h, a };
        const p = prev[m.id!];
        if (p) {
          if (h > p.h) goal = { id: m.id!, side: 'home' };
          else if (a > p.a) goal = { id: m.id!, side: 'away' };
        }
      }
      wcPrevScoresRef.current = next;
      if (goal) {
        setWcGoal(goal);
        setTimeout(() => setWcGoal(g => (g && g.id === goal!.id ? null : g)), 7000);
      }

      setWcMatches(list);
    }, (err) => console.error('wc_matches subscription error:', err));
  }, [isWC]);

  // Detach the warm wc_matches listener only when the Player unmounts.
  useEffect(() => () => { wcUnsubRef.current?.(); wcUnsubRef.current = null; }, []);

  // Tick every 30s so live-by-clock detection and "AO VIVO" stay current.
  useEffect(() => {
    if (!isWC) return;
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isWC]);

  const wcBrazil = useMemo(() => deriveBrazil(wcMatches || []), [wcMatches]);
  const wcToday = useMemo(() => deriveToday(wcMatches || [], brasiliaTodayISO(nowMs)), [wcMatches, nowMs]);
  const wcBracket = useMemo(() => deriveBracket(wcMatches || []), [wcMatches]);

  // TV-side IA refresh, LIVE-ONLY to save resources: every 5 min, fetch only
  // the game(s) currently live (kickoff passed, within the 2h window). If no
  // game is live, nothing is fetched. Never rewrites a finished game. Gated by
  // the card's autoRefresh toggle. Scheduled/future games are the admin's job.
  useEffect(() => {
    if (!isWC) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (currentMedia?.payload?.autoRefresh === false) return;
      if (document.visibilityState !== 'visible') return;
      const live = (wcMatchesRef.current || []).filter(m => isLiveByClock(m, Date.now()));
      if (live.length === 0) return; // no game happening → don't fetch
      try {
        const updates = await fetchWcPendingUpdates(live);
        for (const u of updates) {
          const existing = (wcMatchesRef.current || []).find(m => matchupKey(m) === matchupKey(u));
          if (!existing || existing.status === 'finished') continue; // TV can't create or rewrite finished
          await updateDoc(doc(db, 'wc_matches', existing.id!), {
            homeScore: u.homeScore ?? null,
            awayScore: u.awayScore ?? null,
            homePens: u.homePens ?? null,
            awayPens: u.awayPens ?? null,
            status: u.status || 'scheduled',
            time: u.time || existing.time || '',
            updatedAt: serverTimestamp(),
          }).catch(e => console.error('wc_matches update error:', e));
        }
      } catch (e) {
        console.error('World Cup live refresh error:', e);
      }
    };

    const startId = setTimeout(tick, Math.floor(Math.random() * 15000)); // small startup jitter
    const loopId = setInterval(tick, WC_LIVE_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(startId); clearInterval(loopId); };
  }, [isWC, currentMedia?.payload?.autoRefresh]);

  // Smart Media: subscribe to the `sales` collection in real time (last 5)
  useEffect(() => {
    if (currentMedia?.type !== 'SMART_SALES') {
      setSales([]);
      knownSaleIdsRef.current = null;
      return;
    }

    const scope = currentMedia.payload?.scope || 'latest';
    const q = query(collection(db, 'sales'), orderBy('soldAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale));

      if (scope === 'month') {
        const now = new Date();
        docs = docs.filter(s => {
          if (!s.soldAt) return false;
          const d = new Date(s.soldAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
      }

      // Detect a brand-new top sale for the celebration (skip the first load)
      const topId = docs[0]?.id;
      if (knownSaleIdsRef.current === null) {
        knownSaleIdsRef.current = new Set(docs.map(s => s.id));
      } else if (topId && !knownSaleIdsRef.current.has(topId)) {
        knownSaleIdsRef.current = new Set(docs.map(s => s.id));
        if (currentMedia.payload?.celebrate !== false) {
          setNewSaleId(topId);
          setTimeout(() => setNewSaleId(prev => (prev === topId ? null : prev)), 6000);
        }
      }

      setSales(docs);
    }, (err) => {
      console.error('Error subscribing to sales:', err);
    });

    return () => unsubscribe();
  }, [currentMedia?.id, currentMedia?.type, currentMedia?.payload?.scope]);

  useEffect(() => {
    if (currentMedia?.type === 'CAROUSEL' && currentMedia.payload.images?.length > 0) {
      const interval = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % currentMedia.payload.images.length);
      }, 5000);
      return () => clearInterval(interval);
    } else if (currentMedia?.type === 'NEWS_CLIPPING' && newsItems.length > 0) {
      const interval = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % newsItems.length);
      }, 8000); // News takes longer to read, so 8s
      return () => clearInterval(interval);
    } else {
      setCarouselIndex(0);
    }
  }, [currentMedia?.id, newsItems.length]);
  useEffect(() => {
    if (!playlist || playlist.items.length === 0) return;
    const mediaId = playlist.items[currentIndex].media_id;
    
    const unsubscribe = onSnapshot(doc(db, 'media', mediaId), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentMedia(Object.assign({ id: docSnap.id }, docSnap.data()) as Media);
      } else {
        setCurrentMedia(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `media/${mediaId}`);
    });

    return () => unsubscribe();
  }, [playlist, currentIndex]);

  // 6.1 Preload Next Media (Performance Optimization)
  useEffect(() => {
    if (!playlist || playlist.items.length <= 1 || status !== 'PLAYING') return;
    
    const nextIndex = (currentIndex + 1) % playlist.items.length;
    const nextMediaId = playlist.items[nextIndex].media_id;
    
    // Fetch next media doc to trigger image preloading
    const unsubscribe = onSnapshot(doc(db, 'media', nextMediaId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Preload images if applicable
        if (data.type === 'IMAGE_HERO' && data.payload?.url) {
          const img = new Image();
          img.src = data.payload.url;
        } else if (data.type === 'CAROUSEL' && data.payload?.images) {
          data.payload.images.slice(0, 3).forEach((imgObj: any) => {
            if (imgObj.url) {
              const img = new Image();
              img.src = imgObj.url;
            }
          });
        } else if (data.type === 'NEWS_CLIPPING' && data.payload?.images) {
          data.payload.images.slice(0, 2).forEach((imgObj: any) => {
            if (imgObj.url) {
              const img = new Image();
              img.src = imgObj.url;
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [playlist, currentIndex, status]);

  const getWeatherIcon = (condition: string) => {
    const c = condition?.toLowerCase() || '';
    if (c.includes('sol') || c.includes('limpo')) return <Sun size={48} />;
    if (c.includes('nublado') || c.includes('nuvens')) return <Cloud size={48} />;
    if (c.includes('chuva') || c.includes('chuvoso')) return <CloudRain size={48} />;
    if (c.includes('tempestade') || c.includes('raio')) return <CloudLightning size={48} />;
    if (c.includes('neve')) return <Snowflake size={48} />;
    if (c.includes('neblina') || c.includes('fog')) return <CloudFog size={48} />;
    return <CloudSun size={48} />;
  };

  const getForecastIcon = (condition: string) => {
    const c = condition?.toLowerCase() || '';
    if (c.includes('sol') || c.includes('limpo')) return <Sun size={28} />;
    if (c.includes('nublado') || c.includes('nuvens')) return <Cloud size={28} />;
    if (c.includes('chuva') || c.includes('chuvoso')) return <CloudRain size={28} />;
    if (c.includes('tempestade') || c.includes('raio')) return <CloudLightning size={28} />;
    if (c.includes('neve')) return <Snowflake size={28} />;
    if (c.includes('neblina') || c.includes('fog')) return <CloudFog size={28} />;
    return <CloudSun size={28} />;
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden cursor-none group">
      {/* Fullscreen Overlay (Non-blocking and auto-hiding) */}
      <AnimatePresence>
        {showFullscreenPrompt && !isFullscreen && !user && !promptDismissed && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-adsplay/90 backdrop-blur-md px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-6 border border-white/20"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white animate-pulse">
                <Maximize size={20} />
              </div>
              <div className="text-left">
                <h2 className="text-white font-black text-sm uppercase tracking-widest">Modo TV Recomendado</h2>
                <p className="text-white/70 text-[10px] font-bold">Clique em qualquer lugar para ativar tela cheia</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                  setPromptDismissed(true);
                  safeStorage.set('adsplay_tv_prompt_dismissed', 'true');
                }}
                className="bg-white text-adsplay px-4 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-white/90 transition-all active:scale-95"
              >
                Ativar Agora
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setPromptDismissed(true);
                  safeStorage.set('adsplay_tv_prompt_dismissed', 'true');
                  setShowFullscreenPrompt(false);
                }}
                className="p-2 text-white/60 hover:text-white transition-all"
                title="Ignorar"
              >
                <Minimize size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-black/20 backdrop-blur-sm border-b border-white/5 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-80">Adsplay Labs TV</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          {playlist?.logoUrl && (
            <img 
              src={playlist.logoUrl} 
              className="h-6 object-contain opacity-80" 
              referrerPolicy="no-referrer"
              alt="Logo"
            />
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            {isOnline ? <Wifi size={10} className="text-emerald-400" /> : <WifiOff size={10} className="text-rose-400" />}
            <span className="text-[8px] font-bold text-white uppercase tracking-widest">{deviceName || 'Player'}</span>
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!currentMedia ? (
          <motion.div 
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 flex flex-col items-center justify-center space-y-8 bg-zinc-950"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full animate-pulse" />
              <Tv size={80} className="text-zinc-800 relative" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-zinc-500">Nenhuma programação ativa</h2>
              <p className="text-zinc-700 font-medium">Aguardando playlist agendada para hoje...</p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{deviceName}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key={`${currentIndex}-${currentMedia.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeInOut" }}
            className="absolute inset-0 overflow-hidden"
            style={{ willChange: 'opacity' }}
          >
            {currentMedia.type === 'IMAGE_HERO' && <MediaImageHero payload={currentMedia.payload} />}

            {currentMedia.type === 'VIDEO_FILE' && <MediaVideoFile payload={currentMedia.payload} />}

            {currentMedia.type === 'YOUTUBE' && <MediaYouTube payload={currentMedia.payload} />}

            {currentMedia.type === 'DASHBOARD' && <MediaDashboard payload={currentMedia.payload} />}

            {currentMedia.type === 'INSTAGRAM' && <MediaInstagram payload={currentMedia.payload} />}

            {currentMedia.type === 'CAROUSEL' && <MediaCarousel payload={currentMedia.payload} carouselIndex={carouselIndex} />}

            {currentMedia.type === 'WEBSITE_EMBED' && <MediaWebsiteEmbed payload={currentMedia.payload} title={currentMedia.title} />}
            {currentMedia.type === 'NEWS_CLIPPING' && (
              <div className="w-full h-full bg-[#050505] flex items-center justify-center p-24 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-adsplay/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-purple-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/4" />

                <div className="w-full max-w-[80vw] space-y-12 relative z-10">
                  <div className="flex justify-between items-end border-b border-white/10 pb-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                          <Newspaper size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-adsplay">Clipping Digital</span>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter leading-none">
                        Na Mídia<span className="text-adsplay">.</span>
                      </h2>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-adsplay animate-pulse" />
                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">
                          Powered by AI — Adsplay Labs
                          {currentMedia.payload.lastNewsUpdate && (
                            <span className="ml-2 opacity-50">• {new Date(currentMedia.payload.lastNewsUpdate).toLocaleDateString('pt-BR')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {isFetchingNews ? (
                    <div className="h-[50vh] flex flex-col items-center justify-center gap-8">
                      <div className="relative">
                        <div className="absolute inset-0 bg-adsplay/20 blur-3xl rounded-full animate-pulse" />
                        <Loader2 className="text-adsplay animate-spin relative" size={64} />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-white font-black text-xl uppercase tracking-widest animate-pulse">Sincronizando Notícias</p>
                        <p className="text-zinc-500 text-sm font-medium">Buscando as matérias mais relevantes...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-[60vh] flex items-center">
                      <AnimatePresence>
                        {newsItems.length > 0 ? (
                          <motion.div 
                            key={carouselIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full grid grid-cols-12 gap-16 items-center"
                          >
                            <div className="col-span-6 space-y-8">
                              <div className="space-y-6">
                                <div className="flex flex-col gap-3">
                                  <div className="inline-flex items-center gap-2 w-fit px-3 py-1 bg-adsplay/10 rounded-lg border border-adsplay/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-adsplay animate-pulse" />
                                    <span className="text-[10px] font-black text-adsplay uppercase tracking-[0.2em]">
                                      {newsItems[carouselIndex]?.source || 'Portal'}
                                    </span>
                                  </div>
                                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-[0.3em] ml-1">
                                    {newsItems[carouselIndex]?.date || 'Destaque'}
                                  </span>
                                </div>
                                
                                <h3 className="text-5xl font-black text-white tracking-tighter leading-[1.1] drop-shadow-2xl max-w-xl">
                                  {newsItems[carouselIndex]?.title}
                                </h3>
                              </div>
                              
                              {newsItems[carouselIndex]?.summary && (
                                <p className="text-zinc-400 text-lg leading-relaxed font-medium italic serif max-w-xl border-l-4 border-adsplay/30 pl-6">
                                  "{newsItems[carouselIndex]?.summary}"
                                </p>
                              )}

                              <div className="flex items-center gap-6 pt-2">
                                <div className="flex gap-2">
                                  {newsItems.slice(0, 6).map((_, i) => (
                                    <div 
                                      key={i}
                                      className={`h-1 rounded-full transition-all duration-700 ${
                                        i === carouselIndex ? 'w-10 bg-adsplay' : 'w-2 bg-zinc-800'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.3em]">
                                  {carouselIndex + 1} <span className="mx-1 text-zinc-800">/</span> {Math.min(newsItems.length, 6)}
                                </span>
                              </div>
                            </div>

                            <div className="col-span-6 relative">
                              <div className="aspect-video rounded-[2rem] overflow-hidden border-4 border-white/5 relative group shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)]">
                                {newsItems[carouselIndex]?.imageUrl ? (
                                  <img 
                                    src={newsItems[carouselIndex].imageUrl} 
                                    alt={newsItems[carouselIndex].title}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    style={{ willChange: 'transform' }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-800">
                                    <Newspaper size={80} />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                              </div>
                              
                              {/* Decorative elements */}
                              <div className="absolute -top-10 -right-10 w-48 h-48 bg-adsplay/10 blur-[80px] rounded-full" />
                              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-adsplay/5 blur-[80px] rounded-full" />
                            </div>
                          </motion.div>
                        ) : (
                          <div className="w-full flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center text-zinc-700">
                              <AlertCircle size={48} />
                            </div>
                            <div className="space-y-2">
                              <p className="text-zinc-500 font-black text-2xl uppercase tracking-widest">Nenhum resultado</p>
                              <p className="text-zinc-700 text-lg font-medium">Adicione notícias no painel de controle.</p>
                            </div>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}
            {currentMedia.type === 'MONTHLY_GOAL' && (
              <div className="w-full h-full bg-zinc-950 flex items-center justify-center p-20 relative">
                {(() => {
                  const months = [...(currentMedia.payload.months || [])].sort((a, b) => a.month - b.month);
                  const current = months.length > 0 ? months[months.length - 1] : { month: 1, target: 1, current: 0 };
                  const currentVal = Number(current.current) || 0;
                  const targetVal = Number(current.target) || 1;
                  const rawPercentage = targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : 0;
                  const percentage = isNaN(rawPercentage) ? 0 : rawPercentage;
                  
                  return (
                    <>
                      {percentage >= 100 && <Celebration />}
                      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
                  {/* Left Column: Previous Months Summary */}
                  <div className="lg:col-span-5 space-y-12">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-adsplay">
                        <Calendar size={32} />
                        <span className="text-xl font-black uppercase tracking-[0.3em]">Desempenho Anual</span>
                      </div>
                      <h2 className="text-6xl font-black text-white tracking-tighter leading-none">
                        Meses Anteriores
                        <span className="text-adsplay">.</span>
                        <br />
                        <span className="text-zinc-500 text-4xl">{currentMedia.payload.year}</span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {[...(currentMedia.payload.months || [])]
                        .sort((a, b) => a.month - b.month)
                        .slice(0, -1) // Exclude current month if it's the last one
                        .map((m: any, i: number) => {
                          const currentVal = Number(m.current) || 0;
                          const targetVal = Number(m.target) || 1; // Avoid 0
                          const isHit = currentVal >= targetVal;
                          const surplus = currentVal - targetVal;
                          const rawSurplusPercent = targetVal > 0 ? Math.round((surplus / targetVal) * 100) : 0;
                          const surplusPercent = isNaN(rawSurplusPercent) ? 0 : rawSurplusPercent;
                          const rawHitPercent = targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : 0;
                          const hitPercent = isNaN(rawHitPercent) ? 0 : rawHitPercent;
                          const widthPercent = targetVal > 0 ? Math.min(100, (currentVal / targetVal) * 100) : 0;
                          const sanitizedWidth = isNaN(widthPercent) ? 0 : widthPercent;

                          return (
                            <div key={i} className={`p-8 rounded-[2.5rem] border transition-all space-y-4 ${
                              isHit ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800'
                            }`}>
                              <div className="flex justify-between items-start">
                                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m.month - 1]}
                                </p>
                                {isHit && (
                                  <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full uppercase tracking-tighter">
                                    Meta Batida!
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <p className={`text-4xl font-black ${isHit ? 'text-emerald-400' : 'text-white'}`}>
                                  {hitPercent}%
                                </p>
                                {isHit && surplus > 0 && (
                                  <p className="text-sm font-bold text-emerald-500/80">
                                    +{surplusPercent}%
                                  </p>
                                )}
                              </div>
                              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ${isHit ? 'bg-emerald-500' : 'bg-adsplay'}`}
                                  style={{ width: `${sanitizedWidth}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      {(currentMedia.payload.months || []).length <= 1 && (
                        <div className="col-span-2 p-12 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-[3rem] text-center">
                          <p className="text-zinc-500 font-bold uppercase tracking-widest">Aguardando dados históricos</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Current Month Highlight */}
                  <div className="lg:col-span-7 space-y-12">
                    {(() => {
                      const months = [...(currentMedia.payload.months || [])].sort((a, b) => a.month - b.month);
                      const current = months.length > 0 ? months[months.length - 1] : { month: 1, target: 1, current: 0 };
                      const currentVal = Number(current.current) || 0;
                      const targetVal = Number(current.target) || 1;
                      const rawPercentage = targetVal > 0 ? Math.round((currentVal / targetVal) * 100) : 0;
                      const percentage = isNaN(rawPercentage) ? 0 : rawPercentage;
                      
                      return (
                        <div className="bg-zinc-900/50 p-16 rounded-[5rem] border border-zinc-800 space-y-12 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-12">
                            <div className="px-6 py-3 bg-adsplay text-white rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-adsplay/20">
                              Mês Atual
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-adsplay">
                              <Target size={32} />
                              <span className="text-xl font-black uppercase tracking-[0.3em]">Foco do Mês</span>
                            </div>
                            <h3 className="text-7xl font-black text-white tracking-tighter">
                              {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][current.month - 1]}
                            </h3>
                          </div>

                          <div className="relative aspect-square max-w-[500px] mx-auto">
                            <div className="absolute inset-0 bg-adsplay/10 blur-[120px] rounded-full" />
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                {/* Background Gauge */}
                                <Pie
                                  data={[{ value: 100 }]}
                                  cx="50%"
                                  cy="70%"
                                  innerRadius="75%"
                                  outerRadius="95%"
                                  startAngle={180}
                                  endAngle={0}
                                  dataKey="value"
                                  stroke="none"
                                  fill="#18181b"
                                />
                                {/* Actual Progress Gauge */}
                                <Pie
                                  data={[
                                    { name: 'Atingido', value: Math.min(percentage, 100) },
                                    { name: 'Restante', value: Math.max(0, 100 - percentage) }
                                  ]}
                                  cx="50%"
                                  cy="70%"
                                  innerRadius="75%"
                                  outerRadius="95%"
                                  startAngle={180}
                                  endAngle={0}
                                  dataKey="value"
                                  stroke="none"
                                >
                                  <Cell fill={percentage >= 100 ? '#10b981' : '#7C3AED'} />
                                  <Cell fill="transparent" />
                                </Pie>
                                {percentage > 100 && (
                                  <Pie
                                    data={[
                                      { value: Math.min(percentage - 100, 100) },
                                      { value: Math.max(0, 200 - percentage) }
                                    ]}
                                    cx="50%"
                                    cy="70%"
                                    innerRadius="98%"
                                    outerRadius="105%"
                                    startAngle={180}
                                    endAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    <Cell fill="#10b981" />
                                    <Cell fill="transparent" />
                                  </Pie>
                                )}
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pt-24">
                              <span className="text-[10rem] font-black text-white leading-none tracking-tighter">
                                <Counter value={percentage} />
                                <span className="text-adsplay text-5xl">%</span>
                              </span>
                              <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-base mt-4">Atingimento Total</p>
                            </div>
                          </div>

                          <div className="space-y-8">
                            {!currentMedia.payload.showOnlyPercentage && (
                              <div className="flex justify-between items-end">
                                <div className="space-y-2">
                                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Realizado</p>
                                  <p className="text-5xl font-black text-white">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(current.current)}
                                  </p>
                                </div>
                                <div className="text-right space-y-2">
                                  <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Objetivo</p>
                                  <p className="text-3xl font-bold text-zinc-400">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(current.target)}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            <div className={`p-8 text-white rounded-[2.5rem] flex items-center justify-between shadow-2xl transition-all ${
                              percentage >= 100 ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-adsplay shadow-adsplay/20'
                            }`}>
                              <div className="flex items-center gap-4">
                                <TrendingUp size={32} />
                                <span className="font-black uppercase text-sm tracking-widest">Status da Meta</span>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-xl italic leading-tight block">
                                  {percentage >= 100 ? 'META ATINGIDA!' : 'Bora bater a meta!'}
                                </span>
                                {percentage >= 100 && (
                                  <div className="flex flex-col items-end mt-1">
                                    <span className="text-xs font-bold opacity-80">
                                      Superamos em {percentage - 100}%
                                    </span>
                                    <span className="text-xs font-black">
                                      + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(current.current - current.target)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

            {currentMedia.type === 'NORTH_STAR' && (() => {
              const p = currentMedia.payload || {};
              const prog = Number(p.adsplay) || 0;   // "Programática" (Core)
              const trig = Number(p.trigger) || 0;
              const amax = Number(p.adsmax) || 0;
              const pix = Number(p.pixel) || 0;
              const pm = p.prevMetrics;
              const metaCore = Number(p.metaCoreGoal) || 150;   // Programática + Trigger + Adsmax
              const metaPix = Number(p.metaPixelGoal) || 500;   // Pixel
              const coreSum = prog + trig + amax;               // feeds the 150 meta
              const newBuTotal = trig + amax + pix;             // New BU (visual)
              const grand = prog + trig + amax + pix;
              const prevGrand = pm ? (Number(pm.adsplay) || 0) + (Number(pm.trigger) || 0) + (Number(pm.adsmax) || 0) + (Number(pm.pixel) || 0) : null;
              const prevCore = pm ? (Number(pm.adsplay) || 0) + (Number(pm.trigger) || 0) + (Number(pm.adsmax) || 0) : null;

              const card = (label: string, value: number, prevVal?: number | null) => (
                <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center gap-2 text-center backdrop-blur-xl">
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">{label}</p>
                  <div className="text-6xl font-black text-white tracking-tighter"><Counter value={value} /></div>
                  <NSDelta prev={prevVal} cur={value} size="text-xs" />
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">Campanhas</p>
                </div>
              );

              const metaBar = (title: string, sub: string, value: number, goal: number, grad: string) => {
                const pct = goal > 0 ? Math.round((value / goal) * 100) : 0;
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                      <div>
                        <p className="text-white font-black uppercase tracking-widest text-xl">{title}</p>
                        <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px] mt-1">{sub}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black text-white leading-none"><Counter value={value} /> <span className="text-zinc-500 text-2xl">/ {goal}</span></p>
                        <p className="text-zinc-500 font-black text-sm mt-1">{Math.min(100, pct)}% · faltam {Math.max(0, goal - value)}</p>
                      </div>
                    </div>
                    <div className="h-5 w-full bg-zinc-900 rounded-full p-1.5 border border-white/5 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 2, ease: 'easeOut' }} className={`h-full bg-gradient-to-r ${grad} rounded-full`} />
                    </div>
                  </div>
                );
              };

              return (
                <div className="w-full h-full bg-[#050505] flex items-center justify-center p-16 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[70vw] h-[70vw] bg-adsplay/10 blur-[140px] rounded-full -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-purple-500/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4" />

                  <div className="w-full max-w-7xl space-y-10 relative z-10">
                    {/* Header */}
                    <div className="flex items-end justify-between gap-8">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-adsplay/20 rounded-2xl flex items-center justify-center text-adsplay"><TrendingUp size={26} /></div>
                          <span className="text-lg font-black uppercase tracking-[0.4em] text-adsplay">North Star Metric</span>
                        </div>
                        <h2 className="text-7xl font-black text-white tracking-tighter leading-none">Meta de {p.currentYear || new Date().getFullYear()}<span className="text-adsplay">.</span></h2>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-xs">Total Geral</p>
                        <div className="text-7xl font-black text-white leading-none tracking-tighter"><Counter value={grand} /></div>
                        {prevGrand != null && (
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <NSDelta prev={prevGrand} cur={grand} size="text-base" />
                            <span className="text-zinc-600 font-bold uppercase tracking-[0.15em] text-[9px]">vs. última</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BUs */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-6">
                      <div className="bg-white/[0.02] rounded-[2.5rem] border border-adsplay/20 p-5 space-y-4">
                        <div className="flex items-baseline justify-between px-1">
                          <span className="text-adsplay font-black uppercase tracking-[0.3em] text-lg">Core</span>
                          <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Total <span className="text-white font-black text-lg">{prog}</span></span>
                        </div>
                        {card('Programática', prog, pm?.adsplay)}
                      </div>
                      <div className="bg-white/[0.02] rounded-[2.5rem] border border-purple-500/20 p-5 space-y-4">
                        <div className="flex items-baseline justify-between px-1">
                          <span className="text-purple-400 font-black uppercase tracking-[0.3em] text-lg">New</span>
                          <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Total <span className="text-white font-black text-lg">{newBuTotal}</span></span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {card('Trigger', trig, pm?.trigger)}
                          {card('Adsmax', amax, pm?.adsmax)}
                          {card('Pixel', pix, pm?.pixel)}
                        </div>
                      </div>
                    </div>

                    {/* Metas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      {metaBar('Meta Core', 'Programática + Trigger + Adsmax', coreSum, metaCore, 'from-adsplay to-emerald-500')}
                      {metaBar('Meta Pixel', 'Somente Pixel', pix, metaPix, 'from-purple-600 to-adsplay')}
                    </div>
                  </div>
                </div>
              );
            })()}

            {currentMedia.type === 'WEBSITE_EMBED' && currentMedia.payload && (
              <div className="w-full h-full bg-zinc-950 flex items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-adsplay/10 via-transparent to-purple-500/10" />
                
                <div className="w-full max-w-7xl space-y-8 relative z-10">
                  <div className="flex justify-between items-end border-b border-white/10 pb-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                          <Globe size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-adsplay">Website Preview</span>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter leading-none">
                        {currentMedia.title}<span className="text-adsplay">.</span>
                      </h2>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-adsplay animate-pulse" />
                        <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">
                          Live Snapshot — {currentMedia.payload.url}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="relative aspect-video rounded-[2.5rem] overflow-hidden border-8 border-white/5 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.8)] bg-zinc-900">
                    {currentMedia.payload.screenshotUrl ? (
                      <img 
                        src={currentMedia.payload.screenshotUrl} 
                        alt={currentMedia.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-800">
                        <Globe size={120} />
                      </div>
                    )}
                    
                    {/* Overlay for "Print" look */}
                    <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5 rounded-[2rem]" />
                  </div>
                </div>
              </div>
            )}

            {currentMedia.type === 'WEATHER' && currentMedia.payload && (
              <div className={`w-full h-full flex items-center justify-center p-24 relative overflow-hidden transition-all duration-1000 ${
                (currentMedia.payload.condition || '').toLowerCase().includes('tempestade') || (currentMedia.payload.condition || '').toLowerCase().includes('raio') ? 'bg-[#050505]' :
                (currentMedia.payload.condition || '').toLowerCase().includes('chuva') ? 'bg-[#0a1a2f]' :
                (currentMedia.payload.condition || '').toLowerCase().includes('nublado') ? 'bg-[#1a1a1a]' :
                (currentMedia.payload.condition || '').toLowerCase().includes('ensolarado') ? 'bg-[#003366]' :
                'bg-[#0a0a0a]'
              }`}>
                <WeatherAnimation condition={currentMedia.payload.condition || ''} />
                
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-[70vw] h-[70vw] bg-adsplay/5 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-purple-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4" />

                <div className="w-full max-w-7xl grid grid-cols-12 gap-16 items-center relative z-10">
                  {/* Left Column: Current Weather */}
                  <div className="col-span-7 space-y-12">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-adsplay/10 rounded-2xl flex items-center justify-center text-adsplay">
                          <CloudSun size={24} />
                        </div>
                        <span className="text-sm font-black uppercase tracking-[0.4em] text-adsplay">Previsão do Tempo</span>
                      </div>
                      <h2 className="text-8xl font-black text-white tracking-tighter leading-none">
                        {currentMedia.payload.city || 'Cidade'}
                        <span className="text-adsplay">.</span>
                      </h2>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="text-[180px] font-black text-white leading-none tracking-tighter flex items-start">
                        {currentMedia.payload.currentTemp ?? '--'}
                        <span className="text-adsplay text-6xl mt-8">°C</span>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-6">
                          <div className="text-adsplay">
                            {getWeatherIcon(currentMedia.payload.condition)}
                          </div>
                          <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                            <p className="text-adsplay text-2xl font-black uppercase tracking-widest">
                              {currentMedia.payload.condition || '---'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-8 px-2">
                          <div className="flex items-center gap-3">
                            <Thermometer className="text-zinc-500" size={24} />
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Máx / Mín</p>
                              <p className="text-xl font-bold text-white">
                                {currentMedia.payload.tempMax ?? '--'}° / {currentMedia.payload.tempMin ?? '--'}°
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                          <Droplets size={32} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Umidade</p>
                          <p className="text-3xl font-black text-white">{currentMedia.payload.humidity ?? '--'}%</p>
                        </div>
                      </div>
                      <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex items-center gap-6">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                          <Wind size={32} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Vento</p>
                          <p className="text-3xl font-black text-white">{currentMedia.payload.windSpeed ?? '--'} <span className="text-sm">km/h</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Forecast */}
                  <div className="col-span-5 space-y-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest border-l-4 border-adsplay pl-6">
                      Próximos Dias
                    </h3>
                    <div className="space-y-4">
                      {(currentMedia.payload.forecast || []).map((f: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ x: 50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between group hover:bg-zinc-900 transition-all"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-adsplay/10 rounded-2xl flex items-center justify-center text-adsplay group-hover:scale-110 transition-transform">
                              {getForecastIcon(f.condition)}
                            </div>
                            <div>
                              <p className="text-xl font-black text-white">{f.day || '---'}</p>
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{f.condition || '---'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black text-white">{f.tempMax ?? '--'}°</p>
                            <p className="text-sm font-bold text-zinc-500">{f.tempMin ?? '--'}°</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentMedia.type === 'FINAL_SPRINT' && (() => {
              const target = Number(currentMedia.payload.target) || 1;
              const current = Number(currentMedia.payload.current) || 0;
              const remaining = Math.max(0, target - current);
              const percentage = Math.min(100, Math.round((current / target) * 100));
              const label = currentMedia.payload.label || 'vendas';
              const month = currentMedia.payload.month || '';
              const teamName = currentMedia.payload.teamName || '';
              const isGoalHit = current >= target;
              const fmtBR = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

              return (
                <div className="w-full h-full bg-[#060606] flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Atmospheric glow */}
                  <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: isGoalHit ? [0.3, 0.5, 0.3] : [0.15, 0.3, 0.15] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] rounded-full blur-[200px] ${isGoalHit ? 'bg-emerald-700/30' : 'bg-violet-900/40'}`}
                    />
                    {!isGoalHit && [...Array(7)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: '100vh', opacity: 0 }}
                        animate={{ y: ['100vh', '60vh', '10vh', '-10vh'], opacity: [0, 1, 0.6, 0] }}
                        transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
                        className="absolute text-3xl"
                        style={{ left: `${10 + i * 12}%`, willChange: 'transform' }}
                      >
                        🔥
                      </motion.div>
                    ))}
                  </div>

                  {/* Header badge */}
                  <motion.div
                    initial={{ y: -40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute top-20 left-0 right-0 flex justify-center z-10"
                  >
                    <div className="flex items-center gap-4 px-10 py-4 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
                      <motion.span
                        animate={{ rotate: isGoalHit ? [0, -20, 20, 0] : [-10, 10, -10] }}
                        transition={{ duration: isGoalHit ? 0.6 : 1, repeat: Infinity }}
                        className="text-3xl"
                      >
                        {isGoalHit ? '🏆' : '🦙'}
                      </motion.span>
                      <span className="text-sm font-black text-white/80 uppercase tracking-[0.5em]">
                        Sprint Final{month ? ` — ${month}` : ''}{teamName ? ` · ${teamName}` : ''}
                      </span>
                      {!isGoalHit && (
                        <motion.span
                          animate={{ opacity: [1, 0.2, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="text-3xl"
                        >
                          ⚡
                        </motion.span>
                      )}
                    </div>
                  </motion.div>

                  {/* Main content */}
                  <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-20 gap-8">
                    {isGoalHit ? (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.04, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="text-[clamp(5rem,16vw,14rem)] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-500"
                          style={{ filter: 'drop-shadow(0 0 60px rgba(16,185,129,0.4))' }}
                        >
                          META<br />BATIDA!
                        </motion.div>
                        <p className="text-4xl font-black text-emerald-400 uppercase tracking-widest">
                          A lhama chegou lá! 🦙🎉
                        </p>
                      </motion.div>
                    ) : (
                      <div className="w-full flex flex-col items-center gap-4">
                        <motion.p
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-2xl font-black text-zinc-500 uppercase tracking-[0.4em]"
                        >
                          Falta para a meta{month && <span className="text-adsplay"> {month}</span>}
                        </motion.p>

                        <motion.div
                          animate={{ scale: [1, 1.015, 1] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="text-[clamp(3rem,12vw,12rem)] font-black text-white leading-none tracking-tighter"
                          style={{ textShadow: '0 0 80px rgba(124,58,237,0.5)' }}
                        >
                          {fmtBR(remaining)}
                        </motion.div>

                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="text-3xl font-black text-zinc-400 uppercase tracking-[0.3em] -mt-2"
                        >
                          {label}
                        </motion.p>
                      </div>
                    )}

                    {/* Progress bar + llama */}
                    <div className="w-full space-y-0">
                      <div className="flex justify-between items-end px-2 mb-2">
                        <p className="text-xs font-black text-zinc-700 uppercase tracking-widest">0</p>
                        <motion.p
                          animate={{ opacity: !isGoalHit ? [1, 0.4, 1] : 1 }}
                          transition={{ duration: 1.5, repeat: !isGoalHit ? Infinity : 0 }}
                          className={`text-base font-black uppercase tracking-widest ${isGoalHit ? 'text-emerald-400' : 'text-adsplay'}`}
                        >
                          {percentage}% atingido
                        </motion.p>
                        <p className="text-xs font-black text-zinc-700 uppercase tracking-widest">{target} {label}</p>
                      </div>

                      <div className="relative h-10 w-full bg-zinc-900 rounded-full border border-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 2.5, ease: "easeOut" }}
                          className={`h-full rounded-full relative overflow-hidden ${isGoalHit ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-adsplay via-violet-500 to-fuchsia-500'}`}
                        >
                          <motion.div
                            animate={{ x: ['-100%', '200%'] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "linear", repeatDelay: 0.3 }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12"
                          />
                        </motion.div>
                      </div>

                      <div className="relative" style={{ height: '72px' }}>
                        <motion.div
                          initial={{ left: '1%' }}
                          animate={{ left: `${Math.max(1, Math.min(93, percentage - 2))}%` }}
                          transition={{ duration: 2.5, ease: "easeOut" }}
                          className="absolute top-1 transform -translate-x-1/2"
                        >
                          <motion.div
                            animate={{
                              y: isGoalHit ? [0, -16, 0] : [0, -10, 0],
                              rotate: isGoalHit ? [-15, 15, -15] : [-6, 6, -6]
                            }}
                            transition={{ duration: isGoalHit ? 0.5 : 0.7, repeat: Infinity }}
                          >
                            <span
                              className="text-6xl block select-none"
                              style={{ filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.9))' }}
                            >
                              🦙
                            </span>
                          </motion.div>
                          {!isGoalHit && (
                            <motion.span
                              animate={{ opacity: [0.7, 0], x: [-5, -20] }}
                              transition={{ duration: 0.4, repeat: Infinity }}
                              className="absolute top-4 -left-8 text-xl pointer-events-none"
                            >
                              💨
                            </motion.span>
                          )}
                        </motion.div>
                        <div className="absolute right-0 top-0 text-4xl select-none">🏁</div>
                      </div>
                    </div>

                    {/* Bottom stats */}
                    <motion.div
                      initial={{ y: 24, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-10"
                    >
                      <div className="text-center">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Realizadas</p>
                        <p className={`text-2xl font-black ${isGoalHit ? 'text-emerald-400' : 'text-white'}`}>{fmtBR(current)}</p>
                      </div>
                      <div className="w-px h-10 bg-zinc-800" />
                      <div className="text-center">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Meta</p>
                        <p className="text-2xl font-black text-zinc-500">{fmtBR(target)}</p>
                      </div>
                      {!isGoalHit && (
                        <>
                          <div className="w-px h-10 bg-zinc-800" />
                          <div className="text-center">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Faltam</p>
                            <motion.p
                              animate={{ color: ['#ef4444', '#7C3AED', '#ef4444'] }}
                              transition={{ duration: 2.5, repeat: Infinity }}
                              className="text-2xl font-black"
                            >
                              {fmtBR(remaining)}
                            </motion.p>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </div>
                </div>
              );
            })()}

            {currentMedia.type === 'SMART_SALES' && (() => {
              const valueDisplay = currentMedia.payload?.valueDisplay || 'full';
              const fmtFull = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              const fmtAbbrev = (n: number) => {
                if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
                if (n >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`;
                return fmtFull(n);
              };
              const showValue = (s: Sale) => {
                if (valueDisplay === 'hidden') return null;
                const n = Number(s.investimentoValor) || 0;
                if (!n && s.investimento) return s.investimento;
                return valueDisplay === 'abbreviated' ? fmtAbbrev(n) : fmtFull(n);
              };
              const top = sales[0];
              const rest = sales.slice(1, 5);

              return (
                <div className="w-full h-full bg-[#060606] flex flex-col relative overflow-hidden p-12 gap-8">
                  {/* Atmospheric glow */}
                  <div className="absolute inset-0 pointer-events-none">
                    <motion.div
                      animate={{ opacity: [0.15, 0.3, 0.15] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full blur-[200px] bg-emerald-700/30"
                    />
                  </div>

                  {/* New-sale celebration (brief, lightweight ≤6 elements) */}
                  {newSaleId && newSaleId === top?.id && (
                    <div className="absolute inset-0 pointer-events-none z-30">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ y: '110vh', opacity: 0 }}
                          animate={{ y: '-10vh', opacity: [0, 1, 0] }}
                          transition={{ duration: 2.2, delay: i * 0.18, ease: 'easeOut' }}
                          className="absolute text-5xl"
                          style={{ left: `${12 + i * 14}%`, willChange: 'transform' }}
                        >
                          🎉
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Header */}
                  <div className="relative z-10 flex items-center gap-4">
                    <span className="text-4xl">🏆</span>
                    <div>
                      <p className="text-sm font-black text-emerald-400 uppercase tracking-[0.4em]">Vendas Fechadas</p>
                      <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Adsplay Labs · em tempo real</p>
                    </div>
                  </div>

                  {sales.length === 0 ? (
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-4">
                      <span className="text-7xl opacity-40">📭</span>
                      <p className="text-2xl font-black text-zinc-600 uppercase tracking-widest">Aguardando a próxima venda</p>
                    </div>
                  ) : (
                    <>
                      {/* Featured (latest) sale */}
                      {top && (
                        <motion.div
                          key={top.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.5 }}
                          className="relative z-10 rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 p-10 flex items-center justify-between gap-8"
                        >
                          <div className="space-y-3 min-w-0">
                            <span className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-widest">
                              Última venda · {top.squad || '—'}
                            </span>
                            <p className="text-4xl font-black text-white leading-tight truncate">{top.executivo || top.squad || 'Venda fechada'}</p>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-bold text-zinc-400">
                              {top.status && <span>{top.status}</span>}
                              {top.pi && <span className="text-zinc-500">PI: <span className="text-zinc-300">{top.pi}</span></span>}
                              {top.periodo && <span className="text-zinc-500">Período: <span className="text-zinc-300">{top.periodo}</span></span>}
                              {top.cs && <span className="text-zinc-500">CS: <span className="text-zinc-300">{top.cs}</span></span>}
                            </div>
                          </div>
                          {showValue(top) && (
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Investimento</p>
                              <p className="text-[clamp(2rem,5vw,4rem)] font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-500 leading-none"
                                 style={{ filter: 'drop-shadow(0 0 30px rgba(16,185,129,0.3))' }}>
                                {showValue(top)}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Previous sales (up to 4, smaller) */}
                      {rest.length > 0 && (
                        <div className="relative z-10 grid grid-cols-4 gap-4 flex-1">
                          {rest.map((s) => (
                            <div key={s.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 flex flex-col justify-between">
                              <div className="space-y-1 min-w-0">
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest truncate">{s.squad || '—'}</p>
                                <p className="text-base font-black text-white leading-tight line-clamp-2">{s.executivo || 'Venda'}</p>
                                {s.status && <p className="text-[11px] font-bold text-zinc-500 truncate">{s.status}</p>}
                              </div>
                              {showValue(s) && (
                                <p className="text-lg font-black text-emerald-400 mt-3 truncate">{showValue(s)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* World Cup — Brazil's journey + next match */}
            {currentMedia.type === 'WC_BRAZIL' && (() => {
              const results = wcBrazil.results;
              const next = wcBrazil.nextMatch;
              const loading = wcMatches === null;
              return (
                <div className="w-full h-full bg-gradient-to-b from-white to-zinc-100 flex flex-col p-16 gap-10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-emerald-500 via-yellow-400 to-emerald-500" />
                  <div className="flex items-center gap-6 relative z-10">
                    <TeamFlag code="br" imgClass="w-24 h-16" emojiClass="text-8xl" />
                    <div>
                      <h2 className="text-7xl font-black text-zinc-900 tracking-tighter leading-none">Seleção Brasileira</h2>
                      <p className="text-emerald-600 font-black uppercase tracking-[0.3em] text-lg mt-3">Copa do Mundo FIFA 2026</p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-3xl font-bold">Carregando dados da Copa...</div>
                  ) : (
                    <div className="flex-1 grid grid-cols-12 gap-10 relative z-10 min-h-0">
                      <div className="col-span-5 flex flex-col">
                        <h3 className="text-emerald-600 text-2xl font-black uppercase tracking-[0.25em] mb-5">Próximo Jogo</h3>
                        {next ? (
                          <div className="flex-1 bg-white border-2 border-emerald-100 rounded-[2.5rem] p-10 flex flex-col justify-center gap-10 shadow-xl shadow-emerald-900/5">
                            <div className="flex items-center justify-center gap-10">
                              <div className="flex flex-col items-center gap-4">
                                <TeamFlag code="br" imgClass="w-32 h-20" emojiClass="text-8xl" />
                                <span className="text-3xl font-black text-zinc-900">BRASIL</span>
                              </div>
                              <span className="text-5xl font-black text-zinc-300">×</span>
                              <div className="flex flex-col items-center gap-4">
                                <TeamFlag code={next.opponentCode} emoji={next.opponentFlag} imgClass="w-32 h-20" emojiClass="text-8xl" />
                                <span className="text-3xl font-black text-zinc-900 text-center">{(next.opponent || 'A definir').toUpperCase()}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-3 text-center">
                              {next.stage && <span className="px-5 py-2 bg-emerald-500 text-white rounded-full text-sm font-black uppercase tracking-widest">{next.stage}</span>}
                              <p className="text-5xl font-black text-zinc-900">{fmtBrDate(next.date) || 'A definir'}{next.time ? ` · ${next.time}` : ''}</p>
                              <p className="text-lg text-zinc-400 font-bold uppercase tracking-widest">Horário de Brasília</p>
                              {next.venue && <p className="text-xl text-zinc-500 font-bold">{next.venue}</p>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 bg-white border-2 border-zinc-100 rounded-[2.5rem] p-10 flex items-center justify-center text-center text-zinc-400 text-2xl font-bold">Sem jogo agendado</div>
                        )}
                      </div>

                      <div className="col-span-7 flex flex-col min-h-0">
                        <h3 className="text-emerald-600 text-2xl font-black uppercase tracking-[0.25em] mb-5">Trajetória</h3>
                        <div className="flex-1 space-y-3 overflow-hidden">
                          {results.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-zinc-400 text-2xl font-bold">A seleção ainda não estreou</div>
                          ) : results.slice(0, 8).map((r: any, i: number) => {
                            const letter = wcResultLetter(Number(r.brScore) || 0, Number(r.advScore) || 0, r.brPens, r.advPens);
                            const color = letter === 'V' ? 'bg-emerald-500' : letter === 'D' ? 'bg-rose-500' : 'bg-zinc-400';
                            const hasPens = r.brPens != null && r.advPens != null;
                            return (
                              <div key={i} className="bg-white border border-zinc-200 rounded-2xl px-6 py-4 flex items-center gap-5 shadow-sm">
                                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white font-black text-xl shrink-0`}>{letter}</div>
                                <div className="flex-1 flex items-center gap-3 min-w-0">
                                  <TeamFlag code="br" imgClass="w-10 h-7" emojiClass="text-3xl" />
                                  <span className="text-3xl font-black text-zinc-900">{Number(r.brScore) || 0}</span>
                                  <span className="text-zinc-400 font-black text-2xl">×</span>
                                  <span className="text-3xl font-black text-zinc-900">{Number(r.advScore) || 0}</span>
                                  {hasPens && <span className="text-sm font-black text-emerald-600 shrink-0">({r.brPens}-{r.advPens} pên)</span>}
                                  <TeamFlag code={r.opponentCode} emoji={r.opponentFlag} imgClass="w-10 h-7" emojiClass="text-3xl" />
                                  <span className="text-2xl font-bold text-zinc-700 truncate">{r.opponent}</span>
                                </div>
                                <div className="flex flex-col items-end shrink-0 text-right">
                                  {r.stage && <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{r.stage}</span>}
                                  {r.date && <span className="text-xs font-bold text-zinc-400">{fmtBrDate(r.date)}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* World Cup — today's matches (live by clock + goal animation) */}
            {currentMedia.type === 'WC_TODAY' && (() => {
              const matches = wcToday;
              const today = new Date(nowMs).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' });
              const loading = wcMatches === null;
              const showScore = (m: any) => m.homeScore != null && m.awayScore != null;
              const liveNow = (m: any) => isLiveByClock(m, nowMs);
              const badge = (m: any) => {
                if (m.status === 'finished') return <span className="px-4 py-1.5 bg-zinc-200 text-zinc-600 rounded-full text-sm font-black uppercase tracking-widest">Encerrado</span>;
                if (liveNow(m)) return <span className="px-4 py-1.5 bg-rose-500 text-white rounded-full text-sm font-black uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-white animate-pulse" />Ao Vivo</span>;
                return <span className="px-4 py-1.5 bg-zinc-900 text-white rounded-full text-sm font-black uppercase tracking-widest">Agendado</span>;
              };
              return (
                <div className="w-full h-full bg-gradient-to-b from-white to-zinc-100 flex flex-col p-16 gap-8 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-3 bg-adsplay" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="w-20 h-20 bg-adsplay/10 rounded-2xl flex items-center justify-center text-adsplay"><Calendar size={40} /></div>
                      <div>
                        <h2 className="text-7xl font-black text-zinc-900 tracking-tighter leading-none">Jogos de Hoje</h2>
                        <p className="text-adsplay font-black uppercase tracking-[0.3em] text-lg mt-2 capitalize">{today}</p>
                      </div>
                    </div>
                    <span className="text-lg font-black uppercase tracking-[0.3em] text-zinc-400">Copa FIFA 2026</span>
                  </div>

                  {loading ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-3xl font-bold">Carregando jogos de hoje...</div>
                  ) : matches.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <Calendar size={90} className="text-zinc-200" />
                      <p className="text-4xl font-black text-zinc-400">Nenhum jogo hoje</p>
                    </div>
                  ) : (
                    <div className={`flex-1 grid gap-5 relative z-10 min-h-0 ${matches.length > 4 ? 'grid-cols-2 content-start' : 'grid-cols-1'}`}>
                      {matches.slice(0, 8).map((m: any) => {
                        const isLive = liveNow(m);
                        const scored = wcGoal && wcGoal.id === m.id;
                        return (
                          <div key={m.id} className={`relative rounded-[2rem] px-8 py-6 flex items-center gap-6 border-2 shadow-sm transition-colors ${isLive ? 'bg-rose-50 border-rose-300' : 'bg-white border-zinc-200'}`}>
                            {scored && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.6, y: 6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                                className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 px-5 py-2 bg-emerald-500 text-white rounded-full text-lg font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30"
                                style={{ willChange: 'transform, opacity' }}
                              >
                                ⚽ Gol!
                              </motion.div>
                            )}
                            <div className="flex-1 flex items-center justify-end gap-4 min-w-0">
                              <span className={`text-3xl font-black truncate text-right ${scored && wcGoal!.side === 'home' ? 'text-emerald-600' : 'text-zinc-900'}`}>{(m.home || '').toUpperCase()}</span>
                              <TeamFlag code={m.homeCode} emoji={m.homeFlag} imgClass="w-20 h-14" emojiClass="text-6xl" />
                            </div>
                            <div className="flex flex-col items-center gap-2 shrink-0 min-w-[150px]">
                              {showScore(m) ? (
                                <span className="text-6xl font-black text-zinc-900">{m.homeScore} <span className="text-zinc-300">×</span> {m.awayScore}</span>
                              ) : (
                                <span className="text-4xl font-black text-zinc-300">×</span>
                              )}
                              {m.homePens != null && m.awayPens != null && (
                                <span className="text-sm font-black text-emerald-600">({m.homePens}-{m.awayPens} nos pênaltis)</span>
                              )}
                              {badge(m)}
                              <span className="text-sm font-black text-zinc-500">{m.time ? `${m.time} · Brasília` : 'Horário a definir'}</span>
                            </div>
                            <div className="flex-1 flex items-center gap-4 min-w-0">
                              <TeamFlag code={m.awayCode} emoji={m.awayFlag} imgClass="w-20 h-14" emojiClass="text-6xl" />
                              <span className={`text-3xl font-black truncate ${scored && wcGoal!.side === 'away' ? 'text-emerald-600' : 'text-zinc-900'}`}>{(m.away || '').toUpperCase()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* World Cup — knockout bracket */}
            {currentMedia.type === 'WC_BRACKET' && (() => {
              const rounds = wcBracket;
              const loading = wcMatches === null;
              const winner = (m: any) => {
                if (!m || m.homeScore == null || m.awayScore == null) return 0;
                if (m.homeScore > m.awayScore) return 1;
                if (m.awayScore > m.homeScore) return 2;
                if (m.homePens != null && m.awayPens != null) {
                  if (m.homePens > m.awayPens) return 1;
                  if (m.awayPens > m.homePens) return 2;
                }
                return 0;
              };
              const roundMatches = (order: number) => (rounds.find(r => knockoutOrder(r.name) === order)?.matches) || [];
              const splitSides = (arr: any[], count: number): [any[], any[]] => {
                const l = arr.slice(0, count); const r = arr.slice(count, count * 2);
                while (l.length < count) l.push(null);
                while (r.length < count) r.push(null);
                return [l, r];
              };
              const [r32L, r32R] = splitSides(roundMatches(1), 8);
              const [r16L, r16R] = splitSides(roundMatches(2), 4);
              const [qfL, qfR] = splitSides(roundMatches(3), 2);
              const [sfL, sfR] = splitSides(roundMatches(4), 1);
              const finalM = roundMatches(6)[0] || null;
              const thirdM = roundMatches(5)[0] || null;

              // Flags grow round by round: fewer teams left → more emphasis.
              const TIER: Record<string, { flag: string; score: string; size: string; pad: string; gap: string; min: string; foot: string }> = {
                r32:   { flag: 'w-8 h-6',   score: 'text-base', size: 'w80',  pad: 'px-2 py-1.5', gap: 'gap-1.5', min: 'min-h-[3rem]',    foot: 'text-[9px]' },
                r16:   { flag: 'w-11 h-8',  score: 'text-xl',   size: 'w160', pad: 'px-3 py-2',   gap: 'gap-2',   min: 'min-h-[3.5rem]',  foot: 'text-[10px]' },
                qf:    { flag: 'w-14 h-10', score: 'text-2xl',  size: 'w160', pad: 'px-4 py-3',   gap: 'gap-2.5', min: 'min-h-[4.5rem]',  foot: 'text-xs' },
                sf:    { flag: 'w-20 h-14', score: 'text-4xl',  size: 'w320', pad: 'px-5 py-4',   gap: 'gap-3',   min: 'min-h-[6rem]',    foot: 'text-sm' },
                final: { flag: 'w-28 h-20', score: 'text-6xl',  size: 'w320', pad: 'px-6 py-6',   gap: 'gap-4',   min: 'min-h-[8rem]',    foot: 'text-base' },
                third: { flag: 'w-14 h-10', score: 'text-2xl',  size: 'w160', pad: 'px-4 py-3',   gap: 'gap-2.5', min: 'min-h-[4.5rem]',  foot: 'text-xs' },
              };
              const box = (m: any, key: number, tier: string = 'r32') => {
                const t = TIER[tier] || TIER.r32;
                const emphasize = tier === 'sf' || tier === 'final';
                if (!m) return <div key={key} className={`rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 ${t.min}`} />;
                const w = winner(m);
                const when = `${fmtBrDate(m.date)}${m.time ? ` · ${m.time}` : ''}`.trim();
                return (
                  <div key={key} className={`rounded-xl border bg-white ${t.pad} flex flex-col ${t.gap} shadow-sm ${emphasize ? 'border-emerald-300 shadow-emerald-900/10' : 'border-zinc-200'}`}>
                    <div className={`flex items-center ${t.gap} ${w === 2 ? 'opacity-45' : ''}`}>
                      <TeamFlag code={m.homeCode} emoji={m.homeFlag} size={t.size} imgClass={t.flag} emojiClass={t.score} />
                      <span className={`${t.score} font-black ml-auto ${w === 1 ? 'text-emerald-600' : 'text-zinc-900'}`}>{m.homeScore ?? ''}{m.homePens != null ? ` (${m.homePens})` : ''}</span>
                    </div>
                    <div className="h-px bg-zinc-100" />
                    <div className={`flex items-center ${t.gap} ${w === 1 ? 'opacity-45' : ''}`}>
                      <TeamFlag code={m.awayCode} emoji={m.awayFlag} size={t.size} imgClass={t.flag} emojiClass={t.score} />
                      <span className={`${t.score} font-black ml-auto ${w === 2 ? 'text-emerald-600' : 'text-zinc-900'}`}>{m.awayScore ?? ''}{m.awayPens != null ? ` (${m.awayPens})` : ''}</span>
                    </div>
                    {when && m.status !== 'finished' && (
                      <div className={`text-center ${t.foot} font-bold text-zinc-400 pt-0.5`}>{when} · Brasília</div>
                    )}
                  </div>
                );
              };

              const col = (label: string, boxes: any[], k: string, tier: string = 'r32') => (
                <div key={k} className="flex-1 flex flex-col min-w-0">
                  <h4 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest text-center mb-3 truncate">{label}</h4>
                  <div className="flex-1 flex flex-col justify-around gap-1.5">
                    {boxes.map((m, i) => box(m, i, tier))}
                  </div>
                </div>
              );

              return (
                <div className="w-full h-full bg-gradient-to-b from-white to-zinc-100 flex flex-col p-10 gap-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-emerald-500 via-yellow-400 to-emerald-500" />
                  <div className="text-center relative z-10">
                    <h2 className="text-6xl font-black text-zinc-900 tracking-tighter leading-none">Caminho até a Final</h2>
                    <p className="text-emerald-600 font-black uppercase tracking-[0.3em] text-sm mt-2">Copa do Mundo FIFA 2026 · Mata-Mata</p>
                  </div>

                  {loading ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-2xl font-bold">Carregando chaveamento...</div>
                  ) : rounds.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <Trophy size={80} className="text-zinc-200" />
                      <p className="text-3xl font-black text-zinc-400">Mata-mata ainda não começou</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-stretch gap-3 relative z-10 min-h-0">
                      {col('2ª Fase', r32L, 'r32l', 'r32')}
                      {col('Oitavas', r16L, 'r16l', 'r16')}
                      {col('Quartas', qfL, 'qfl', 'qf')}
                      {col('Semifinais', sfL, 'sfl', 'sf')}
                      <div className="flex flex-col items-center justify-center gap-8 px-2 shrink-0" style={{ flexBasis: '260px' }}>
                        {(() => {
                          const fw = winner(finalM);
                          if (!finalM || fw === 0) {
                            return (
                              <div className="w-full text-center">
                                <h4 className="text-3xl font-black text-emerald-600 uppercase tracking-[0.2em] mb-3">Final</h4>
                                {box(finalM, 999, 'final')}
                              </div>
                            );
                          }
                          const champName = fw === 1 ? finalM.home : finalM.away;
                          const champCode = fw === 1 ? finalM.homeCode : finalM.awayCode;
                          return (
                            <div className="w-full text-center flex flex-col items-center gap-3">
                              <div className="text-5xl">🏆</div>
                              <h4 className="text-2xl font-black text-yellow-500 uppercase tracking-[0.25em]">Campeão do Mundo</h4>
                              <TeamFlag code={champCode} imgClass="w-40 h-28" emojiClass="text-8xl" />
                              <p className="text-4xl font-black text-zinc-900 tracking-tighter">{(champName || '').toUpperCase()}</p>
                              <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.3em]">FIFA 2026</p>
                            </div>
                          );
                        })()}
                        <div className="w-full text-center">
                          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Disputa do 3º Lugar</h4>
                          {box(thirdM, 998, 'third')}
                        </div>
                      </div>
                      {col('Semifinais', sfR, 'sfr', 'sf')}
                      {col('Quartas', qfR, 'qfr', 'qf')}
                      {col('Oitavas', r16R, 'r16r', 'r16')}
                      {col('2ª Fase', r32R, 'r32r', 'r32')}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* World Cup — ranking by titles (stars) */}
            {currentMedia.type === 'WC_RANKING' && (() => {
              const ranking = (Array.isArray(currentMedia.payload?.ranking) ? currentMedia.payload.ranking : [])
                .slice().sort((a: any, b: any) => (Number(b.titles) || 0) - (Number(a.titles) || 0));
              const maxT = ranking.reduce((m: number, r: any) => Math.max(m, Number(r.titles) || 0), 0);
              return (
                <div className="w-full h-full bg-gradient-to-b from-white to-zinc-100 flex flex-col items-center justify-center relative overflow-hidden" style={{ padding: '7vh 8vw' }}>
                  <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
                  <div className="w-full max-w-4xl flex flex-col gap-6 relative z-10 min-h-0">
                    <div className="flex items-center gap-4 justify-center text-center">
                      <div className="w-14 h-14 bg-yellow-400/15 rounded-2xl flex items-center justify-center text-yellow-500 shrink-0"><Trophy size={28} /></div>
                      <div>
                        <h2 className="text-5xl font-black text-zinc-900 tracking-tighter leading-none">Maiores Campeões</h2>
                        <p className="text-amber-600 font-black uppercase tracking-[0.3em] text-xs mt-1.5">Copa do Mundo FIFA · Títulos por Seleção</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {ranking.length === 0 ? (
                        <div className="py-16 text-center text-zinc-400 text-2xl font-bold">Nenhuma seleção cadastrada</div>
                      ) : ranking.slice(0, 8).map((r: any, i: number) => {
                        const titles = Number(r.titles) || 0;
                        const top = titles === maxT;
                        return (
                          <div key={i} className={`rounded-2xl px-6 py-3 flex items-center gap-5 border shadow-sm ${top ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-zinc-200'}`}>
                            <span className={`text-2xl font-black w-9 text-center shrink-0 ${top ? 'text-amber-500' : 'text-zinc-300'}`}>{i + 1}</span>
                            <TeamFlag code={r.code} emoji={r.flag} imgClass="w-14 h-10" emojiClass="text-4xl" />
                            <span className="text-3xl font-black text-zinc-900 flex-1 truncate">{r.team}</span>
                            <span className="text-xl tracking-tight shrink-0 whitespace-nowrap hidden md:inline">{'⭐'.repeat(Math.min(titles, 6))}</span>
                            <span className="text-2xl font-black text-zinc-900 w-32 text-right shrink-0">{titles} {titles === 1 ? 'título' : 'títulos'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Unknown Media Type Fallback */}
            {!['IMAGE_HERO', 'VIDEO_FILE', 'YOUTUBE', 'DASHBOARD', 'INSTAGRAM', 'CAROUSEL', 'NEWS_CLIPPING', 'MONTHLY_GOAL', 'WEATHER', 'NORTH_STAR', 'WEBSITE_EMBED', 'FINAL_SPRINT', 'SMART_SALES', 'WC_BRAZIL', 'WC_TODAY', 'WC_BRACKET', 'WC_RANKING'].includes(currentMedia.type) && (
              <div className="w-full h-full flex flex-col items-center justify-center text-white bg-zinc-900">
                <p className="text-2xl font-bold">Tipo de mídia desconhecido</p>
                <p className="text-zinc-500">{currentMedia.type}</p>
              </div>
            )}

            {/* Overlay Info (Legacy - Hidden by Top Bar but kept for safety if needed) */}
            <div className="absolute top-10 right-10 flex items-center gap-4 opacity-0 pointer-events-none">
              <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-white uppercase tracking-widest">{deviceName}</span>
              </div>
              {!isOnline && (
                <div className="px-4 py-2 bg-rose-500 text-white rounded-2xl flex items-center gap-2 font-bold text-xs">
                  <WifiOff size={16} /> OFFLINE
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar - Moved outside AnimatePresence for smoother transitions */}
      {playlist && playlist.items[currentIndex] && status === 'PLAYING' && (
        <ProgressBar 
          duration={playlist.items[currentIndex].duration * 1000} 
          currentIndex={currentIndex}
          onNext={handleNext}
        />
      )}

      {/* Connectivity Alert */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 z-50"
          >
            <AlertCircle size={24} />
            <div>
              <p className="font-bold">Conexão Perdida</p>
              <p className="text-xs opacity-80">Tentando reconectar automaticamente...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Admin Back Button & Global Weather */}
      <div className={`absolute top-8 left-8 z-50 flex items-center gap-4 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        <Link 
          to="/admin" 
          className="bg-white/10 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold hover:bg-white/20 transition-all shadow-lg"
        >
          <ArrowLeft size={16} /> Voltar ao Painel
        </Link>

        {globalWeather && (
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full shadow-lg">
            <div className="text-adsplay">
              {globalWeather.condition?.toLowerCase().includes('chuva') ? <CloudRain size={18} /> :
               globalWeather.condition?.toLowerCase().includes('nublado') ? <Cloud size={18} /> :
               globalWeather.condition?.toLowerCase().includes('tempestade') ? <CloudLightning size={18} /> :
               <Sun size={18} />}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-black text-sm">{globalWeather.currentTemp}°C</span>
              <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest">{globalWeather.city?.split(',')[0]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
