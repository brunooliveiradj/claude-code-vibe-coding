import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Image as ImageIcon, Video, Youtube, Layout, Trash2, Edit2, Instagram, Upload, Loader2, BarChart3, AlertCircle, Layers, X as XIcon, Newspaper, CloudSun, Star, MapPin, TrendingUp, Globe, HardDrive, CheckCircle2, Zap, Trophy, Flag, Calendar } from 'lucide-react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, getMetadata } from 'firebase/storage';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Company } from '../types';
import { GoogleGenAI } from "@google/genai";
import { parseBaseImport, parseLooseJson, fetchWcPendingUpdates, fetchBrazilCampaign, matchDocId, matchupKey, WCMatch } from '../lib/worldcup';
import imageCompression from 'browser-image-compression';

type MediaType = 'IMAGE_HERO' | 'VIDEO_FILE' | 'YOUTUBE' | 'DASHBOARD' | 'INSTAGRAM' | 'MONTHLY_GOAL' | 'CAROUSEL' | 'NEWS_CLIPPING' | 'WEATHER' | 'NORTH_STAR' | 'WEBSITE_EMBED' | 'FINAL_SPRINT' | 'SMART_SALES' | 'WC_BRAZIL' | 'WC_TODAY' | 'WC_BRACKET';

interface Media {
  id: string;
  title: string;
  type: MediaType;
  company: Company;
  payload: any;
}

