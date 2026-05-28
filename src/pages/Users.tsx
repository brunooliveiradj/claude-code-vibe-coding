import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users as UsersIcon,
  UserPlus,
  Trash2,
  Mail,
  Check,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Plus,
  Link as LinkIcon,
  CheckCircle,
  Send
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, firebaseConfig, auth, sendPasswordResetEmail } from '../firebase';
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

const ALLOWED_DOMAINS = ['adsplay.com.br', 'mootag.com.br', 'the365group.com.br'];

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function Users() {
  const { isSuperAdmin, isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteSent, setInviteSent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('CONTENT_MANAGER');
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, [isAdmin]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const domain = inviteEmail.split('@')[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain)) {
      setError('Acesso permitido apenas para @adsplay.com.br, @mootag.com.br ou @the365group.com.br.');
      return;
    }
    if (!isSuperAdmin && inviteRole === 'SUPER_ADMIN') {
      setError('Apenas Super Admins podem criar outros Super Admins.');
      return;
    }

    setLoading(true);
    let secondaryApp;
    try {
      const emailKey = inviteEmail.toLowerCase().trim();
      const profileData = {
        email: emailKey,
        role: inviteRole,
        displayName: emailKey.split('@')[0],
        photoURL: '',
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      try {
        // Try to create new Auth user via secondary app (preserves admin session)
        secondaryApp = initializeApp(firebaseConfig, `invite_${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, inviteEmail, randomPassword());
        await setDoc(doc(db, 'users', newUser.uid), profileData);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Auth user exists but has no Firestore profile — write invite doc
          // AuthContext will migrate it to UID-based doc on first login
          await setDoc(doc(db, 'users', `invite_${emailKey}`), profileData);
        } else {
          throw authErr;
        }
      }

      await sendPasswordResetEmail(auth, inviteEmail);
      setInviteSent(inviteEmail);
    } catch (err: any) {
      console.error('[Invite error]', err?.code, err?.message, err);
      if (err.code === 'permission-denied' || err?.message?.includes('PERMISSION_DENIED')) {
        setError('Sem permissão. As Firestore Rules precisam ser publicadas no Firebase Console.');
      } else {
        setError(`Erro: ${err?.code || err?.message || 'desconhecido'}`);
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const closeInvite = () => {
    setIsInviteOpen(false);
    setInviteSent(null);
    setInviteEmail('');
    setInviteRole('CONTENT_MANAGER');
    setError(null);
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    if (uid === currentUser?.uid) return;
    if (!isSuperAdmin && newRole === 'SUPER_ADMIN') {
      setError('Apenas Super Admins podem promover a Super Admin.');
      return;
    }
    setError(null);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole, updatedAt: serverTimestamp() });
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar cargo.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === currentUser?.uid) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setDeleteConfirmId(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover usuário.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><ShieldAlert size={12} /> SUPER ADMIN</span>;
      case 'ADMIN': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><ShieldCheck size={12} /> ADMIN</span>;
      case 'CONTENT_MANAGER': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1"><UserCog size={12} /> GESTOR</span>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-zinc-500 max-w-xs">Apenas Admins podem gerenciar usuários do sistema.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Usuários</h2>
          <p className="text-zinc-500 font-medium">Gerencie quem tem acesso ao painel da Adsplay Labs.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.origin + '/admin'); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}
            className="bg-white text-zinc-600 border border-zinc-200 px-6 py-4 rounded-2xl flex items-center gap-2 font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            {copySuccess ? <Check size={20} className="text-emerald-500" /> : <LinkIcon size={20} />}
            {copySuccess ? 'Copiado!' : 'Copiar Link de Login'}
          </button>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="bg-adsplay text-white px-8 py-4 rounded-2xl flex items-center gap-2 font-bold hover:bg-adsplay-dark transition-all shadow-xl shadow-adsplay/20"
          >
            <UserPlus size={20} /> Convidar Usuário
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
                        {u.photoURL ? <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" /> : <UsersIcon size={20} />}
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
                          {isSuperAdmin && <option value="SUPER_ADMIN">SUPER ADMIN</option>}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${(u as any).status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${(u as any).status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {(u as any).status === 'pending' ? 'Aguardando ativação' : 'Ativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.uid !== currentUser?.uid && !(u.role === 'SUPER_ADMIN' && !isSuperAdmin) && (
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-zinc-400 text-sm">Nenhum usuário cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Remover Usuário?</h3>
                <p className="text-zinc-500 text-sm">O usuário perderá o acesso imediatamente.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">Cancelar</button>
                <button onClick={() => handleDeleteUser(deleteConfirmId)} disabled={loading} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors disabled:opacity-50">
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
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]"
          >
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70"><Plus size={18} className="rotate-45" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">

                {/* Success state */}
                {inviteSent ? (
                  <div className="text-center space-y-6 py-4">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
                      <CheckCircle size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">Convite enviado!</h3>
                      <p className="text-zinc-500 text-sm">
                        Um e-mail foi enviado para <span className="font-bold text-zinc-700">{inviteSent}</span> com o link para criar a senha e acessar o sistema.
                      </p>
                    </div>
                    <button onClick={closeInvite} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors">
                      Fechar
                    </button>
                  </div>
                ) : (
                  /* Invite form */
                  <>
                    <div className="space-y-2">
                      <div className="w-12 h-12 bg-adsplay text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-adsplay/20">
                        <Send size={22} />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">Convidar Usuário</h3>
                      <p className="text-zinc-500 text-sm">A pessoa receberá um e-mail para criar a própria senha e acessar o sistema.</p>
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
                            placeholder="julia@adsplay.com.br"
                            className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/20 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nível de Acesso</label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { id: 'CONTENT_MANAGER', label: 'Gestor de Conteúdo', desc: 'Mídias, Playlists e Agenda' },
                            { id: 'ADMIN', label: 'Administrador', desc: 'Tudo exceto usuários' },
                            ...(isSuperAdmin ? [{ id: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Acesso total ao sistema' }] : [])
                          ].map((r) => (
                            <button key={r.id} type="button" onClick={() => setInviteRole(r.id as UserRole)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${inviteRole === r.id ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-100 text-zinc-600 hover:border-zinc-200'}`}
                            >
                              <p className="font-bold text-sm">{r.label}</p>
                              <p className={`text-xs ${inviteRole === r.id ? 'text-white/60' : 'text-zinc-400'}`}>{r.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-medium">
                          <AlertCircle size={18} /> {error}
                        </div>
                      )}

                      <div className="pt-2 flex gap-3">
                        <button type="button" onClick={closeInvite} className="flex-1 px-4 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">
                          Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                          className="flex-1 px-4 py-4 bg-adsplay text-white rounded-2xl font-bold hover:bg-adsplay-dark transition-colors shadow-lg shadow-adsplay/20 disabled:opacity-50"
                        >
                          {loading ? 'Enviando...' : 'Enviar Convite'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
