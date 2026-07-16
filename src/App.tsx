import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';

const Player = lazy(() => import('./pages/Player').then(m => ({ default: m.Player })));
const Layout = lazy(() => import('./components/Layout').then(m => ({ default: m.Layout })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Devices = lazy(() => import('./pages/Devices').then(m => ({ default: m.Devices })));
const Media = lazy(() => import('./pages/Media').then(m => ({ default: m.Media })));
const Library = lazy(() => import('./pages/Library').then(m => ({ default: m.Library })));
const Schedule = lazy(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })));
const Playlists = lazy(() => import('./pages/Playlists').then(m => ({ default: m.Playlists })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Backup = lazy(() => import('./pages/Backup').then(m => ({ default: m.Backup })));
const InboxPage = lazy(() => import('./pages/Inbox/InboxPage').then(m => ({ default: m.InboxPage })));

function PageLoader() {
  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Player />} />
              <Route path="/player" element={<Navigate to="/" replace />} />
              <Route path="/player/*" element={<Navigate to="/" replace />} />

              <Route path="/admin/*" element={
                <AuthGuard>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/devices" element={<Devices />} />
                      <Route path="/library" element={<Library />} />
                      <Route path="/media" element={<Media />} />
                      <Route path="/playlists" element={<Playlists />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/backup" element={<Backup />} />
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                  </Layout>
                </AuthGuard>
              } />

              <Route path="/login" element={
                <AuthGuard>
                  <Navigate to="/admin" replace />
                </AuthGuard>
              } />

              <Route path="/inbox" element={<InboxPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
