import { LayoutDashboard, Monitor, PlaySquare, Calendar, Image as ImageIcon, Users, LogOut, User, HardDrive, Database } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Sidebar() {
  const { profile, logout, isSuperAdmin, isAdmin, isContentManager } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', show: true },
    { icon: Monitor, label: 'Dispositivos', path: '/admin/devices', show: isAdmin },
    { icon: HardDrive, label: 'Biblioteca', path: '/admin/library', show: isContentManager },
    { icon: ImageIcon, label: 'Mídias', path: '/admin/media', show: isContentManager },
    { icon: PlaySquare, label: 'Playlists', path: '/admin/playlists', show: isContentManager },
    { icon: Calendar, label: 'Agenda', path: '/admin/schedule', show: isContentManager },
    { icon: Database, label: 'Backup de Dados', path: '/admin/backup', show: isContentManager },
    { icon: Users, label: 'Usuários', path: '/admin/users', show: isSuperAdmin },
    { icon: User, label: 'Meu Perfil', path: '/admin/profile', show: true },
  ];

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col font-sans">
      <div className="p-6 border-b border-zinc-100">
        <h1 className="text-xl font-black tracking-tighter text-zinc-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-adsplay rounded-lg flex items-center justify-center text-white text-[10px] font-black">AP</div>
          Adsplay <span className="text-adsplay">Labs</span>
        </h1>
        <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-[0.2em] font-black">Signage Platform</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.filter(item => item.show).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                isActive 
                  ? "bg-adsplay text-white shadow-lg shadow-adsplay/20" 
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-adsplay"
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-100 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <Users size={20} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{profile?.displayName || 'Usuário'}</p>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">
              {profile?.role?.replace('_', ' ') || 'Acessando...'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
