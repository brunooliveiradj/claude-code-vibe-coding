import { Monitor, PlaySquare, Calendar, AlertCircle, CheckCircle2, Clock, Tv, ExternalLink, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface Stats {
  devices: number;
  playlists: number;
  online: number;
}

interface Device {
  id: string;
  name: string;
  is_paired: boolean;
  last_ping: any;
}

export function Dashboard() {
  const { isAdmin, isContentManager, profile } = useAuth();
  const [statsData, setStatsData] = useState<Stats>({ devices: 0, playlists: 0, online: 0 });
  const [devices, setDevices] = useState<Device[]>([]);

  const fetchDashboardData = async () => {
    try {
      const [devicesSnap, playlistsSnap] = await Promise.all([
        getDocs(collection(db, 'devices')),
        getDocs(collection(db, 'playlists'))
      ]);

      const devicesList = devicesSnap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()) as Device);
      
      setStatsData({
        devices: devicesSnap.size,
        playlists: playlistsSnap.size,
        online: devicesList.filter(d => d.is_paired).length
      });

      setDevices(devicesList.slice(0, 5));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'dashboard');
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = [
    { label: 'TVs Cadastradas', value: statsData.devices.toString(), icon: Monitor, color: 'text-adsplay', bg: 'bg-adsplay/10', show: isAdmin },
    { label: 'Playlists Ativas', value: statsData.playlists.toString(), icon: PlaySquare, color: 'text-adsplay-dark', bg: 'bg-adsplay-dark/10', show: isContentManager },
    { label: 'TVs Online', value: statsData.online.toString(), icon: Tv, color: 'text-adsplay-light', bg: 'bg-adsplay-light/10', show: isAdmin },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Dashboard</h2>
          <p className="text-zinc-500 font-medium">Bem-vindo de volta, <span className="text-adsplay font-bold">{profile?.displayName || 'Usuário'}</span>.</p>
        </div>
        <div className="bg-zinc-100 px-4 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] text-zinc-400 uppercase">
          Acesso: {profile?.role?.replace('_', ' ')}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.filter(s => s.show).map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-zinc-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Status das TVs */}
        {isAdmin ? (
          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Status das TVs</h3>
              <Link to="/devices" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">Ver todas</Link>
            </div>
            <div className="divide-y divide-zinc-100">
              {devices.map((device) => (
                <div key={device.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${device.is_paired ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <div>
                      <p className="font-semibold text-sm">{device.name}</p>
                      <p className="text-xs text-zinc-500">{device.is_paired ? 'Pareado' : 'Aguardando Pareamento'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-zinc-400 flex items-center gap-1 justify-end">
                      <Clock size={12} /> {device.last_ping?.toDate ? device.last_ping.toDate().toLocaleTimeString() : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="bg-adsplay/5 rounded-2xl border border-adsplay/10 p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-adsplay text-white rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-adsplay/20">
              <PlaySquare size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-xl text-zinc-900 tracking-tight">Gestão de Conteúdo Ativa</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">Você tem permissão total para gerenciar mídias, playlists e a agenda de transmissão da Adsplay.</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Link to="/media" className="bg-white text-adsplay px-4 py-2 rounded-lg text-xs font-bold border border-zinc-200 hover:bg-zinc-50 transition-colors">Gerenciar Mídias</Link>
              <Link to="/playlists" className="bg-adsplay text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-adsplay-dark transition-colors shadow-lg shadow-adsplay/20">Ver Playlists</Link>
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
}
