export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CONTENT_MANAGER';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  photoURL?: string;
  password?: string; // Added for internal tracking as requested
  createdAt: any;
  updatedAt?: any;
}

export type Company = 'Adsplay' | 'Mootag' | 'Geral';

export interface Media {
  id: string;
  title: string;
  type: 'IMAGE_HERO' | 'VIDEO_FILE' | 'YOUTUBE' | 'DASHBOARD' | 'INSTAGRAM' | 'MONTHLY_GOAL' | 'CAROUSEL' | 'NEWS_CLIPPING' | 'WEATHER' | 'NORTH_STAR';
  company: Company;
  payload: any;
  createdAt?: any;
}

export interface Playlist {
  id: string;
  name: string;
  company: Company;
  logoUrl?: string;
  items: {
    media_id: string;
    duration: number;
  }[];
  createdAt?: any;
}

export interface Device {
  id: string;
  name: string;
  pair_code: string;
  is_paired: boolean;
  last_ping?: any;
  current_playlist_id?: string;
}
