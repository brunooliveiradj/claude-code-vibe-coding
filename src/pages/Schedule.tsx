import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Check, 
  Zap,
  MoreHorizontal
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, setDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { Company } from '../types';

interface Playlist {
  id: string;
  name: string;
  company?: Company;
}

interface ScheduleData {
  [date: string]: string; // date -> playlistId
}

export function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterCompany, setFilterCompany] = useState<Company | 'Todos'>('Todos');

  // Bulk Edit State
  const [bulkPlaylist, setBulkPlaylist] = useState('');
  const [bulkDays, setBulkDays] = useState<string[]>([]);

  const fetchPlaylists = async () => {
    try {
      const q = query(collection(db, 'playlists'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      setPlaylists(querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name,
        company: doc.data().company || 'Geral'
      })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'playlists');
    }
  };

  const fetchSchedule = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'schedule'));
      const data: ScheduleData = {};
      querySnapshot.docs.forEach(doc => {
        data[doc.id] = doc.data().playlistId;
      });
      setSchedule(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'schedule');
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchSchedule();
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const assignPlaylist = async (date: string, playlistId: string) => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'schedule', date), { playlistId });
      fetchSchedule();
      setSelectedDate(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schedule/${date}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 3, 0);
      
      const promises = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (bulkDays.includes(dayName)) {
          const dateStr = d.toISOString().split('T')[0];
          promises.push(setDoc(doc(db, 'schedule', dateStr), { playlistId: bulkPlaylist }));
        }
      }
      await Promise.all(promises);
      
      fetchSchedule();
      setIsBulkOpen(false);
      setBulkDays([]);
      setBulkPlaylist('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedule/bulk');
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 border-r border-b border-zinc-100 bg-zinc-50/30" />);
    }

    // Days of the month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const playlistId = schedule[dateStr];
      const playlist = playlists.find(p => p.id === playlistId);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr)}
          className={`h-32 border-r border-b border-zinc-100 p-3 transition-all cursor-pointer hover:bg-zinc-50 group relative ${selectedDate === dateStr ? 'bg-zinc-50 ring-2 ring-inset ring-adsplay z-10' : 'bg-white'}`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-bold ${isToday ? 'bg-adsplay text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg shadow-adsplay/20' : 'text-zinc-400'}`}>
              {d}
            </span>
          </div>
          
          <div className="mt-2 space-y-1">
            {playlist ? (
              (filterCompany === 'Todos' || playlist.company === filterCompany) ? (
                <div className={`text-[10px] font-black uppercase tracking-widest p-1.5 rounded-lg border flex items-center gap-1.5 transition-all shadow-sm ${
                  playlist.company === 'Adsplay' 
                    ? 'bg-purple-600 border-purple-700 text-white' 
                    : playlist.company === 'Mootag'
                    ? 'bg-blue-600 border-blue-700 text-white'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    playlist.company === 'Adsplay' || playlist.company === 'Mootag' ? 'bg-white' : 'bg-zinc-400'
                  }`} />
                  <span className="truncate">{playlist.name}</span>
                </div>
              ) : null
            ) : (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1">
                  <Plus size={10} /> Agendar
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Agenda</h2>
          <p className="text-zinc-500 font-medium">Programação de conteúdo das TVs Adsplay.</p>
          
          <div className="flex gap-2 mt-4">
            {(['Todos', 'Adsplay', 'Mootag', 'Geral'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCompany(c)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterCompany === c 
                    ? 'bg-zinc-900 text-white shadow-lg' 
                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsBulkOpen(true)}
            className="bg-white border border-zinc-200 text-adsplay px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Zap size={18} /> Programação em Lote
          </button>
          <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-50 border-r border-zinc-200 text-zinc-500"><ChevronLeft size={20} /></button>
            <div className="px-4 py-2 font-bold text-zinc-900 min-w-[160px] text-center flex items-center justify-center gap-2">
              <CalendarIcon size={16} className="text-zinc-400" />
              {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-50 border-l border-zinc-200 text-zinc-500"><ChevronRight size={20} /></button>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {renderCalendar()}
        </div>
      </div>

      {/* Day Selector Modal */}
      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold tracking-tight">Agendar Playlist</h3>
                  <p className="text-zinc-500 font-medium">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Escolha a Playlist</label>
                  <div className="space-y-2">
                    {playlists.map(p => (
                      <button
                        key={p.id}
                        onClick={() => assignPlaylist(selectedDate, p.id)}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${
                          schedule[selectedDate] === p.id 
                            ? 'border-zinc-900 bg-zinc-900 text-white' 
                            : 'border-zinc-100 hover:border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                            p.company === 'Adsplay' ? 'bg-purple-500' :
                            p.company === 'Mootag' ? 'bg-blue-500' :
                            'bg-zinc-400'
                          }`} />
                          <div className="flex flex-col">
                            <span className="font-bold">{p.name}</span>
                            <span className={`text-[8px] font-black uppercase tracking-tighter ${
                              schedule[selectedDate] === p.id ? 'text-white/70' : 'text-zinc-400'
                            }`}>{p.company}</span>
                          </div>
                        </div>
                        {schedule[selectedDate] === p.id && <Check size={18} />}
                      </button>
                    ))}
                    <button
                      onClick={() => assignPlaylist(selectedDate, '')}
                      className="w-full p-4 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400 font-bold text-sm hover:border-zinc-300 hover:text-zinc-500 transition-all"
                    >
                      Remover Agendamento
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedDate(null)}
                  className="w-full py-3 text-zinc-400 font-bold text-sm hover:text-zinc-600 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {isBulkOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-8">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Edição em Lote</h3>
                  <p className="text-zinc-500">Defina regras recorrentes para os próximos 3 meses.</p>
                </div>

                <form onSubmit={handleBulkSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Dias da Semana</label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setBulkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                          className={`px-4 py-2 rounded-xl border-2 font-bold text-xs transition-all ${
                            bulkDays.includes(day) ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-100 text-zinc-400 hover:border-zinc-200'
                          }`}
                        >
                          {day.slice(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Playlist</label>
                    <div className="grid grid-cols-2 gap-3">
                      {playlists.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setBulkPlaylist(p.id)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            bulkPlaylist === p.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                          }`}
                        >
                          <span className="text-xs font-bold block mb-1 opacity-50 uppercase">Playlist</span>
                          <span className="font-bold">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsBulkOpen(false)}
                      className="flex-1 px-4 py-3 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading || !bulkPlaylist || bulkDays.length === 0}
                      className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
                    >
                      {loading ? 'Aplicando...' : 'Aplicar Regras'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
