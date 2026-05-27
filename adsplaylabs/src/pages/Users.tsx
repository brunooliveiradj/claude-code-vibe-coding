import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Shield, 
  Trash2, 
  Mail, 
  Check, 
  X,
  AlertCircle,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Plus,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Copy
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, firebaseConfig } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';

export function Users() {
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('CONTENT_MANAGER');
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !invitePassword) return;
    if (invitePassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    let secondaryApp;
    try {
      // 1. Create the user in Firebase Auth using a secondary app instance
      // This prevents the current admin session from being swapped
      secondaryApp = initializeApp(firebaseConfig, `Secondary_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, inviteEmail, invitePassword);
      const newUid = userCredential.user.uid;

      // 2. Create the profile in Firestore
      await setDoc(doc(db, 'users', newUid), {
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        password: invitePassword, // Store plain password as requested (security warning implied)
        createdAt: serverTimestamp(),
        displayName: inviteEmail.split('@')[0],
        photoURL: ''
      });
      
      setIsInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('CONTENT_MANAGER');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else {
        setError('Erro ao criar usuário. Verifique as permissões.');
        console.error(err);
      }
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (uid: string) => {
    setShowPasswords(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const copyLoginLink = () => {
    const link = window.location.origin;
    navigator.clipboard.writeText(link);
    setCopySuccess('Link copiado!');
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    if (uid === currentUser?.uid) {
      setError('Você não pode alterar seu próprio cargo.');
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao atualizar cargo.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === currentUser?.uid) {
      setError('Você não pode excluir sua própria conta.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao remover usuário.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><ShieldAlert size={12} /> SUPER ADMIN</span>;
      case 'ADMIN':
        return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><ShieldCheck size={12} /> ADMIN</span>;
      case 'CONTENT_MANAGER':
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><UserCog size={12} /> GESTOR</span>;
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-zinc-500 max-w-xs">Apenas Super Admins podem gerenciar usuários do sistema.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Usuários</h2>
          <p className="text-zinc-500 font-medium">Gerencie quem tem acesso ao painel da Adsplay Labs.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={copyLoginLink}
            className="bg-white text-zinc-600 border border-zinc-200 px-6 py-4 rounded-2xl flex items-center gap-2 font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            {copySuccess ? <Check size={20} className="text-emerald-500" /> : <LinkIcon size={20} />}
            {copySuccess || 'Copiar Link de Login'}
          </button>
          <button 
            onClick={() => setIsInviteOpen(true)}
            className="bg-adsplay text-white px-8 py-4 rounded-2xl flex items-center gap-2 font-bold hover:bg-adsplay-dark transition-all shadow-xl shadow-adsplay/20"
          >
            <UserPlus size={20} /> Criar Usuário
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cargo</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Senha</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center text-zinc-400">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <UsersIcon size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-zinc-900">{u.displayName || 'Usuário'}</p>
                        <p className="text-xs text-zinc-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getRoleBadge(u.role)}
                      {u.uid !== currentUser?.uid && (
                        <select 
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.uid, e.target.value as UserRole)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold bg-white border border-zinc-200 rounded px-1 py-0.5 outline-none focus:ring-1 ring-zinc-900"
                        >
                          <option value="CONTENT_MANAGER">GESTOR</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER ADMIN</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.password ? (
                      <div className="flex items-center gap-2">
                        <code className="bg-zinc-100 px-2 py-1 rounded text-xs font-mono">
                          {showPasswords[u.uid] ? u.password : '••••••••'}
                        </code>
                        <button 
                          onClick={() => togglePasswordVisibility(u.uid)}
                          className="text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          {showPasswords[u.uid] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 italic">Login Google</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${u.uid.startsWith('invite_') ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <div className={`w-1 h-1 rounded-full ${u.uid.startsWith('invite_') ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {u.uid.startsWith('invite_') ? 'Pendente' : 'Ativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.uid !== currentUser?.uid && (
                      <button 
                        onClick={() => setDeleteConfirmId(u.uid)}
                        className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
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
                <h3 className="text-xl font-bold">Remover Usuário?</h3>
                <p className="text-zinc-500 text-sm">Esta ação não pode ser desfeita. O usuário perderá o acesso ao painel imediatamente.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteUser(deleteConfirmId)}
                  disabled={loading}
                  className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Removendo...' : 'Remover'}
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

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mb-4">
                    <UserPlus size={24} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Criar Usuário</h3>
                  <p className="text-zinc-500">O usuário terá acesso ao painel com este e-mail e senha.</p>
                </div>

                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input 
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="exemplo@gmail.com"
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-zinc-900/5 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Senha Inicial</label>
                    <div className="relative">
                      <Eye className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input 
                        type="text"
                        required
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-zinc-900/5 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nível de Acesso</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'CONTENT_MANAGER', label: 'Gestor de Conteúdo', desc: 'Mídias, Playlists e Agenda' },
                        { id: 'ADMIN', label: 'Administrador', desc: 'Tudo exceto usuários' },
                        { id: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Acesso total ao sistema' }
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setInviteRole(r.id as UserRole)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            inviteRole === r.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 text-zinc-600 hover:border-zinc-200'
                          }`}
                        >
                          <p className="font-bold text-sm">{r.label}</p>
                          <p className={`text-xs ${inviteRole === r.id ? 'text-white/60' : 'text-zinc-400'}`}>{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-medium">
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsInviteOpen(false)}
                      className="flex-1 px-4 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors shadow-lg disabled:opacity-50"
                    >
                      {loading ? 'Enviando...' : 'Convidar'}
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