export function Media() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [type, setType] = useState<MediaType>('IMAGE_HERO');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState<Company>('Geral');
  const [payload, setPayload] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [carouselUrl, setCarouselUrl] = useState('');
  const [filterCompany, setFilterCompany] = useState<Company | 'Todos'>('Todos');

  const [isSyncingWeather, setIsSyncingWeather] = useState(false);
  const [isSyncingNews, setIsSyncingNews] = useState<number | null>(null);
  // World Cup — shared match collection management
  const [wcMatches, setWcMatches] = useState<WCMatch[]>([]);
  const [wcImportText, setWcImportText] = useState('');
  const [wcBusy, setWcBusy] = useState<string | null>(null); // 'load' | 'import' | 'sync' | 'save'
  const [wcMsg, setWcMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryTarget, setLibraryTarget] = useState<'single' | 'carousel' | 'playlist_logo'>('single');

  const optimizeImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return file;
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
    };
    try {
      setUploadStatus(`Otimizando "${file.name}"...`);
      return await imageCompression(file, options);
    } catch (e) {
      console.error('Compression error:', e);
      return file;
    }
  };

  const fetchLibrary = async () => {
    try {
      const q = query(collection(db, 'library'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setLibraryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Library fetch error:', err);
    }
  };

  const handleLibrarySelect = (item: any) => {
    if (libraryTarget === 'single') {
      setPayload({ ...payload, url: item.url });
    } else if (libraryTarget === 'carousel') {
      const img = { url: item.url, id: `${Date.now()}-${Math.random().toString(36).substring(2)}` };
      setPayload({ ...payload, images: [...(payload.images || []), img] });
    } else if (libraryTarget === 'playlist_logo') {
      // Logic for playlist logo if integrated elsewhere
    }
    setIsLibraryOpen(false);
  };

  const syncNewsMetadata = async (index: number, url: string) => {
    if (!url) return;
    setIsSyncingNews(index);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Extraia o título da notícia, o nome do veículo/fonte e a URL da imagem de destaque desta matéria: ${url}. 
      Retorne APENAS um JSON no seguinte formato:
      {
        "title": "Título da Notícia",
        "source": "Nome do Veículo",
        "imageUrl": "URL da Imagem de Destaque"
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
        const metadata = JSON.parse(response.text);
        const newList = [...(payload.newsItems || [])];
        newList[index] = { ...newList[index], ...metadata };
        setPayload({ ...payload, newsItems: newList });
      }
    } catch (err) {
      console.error('News sync error:', err);
      setError('Erro ao buscar metadados da notícia.');
    } finally {
      setIsSyncingNews(null);
    }
  };

  const syncWeather = async (cityOverride?: string) => {
    const cityToSync = cityOverride || payload.city;
    if (!cityToSync) {
      setError('Digite o nome de uma cidade para sincronizar.');
      return;
    }

    setIsSyncingWeather(true);
    setError(null);

    try {
      const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Consulte o clima ATUAL em tempo real para a cidade de ${cityToSync} agora (hoje: ${now}). 
      É CRITICAL que você use a busca do Google para encontrar a temperatura EXATA deste momento.
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
        setPayload({ 
          ...payload, 
          ...weatherData,
          lastSync: new Date().toISOString(),
          lastWeatherUpdate: Date.now()
        });
      }
    } catch (err: any) {
      console.error('Weather sync error:', err);
      setError('Erro ao sincronizar clima. Tente novamente.');
    } finally {
      setIsSyncingWeather(false);
    }
  };

  // Pull fresh World Cup data via IA into the form for review/editing (hybrid).
  // --- World Cup: shared `wc_matches` collection (single source of truth) ----
  const wcDocData = (m: WCMatch) => {
    const data: any = {
      date: m.date || '', time: m.time || '', stage: m.stage || '',
      home: m.home, away: m.away, homeCode: m.homeCode || '', awayCode: m.awayCode || '',
      homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
      homePens: m.homePens ?? null, awayPens: m.awayPens ?? null,
      status: m.status || 'scheduled', updatedAt: serverTimestamp(),
    };
    // Only write bracket order when known, so IA merges don't wipe it.
    if (typeof m.order === 'number' && !isNaN(m.order)) data.order = m.order;
    return data;
  };

  const loadWcMatches = async () => {
    setWcBusy('load');
    try {
      const snap = await getDocs(collection(db, 'wc_matches'));
      const list = snap.docs.map(d => Object.assign({ id: d.id }, d.data()) as WCMatch);
      list.sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
      setWcMatches(list);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'wc_matches');
    } finally {
      setWcBusy(null);
    }
  };

  // Import/upsert base results (played games are fixed data). Idempotent by id.
  const importWcBase = async () => {
    setWcMsg(null);
    if (!parseLooseJson(wcImportText)) {
      setWcMsg({ ok: false, text: 'JSON malformado (erro de sintaxe). Verifique se colou o texto completo.' });
      return;
    }
    const parsed = parseBaseImport(wcImportText);
    if (parsed.length === 0) {
      setWcMsg({ ok: false, text: 'JSON lido, mas nenhum jogo reconhecido. O array precisa ter jogos com "equipe_casa"/"equipe_visitante".' });
      return;
    }
    setWcBusy('import');
    try {
      await Promise.all(parsed.map(m => setDoc(doc(db, 'wc_matches', m.id!), wcDocData(m), { merge: true })));
      setWcImportText('');
      await loadWcMatches();
      setWcMsg({ ok: true, text: `✅ ${parsed.length} jogo(s) importado(s) com sucesso.` });
    } catch (e: any) {
      console.error('WC import error:', e);
      setWcMsg({ ok: false, text: `Erro ao gravar no banco: ${e?.message || 'verifique permissões (regras do Firestore)'}` });
    } finally {
      setWcBusy(null);
    }
  };

  // IA updates ONLY pending/future games; never rewrites a finished result.
  const syncWcPending = async () => {
    const pending = wcMatches.filter(m => m.status !== 'finished');
    setWcBusy('sync');
    setWcMsg(null);
    try {
      const updates = await fetchWcPendingUpdates(pending);
      if (updates.length === 0) { setWcMsg({ ok: false, text: 'A IA não retornou atualizações. Tente novamente.' }); }
      let applied = 0;
      await Promise.all(updates.map(u => {
        const existing = wcMatches.find(m => matchupKey(m) === matchupKey(u));
        if (existing && existing.status === 'finished') return Promise.resolve(); // never rewrite finished
        applied++;
        const id = existing?.id || u.id || matchDocId(u);
        return setDoc(doc(db, 'wc_matches', id), wcDocData({
          ...u,
          order: u.order ?? existing?.order,
          date: u.date || existing?.date, time: u.time || existing?.time, stage: u.stage || existing?.stage,
          homeCode: u.homeCode || existing?.homeCode, awayCode: u.awayCode || existing?.awayCode,
        }), { merge: true });
      }));
      await loadWcMatches();
      if (updates.length > 0) setWcMsg({ ok: true, text: `✅ ${applied} jogo(s) pendente(s) atualizado(s) pela IA.` });
    } catch (e: any) {
      console.error('WC pending sync error:', e);
      setWcMsg({ ok: false, text: `Erro ao sincronizar pendentes: ${e?.message || 'tente novamente'}` });
    } finally {
      setWcBusy(null);
    }
  };

  // One-click: fetch Brazil's full campaign via IA and upsert it, so the
  // trajectory is complete even if the imported base was missing games.
  const syncBrazil = async () => {
    setWcBusy('brazil');
    setWcMsg(null);
    try {
      const games = await fetchBrazilCampaign();
      if (games.length === 0) { setWcMsg({ ok: false, text: 'A IA não retornou jogos do Brasil. Tente novamente.' }); return; }
      await Promise.all(games.map(m => {
        const existing = wcMatches.find(x => matchupKey(x) === matchupKey(m));
        const id = existing?.id || m.id!;
        return setDoc(doc(db, 'wc_matches', id), wcDocData({ ...m, order: m.order ?? existing?.order }), { merge: true });
      }));
      await loadWcMatches();
      setWcMsg({ ok: true, text: `✅ Trajetória do Brasil sincronizada (${games.length} jogo(s)).` });
    } catch (e: any) {
      console.error('Brazil sync error:', e);
      setWcMsg({ ok: false, text: `Erro ao sincronizar Brasil: ${e?.message || 'tente novamente'}` });
    } finally {
      setWcBusy(null);
    }
  };

  const updateWcRow = (id: string, patch: Partial<WCMatch>) => {
    setWcMatches(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  };

  const saveWcRow = async (m: WCMatch) => {
    setWcBusy('save');
    try {
      await setDoc(doc(db, 'wc_matches', m.id!), wcDocData(m), { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `wc_matches/${m.id}`);
    } finally {
      setWcBusy(null);
    }
  };

  const deleteWcRow = async (id: string) => {
    setWcBusy('save');
    try {
      await deleteDoc(doc(db, 'wc_matches', id));
      await loadWcMatches();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `wc_matches/${id}`);
    } finally {
      setWcBusy(null);
    }
  };

  // Wipe the whole shared collection so you can reimport a clean, single base
  // (avoids duplicates left by earlier imports with different name spellings).
  const clearWcBase = async () => {
    if (!window.confirm('Apagar TODOS os jogos da base da Copa? A coleção será limpa e você poderá reimportar em seguida.')) return;
    setWcBusy('clear');
    setWcMsg(null);
    try {
      const snap = await getDocs(collection(db, 'wc_matches'));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'wc_matches', d.id))));
      await loadWcMatches();
      setWcMsg({ ok: true, text: '🧹 Base limpa. Agora cole o JSON definitivo e clique em Importar.' });
    } catch (e: any) {
      console.error('WC clear error:', e);
      setWcMsg({ ok: false, text: `Erro ao limpar a base: ${e?.message || 'tente novamente'}` });
    } finally {
      setWcBusy(null);
    }
  };

  const fetchMedia = async () => {
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Media));
      setMediaList(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'media');
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  // Load the shared World Cup matches whenever a WC card is being edited.
  useEffect(() => {
    if (isModalOpen && (type === 'WC_BRAZIL' || type === 'WC_TODAY' || type === 'WC_BRACKET')) {
      loadWcMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, type]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      setError('Você precisa estar logado para fazer upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await optimizeImage(file);
      }
      
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `media/${fileName}`);
      
      setUploadStatus(`Enviando "${file.name}"...`);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error('Upload expirou. Verifique sua conexão ou as permissões do Firebase Storage.'));
        }, 60000);

        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
            setUploadProgress(Math.round(progress));
          },
          (err: any) => {
            clearTimeout(timeout);
            console.error('Upload error:', err.code, err.message);
            if (err.code === 'storage/unauthorized') {
              reject(new Error('Sem permissão. Verifique as Storage Rules no Firebase Console.'));
            } else if (err.code === 'storage/canceled') {
              reject(new Error('Upload cancelado por timeout. Tente novamente.'));
            } else {
              reject(new Error(`Erro no upload: ${err.code || err.message}`));
            }
          },
          async () => {
            clearTimeout(timeout);
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              const meta = await getMetadata(uploadTask.snapshot.ref);

              await addDoc(collection(db, 'library'), {
                name: file.name,
                url,
                path: `media/${fileName}`,
                type: file.type.startsWith('image/') ? 'image' : 'video',
                size: meta.size,
                createdAt: serverTimestamp(),
                uploadedBy: auth.currentUser?.uid
              });

              setPayload(prev => ({ ...prev, url }));
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        );
      });
      
      setError(null);
    } catch (error: any) {
      console.error('Upload error details:', error);
      setError(error.message || 'Erro no upload.');
    } finally {
      setUploading(false);
      setUploadStatus(null);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (!auth.currentUser) {
      setError('Você precisa estar logado para fazer upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    const files = Array.from(fileList);

    try {
      const uploadedImages = [];
      
      for (let i = 0; i < files.length; i++) {
        let file: any = files[i];
        if (file.type.startsWith('image/')) {
          file = await optimizeImage(file);
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}_${i}.${fileExt}`;
        const storageRef = ref(storage, `media/carousel/${fileName}`);
        
        setUploadStatus(`Enviando "${file.name}"...`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error(`Upload de "${file.name}" expirou. Verifique as Storage Rules no Firebase Console.`));
          }, 60000);

          uploadTask.on('state_changed',
            (snapshot) => {
              const fileProgress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 : 0;
              const overallProgress = ((i / files.length) * 100) + (fileProgress / files.length);
              setUploadProgress(Math.round(overallProgress));
            },
            (err: any) => {
              clearTimeout(timeout);
              console.error('Upload error:', err.code, err.message);
              if (err.code === 'storage/unauthorized') {
                reject(new Error(`Sem permissão para "${file.name}". Verifique as Storage Rules no Firebase Console.`));
              } else {
                reject(new Error(`Erro no upload de "${file.name}": ${err.code || err.message}`));
              }
            },
            async () => {
              clearTimeout(timeout);
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                const meta = await getMetadata(uploadTask.snapshot.ref);

                await addDoc(collection(db, 'library'), {
                  name: file.name,
                  url,
                  path: `media/carousel/${fileName}`,
                  type: 'image',
                  size: meta.size,
                  createdAt: serverTimestamp(),
                  uploadedBy: auth.currentUser?.uid
                });

                uploadedImages.push({ url, id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2)}` });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      }
      
      setPayload(prev => ({ ...prev, images: (prev.images || []).concat(uploadedImages) }));
      setError(null);
    } catch (error: any) {
      console.error('Multiple upload error:', error);
      setError(error.message || 'Erro no upload múltiplo.');
    } finally {
      setUploading(false);
      setUploadStatus(null);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    let finalPayload = Object.assign({}, payload);
    if (type === 'YOUTUBE' && finalPayload.url) {
      finalPayload.videoId = extractYoutubeId(finalPayload.url);
    }
    if (type === 'MONTHLY_GOAL' && !finalPayload.year) {
      finalPayload.year = new Date().getFullYear();
    }
    if (type === 'MONTHLY_GOAL' && !finalPayload.months) {
      finalPayload.months = [];
    }
    if (type === 'CAROUSEL' && !finalPayload.images) {
      finalPayload.images = [];
    }

    if (type === 'NEWS_CLIPPING' && (!finalPayload.newsItems || finalPayload.newsItems.length === 0)) {
      setError('Adicione pelo menos uma notícia para o Clipping.');
      setLoading(false);
      return;
    }

    if (type === 'WEBSITE_EMBED' && (!finalPayload.url || !finalPayload.screenshotUrl)) {
      setError('Insira uma URL e capture o print do site antes de salvar.');
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'media', editingId), {
          title,
          type,
          company,
          payload: finalPayload,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'media'), {
          title,
          type,
          company,
          payload: finalPayload,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchMedia();
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Erro ao salvar mídia. Verifique sua conexão.');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'media');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'media', id));
      setDeleteConfirmId(null);
      fetchMedia();
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Erro ao excluir mídia.');
      handleFirestoreError(error, OperationType.DELETE, `media/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (media: Media) => {
    setEditingId(media.id);
    setTitle(media.title);
    setType(media.type);
    setCompany(media.company || 'Geral');
    setPayload(media.payload);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCompany('Geral');
    setType('IMAGE_HERO');
    setPayload({});
    setCarouselUrl('');
  };

  const getIcon = (type: MediaType) => {
    switch (type) {
      case 'IMAGE_HERO': return <ImageIcon size={20} />;
      case 'VIDEO_FILE': return <Video size={20} />;
      case 'YOUTUBE': return <Youtube size={20} />;
      case 'DASHBOARD': return <Layout size={20} />;
      case 'INSTAGRAM': return <Instagram size={20} />;
      case 'MONTHLY_GOAL': return <BarChart3 size={20} />;
      case 'CAROUSEL': return <Layers size={20} />;
      case 'NEWS_CLIPPING': return <Newspaper size={20} />;
      case 'WEATHER': return <CloudSun size={20} />;
      case 'NORTH_STAR': return <Star size={20} />;
      case 'WEBSITE_EMBED': return <Globe size={20} />;
      case 'FINAL_SPRINT': return <Zap size={20} />;
      case 'SMART_SALES': return <Trophy size={20} />;
      case 'WC_BRAZIL': return <Flag size={20} />;
      case 'WC_TODAY': return <Calendar size={20} />;
      case 'WC_BRACKET': return <Trophy size={20} />;
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
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Biblioteca de Mídias</h2>
          <p className="text-zinc-500 font-medium">Crie e gerencie os blocos de conteúdo para as TVs da Adsplay.</p>
          
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
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-adsplay text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-adsplay-dark transition-all shadow-lg shadow-adsplay/20"
        >
          <Plus size={18} /> Nova Mídia
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mediaList
          .filter(item => filterCompany === 'Todos' || item.company === filterCompany)
          .map((item) => (
          <motion.div 
            key={item.id}
            layoutId={item.id}
            className="bg-white rounded-2xl border border-zinc-200 overflow-hidden group hover:shadow-xl transition-all"
          >
            <div className="aspect-video bg-zinc-100 relative overflow-hidden">
              {item.type === 'IMAGE_HERO' && (
                <img 
                  src={item.payload.url} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  alt=""
                />
              )}
              {item.type === 'YOUTUBE' && (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <Youtube size={48} className="text-white/20" />
                </div>
              )}
              {item.type === 'DASHBOARD' && (
                <div className="w-full h-full flex items-center justify-center bg-zinc-50">
                  <Layout size={48} className="text-zinc-200" />
                </div>
              )}
              {item.type === 'INSTAGRAM' && (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
                  <Instagram size={48} className="text-white/50" />
                </div>
              )}
              {item.type === 'NEWS_CLIPPING' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 space-y-3 text-center">
                  <Newspaper size={32} className="text-adsplay" />
                  <div>
                    <p className="text-xs font-bold text-white">Na Mídia</p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                      {(item.payload.keywords || []).length} keywords 
                      {(item.payload.manualNews || []).length > 0 && ` • ${(item.payload.manualNews || []).length} manuais`}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {(item.payload.keywords || []).slice(0, 3).map((kw: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[8px] font-bold rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {item.type === 'MONTHLY_GOAL' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 space-y-3">
                  <BarChart3 size={32} className="text-adsplay" />
                  <div className="text-center">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ano {item.payload.year}</p>
                    <p className="text-xs font-bold text-white">{(item.payload.months || []).length} meses registrados</p>
                    {item.payload.showOnlyPercentage && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-adsplay/20 text-adsplay text-[8px] font-black uppercase tracking-widest rounded-full">
                        Apenas %
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 items-end h-12">
                    {(item.payload.months || []).slice(-6).map((m: any, i: number) => {
                      const isHit = m.current >= m.target;
                      return (
                        <div 
                          key={i} 
                          className={`w-2 rounded-full transition-all ${isHit ? 'bg-emerald-500' : 'bg-adsplay'}`} 
                          style={{ height: `${Math.max(4, Math.min(48, (m.current / m.target) * 40))}px` }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              {item.type === 'CAROUSEL' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 space-y-2">
                  <Layers size={32} className="text-indigo-500" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-white">{(item.payload.images || []).length} Imagens</p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Carrossel de Eventos</p>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {(item.payload.images || []).slice(0, 3).map((img: any, i: number) => (
                      <img 
                        key={i}
                        src={img.url}
                        className="inline-block h-8 w-8 rounded-full ring-2 ring-zinc-900 object-cover"
                        alt=""
                      />
                    ))}
                    {(item.payload.images || []).length > 3 && (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-[10px] font-bold text-white">
                        +{(item.payload.images || []).length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {item.type === 'WEATHER' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 space-y-3 text-center">
                  <CloudSun size={32} className="text-adsplay" />
                  <div>
                    <p className="text-xs font-bold text-white">{item.payload.city || 'Cidade'}</p>
                    <p className="text-[24px] font-black text-white mt-1">
                      {item.payload.currentTemp || 0}°C
                    </p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      {item.payload.condition || 'Condição'}
                    </p>
                  </div>
                </div>
              )}
              {item.type === 'NORTH_STAR' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 space-y-3 text-center">
                  <Star size={32} className="text-yellow-400" />
                  <div>
                    <p className="text-xs font-bold text-white">North Star Metric</p>
                    <p className="text-[24px] font-black text-white mt-1">
                      {((item.payload.adsplay || 0) + (item.payload.pixel || 0) + (item.payload.trigger || 0) + (item.payload.adsmax || 0))} / 1000
                    </p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      Campanhas Ativas
                    </p>
                  </div>
                </div>
              )}
              {item.type === 'WEBSITE_EMBED' && (
                <div className="w-full h-full relative group">
                  <img
                    src={item.payload.screenshotUrl}
                    className="w-full h-full object-cover"
                    alt={item.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4 text-center">
                    <Globe size={32} className="text-adsplay mb-2" />
                    <p className="text-xs font-bold text-white truncate w-full">{item.payload.url}</p>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Website Embed</p>
                  </div>
                </div>
              )}
              {item.type === 'FINAL_SPRINT' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 space-y-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-violet-900/20 blur-[60px] rounded-full" />
                  <motion.span
                    animate={{ y: [0, -6, 0], rotate: [-8, 8, -8] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl relative z-10"
                    style={{ filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.8))' }}
                  >
                    🦙
                  </motion.span>
                  {(() => {
                    const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    const remaining = Math.max(0, (item.payload.target || 100) - (item.payload.current || 0));
                    const pct = Math.min(100, Math.round(((item.payload.current || 0) / (item.payload.target || 1)) * 100));
                    return (
                      <>
                        <div className="text-center relative z-10">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sprint Final</p>
                          <p className="text-lg font-black text-white mt-1 leading-tight">{fmt(remaining)}</p>
                          <p className="text-[9px] font-bold text-zinc-500">{item.payload.label || 'vendas'} faltam</p>
                        </div>
                        <div className="w-full relative z-10 space-y-1">
                          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-adsplay to-violet-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-center">
                            {fmt(item.payload.current || 0)} / {fmt(item.payload.target || 0)}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              {item.type === 'SMART_SALES' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 space-y-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-emerald-900/20 blur-[60px] rounded-full" />
                  <Trophy size={36} className="text-emerald-400 relative z-10" style={{ filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.7))' }} />
                  <div className="text-center relative z-10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Smart Media</p>
                    <p className="text-base font-black text-white mt-0.5">Vendas em tempo real</p>
                    <p className="text-[9px] font-bold text-zinc-500 mt-1">
                      {(item.payload.scope || 'latest') === 'month' ? 'Mês atual' : 'Últimas 5'} · entradadecampanha@
                    </p>
                  </div>
                </div>
              )}
              {item.type === 'WC_BRAZIL' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#00401f] to-[#0a0a0a] p-6 space-y-2 text-center">
                  <span className="text-4xl">🇧🇷</span>
                  <p className="text-sm font-black text-white leading-tight">Seleção Brasileira</p>
                  <p className="text-[9px] font-bold text-yellow-400 uppercase tracking-widest">Trajetória + próximo jogo</p>
                </div>
              )}
              {item.type === 'WC_TODAY' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0f2c] to-[#050505] p-6 space-y-2 text-center">
                  <Calendar size={32} className="text-adsplay" />
                  <p className="text-sm font-black text-white leading-tight">Jogos de Hoje</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Copa 2026</p>
                </div>
              )}
              {item.type === 'WC_BRACKET' && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1a0a2e] to-[#050505] p-6 space-y-2 text-center">
                  <Trophy size={32} className="text-yellow-400" />
                  <p className="text-sm font-black text-white leading-tight">Mata-Mata</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Chaveamento · Copa 2026</p>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white p-2 rounded-lg">
                {getIcon(item.type)}
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-zinc-900 line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-1">{item.type}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                  item.company === 'Adsplay' ? 'bg-purple-100 text-purple-600' :
                  item.company === 'Mootag' ? 'bg-blue-100 text-blue-600' :
                  'bg-zinc-100 text-zinc-500'
                }`}>
                  {item.company || 'Geral'}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => handleEdit(item)}
                  className="flex-1 bg-zinc-50 text-zinc-600 py-2 rounded-lg text-sm font-bold hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 size={14} /> Editar
                </button>
                <button 
                  onClick={() => setDeleteConfirmId(item.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
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
                <h3 className="text-xl font-bold">Excluir Mídia?</h3>
                <p className="text-zinc-500 text-sm">Esta ação não pode ser desfeita. A mídia será removida de todas as playlists.</p>
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

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
              <Plus size={18} className="rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                <div className="p-8 pb-4 border-b border-zinc-100 shrink-0">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight">{editingId ? 'Editar Mídia' : 'Nova Mídia'}</h3>
                    <p className="text-zinc-500">Escolha o tipo de conteúdo e configure os detalhes.</p>
                  </div>
                </div>

                <div className="p-8 pt-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                  <div className="grid grid-cols-10 gap-2">
                    {(['IMAGE_HERO', 'VIDEO_FILE', 'YOUTUBE', 'DASHBOARD', 'INSTAGRAM', 'MONTHLY_GOAL', 'CAROUSEL', 'NEWS_CLIPPING', 'WEATHER', 'NORTH_STAR', 'WEBSITE_EMBED', 'FINAL_SPRINT', 'SMART_SALES', 'WC_BRAZIL', 'WC_TODAY', 'WC_BRACKET'] as MediaType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t);
                          setCarouselUrl('');
                          if (t === 'MONTHLY_GOAL' && !payload.months) {
                            setPayload({ ...payload, year: new Date().getFullYear(), months: [] });
                          }
                          if (t === 'CAROUSEL' && !payload.images) {
                            setPayload({ ...payload, images: [] });
                          }
                          if (t === 'NEWS_CLIPPING' && !payload.keywords) {
                            setPayload({ ...payload, keywords: [], website: '', manualNews: [] });
                          }
                          if (t === 'WEATHER' && !payload.city) {
                            setPayload({ 
                              city: 'São Paulo', 
                              currentTemp: 25, 
                              condition: 'Ensolarado',
                              tempMax: 28,
                              tempMin: 18,
                              humidity: 60,
                              windSpeed: 10,
                              forecast: [
                                { day: 'Amanhã', tempMax: 27, tempMin: 19, condition: 'Nublado' },
                                { day: 'Depois', tempMax: 26, tempMin: 17, condition: 'Chuvoso' },
                                { day: 'Sexta', tempMax: 29, tempMin: 20, condition: 'Ensolarado' }
                              ]
                            });
                          }
                          if (t === 'NORTH_STAR' && !payload.adsplay) {
                            setPayload({ ...payload, adsplay: 0, pixel: 0, trigger: 0, adsmax: 0 });
                          }
                          if (t === 'FINAL_SPRINT') {
                            setPayload({ target: 100, current: 0, label: 'vendas', month: '', teamName: '' });
                          }
                          if (t === 'SMART_SALES') {
                            setPayload({ valueDisplay: 'full', scope: 'latest' });
                          }
                          if ((t === 'WC_BRAZIL' || t === 'WC_TODAY' || t === 'WC_BRACKET') && payload.autoRefresh === undefined) {
                            setPayload({ autoRefresh: true });
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                          type === t ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                        }`}
                      >
                        {getIcon(t)}
                        <span className="text-[7px] font-bold uppercase tracking-widest">{t === 'WC_BRAZIL' ? 'WC BRASIL' : t === 'WC_TODAY' ? 'WC HOJE' : t === 'WC_BRACKET' ? 'WC CHAVE' : t.split('_')[0]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Título Interno</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ex: Campanha de Vendas" 
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Empresa / Classificação</label>
                        <div className="flex gap-2">
                          {(['Adsplay', 'Mootag', 'Geral'] as Company[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCompany(c)}
                              className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                                company === c 
                                  ? 'bg-zinc-900 border-zinc-900 text-white' 
                                  : 'bg-zinc-50 border-zinc-100 text-zinc-400 hover:border-zinc-200'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  {type === 'IMAGE_HERO' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Imagem</label>
                        <div className="flex gap-3 relative">
                          {uploading && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl z-10 border border-adsplay/20">
                              <Loader2 className="animate-spin text-adsplay mb-2" size={20} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">{uploadStatus || 'Enviando...'}</span>
                              <div className="w-1/2 h-1 bg-zinc-100 rounded-full mt-2 overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-adsplay"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                  />
                              </div>
                            </div>
                          )}
                          <input 
                            type="url" 
                            placeholder="URL da Imagem (ou use o upload ao lado)" 
                            value={payload.url || ''}
                            onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLibraryTarget('single');
                              fetchLibrary();
                              setIsLibraryOpen(true);
                            }}
                            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl flex items-center gap-2 transition-colors border border-zinc-200 shadow-sm"
                            title="Selecionar da Biblioteca"
                          >
                            <HardDrive size={20} />
                          </button>
                          <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl flex items-center gap-2 transition-colors border border-zinc-200 shadow-sm">
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                            <span className="text-sm font-bold">Upload</span>
                            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                          </label>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Título na Tela</label>
                        <input 
                          type="text" 
                          value={payload.title || ''}
                          onChange={(e) => setPayload({ ...payload, title: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Texto da Mídia</label>
                        <input 
                          type="text" 
                          value={payload.subtitle || ''}
                          onChange={(e) => setPayload({ ...payload, subtitle: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'VIDEO_FILE' && (
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Vídeo</label>
                        <div className="flex gap-3 relative">
                          {uploading && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl z-10 border border-adsplay/20">
                              <Loader2 className="animate-spin text-adsplay mb-2" size={20} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">{uploadStatus || 'Enviando...'}</span>
                              <div className="w-1/2 h-1 bg-zinc-100 rounded-full mt-2 overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-adsplay"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                  />
                              </div>
                            </div>
                          )}
                          <input 
                            type="url" 
                            placeholder="URL do Vídeo (ou use o upload ao lado)" 
                            value={payload.url || ''}
                            onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                          />
                          <label className="cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl flex items-center gap-2 transition-colors">
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                            <span className="text-sm font-bold">Upload</span>
                            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                          </label>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium">Formatos recomendados: MP4, WebM.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Título na Tela</label>
                        <input 
                          type="text" 
                          value={payload.title || ''}
                          onChange={(e) => setPayload({ ...payload, title: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Texto da Mídia</label>
                        <input 
                          type="text" 
                          value={payload.subtitle || ''}
                          onChange={(e) => setPayload({ ...payload, subtitle: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'INSTAGRAM' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">URL do Post do Instagram</label>
                      <input 
                        required
                        type="url" 
                        placeholder="https://www.instagram.com/p/..." 
                        value={payload.url || ''}
                        onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                      />
                      <p className="text-[10px] text-zinc-400 font-medium">O post deve ser público para ser exibido.</p>
                    </div>
                  )}

                  {type === 'YOUTUBE' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">URL do Vídeo YouTube</label>
                      <input 
                        required
                        type="url" 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        value={payload.url || ''}
                        onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                      />
                    </div>
                  )}

                  {type === 'DASHBOARD' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">URL do Dashboard</label>
                      <input 
                        required
                        type="url" 
                        placeholder="https://..." 
                        value={payload.url || ''}
                        onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                      />
                    </div>
                  )}

                  {type === 'CAROUSEL' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Imagens do Carrossel</label>
                        
                        <div className="flex gap-3 mb-4">
                          <input 
                            type="url" 
                            placeholder="Adicionar imagem por URL..." 
                            value={carouselUrl}
                            onChange={(e) => setCarouselUrl(e.target.value)}
                            className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (carouselUrl.trim()) {
                                  setPayload({ 
                                    ...payload, 
                                    images: [...(payload.images || []), { id: Date.now().toString(), url: carouselUrl.trim() }] 
                                  });
                                  setCarouselUrl('');
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (carouselUrl.trim()) {
                                setPayload({ 
                                  ...payload, 
                                  images: [...(payload.images || []), { id: Date.now().toString(), url: carouselUrl.trim() }] 
                                });
                                setCarouselUrl('');
                              }
                            }}
                            className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                          >
                            Adicionar
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 relative">
                          {uploading && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-2xl z-10 border border-adsplay/20">
                              <Loader2 className="animate-spin text-adsplay mb-2" size={20} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">{uploadStatus || 'Enviando...'}</span>
                              <div className="w-1/2 h-1 bg-zinc-100 rounded-full mt-2 overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-adsplay"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${uploadProgress}%` }}
                                  />
                              </div>
                            </div>
                          )}
                          {(payload.images || []).map((img: any, index: number) => (
                            <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group">
                              <img src={img.url} className="w-full h-full object-cover" alt="" />
                              <button 
                                type="button"
                                onClick={() => {
                                  const newImages = payload.images.filter((_: any, i: number) => i !== index);
                                  setPayload({ ...payload, images: newImages });
                                }}
                                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XIcon size={12} />
                              </button>
                            </div>
                          ))}
                          <label className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-50 transition-colors">
                            <Plus size={24} className="text-zinc-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Upload</span>
                            <input 
                              type="file" 
                              multiple
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleMultipleFileUpload}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setLibraryTarget('carousel');
                              fetchLibrary();
                              setIsLibraryOpen(true);
                            }}
                            className="aspect-square rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-50 transition-colors"
                          >
                            <HardDrive size={24} className="text-zinc-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Biblioteca</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Título na Tela</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Fotos do Evento" 
                          value={payload.titleOnScreen || ''}
                          onChange={(e) => setPayload({ ...payload, titleOnScreen: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Texto da Mídia</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Confira os melhores momentos" 
                          value={payload.subtitle || ''}
                          onChange={(e) => setPayload({ ...payload, subtitle: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>
                    </div>
                  )}
                  {type === 'NEWS_CLIPPING' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Notícias (Máx 5)</label>
                            <p className="text-[10px] text-zinc-400 font-medium">Adicione as notícias que aparecerão no carrossel do player.</p>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400">{(payload.newsItems || []).length}/5</span>
                        </div>

                        <div className="space-y-3">
                          {(payload.newsItems || []).map((news: any, index: number) => (
                            <div key={index} className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3 relative group">
                              <button 
                                type="button"
                                onClick={() => {
                                  const newList = payload.newsItems.filter((_: any, i: number) => i !== index);
                                  setPayload({ ...payload, newsItems: newList });
                                }}
                                className="absolute top-4 right-4 text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              
                              <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase">URL da Matéria (Auto-preencher)</label>
                                  <div className="flex gap-2">
                                    <input 
                                      type="url"
                                      value={news.url || ''}
                                      onChange={(e) => {
                                        const newList = [...payload.newsItems];
                                        newList[index].url = e.target.value;
                                        setPayload({ ...payload, newsItems: newList });
                                      }}
                                      className="flex-1 bg-transparent text-xs font-bold focus:outline-none border-b border-zinc-200 pb-1"
                                      placeholder="https://..."
                                    />
                                    <button
                                      type="button"
                                      disabled={isSyncingNews === index || !news.url}
                                      onClick={() => syncNewsMetadata(index, news.url)}
                                      className="px-3 py-1 bg-adsplay/10 text-adsplay text-[10px] font-black rounded-lg hover:bg-adsplay/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                      {isSyncingNews === index ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
                                      Sincronizar
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[8px] font-black text-zinc-400 uppercase">Título da Notícia</label>
                                  <input 
                                    type="text"
                                    value={news.title}
                                    onChange={(e) => {
                                      const newList = [...payload.newsItems];
                                      newList[index].title = e.target.value;
                                      setPayload({ ...payload, newsItems: newList });
                                    }}
                                    className="w-full bg-transparent text-xs font-bold focus:outline-none border-b border-zinc-200 pb-1"
                                    placeholder="Ex: Adsplay atinge marca histórica..."
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-black text-zinc-400 uppercase">Veículo / Fonte</label>
                                    <input 
                                      type="text"
                                      value={news.source}
                                      onChange={(e) => {
                                        const newList = [...payload.newsItems];
                                        newList[index].source = e.target.value;
                                        setPayload({ ...payload, newsItems: newList });
                                      }}
                                      className="w-full bg-transparent text-xs font-bold focus:outline-none border-b border-zinc-200 pb-1"
                                      placeholder="Ex: Meio & Mensagem"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-black text-zinc-400 uppercase">URL da Imagem</label>
                                    <input 
                                      type="url"
                                      value={news.imageUrl}
                                      onChange={(e) => {
                                        const newList = [...payload.newsItems];
                                        newList[index].imageUrl = e.target.value;
                                        setPayload({ ...payload, newsItems: newList });
                                      }}
                                      className="w-full bg-transparent text-xs font-bold focus:outline-none border-b border-zinc-200 pb-1"
                                      placeholder="https://..."
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {(payload.newsItems || []).length < 5 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newList = payload.newsItems || [];
                                setPayload({
                                  ...payload,
                                  newsItems: [...newList, { title: '', source: '', imageUrl: '', url: '' }]
                                });
                              }}
                              className="w-full py-4 border-2 border-dashed border-zinc-100 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-50 transition-all group"
                            >
                              <Plus size={16} className="group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Notícia</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {type === 'MONTHLY_GOAL' && (
                    <>
                      <div className="space-y-6">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ano de Referência</label>
                          <input 
                            required
                            type="number" 
                            value={payload.year || new Date().getFullYear()}
                            onChange={(e) => setPayload({ ...payload, year: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Exibição</label>
                          <button
                            type="button"
                            onClick={() => setPayload({ ...payload, showOnlyPercentage: !payload.showOnlyPercentage })}
                            className={`w-full px-4 py-3 rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-sm ${
                              payload.showOnlyPercentage 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                            }`}
                          >
                            {payload.showOnlyPercentage ? 'Apenas Percentual' : 'Valores Financeiros'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Metas por Mês</label>
                          <button 
                            type="button"
                            onClick={() => {
                              const months = payload.months || [];
                              const nextMonth = months.length > 0 ? (months[months.length - 1].month % 12) + 1 : new Date().getMonth() + 1;
                              setPayload({
                                ...payload,
                                months: [...months, { month: nextMonth, target: 0, current: 0 }]
                              });
                            }}
                            className="text-[10px] font-black bg-zinc-100 px-3 py-1 rounded-full hover:bg-zinc-200 transition-colors uppercase tracking-widest"
                          >
                            + Adicionar Mês
                          </button>
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {(payload.months || []).map((m: any, index: number) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                              <div className="col-span-3 space-y-1">
                                <label className="text-[8px] font-black text-zinc-400 uppercase">Mês</label>
                                <select 
                                  value={m.month}
                                  onChange={(e) => {
                                    const newMonths = [...payload.months];
                                    newMonths[index].month = parseInt(e.target.value);
                                    setPayload({ ...payload, months: newMonths });
                                  }}
                                  className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                >
                                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((name, i) => (
                                    <option key={name} value={i + 1}>{name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-zinc-400 uppercase">Meta (R$)</label>
                                <input 
                                  type="number"
                                  step="0.01"
                                  value={m.target}
                                  onChange={(e) => {
                                    const newMonths = [...payload.months];
                                    newMonths[index].target = parseFloat(e.target.value);
                                    setPayload({ ...payload, months: newMonths });
                                  }}
                                  className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                />
                              </div>
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-zinc-400 uppercase">Vendido (R$)</label>
                                <input 
                                  type="number"
                                  step="0.01"
                                  value={m.current}
                                  onChange={(e) => {
                                    const newMonths = (payload.months || []).slice();
                                    newMonths[index].current = parseFloat(e.target.value);
                                    setPayload(Object.assign({}, payload, { months: newMonths }));
                                  }}
                                  className="w-full bg-transparent text-sm font-bold focus:outline-none"
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newMonths = (payload.months || []).filter((_: any, i: number) => i !== index);
                                    setPayload(Object.assign({}, payload, { months: newMonths }));
                                  }}
                                  className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {(payload.months || []).length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-zinc-100 rounded-2xl">
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nenhum mês adicionado</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {type === 'WEBSITE_EMBED' && (
                    <div className="space-y-6">
                      <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                            <Globe size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">Website Embed</p>
                            <p className="text-[10px] text-zinc-400 font-medium">Insira a URL para capturar um print do site.</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            required
                            type="url" 
                            placeholder="https://exemplo.com"
                            value={payload.url || ''}
                            onChange={(e) => setPayload({ ...payload, url: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!payload.url) return;
                              const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(payload.url)}?w=1280`;
                              setPayload({ ...payload, screenshotUrl });
                            }}
                            className="px-6 py-3 bg-adsplay text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-adsplay-dark transition-all flex items-center gap-2 shadow-lg shadow-adsplay/20"
                          >
                            <ImageIcon size={16} />
                            Capturar
                          </button>
                        </div>

                        {payload.screenshotUrl && (
                          <div className="mt-4 space-y-2">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Preview da Captura</p>
                            <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-200 bg-white">
                              <img 
                                src={payload.screenshotUrl} 
                                alt="Website Preview" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <p className="text-[9px] text-zinc-400 italic">
                              * A captura pode levar alguns segundos para carregar.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {type === 'WEATHER' && (
                    <div className="space-y-6">
                      <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                              <CloudSun size={20} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">Configuração de Clima</p>
                              <p className="text-[10px] text-zinc-400 font-medium">Sincronize automaticamente os dados do tempo.</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={isSyncingWeather}
                            onClick={() => {
                              setPayload({ ...payload, city: 'São Paulo, Pinheiros' });
                              syncWeather('São Paulo, Pinheiros');
                            }}
                            className="text-[10px] font-black bg-white border border-zinc-200 px-4 py-2 rounded-full hover:bg-zinc-50 transition-colors uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                          >
                            <MapPin size={12} />
                            {isSyncingWeather ? 'Sincronizando...' : 'Usar Pinheiros (Default)'}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            required
                            type="text" 
                            placeholder="Digite a cidade (Ex: São Paulo, Pinheiros)"
                            value={payload.city || ''}
                            onChange={(e) => setPayload({ ...payload, city: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => syncWeather()}
                            disabled={isSyncingWeather}
                            className="px-6 py-3 bg-adsplay text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-adsplay-dark transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-adsplay/20"
                          >
                            {isSyncingWeather ? <Loader2 className="animate-spin" size={16} /> : <CloudSun size={16} />}
                            {isSyncingWeather ? 'Sincronizando...' : 'Sincronizar'}
                          </button>
                        </div>

                        {payload.lastSync && (
                          <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest text-center">
                            Última sincronização: {new Date(payload.lastSync).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>

                      {payload.currentTemp !== undefined && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-center">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Temp. Atual</p>
                            <p className="text-2xl font-black text-zinc-900">{payload.currentTemp}°C</p>
                          </div>
                          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-center">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Condição</p>
                            <p className="text-sm font-black text-zinc-900">{payload.condition}</p>
                          </div>
                          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 text-center">
                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Umidade</p>
                            <p className="text-2xl font-black text-zinc-900">{payload.humidity}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {type === 'NORTH_STAR' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Meta do Ano Atual</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.currentYearGoal) || 200}
                            onChange={(e) => setPayload({ ...payload, currentYearGoal: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ano Atual</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.currentYear) || new Date().getFullYear()}
                            onChange={(e) => setPayload({ ...payload, currentYear: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Meta North Star (Total)</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.targetGoal) || 1000}
                            onChange={(e) => setPayload({ ...payload, targetGoal: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ano Limite</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.targetYear) || 2030}
                            onChange={(e) => setPayload({ ...payload, targetYear: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Adsplay</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.adsplay) || 0}
                            onChange={(e) => setPayload({ ...payload, adsplay: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Pixel</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.pixel) || 0}
                            onChange={(e) => setPayload({ ...payload, pixel: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Trigger</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.trigger) || 0}
                            onChange={(e) => setPayload({ ...payload, trigger: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">AdsMax</label>
                          <input 
                            required
                            type="number" 
                            value={Number(payload.adsmax) || 0}
                            onChange={(e) => setPayload({ ...payload, adsmax: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === 'FINAL_SPRINT' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 p-4 bg-violet-50 rounded-2xl border border-violet-100">
                        <span className="text-3xl">🦙</span>
                        <div>
                          <p className="text-xs font-black text-violet-700 uppercase tracking-widest">Sprint Final</p>
                          <p className="text-[10px] text-violet-500 font-medium">Exibe o número que falta para bater a meta do mês. Vai dar gás no time!</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Meta (total)</label>
                          <input
                            required
                            type="number"
                            placeholder="Ex: 100"
                            value={payload.target || ''}
                            onChange={(e) => setPayload({ ...payload, target: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Realizadas (atual)</label>
                          <input
                            required
                            type="number"
                            placeholder="Ex: 65"
                            value={payload.current || ''}
                            onChange={(e) => setPayload({ ...payload, current: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tipo da Métrica</label>
                          <input
                            type="text"
                            placeholder="vendas, contratos, ativações..."
                            value={payload.label || ''}
                            onChange={(e) => setPayload({ ...payload, label: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Mês de Referência</label>
                          <input
                            type="text"
                            placeholder="Ex: Maio, Junho"
                            value={payload.month || ''}
                            onChange={(e) => setPayload({ ...payload, month: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome do Time (opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: Time Comercial, Squad Alpha"
                          value={payload.teamName || ''}
                          onChange={(e) => setPayload({ ...payload, teamName: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all"
                        />
                      </div>

                      {(payload.target > 0) && (
                        <div className="bg-zinc-900 p-5 rounded-3xl space-y-3">
                          {(() => {
                            const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            const remaining = Math.max(0, (payload.target || 100) - (payload.current || 0));
                            const pct = Math.round(((payload.current || 0) / (payload.target || 1)) * 100);
                            return (
                              <>
                                <div className="flex justify-between items-center">
                                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Preview</p>
                                  <p className="text-sm font-black text-adsplay">{fmt(remaining)} faltam</p>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-adsplay to-violet-400 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                  <div className="flex justify-between text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                                    <span>R$ 0,00</span>
                                    <span className="text-zinc-400">{pct}% atingido</span>
                                    <span className="text-adsplay">{fmt(payload.target || 0)} {payload.label || 'vendas'}</span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {type === 'SMART_SALES' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <Trophy size={28} className="text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Smart Media · Vendas</p>
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Conteúdo automático. Cada venda que chega em <span className="font-bold">entradadecampanha@adsplay.com.br</span> vira um card na TV em tempo real. Não é preciso cadastrar nada aqui — só configurar a exibição.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Exibição do valor (INVESTIMENTO)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { v: 'full', label: 'Valor cheio', hint: 'R$ 80.000,00' },
                            { v: 'abbreviated', label: 'Abreviado', hint: 'R$ 80 mil' },
                            { v: 'hidden', label: 'Ocultar', hint: 'sem cifras' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setPayload({ ...payload, valueDisplay: opt.v })}
                              className={`p-3 rounded-2xl border-2 transition-all text-center ${
                                (payload.valueDisplay || 'full') === opt.v
                                  ? 'border-zinc-900 bg-zinc-900 text-white'
                                  : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                              }`}
                            >
                              <p className="text-xs font-black uppercase tracking-widest">{opt.label}</p>
                              <p className={`text-[9px] font-bold mt-0.5 ${(payload.valueDisplay || 'full') === opt.v ? 'text-zinc-400' : 'text-zinc-400'}`}>{opt.hint}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Quais vendas exibir</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { v: 'latest', label: 'Últimas 5', hint: 'sempre, qualquer data' },
                            { v: 'month', label: 'Mês atual', hint: 'zera a cada mês' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setPayload({ ...payload, scope: opt.v })}
                              className={`p-3 rounded-2xl border-2 transition-all text-center ${
                                (payload.scope || 'latest') === opt.v
                                  ? 'border-zinc-900 bg-zinc-900 text-white'
                                  : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                              }`}
                            >
                              <p className="text-xs font-black uppercase tracking-widest">{opt.label}</p>
                              <p className="text-[9px] font-bold text-zinc-400 mt-0.5">{opt.hint}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <div>
                          <p className="text-xs font-black text-zinc-700 uppercase tracking-widest">Comemorar venda nova</p>
                          <p className="text-[10px] text-zinc-400 font-medium">Animação breve quando uma venda entra na tela.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPayload({ ...payload, celebrate: payload.celebrate === false ? true : false })}
                          className={`w-12 h-7 rounded-full transition-all relative ${payload.celebrate === false ? 'bg-zinc-300' : 'bg-emerald-500'}`}
                        >
                          <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${payload.celebrate === false ? 'left-1' : 'left-6'}`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {(type === 'WC_BRAZIL' || type === 'WC_TODAY' || type === 'WC_BRACKET') && (() => {
                    const inputCls = "w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all";
                    const parseScore = (v: string) => (v === '' ? null : Number(v));
                    const finishedCount = wcMatches.filter(m => m.status === 'finished').length;
                    const pendingCount = wcMatches.length - finishedCount;
                    return (
                    <div className="space-y-6">
                      <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-100 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                            {getIcon(type)}
                          </div>
                          <div>
                            <p className="text-xs font-black text-zinc-900 uppercase tracking-widest">Central de Resultados da Copa</p>
                            <p className="text-[10px] text-zinc-400 font-medium">Base compartilhada pelos 3 cards. Jogo encerrado é fixo; a IA só atualiza os pendentes.</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-zinc-100">
                          <div>
                            <p className="text-[11px] font-black text-zinc-700 uppercase tracking-widest">Atualização automática (pendentes)</p>
                            <p className="text-[9px] text-zinc-400 font-medium">{payload.autoRefresh === false ? 'Travado — a TV não busca via IA.' : 'A TV atualiza placares de jogos pendentes via IA.'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayload({ ...payload, autoRefresh: payload.autoRefresh === false ? true : false })}
                            className={`w-12 h-7 rounded-full transition-all relative shrink-0 ${payload.autoRefresh === false ? 'bg-zinc-300' : 'bg-emerald-500'}`}
                          >
                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${payload.autoRefresh === false ? 'left-1' : 'left-6'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Importar base (colar JSON)</label>
                        <textarea
                          value={wcImportText}
                          onChange={(e) => { setWcImportText(e.target.value); if (wcMsg) setWcMsg(null); }}
                          placeholder={'Cole o JSON dos jogos aqui. Aceita { "copa_do_mundo": { "todos_os_jogos": [...] } } ou um array de jogos. Jogos encerrados viram base fixa.'}
                          className="w-full h-40 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all resize-y"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={!!wcBusy || !wcImportText.trim()} onClick={importWcBase} className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2">
                            {wcBusy === 'import' && <Loader2 className="animate-spin" size={12} />}
                            {wcBusy === 'import' ? 'Importando...' : 'Importar / atualizar base'}
                          </button>
                          <button type="button" disabled={!!wcBusy} onClick={syncWcPending} className="px-4 py-2 bg-adsplay text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-adsplay-dark transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-adsplay/20">
                            {wcBusy === 'sync' ? <Loader2 className="animate-spin" size={12} /> : <TrendingUp size={12} />}
                            {wcBusy === 'sync' ? 'Buscando...' : 'Sincronizar pendentes (IA)'}
                          </button>
                          <button type="button" disabled={!!wcBusy} onClick={syncBrazil} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                            {wcBusy === 'brazil' ? <Loader2 className="animate-spin" size={12} /> : <span>🇧🇷</span>}
                            {wcBusy === 'brazil' ? 'Buscando...' : 'Sincronizar Brasil (IA)'}
                          </button>
                          <button type="button" disabled={!!wcBusy} onClick={loadWcMatches} className="px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-all disabled:opacity-50">
                            {wcBusy === 'load' ? 'Carregando...' : 'Recarregar'}
                          </button>
                          <button type="button" disabled={!!wcBusy} onClick={clearWcBase} className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center gap-2">
                            <Trash2 size={12} /> {wcBusy === 'clear' ? 'Limpando...' : 'Limpar base'}
                          </button>
                        </div>

                        {wcMsg && (
                          <div className={`px-4 py-3 rounded-2xl text-xs font-bold border ${wcMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            {wcMsg.text}
                          </div>
                        )}

                        <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">
                          {wcMatches.length} jogos · {finishedCount} encerrados · {pendingCount} pendentes
                        </p>
                      </div>

                      <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                        {wcMatches.length === 0 && (
                          <p className="text-center text-zinc-400 text-sm py-6">Nenhum jogo ainda. Importe a base acima.</p>
                        )}
                        {wcMatches.map(m => (
                          <div key={m.id} className={`p-3 rounded-2xl border relative ${m.status === 'finished' ? 'bg-emerald-50/40 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
                            <button type="button" onClick={() => deleteWcRow(m.id!)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-50 p-1 rounded-lg"><Trash2 size={12} /></button>
                            <div className="grid grid-cols-2 gap-2 pr-6">
                              <input className={inputCls} placeholder="Data (AAAA-MM-DD)" value={m.date || ''} onChange={e => updateWcRow(m.id!, { date: e.target.value })} />
                              <input className={inputCls} placeholder="Fase" value={m.stage || ''} onChange={e => updateWcRow(m.id!, { stage: e.target.value })} />
                              <input className={inputCls} placeholder="Mandante" value={m.home || ''} onChange={e => updateWcRow(m.id!, { home: e.target.value })} />
                              <input className={inputCls} placeholder="País mand. (br)" value={m.homeCode || ''} onChange={e => updateWcRow(m.id!, { homeCode: e.target.value })} />
                              <input className={inputCls} placeholder="Visitante" value={m.away || ''} onChange={e => updateWcRow(m.id!, { away: e.target.value })} />
                              <input className={inputCls} placeholder="País vis. (jp)" value={m.awayCode || ''} onChange={e => updateWcRow(m.id!, { awayCode: e.target.value })} />
                              <div className="flex gap-2">
                                <input type="number" className={inputCls} placeholder="Gols M" value={m.homeScore ?? ''} onChange={e => updateWcRow(m.id!, { homeScore: parseScore(e.target.value) })} />
                                <input type="number" className={inputCls} placeholder="Gols V" value={m.awayScore ?? ''} onChange={e => updateWcRow(m.id!, { awayScore: parseScore(e.target.value) })} />
                              </div>
                              <div className="flex gap-2">
                                <input type="number" className={inputCls} placeholder="Pên M" value={m.homePens ?? ''} onChange={e => updateWcRow(m.id!, { homePens: parseScore(e.target.value) })} />
                                <input type="number" className={inputCls} placeholder="Pên V" value={m.awayPens ?? ''} onChange={e => updateWcRow(m.id!, { awayPens: parseScore(e.target.value) })} />
                              </div>
                              <input className={inputCls} placeholder="Hora (HH:MM)" value={m.time || ''} onChange={e => updateWcRow(m.id!, { time: e.target.value })} />
                              <select className={inputCls} value={m.status || 'scheduled'} onChange={e => updateWcRow(m.id!, { status: e.target.value as any })}>
                                <option value="scheduled">A começar</option>
                                <option value="live">Ao vivo</option>
                                <option value="finished">Encerrado</option>
                              </select>
                            </div>
                            <button type="button" disabled={!!wcBusy} onClick={() => saveWcRow(m)} className="mt-2 text-[10px] font-black text-adsplay uppercase tracking-widest disabled:opacity-50">Salvar este jogo</button>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}

                  </div>
                </div>

                <div className="p-8 pt-4 border-t border-zinc-100 flex gap-3 shrink-0">
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
                    {loading ? 'Salvando...' : 'Salvar Mídia'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Library Selector Modal */}
      <AnimatePresence>
        {isLibraryOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold">Selecionar da Biblioteca</h3>
                  <p className="text-zinc-500 text-xs font-medium">Escolha uma mídia já otimizada para o sistema.</p>
                </div>
                <button 
                  onClick={() => setIsLibraryOpen(false)}
                  className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                >
                  <XIcon size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {libraryItems.length > 0 ? (
                    libraryItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleLibrarySelect(item)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-100 hover:border-adsplay transition-all bg-zinc-50"
                      >
                        {item.type === 'image' ? (
                          <img 
                            src={item.url} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            alt={item.name}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                            <Video size={24} />
                            <span className="text-[8px] font-black mt-1">VÍDEO</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <CheckCircle2 className="text-white" size={32} />
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-2 bg-black/60 translate-y-full group-hover:translate-y-0 transition-transform">
                          <p className="text-[10px] text-white font-bold truncate">{item.name}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center space-y-4">
                      <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                        <HardDrive size={24} />
                      </div>
                      <p className="text-sm font-bold text-zinc-500">Nenhuma mídia na biblioteca.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-between items-center shrink-0">
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{libraryItems.length} Arquivos Disponíveis</p>
                <button 
                  onClick={() => setIsLibraryOpen(false)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-zinc-900/10 hover:bg-zinc-800 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
