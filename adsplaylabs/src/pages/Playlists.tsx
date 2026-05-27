import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Play, 
  Trash2, 
  Edit2, 
  GripVertical, 
  Clock, 
  Image as ImageIcon, 
  Youtube, 
  Layout, 
  ChevronRight,
  Save,
  X,
  Instagram,
  Layers,
  BarChart3
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Company } from '../types';

interface Media {
  id: string;
  title: string;
  type: string;
  company?: Company;
  payload: any;
}

interface PlaylistItem {
  id: string;
  media_id: string;
  duration: number;
}

interface Playlist {
  id: string;
  name: string;
  company: Company;
  logoUrl?: string;
  items: PlaylistItem[];
}

export function Playlists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCompany, setFilterCompany] = useState<Company | 'Todos'>('Todos');
  const [mediaFilterCompany, setMediaFilterCompany] = useState<Company | 'Todos'>('Todos');

  const fetchData = async () => {
    try {
      const [plSnapshot, mSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'playlists'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'media'), orderBy('createdAt', 'desc')))
      ]);
      
      setPlaylists(plSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist)));
      setMediaList(mSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Media)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'playlists');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingPlaylist({ id: '', name: 'Nova Playlist', company: 'Geral', logoUrl: '', items: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (playlist: Playlist) => {
    const cloned = JSON.parse(JSON.stringify(playlist)) as Playlist;
    // Ensure all items have a unique ID for React keys and reordering
    cloned.items = (cloned.items || []).map(item => ({
      ...item,
      id: item.id || Math.random().toString(36).substring(2, 9) + Date.now()
    }));
    setEditingPlaylist(cloned);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'playlists', id));
      setDeleteConfirmId(null);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `playlists/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingPlaylist) return;
    setLoading(true);
    try {
      const data = Object.assign({}, editingPlaylist);
      const id = data.id;
      delete data.id;
      
      if (id) {
        await updateDoc(doc(db, 'playlists', id), Object.assign({}, data, {
          updatedAt: serverTimestamp()
        }));
      } else {
        await addDoc(collection(db, 'playlists'), Object.assign({}, data, {
          createdAt: serverTimestamp()
        }));
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, editingPlaylist.id ? OperationType.UPDATE : OperationType.CREATE, 'playlists');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (mediaId: string) => {
    if (!editingPlaylist) return;
    const newItem: PlaylistItem = { 
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      media_id: mediaId, 
      duration: 30 
    };
    setEditingPlaylist(Object.assign({}, editingPlaylist, {
      items: (editingPlaylist.items || []).concat([newItem])
    }));
  };

  const removeItem = (index: number) => {
    if (!editingPlaylist) return;
    const newItems = (editingPlaylist.items || []).slice();
    newItems.splice(index, 1);
    setEditingPlaylist(Object.assign({}, editingPlaylist, { items: newItems }));
  };

  const updateDuration = (index: number, duration: number) => {
    if (!editingPlaylist) return;
    const newItems = (editingPlaylist.items || []).slice();
    newItems[index].duration = duration;
    setEditingPlaylist(Object.assign({}, editingPlaylist, { items: newItems }));
  };

  const updatePosition = (currentIndex: number, newPosition: number) => {
    if (!editingPlaylist) return;
    const items = (editingPlaylist.items || []).slice();
    const targetIndex = newPosition - 1;

    if (targetIndex < 0 || targetIndex >= items.length || targetIndex === currentIndex) return;

    // Swap items
    const temp = items[currentIndex];
    items[currentIndex] = items[targetIndex];
    items[targetIndex] = temp;

    setEditingPlaylist(Object.assign({}, editingPlaylist, { items }));
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'IMAGE_HERO': return <ImageIcon size={14} />;
      case 'VIDEO_FILE': return <Play size={14} />;
      case 'YOUTUBE': return <Youtube size={14} />;
      case 'DASHBOARD': return <Layout size={14} />;
      case 'INSTAGRAM': return <Instagram size={14} />;
      case 'CAROUSEL': return <Layers size={14} />;
      case 'MONTHLY_GOAL': return <BarChart3 size={14} />;
      default: return <Play size={14} />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Playlists</h2>
          <p className="text-zinc-500 font-medium">Crie sequências de mídias para rodar nas TVs da Adsplay.</p>
          
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
        <button 
          onClick={handleCreate}
          className="bg-adsplay text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-adsplay-dark transition-all shadow-lg shadow-adsplay/20"
        >
          <Plus size={18} /> Nova Playlist
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists
          .filter(pl => filterCompany === 'Todos' || pl.company === filterCompany)
          .map((pl) => (
          <motion.div 
            key={pl.id}
            className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-6 hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-zinc-900">{pl.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                    pl.company === 'Adsplay' ? 'bg-purple-100 text-purple-600' :
                    pl.company === 'Mootag' ? 'bg-blue-100 text-blue-600' :
                    'bg-zinc-100 text-zinc-500'
                  }`}>
                    {pl.company || 'Geral'}
                  </span>
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  {pl.items.length} Itens • {pl.items.reduce((acc, curr) => acc + curr.duration, 0)}s Total
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(pl)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => setDeleteConfirmId(pl.id)} className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {pl.items.slice(0, 3).map((item, idx) => {
                const media = mediaList.find(m => m.id === item.media_id);
                return (
                  <div key={item.id || idx} className="flex items-center gap-3 text-sm text-zinc-600 bg-zinc-50 p-2 rounded-lg">
                    <div className="text-zinc-400">{getMediaIcon(media?.type || '')}</div>
                    <span className="flex-1 truncate font-medium">{media?.title || 'Mídia removida'}</span>
                    <span className="text-[10px] font-bold text-zinc-400">{item.duration}s</span>
                  </div>
                );
              })}
              {pl.items.length > 3 && (
                <p className="text-[10px] text-center font-bold text-zinc-400 uppercase tracking-widest pt-1">
                  + {pl.items.length - 3} itens adicionais
                </p>
              )}
            </div>

            <button 
              onClick={() => handleEdit(pl)}
              className="w-full py-3 bg-zinc-50 text-zinc-900 rounded-xl font-bold text-sm hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
            >
              Gerenciar Sequência <ChevronRight size={16} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Excluir Playlist?</h3>
                <p className="text-zinc-500 text-sm">Esta ação não pode ser desfeita. A playlist será removida de todos os dispositivos.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={loading}
                  className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Playlist Editor Modal */}
      <AnimatePresence>
        {isModalOpen && editingPlaylist && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-5xl h-[80vh] overflow-hidden shadow-2xl flex"
            >
              {/* Left: Sequence Editor */}
              <div className="flex-1 flex flex-col border-r border-zinc-100">
                <div className="p-6 border-b border-zinc-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1 flex flex-col gap-2">
                      <input 
                        value={editingPlaylist.name}
                        onChange={(e) => setEditingPlaylist({ ...editingPlaylist, name: e.target.value })}
                        className="text-2xl font-bold text-zinc-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                        placeholder="Nome da Playlist"
                      />
                      <div className="flex gap-2">
                        {(['Adsplay', 'Mootag', 'Geral'] as Company[]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingPlaylist({ ...editingPlaylist, company: c })}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                              editingPlaylist.company === c 
                                ? 'bg-zinc-900 border-zinc-900 text-white' 
                                : 'bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-200'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-center overflow-hidden">
                      {editingPlaylist.logoUrl ? (
                        <img src={editingPlaylist.logoUrl} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="" />
                      ) : (
                        <ImageIcon size={20} className="text-zinc-300" />
                      )}
                    </div>
                    <input 
                      value={editingPlaylist.logoUrl || ''}
                      onChange={(e) => setEditingPlaylist({ ...editingPlaylist, logoUrl: e.target.value })}
                      className="flex-1 text-sm text-zinc-500 bg-zinc-50 px-4 py-2 rounded-xl border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                      placeholder="URL do Logo da Empresa (Opcional)"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {editingPlaylist.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center">
                        <Play size={32} />
                      </div>
                      <p className="font-medium">Sua playlist está vazia. Adicione mídias ao lado.</p>
                    </div>
                  ) : (
                    editingPlaylist.items.map((item, idx) => {
                      const media = mediaList.find(m => m.id === item.media_id);
                      return (
                        <motion.div 
                          layout
                          key={item.id || `item-${idx}`}
                          className="flex items-center gap-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 group"
                        >
                          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-200">
                            <span className="text-[10px] font-black text-zinc-400 uppercase">Pos</span>
                            <input 
                              type="number" 
                              value={idx + 1}
                              min={1}
                              max={editingPlaylist.items.length}
                              onChange={(e) => updatePosition(idx, parseInt(e.target.value) || 1)}
                              className="w-8 text-sm font-bold text-zinc-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-center"
                            />
                          </div>
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-zinc-400 shadow-sm">
                            {getMediaIcon(media?.type || '')}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-zinc-900">{media?.title || 'Mídia removida'}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{media?.type}</p>
                          </div>
                          <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-zinc-200">
                            <Clock size={14} className="text-zinc-400" />
                            <input 
                              type="number" 
                              value={Number(item.duration) || 0}
                              onChange={(e) => updateDuration(idx, parseInt(e.target.value) || 0)}
                              className="w-12 text-sm font-bold text-zinc-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                            />
                            <span className="text-xs font-bold text-zinc-400">s</span>
                          </div>
                          <button 
                            onClick={() => removeItem(idx)}
                            className="p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <div className="p-6 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                    Total: {editingPlaylist.items.reduce((acc, curr) => acc + curr.duration, 0)}s
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="bg-zinc-900 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50"
                  >
                    <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Playlist'}
                  </button>
                </div>
              </div>

              {/* Right: Media Library Picker */}
              <div className="w-80 bg-zinc-50/50 flex flex-col">
                <div className="p-6 border-b border-zinc-100 space-y-4">
                  <div>
                    <h4 className="font-bold text-zinc-900">Biblioteca</h4>
                    <p className="text-xs text-zinc-500">Clique para adicionar à playlist</p>
                  </div>
                  
                  <div className="flex gap-1">
                    {(['Todos', 'Adsplay', 'Mootag'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setMediaFilterCompany(c)}
                        className={`flex-1 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all ${
                          mediaFilterCompany === c 
                            ? 'bg-zinc-900 text-white' 
                            : 'bg-white text-zinc-400 border border-zinc-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {mediaList
                    .filter(m => mediaFilterCompany === 'Todos' || m.company === mediaFilterCompany)
                    .map((media) => (
                    <button
                      key={media.id}
                      onClick={() => addItem(media.id)}
                      className="w-full text-left bg-white p-3 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                          {getMediaIcon(media.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-bold text-zinc-900 truncate">{media.title}</p>
                            <span className={`text-[6px] font-black uppercase px-1 rounded-full ${
                              media.company === 'Adsplay' ? 'text-purple-500' :
                              media.company === 'Mootag' ? 'text-blue-500' :
                              'text-zinc-400'
                            }`}>
                              {media.company?.charAt(0)}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{media.type.split('_')[0]}</p>
                        </div>
                        <Plus size={14} className="text-zinc-300 group-hover:text-zinc-900" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
