import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileJson, 
  ArrowRight, 
  RefreshCw, 
  Settings, 
  ShieldAlert, 
  Trash2,
  HardDrive,
  ImageIcon,
  PlaySquare,
  Calendar,
  Monitor,
  Users
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  Timestamp 
} from 'firebase/firestore';

interface CollectionOption {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  defaultChecked: boolean;
}

const COLLECTION_OPTIONS: CollectionOption[] = [
  { key: 'media', label: 'Mídias', description: 'Ativos de imagem, vídeo, YouTube e dashboards configurados.', icon: ImageIcon, defaultChecked: true },
  { key: 'playlists', label: 'Playlists', description: 'Sequências de mídias estruturadas e ordenadas.', icon: PlaySquare, defaultChecked: true },
  { key: 'schedule', label: 'Agenda / Calendário', description: 'Programação de playlists associadas aos dias do ano.', icon: Calendar, defaultChecked: true },
  { key: 'library', label: 'Biblioteca de Uploads', description: 'Registros de arquivos físicos salvos no Firebase Storage.', icon: HardDrive, defaultChecked: true },
  { key: 'devices', label: 'Dispositivos', description: 'TVs e telas pareadas ou pendentes.', icon: Monitor, defaultChecked: false },
  { key: 'users', label: 'Usuários do Sistema', description: 'Controle de acessos e perfis cadastrados.', icon: Users, defaultChecked: false },
];

const ALLOWED_KEYS_MAP: Record<string, string[]> = {
  media: ['title', 'type', 'payload', 'company', 'createdAt', 'updatedAt'],
  playlists: ['name', 'items', 'logoUrl', 'company', 'createdAt', 'updatedAt'],
  schedule: ['playlistId', 'date'],
  devices: ['name', 'pair_code', 'is_paired', 'last_ping', 'createdAt', 'updatedAt', 'current_playlist_id'],
  users: ['email', 'role', 'displayName', 'photoURL', 'createdAt', 'updatedAt'],
  library: ['name', 'url', 'path', 'type', 'size', 'createdAt', 'uploadedBy']
};

