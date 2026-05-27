/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Player } from './pages/Player';
import { Devices } from './pages/Devices';
import { Media } from './pages/Media';
import { Library } from './pages/Library';
import { Schedule } from './pages/Schedule';
import { Playlists } from './pages/Playlists';
import { Users } from './pages/Users';
import { Profile } from './pages/Profile';
import { Backup } from './pages/Backup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Player is now the Root Route (Public) */}
            <Route path="/" element={<Player />} />
            <Route path="/player" element={<Navigate to="/" replace />} />
            <Route path="/player/*" element={<Navigate to="/" replace />} />
            
            {/* Admin Routes (Protected, With Layout) */}
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

            {/* Explicit Login Route */}
            <Route path="/login" element={
              <AuthGuard>
                <Navigate to="/admin" replace />
              </AuthGuard>
            } />

            {/* Catch-all for other top-level routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}





