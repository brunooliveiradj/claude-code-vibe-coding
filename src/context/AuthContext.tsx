import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, signInWithGoogle, signOut } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isContentManager: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          // 1. Try fetching by UID
          const docRef = doc(db, 'users', user.uid);
          let docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile({ uid: user.uid, ...docSnap.data() } as UserProfile);
          } else {
            const isDefaultAdmin = user.email?.toLowerCase()?.trim() === 'bruno@adsplay.com.br';
            
            // 2. Try fetching the specific invite document (predictable ID)
            const inviteId = `invite_${user.email?.toLowerCase()?.trim()}`;
            const inviteRef = doc(db, 'users', inviteId);
            const inviteSnap = await getDoc(inviteRef);
            
            if (inviteSnap.exists()) {
              const inviteData = inviteSnap.data();
              
              // Migrate invite doc to UID-based doc
              const profileData = {
                email: user.email!.toLowerCase().trim(),
                role: inviteData.role,
                displayName: user.displayName || inviteData.displayName || '',
                photoURL: user.photoURL || inviteData.photoURL || '',
                password: inviteData.password || '', // Keep password if it was set
                createdAt: inviteData.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              
              try {
                await setDoc(docRef, profileData);
                // Delete the invite doc
                await deleteDoc(inviteRef);
              } catch (e) {
                console.error('Failed to migrate invite:', e);
              }
              setProfile({ uid: user.uid, ...profileData } as UserProfile);
            } else if (isDefaultAdmin) {
              // 3. Auto-create profile for the first admin if it doesn't exist
              const profileData = {
                email: user.email!.toLowerCase().trim(),
                role: 'SUPER_ADMIN' as UserRole,
                displayName: user.displayName || 'Bruno Adsplay',
                photoURL: user.photoURL || '',
                createdAt: serverTimestamp()
              };
              
              try {
                await setDoc(docRef, profileData);
              } catch (e) {
                console.error('Failed to auto-create default admin profile:', e);
                // Even if setDoc fails (e.g. rules issue), we allow Bruno in with a virtual profile
              }
              setProfile({ uid: user.uid, ...profileData } as UserProfile);
            } else {
              setProfile(null);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log('Login popup request was cancelled by a subsequent request.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed by the user.');
      } else {
        console.error('Login error:', error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await firebaseSignInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const role = profile?.role || null;
  const isSuperAdmin = role === 'SUPER_ADMIN' || user?.email === 'bruno@adsplay.com.br';
  const isAdmin = isSuperAdmin || role === 'ADMIN';
  const isContentManager = isAdmin || role === 'CONTENT_MANAGER';

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      role, 
      isSuperAdmin, 
      isAdmin, 
      isContentManager, 
      isLoggingIn,
      login, 
      loginWithEmail,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
