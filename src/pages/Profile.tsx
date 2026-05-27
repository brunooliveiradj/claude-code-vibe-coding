import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Shield,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, auth, updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function Profile() {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Update Firestore Profile
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        updatedAt: serverTimestamp()
      });

      // 2. If email changed, update in Auth (requires re-auth)
      if (email !== user.email) {
        if (!currentPassword) {
          throw new Error('Senha atual é necessária para alterar o e-mail.');
        }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, email);
        await updateDoc(doc(db, 'users', user.uid), { email });
      }

      // 3. If password changed, update in Auth (requires re-auth)
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('As senhas não coincidem.');
        }
        if (newPassword.length < 6) {
          throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        }
        if (!currentPassword) {
          throw new Error('Senha atual é necessária para alterar a senha.');
        }

        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        // Also update the stored password in Firestore for the admin to see (as requested)
        await updateDoc(doc(db, 'users', user.uid), { password: newPassword });
      }

      setSuccess('Perfil atualizado com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('Senha atual incorreta.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Por segurança, faça login novamente para realizar esta alteração.');
      } else {
        setError(err.message || 'Erro ao atualizar perfil.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <header>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-900">Meu Perfil</h2>
        <p className="text-zinc-500 font-medium">Gerencie suas informações de acesso e segurança.</p>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-adsplay text-white flex items-center justify-center shadow-lg shadow-adsplay/20">
            <User size={32} />
          </div>
          <div>
            <p className="font-black text-xl text-zinc-900">{profile?.displayName || 'Usuário'}</p>
            <div className="flex items-center gap-2 text-zinc-500">
              <Shield size={14} />
              <span className="text-xs font-bold uppercase tracking-widest">{profile?.role}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="p-8 space-y-8">
          {/* Basic Info */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Mail size={14} /> Informações Básicas
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/10 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">E-mail de Login</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/10 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Key size={14} /> Segurança
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Senha Atual</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input 
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Necessária para alterações críticas"
                    className="w-full pl-12 pr-12 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/10 transition-all font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nova Senha</label>
                  <div className="relative">
                    <input 
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/10 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <div className="relative">
                    <input 
                      type={showNewPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/10 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm font-bold"
              >
                <CheckCircle2 size={18} />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-adsplay text-white rounded-2xl font-bold hover:bg-adsplay-dark transition-all flex items-center justify-center gap-2 shadow-xl shadow-adsplay/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={20} />
            )}
            Salvar Alterações
          </button>
        </form>
      </div>
    </motion.div>
  );
}
