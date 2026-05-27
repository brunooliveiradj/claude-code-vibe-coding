import React, { useState, useEffect, useRef } from 'react';
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
  QrCode,
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
  Globe
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  getDoc
} from 'firebase/firestore';

interface Media {
  id: string;
  title: string;
  type: 'IMAGE_HERO' | 'VIDEO_FILE' | 'YOUTUBE' | 'DASHBOARD' | 'INSTAGRAM' | 'MONTHLY_GOAL' | 'CAROUSEL' | 'NEWS_CLIPPING' | 'NORTH_STAR' | 'WEATHER' | 'WEBSITE_EMBED';
  payload: any;
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
  
  const [isPaired, setIsPaired] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(urlDeviceId || safeStorage.get('labs365_device_id'));
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
  const [error, setError] = useState<string | null>(null);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [newsItems, setNewsItems] = useState<any[]>([]);

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

  // 2. Pairing Logic & Device Sync
  useEffect(() => {
    if (!deviceId) {
      // Generate a new temporary pair code
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setPairCode(code);
      return;
    }

    // Listen to device document
    const unsubscribe = onSnapshot(doc(db, 'devices', deviceId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsPaired(data.is_paired);
        setDeviceName(data.name);
      } else if (!urlDeviceId) {
        // Device removed from DB and not a forced URL preview
        safeStorage.remove('labs365_device_id');
        setDeviceId(null);
        setIsPaired(false);
      }
    }, (err) => {
      console.error('Firestore error:', err);
      if (urlDeviceId) {
        setError('Dispositivo não encontrado ou sem permissão.');
      }
    });

    // Ping interval (every 30 seconds to save writes)
    const pingInterval = setInterval(() => {
      if (deviceId && !urlDeviceId && isOnline) {
        updateDoc(doc(db, 'devices', deviceId), {
          last_ping: serverTimestamp()
        }).catch(err => console.error('Ping error:', err));
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(pingInterval);
    };
  }, [deviceId, urlDeviceId, isOnline]);

  // 3. Polling for Pairing (if not paired)
  useEffect(() => {
    if (isPaired || deviceId) return;

    const interval = setInterval(async () => {
      try {
        const q = query(collection(db, 'devices'), where('pair_code', '==', pairCode), where('is_paired', '==', true));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const id = doc.id;
          setDeviceId(id);
          safeStorage.set('labs365_device_id', id);
        }
      } catch (err) {
        console.error('Pairing poll error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaired, deviceId, pairCode]);

  // 4. Fetch Schedule & Playlist
  useEffect(() => {
    // Load schedule if paired OR if no device ID is provided (Public Mode)
    if (!isPaired && deviceId) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Listen to schedule for today
    const unsubscribe = onSnapshot(doc(db, 'schedule', today), async (docSnap) => {
      if (docSnap.exists()) {
        const playlistId = docSnap.data().playlistId;
        if (playlistId) {
          const plSnap = await getDoc(doc(db, 'playlists', playlistId));
          if (plSnap.exists()) {
            setPlaylist(Object.assign({ id: plSnap.id }, plSnap.data()) as Playlist);
            setCurrentIndex(0);
            setStatus('PLAYING');
            return;
          }
        }
      }
      // No schedule or playlist found
      setPlaylist(null);
      setStatus('IDLE');
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `schedule/${today}`);
    });

    return () => unsubscribe();
  }, [isPaired]);

  // 5. Playback Loop
  const handleNext = React.useCallback(() => {
    if (!playlist) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
  }, [playlist]);

  // 6. Media Resolver (Real-time media fetch)
  const [currentMedia, setCurrentMedia] = useState<Media | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (currentMedia?.type === 'NEWS_CLIPPING') {
      fetchNews(currentMedia);
    } else if (currentMedia?.type === 'WEATHER') {
      fetchWeather(currentMedia);
    } else {
      setNewsItems([]);
    }
  }, [currentMedia?.id]);

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

  if (!isPaired && status !== 'PLAYING') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="flex items-center gap-4 text-adsplay">
              <Tv size={48} />
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-[0.3em]">Adsplay TV</span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Soluções para ir além</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-6xl font-black text-white leading-tight tracking-tighter">
                Vincular <br /> esta TV
              </h1>
              <p className="text-zinc-400 text-xl leading-relaxed">
                Abra o painel administrativo no seu celular ou computador e insira o código ao lado.
              </p>
            </div>

            <div className="flex items-center gap-6 p-6 bg-zinc-900/50 rounded-3xl border border-zinc-800">
              <div className={`w-3 h-3 rounded-full animate-pulse ${isOnline ? 'bg-adsplay' : 'bg-rose-500'}`} />
              <div className="flex-1">
                <p className="text-white font-bold">{isOnline ? 'Conectado à Internet' : 'Sem Conexão'}</p>
                <p className="text-zinc-500 text-sm">{isOnline ? 'Aguardando pareamento...' : 'Verifique sua rede'}</p>
              </div>
              {isOnline && <Loader2 className="text-zinc-700 animate-spin" size={24} />}
            </div>
          </div>

          <div className="flex flex-col items-center gap-8">
            <div className="bg-white p-12 rounded-[3rem] shadow-2xl shadow-adsplay/10 flex flex-col items-center gap-6">
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Código de Acesso</p>
                <div className="text-8xl font-black text-zinc-950 tracking-tighter">
                  {pairCode}
                </div>
              </div>
              
              <div className="w-full h-px bg-zinc-100" />
              
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <QRCodeSVG 
                    value={window.location.origin} 
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <QrCode size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Escanear para Painel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

            {currentMedia.type === 'NORTH_STAR' && (
              <div className="w-full h-full bg-[#050505] flex items-center justify-center p-24 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-[80vw] h-[80vw] bg-adsplay/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-purple-500/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/4" />

                <div className="w-full max-w-7xl space-y-20 relative z-10">
                  <div className="text-center space-y-6">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-adsplay/20 rounded-2xl flex items-center justify-center text-adsplay">
                        <TrendingUp size={32} />
                      </div>
                      <span className="text-2xl font-black uppercase tracking-[0.5em] text-adsplay">North Star Metric</span>
                    </div>
                    <h2 className="text-9xl font-black text-white tracking-tighter leading-none">
                      Meta de {currentMedia.payload.currentYear || new Date().getFullYear()}<span className="text-adsplay">.</span>
                    </h2>
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-4xl text-white font-bold tracking-widest uppercase">
                        {currentMedia.payload.currentYearGoal || 200} campanhas ativas este ano
                      </p>
                      <p className="text-xl text-zinc-500 font-bold tracking-[0.3em] uppercase border-t border-white/10 pt-4">
                        Objetivo North Star: {currentMedia.payload.targetGoal || 1000} campanhas até {currentMedia.payload.targetYear || 2030}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 items-center">
                    {/* Adsplay Card */}
                    <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 space-y-4 text-center backdrop-blur-xl">
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-lg">Adsplay</p>
                      <div className="text-7xl font-black text-white tracking-tighter">
                        <Counter value={Number(currentMedia.payload.adsplay) || 0} />
                      </div>
                      <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Campanhas Ativas</p>
                    </div>

                    {/* Pixel Card */}
                    <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 space-y-4 text-center backdrop-blur-xl">
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-lg">Pixel</p>
                      <div className="text-7xl font-black text-white tracking-tighter">
                        <Counter value={Number(currentMedia.payload.pixel) || 0} />
                      </div>
                      <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Campanhas Ativas</p>
                    </div>

                    {/* Trigger Card */}
                    <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 space-y-4 text-center backdrop-blur-xl">
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-lg">Trigger</p>
                      <div className="text-7xl font-black text-white tracking-tighter">
                        <Counter value={Number(currentMedia.payload.trigger) || 0} />
                      </div>
                      <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Campanhas Ativas</p>
                    </div>

                    {/* AdsMax Card */}
                    <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 space-y-4 text-center backdrop-blur-xl">
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-lg">AdsMax</p>
                      <div className="text-7xl font-black text-white tracking-tighter">
                        <Counter value={Number(currentMedia.payload.adsmax) || 0} />
                      </div>
                      <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">Campanhas Ativas</p>
                    </div>

                    {/* Total Center Piece */}
                    <div className="relative flex flex-col items-center justify-center py-8 col-span-2 lg:col-span-1">
                      <div className="absolute inset-0 bg-adsplay/20 blur-[80px] rounded-full animate-pulse" />
                      <div className="relative space-y-2 text-center">
                        <p className="text-adsplay font-black uppercase tracking-[0.4em] text-xl">Total Geral</p>
                        <div className="text-[10rem] font-black text-white leading-none tracking-tighter">
                          {(() => {
                            const sum = (Number(currentMedia.payload.adsplay) || 0) + 
                                        (Number(currentMedia.payload.pixel) || 0) + 
                                        (Number(currentMedia.payload.trigger) || 0) + 
                                        (Number(currentMedia.payload.adsmax) || 0);
                            return <Counter value={sum} />;
                          })()}
                        </div>
                        <div className="flex items-center justify-center gap-4">
                          <div className="h-1 w-16 bg-zinc-800 rounded-full" />
                          <span className="text-zinc-400 font-black text-3xl tracking-tighter">/ {Number(currentMedia.payload.currentYearGoal) || 200}</span>
                          <div className="h-1 w-16 bg-zinc-800 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bars */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Current Year Progress */}
                    {(() => {
                      const sum = (Number(currentMedia.payload.adsplay) || 0) + 
                                  (Number(currentMedia.payload.pixel) || 0) + 
                                  (Number(currentMedia.payload.trigger) || 0) + 
                                  (Number(currentMedia.payload.adsmax) || 0);
                      const goal = Number(currentMedia.payload.currentYearGoal) || 200;
                      const rawYearPercentage = Math.round((sum / goal) * 100);
                      const yearPercentage = isNaN(rawYearPercentage) ? 0 : rawYearPercentage;
                      
                      return (
                        <div className="space-y-6">
                          <div className="flex justify-between items-end px-4">
                            <div className="space-y-1">
                              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">Progresso {currentMedia.payload.currentYear || new Date().getFullYear()}</p>
                              <p className="text-4xl font-black text-white">
                                <Counter value={yearPercentage} />%
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">Faltam para Meta {currentMedia.payload.currentYear || new Date().getFullYear()}</p>
                              <p className="text-4xl font-black text-adsplay">
                                <Counter value={Math.max(0, goal - sum)} />
                              </p>
                            </div>
                          </div>
                          <div className="h-6 w-full bg-zinc-900 rounded-full p-1.5 border border-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, yearPercentage)}%` }}
                              transition={{ duration: 2, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-adsplay to-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* North Star Progress */}
                    {(() => {
                      const sum = (Number(currentMedia.payload.adsplay) || 0) + 
                                  (Number(currentMedia.payload.pixel) || 0) + 
                                  (Number(currentMedia.payload.trigger) || 0) + 
                                  (Number(currentMedia.payload.adsmax) || 0);
                      const target = Number(currentMedia.payload.targetGoal) || 1000;
                      const rawNorthStarPercentage = Math.round((sum / target) * 100);
                      const nsPercentage = isNaN(rawNorthStarPercentage) ? 0 : rawNorthStarPercentage;

                      return (
                        <div className="space-y-6">
                          <div className="flex justify-between items-end px-4">
                            <div className="space-y-1">
                              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">Progresso North Star</p>
                              <p className="text-4xl font-black text-white">
                                <Counter value={nsPercentage} />%
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-zinc-500 font-black uppercase tracking-widest text-sm">Faltam para {currentMedia.payload.targetYear || 2030}</p>
                              <p className="text-4xl font-black text-purple-500">
                                <Counter value={Math.max(0, target - sum)} />
                              </p>
                            </div>
                          </div>
                          <div className="h-6 w-full bg-zinc-900 rounded-full p-1.5 border border-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, nsPercentage)}%` }}
                              transition={{ duration: 2, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-purple-600 to-adsplay rounded-full shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

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

            {/* Unknown Media Type Fallback */}
            {!['IMAGE_HERO', 'VIDEO_FILE', 'YOUTUBE', 'DASHBOARD', 'INSTAGRAM', 'CAROUSEL', 'NEWS_CLIPPING', 'MONTHLY_GOAL', 'WEATHER', 'NORTH_STAR'].includes(currentMedia.type) && (
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
