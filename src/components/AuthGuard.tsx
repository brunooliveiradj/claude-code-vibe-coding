import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, ShieldAlert, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, login, loginWithEmail, logout, isLoggingIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão: Verifique sua internet ou se o domínio está bloqueado por um firewall.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-zinc-200 rounded-full" />
          <div className="h-4 w-24 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center space-y-8 border border-zinc-100">
          <div className="w-16 h-16 bg-adsplay text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-adsplay/20">
            <LogIn size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tighter">Adsplay <span className="text-adsplay">Labs</span></h1>
            <p className="text-zinc-500 font-medium">Acesse o painel de controle das TVs.</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/20 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 ring-adsplay/20 transition-all font-medium"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-xs font-bold text-center">{error}</p>
            )}

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/10 disabled:opacity-50"
            >
              {isLoggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-white px-4 text-zinc-400">Ou continue com</span>
            </div>
          </div>

          <button 
            onClick={login}
            disabled={isLoggingIn}
            className="w-full py-4 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-rose-600">Acesso Negado</h1>
            <p className="text-zinc-500">Seu e-mail ({user.email}) não está autorizado a acessar este painel. Entre em contato com um administrador.</p>
          </div>
          <button 
            onClick={logout}
            className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
          >
            Sair e tentar outra conta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
