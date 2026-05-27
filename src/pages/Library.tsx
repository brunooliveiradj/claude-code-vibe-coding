import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, Search, Filter, Loader2, Image as ImageIcon, Video, FileText, CheckCircle2, AlertCircle, HardDrive, Download, ExternalLink } from 'lucide-react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';

interface LibraryItem {
  id: string;
  name: string;
  url: string;
  path: string;
  type: 'image' | 'video';
  size: number;
  createdAt: any;
  uploadedBy: string;
}

export function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryItem));
      setItems(data);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    if (!auth.currentUser) {
      setError('Você precisa estar logado para fazer upload.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const files: any[] = Array.from(fileList);

    try {
      for (let i = 0; i < files.length; i++) {
        let file: any = files[i];
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) continue;

        if (isImage) {
          try {
            setUploadStatus(`Otimizando "${file.name}"...`);
            // Use web worker if possible, it's usually faster
            file = await imageCompression(file, {
              maxSizeMB: 0.8,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
              initialQuality: 0.8,
            });
          } catch (compressErr) {
            console.error('Compression failed, using original:', compressErr);
          }
        }

        setUploadStatus(`Enviando "${file.name}"...`);
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `library/${auth.currentUser.uid}/${fileName}`;
        const storageRef = ref(storage, filePath);
        
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const fileProgress = snapshot.totalBytes > 0 
                ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 
                : 0;
              
              const overallProgress = ((i / files.length) * 100) + (fileProgress / files.length);
              setUploadProgress(Math.round(overallProgress));
            }, 
            (error) => {
              console.error('Upload task error:', error);
              // Check for specific Firebase error codes
              if (error.code === 'storage/unauthorized') {
                reject(new Error('Sem permissão para salvar no Storage. Verifique se seu perfil tem permissão de administrador.'));
              } else {
                reject(new Error(`Erro no arquivo ${file.name}: ${error.message}`));
              }
            }, 
            async () => {
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                const meta = await getMetadata(uploadTask.snapshot.ref);

                await addDoc(collection(db, 'library'), {
                  name: files[i].name,
                  url,
                  path: filePath,
                  type: isImage ? 'image' : 'video',
                  size: meta.size,
                  createdAt: serverTimestamp(),
                  uploadedBy: auth.currentUser?.uid
                });
                resolve();
              } catch (err: any) {
                console.error('Firestore save error:', err);
                reject(new Error(`Mídia enviada, mas erro ao salvar no banco: ${err.message}`));
              }
            }
          );
        });
      }
      setUploadProgress(100);
      setUploadStatus('Finalizado!');
      setTimeout(() => {
        fetchItems();
        setUploading(false);
        setUploadStatus(null);
        setUploadProgress(0);
      }, 1000);
    } catch (err: any) {
      console.error('Complete upload error:', err);
      setError(err.message || 'Erro ao processar uploads.');
      setUploading(false);
      setUploadStatus(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${item.name}"?`)) return;

    setLoading(true);
    try {
      // 1. Delete from Storage
      const storageRef = ref(storage, item.path);
      await deleteObject(storageRef);

      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'library', item.id));
      
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err: any) {
      console.error('Delete error:', err);
      setError('Erro ao excluir arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items
    .filter(item => filter === 'all' || item.type === filter)
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900 flex items-center gap-3">
            <HardDrive className="text-adsplay" size={36} />
            Biblioteca Digital
          </h2>
          <p className="text-zinc-500 font-medium">Banco de dados de imagens e vídeos otimizados para Tizen TVs.</p>
        </div>

        <label className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg cursor-pointer ${
          uploading ? 'bg-zinc-800 text-white shadow-zinc-800/10' : 'bg-adsplay text-white shadow-adsplay/20 hover:bg-adsplay-dark'
        }`}>
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
          <div className="flex flex-col items-start leading-none">
            <span className="text-sm">{uploading ? (uploadStatus || 'Enviando...') : 'Fazer Upload'}</span>
            {uploading && (
              <span className="text-[10px] opacity-70 mt-1">{Math.round(uploadProgress)}% concluído</span>
            )}
          </div>
          <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </header>

      <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar arquivos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-adsplay/10 transition-all font-medium"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'image', 'video'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  filter === f 
                    ? 'bg-zinc-900 text-white shadow-lg' 
                    : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                }`}
              >
                {f === 'all' ? 'Tudo' : f === 'image' ? 'Imagens' : 'Vídeos'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-zinc-50 rounded-2xl overflow-hidden aspect-square border border-zinc-100 hover:border-adsplay/30 transition-all"
              >
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.name} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/10 text-zinc-400">
                    <Video size={32} />
                    <span className="text-[10px] font-bold mt-1">VÍDEO</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <div className="flex justify-end">
                    <button 
                      onClick={() => handleOptions(item)}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                      title="Copiar Link"
                      onClickCapture={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(item.url);
                        alert('Link copiado!');
                      }}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white truncate" title={item.name}>{item.name}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{formatSize(item.size)}</span>
                      <button 
                        onClick={() => handleDelete(item)}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-white rounded-lg transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {!loading && filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                <HardDrive size={32} />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-zinc-900">Nenhum arquivo encontrado</p>
                <p className="text-sm text-zinc-500">Faça upload de novas mídias para começar.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600"
        >
          <AlertCircle size={20} />
          <p className="text-sm font-bold">{error}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

function handleOptions(item: any) {
  // Logic handled in-line for now
}
