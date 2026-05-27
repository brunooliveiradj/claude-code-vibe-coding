import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Plus, Search, MoreVertical, RefreshCw, Tv, Trash2, ExternalLink, Copy, QrCode, X, CheckCircle2, Edit2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface Device {
  id: string;
  name: string;
  pair_code: string;
  is_paired: boolean;
  last_ping: any;
}

export function Devices() {
  const { isAdmin } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<{ id: string, name: string } | null>(null);
  const [editName, setEditName] = useState('');

  const fetchDevices = async () => {
    try {
      const q = query(collection(db, 'devices'), orderBy('last_ping', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
      setDevices(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'devices');
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // In a real app, we'd check if the code exists and is pending.
      // For this demo, we'll just create a new device with that code.
      await addDoc(collection(db, 'devices'), {
        name: newDeviceName,
        pair_code: pairCode,
        is_paired: true,
        last_ping: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      setIsModalOpen(false);
      setNewDeviceName('');
      setPairCode('');
      fetchDevices();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'devices');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'devices', id));
      setDeleteConfirmId(null);
      fetchDevices();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `devices/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'devices', editingDevice.id), {
        name: editName,
        updatedAt: serverTimestamp()
      });
      setEditingDevice(null);
      fetchDevices();
      setToast('Nome atualizado!');
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `devices/${editingDevice.id}`);
    } finally {
      setLoading(false);
    }
  };

  const copyGlobalLink = () => {
    const link = `${window.location.origin}/player`;
    navigator.clipboard.writeText(link);
    setToast('Link global copiado!');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Dispositivos</h2>
          <p className="text-zinc-500 font-medium">Gerencie as TVs da Adsplay conectadas ao sistema.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={copyGlobalLink}
            className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-zinc-200 transition-all"
          >
            <Copy size={18} /> Copiar Link Global
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-adsplay text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-adsplay-dark transition-all shadow-lg shadow-adsplay/20"
          >
            <Plus size={18} /> Novo Dispositivo
          </button>
        </div>
      </header>

      <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight">Link Único de Visualização</h3>
          <p className="text-indigo-700/70 text-sm font-medium">Use este link em qualquer Smart TV ou navegador para iniciar o player.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 pl-6 rounded-2xl border border-indigo-200 w-full md:w-auto">
          <code className="text-indigo-600 font-bold text-sm truncate max-w-[200px] md:max-w-xs">
            {window.location.origin}/player
          </code>
          <button 
            onClick={copyGlobalLink}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Copy size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar TV..." 
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
            />
          </div>
          <button onClick={fetchDevices} className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Dispositivo</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Link do Player</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Último Ping</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                        <Tv size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900">{device.name}</p>
                          <button 
                            onClick={() => {
                              setEditingDevice({ id: device.id, name: device.name });
                              setEditName(device.name);
                            }}
                            className="p-1 text-zinc-400 hover:text-adsplay opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500">ID: {device.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${device.is_paired ? 'bg-adsplay' : 'bg-rose-500'}`} />
                      <span className="text-sm font-medium text-zinc-700">
                        {device.is_paired ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <a 
                        href={`${window.location.origin}/player?id=${device.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <ExternalLink size={12} /> Abrir Player
                      </a>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/player?id=${device.id}`);
                          setToast('Link copiado!');
                          setTimeout(() => setToast(null), 3000);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                        title="Copiar Link"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {device.last_ping?.toDate ? device.last_ping.toDate().toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && (
                        <button 
                          onClick={() => setDeleteConfirmId(device.id)}
                          className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                <h3 className="text-xl font-bold">Excluir Dispositivo?</h3>
                <p className="text-zinc-500 text-sm">Esta ação não pode ser desfeita. O dispositivo perderá a conexão com o sistema.</p>
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

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {editingDevice && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">Renomear Player</h3>
                  <p className="text-zinc-500 text-sm">Altere o nome de identificação deste dispositivo.</p>
                </div>

                <form onSubmit={handleRename} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Novo Nome</label>
                    <input 
                      required
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                    />
                  </div>
                  
                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setEditingDevice(null)}
                      className="flex-1 px-4 py-3 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pairing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-md overflow-hidden shadow-2xl"
          >
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Vincular Nova TV</h3>
                <p className="text-zinc-500 text-sm">
                  1. Abra o <a href="/player" target="_blank" className="text-indigo-600 font-bold hover:underline">Link do Player</a> em sua TV ou navegador.<br />
                  2. Insira o código de 4 dígitos que aparecerá na tela.
                </p>
              </div>

              <form onSubmit={handlePair} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome do Local</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Recepção" 
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Código de 4 Dígitos</label>
                  <input 
                    required
                    type="text" 
                    maxLength={4}
                    placeholder="0000" 
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                  />
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Vinculando...' : 'Vincular'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