export function Backup() {
  const [selectedExport, setSelectedExport] = useState<Record<string, boolean>>(
    COLLECTION_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.defaultChecked }), {})
  );
  const [selectedImport, setSelectedImport] = useState<Record<string, boolean>>(
    COLLECTION_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.key]: opt.defaultChecked }), {})
  );

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Import file processing
  const [dragOver, setDragOver] = useState(false);
  const [backupData, setBackupData] = useState<any | null>(null);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'overwrite'>('merge');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // Firestore Timestamp serialization helpers
  const serializeData = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj && typeof obj.toDate === 'function') {
      return {
        _type: 'FirestoreTimestamp',
        seconds: obj.seconds,
        nanoseconds: obj.nanoseconds,
      };
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeData);
    }
    if (typeof obj === 'object') {
      const res: any = {};
      for (const key of Object.keys(obj)) {
        res[key] = serializeData(obj[key]);
      }
      return res;
    }
    return obj;
  };

  const deserializeData = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (obj && obj._type === 'FirestoreTimestamp' && typeof obj.seconds === 'number') {
      return new Timestamp(obj.seconds, obj.nanoseconds || 0);
    }
    if (Array.isArray(obj)) {
      return obj.map(deserializeData);
    }
    if (typeof obj === 'object') {
      const res: any = {};
      for (const key of Object.keys(obj)) {
        res[key] = deserializeData(obj[key]);
      }
      return res;
    }
    return obj;
  };

  // Helper to filter allowed fields in document write so Firestore rules allow it
  const filterDocumentData = (collectionName: string, data: any): any => {
    const allowedKeys = ALLOWED_KEYS_MAP[collectionName];
    if (!allowedKeys) return data;
    
    const filtered: any = {};
    for (const key of allowedKeys) {
      if (key in data) {
        filtered[key] = data[key];
      }
    }
    return filtered;
  };

  // Handle Export
  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setSuccess(null);
    setProgress(5);
    setStatusText('Iniciando exportação...');

    const collectionsToFetch = Object.keys(selectedExport).filter(k => selectedExport[k]);
    if (collectionsToFetch.length === 0) {
      setError('Por favor, selecione ao menos uma coleção para exportar.');
      setExporting(false);
      return;
    }

    try {
      const backupResult: Record<string, any[]> = {};
      let index = 0;

      for (const colName of collectionsToFetch) {
        setStatusText(`Buscando dados da coleção: ${colName}...`);
        const qSnap = await getDocs(collection(db, colName));
        
        const docsList = qSnap.docs.map(gdoc => {
          const docData = gdoc.data();
          const serialized = serializeData(docData);
          return {
            _id: gdoc.id,
            ...serialized
          };
        });

        backupResult[colName] = docsList;
        index++;
        setProgress(Math.round((index / collectionsToFetch.length) * 90) + 5);
      }

      setStatusText('Montando arquivo de backup...');
      const payload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        collections: backupResult
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `adsplay_labs_backup_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setSuccess('Exportação concluída com sucesso! O arquivo foi baixado.');
    } catch (err: any) {
      console.error('Export error: ', err);
      setError(`Falha ao exportar dados: ${err.message || err}`);
    } finally {
      setTimeout(() => {
        setExporting(false);
        setProgress(0);
        setStatusText('');
      }, 1000);
    }
  };

  // Handle file select/drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const processFile = (file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Tipo de arquivo inválido. Carregue um arquivo JSON de backup.');
      return;
    }

    setBackupFileName(file.name);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed || typeof parsed !== 'object' || !parsed.collections) {
          throw new Error('Arquivo de backup inválido. Chave "collections" não encontrada.');
        }
        setBackupData(parsed);
      } catch (err: any) {
        setError(`Erro ao decodificar JSON: ${err.message}`);
        setBackupData(null);
        setBackupFileName(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Run Import
  const handleImport = async () => {
    if (!backupData) return;

    if (importStrategy === 'overwrite' && !confirmOverwrite) {
      setError('Por favor, confirme a caixa de aviso de substituição total.');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setProgress(5);
    setStatusText('Iniciando importação...');

    const collectionsToImport = Object.keys(selectedImport).filter(
      k => selectedImport[k] && backupData.collections[k]
    );

    if (collectionsToImport.length === 0) {
      setError('Selecione ao menos uma coleção com dados no arquivo para importar.');
      setImporting(false);
      return;
    }

    try {
      let stepMultiplier = 1;
      if (importStrategy === 'overwrite') {
        stepMultiplier = 2; // Two phases: clean and write
      }

      let operationsDone = 0;
      const totalOperations = collectionsToImport.length * stepMultiplier;

      // PHASE 1: OVERWRITE (wipe existing selected collections first)
      if (importStrategy === 'overwrite') {
        for (const colName of collectionsToImport) {
          setStatusText(`Limpando dados existentes da coleção: ${colName}...`);
          const qSnap = await getDocs(collection(db, colName));
          
          let deleted = 0;
          for (const sDoc of qSnap.docs) {
            await deleteDoc(doc(db, colName, sDoc.id));
            deleted++;
          }
          console.log(`Deleted ${deleted} docs from ${colName}`);
          
          operationsDone++;
          setProgress(Math.round((operationsDone / totalOperations) * 90) + 5);
        }
      }

      // PHASE 2: WRITE DATA
      for (const colName of collectionsToImport) {
        const list = backupData.collections[colName] || [];
        setStatusText(`Importando ${list.length} registros para a coleção: ${colName}...`);
        
        let importedCount = 0;
        for (const rawItem of list) {
          const docId = rawItem._id;
          if (!docId) continue;

          // Remove database metadata
          const { _id, ...cleanItem } = rawItem;
          
          // Deserialize fields (restore nested dates to Timestamp)
          const deserialized = deserializeData(cleanItem);

          // Filter keys to obey firestore.rules isValid checks
          const payloadToWrite = filterDocumentData(colName, deserialized);

          // Write document keeping original document ID for relationship preservation
          await setDoc(doc(db, colName, docId), payloadToWrite);
          importedCount++;
        }
        
        console.log(`Imported ${importedCount} docs to ${colName}`);
        operationsDone++;
        setProgress(Math.round((operationsDone / totalOperations) * 90) + 5);
      }

      setProgress(100);
      setSuccess('Importação finalizada com sucesso! Todos os dados foram gravados.');
      setBackupData(null);
      setBackupFileName(null);
      setConfirmOverwrite(false);
    } catch (err: any) {
      console.error('Import error: ', err);
      setError(`Falha ao importar dados: ${err.message || err}`);
    } finally {
      setTimeout(() => {
        setImporting(false);
        setProgress(0);
        setStatusText('');
      }, 1000);
    }
  };

  const getCollectionCount = (key: string) => {
    return backupData?.collections?.[key]?.length || 0;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-3">
            <Database className="text-adsplay" size={32} />
            Backup e Sincronização
          </h1>
          <p className="text-zinc-500 font-medium">
            Exporte as mídias, playlists e programação para sincronizar com a V2 ou criar salvaguardas de segurança.
          </p>
        </div>
      </header>

      {/* Global Toast Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm"
          >
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold text-sm">Ocorreu um problema</p>
              <p className="text-xs text-rose-700/90 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm"
          >
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold text-sm">Sucesso!</p>
              <p className="text-xs text-emerald-700/90 mt-0.5 leading-relaxed">{success}</p>
            </div>
          </motion.div>
        )}

        {(exporting || importing) && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-5 bg-zinc-900 text-white rounded-2xl shadow-xl flex flex-col gap-4 border border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-adsplay shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                  {exporting ? 'Exportando Banco de Dados' : 'Importando Banco de Dados'}
                </span>
                <p className="text-sm font-bold text-white truncate mt-0.5">{statusText}</p>
              </div>
              <span className="text-sm font-black text-adsplay">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-adsplay rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* EXPORT SECTION */}
        <section className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-adsplay/10 rounded-xl flex items-center justify-center text-adsplay">
                  <Download size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Exportação de Dados</h2>
                  <p className="text-xs text-zinc-400 font-medium">Selecione o que deseja baixar para um arquivo local</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400 block mb-1">Coleções Disponíveis</span>
              {COLLECTION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <label 
                    key={`exp-${opt.key}`}
                    className={`flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      selectedExport[opt.key]
                        ? 'border-adsplay/30 bg-adsplay/5 shadow-sm shadow-adsplay/5'
                        : 'border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      className="mt-1 accent-adsplay rounded"
                      checked={selectedExport[opt.key]}
                      disabled={exporting || importing}
                      onChange={(e) => setSelectedExport(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                    />
                    <div className="shrink-0 mt-0.5 text-zinc-400">
                      <Icon size={18} className={selectedExport[opt.key] ? 'text-adsplay' : ''} />
                    </div>
                    <div className="flex-1 min-w-0 leading-tight">
                      <span className="text-sm font-bold text-zinc-800 block">{opt.label}</span>
                      <span className="text-xs text-zinc-400 font-medium block mt-0.5 leading-relaxed">{opt.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || importing}
            className="w-full bg-adsplay text-white py-3 px-5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-adsplay-dark transition-all disabled:opacity-50 shadow-md shadow-adsplay/10"
          >
            {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            Efetuar Exportação (Download)
          </button>
        </section>

        {/* IMPORT SECTION */}
        <section className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm flex flex-col space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                <Upload size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Importação de Dados (Backup)</h2>
                <p className="text-xs text-zinc-400 font-medium">Carregue ou arraste um arquivo de backup JSON</p>
              </div>
            </div>
          </div>

          {!backupData ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 min-h-[300px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center transition-all ${
                dragOver 
                  ? 'border-adsplay bg-adsplay/5 scale-[0.98]' 
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 mb-4 border border-zinc-100 shadow-sm">
                <FileJson size={28} className={dragOver ? 'text-adsplay animate-pulse' : ''} />
              </div>
              <p className="font-extrabold text-sm text-zinc-800">Arraste seu arquivo JSON aqui</p>
              <p className="text-xs text-zinc-400 mt-1 mb-4 font-medium">ou escolha do seu computador</p>
              
              <label className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95">
                Selecionar Arquivo
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleFileChange} 
                  disabled={exporting || importing}
                />
              </label>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 flex-1 flex flex-col justify-between"
            >
              {/* File details panel */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <FileJson className="text-emerald-600 shrink-0" size={24} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Arquivo Carregado</span>
                    <p className="text-sm font-extrabold text-zinc-800 truncate leading-none mt-0.5">{backupFileName}</p>
                    {backupData.exportedAt && (
                      <p className="text-[10px] text-zinc-400 font-medium mt-1">Exportado em: {new Date(backupData.exportedAt).toLocaleString()}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => { setBackupData(null); setBackupFileName(null); setConfirmOverwrite(false); }}
                    className="p-1 px-2.5 text-xs text-zinc-400 hover:text-rose-600 font-bold border border-zinc-200 rounded-lg hover:border-rose-200 hover:bg-rose-50"
                  >
                    Mudar
                  </button>
                </div>

                {/* What package contains */}
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 block">Dados a Importar</span>
                  <div className="grid grid-cols-2 gap-3">
                    {COLLECTION_OPTIONS.map((opt) => {
                      const count = getCollectionCount(opt.key);
                      const hasData = count > 0;
                      return (
                        <label 
                          key={`imp-${opt.key}`}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            hasData ? 'cursor-pointer' : 'opacity-40 cursor-default bg-zinc-50/50'
                          } ${
                            selectedImport[opt.key] && hasData
                              ? 'border-adsplay/30 bg-adsplay/5'
                              : 'border-zinc-100 bg-white'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            className="accent-adsplay rounded"
                            checked={selectedImport[opt.key] && hasData}
                            disabled={!hasData || importing}
                            onChange={(e) => setSelectedImport(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-extrabold text-zinc-800 block truncate">{opt.label}</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5 block">
                              {count} {count === 1 ? 'registro' : 'registros'}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Import Strategy Options */}
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 block">Estratégia de Integração</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-2.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      importStrategy === 'merge' ? 'border-zinc-800 bg-zinc-50' : 'border-zinc-100 hover:bg-zinc-50/50'
                    }`}>
                      <input 
                        type="radio"
                        name="strategy"
                        value="merge"
                        className="mt-1 accent-zinc-800"
                        checked={importStrategy === 'merge'}
                        onChange={() => { setImportStrategy('merge'); setConfirmOverwrite(false); }}
                      />
                      <div>
                        <span className="text-xs font-black text-zinc-800 block">Mesclar (Merge)</span>
                        <span className="text-[10px] text-zinc-400 font-medium block mt-0.5 leading-normal">
                          Adiciona novos registros. Sobrescreve apenas se houver conflito de identificadores (IDs).
                        </span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      importStrategy === 'overwrite' ? 'border-rose-200 bg-rose-50/20' : 'border-zinc-100 hover:bg-zinc-50/50'
                    }`}>
                      <input 
                        type="radio"
                        name="strategy"
                        value="overwrite"
                        className="mt-1 accent-rose-600"
                        checked={importStrategy === 'overwrite'}
                        onChange={() => setImportStrategy('overwrite')}
                      />
                      <div>
                        <span className="text-xs font-black text-rose-800 block">Substituir Total (Reset)</span>
                        <span className="text-[10px] text-zinc-400 font-medium block mt-0.5 leading-normal">
                          Apaga TODA a coleção no banco antes de gravar os registros importados. Use com cautela!
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Warning notice if Overwrite option is active */}
                <AnimatePresence>
                  {importStrategy === 'overwrite' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-2.5 text-xs font-bold leading-normal">
                        <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          Este método irá deletar todos os documentos atuais das tabelas selecionadas antes de carregar o backup. Isto é irreversível.
                        </div>
                      </div>
                      <label className="flex items-center gap-2 p-2 bg-white/60 border border-rose-200/50 rounded-xl cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          className="accent-rose-600"
                          checked={confirmOverwrite}
                          onChange={(e) => setConfirmOverwrite(e.target.checked)}
                        />
                        <span className="text-[10px] font-black uppercase text-rose-700 tracking-wide">
                          Estou ciente e confirmo a substituição completa dos dados.
                        </span>
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setBackupData(null); setBackupFileName(null); }}
                  className="px-4 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || (importStrategy === 'overwrite' && !confirmOverwrite)}
                  className={`py-3 px-6 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-md ${
                    importStrategy === 'overwrite'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-950/20'
                  }`}
                >
                  {importing ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                  Importar Agora (Girar Backup)
                </button>
              </div>
            </motion.div>
          )}
        </section>

      </div>
    </motion.div>
  );
}
