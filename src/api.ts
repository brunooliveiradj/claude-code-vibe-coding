// Pixel Roads API client
// Set VITE_PIXEL_ROADS_API_URL + VITE_PIXEL_ROADS_API_TOKEN in .env.local to use real data.
// Falls back to empty arrays (mock data stays in App.tsx for dev without env vars).

const BASE = import.meta.env.VITE_PIXEL_ROADS_API_URL ?? "";
const TOKEN = import.meta.env.VITE_PIXEL_ROADS_API_TOKEN ?? "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}: ${detail}`);
  }
  return res.json();
}

export const isConfigured = Boolean(BASE);

// ── Types returned by the API ─────────────────────────────────────────────────

export interface Advertiser {
  id: string;
  name: string;
}

export interface GeoState {
  id: string;
  label: string;        // "São Paulo (SP)"
  uf?: string;          // "SP"
}

export interface GeoCity {
  id: string;
  label: string;
  state_id: string;
}

export interface Creative {
  id: string;
  name: string;
  type: "Display" | "Video";
  size?: string;
  dimensions?: string;
  preview_url?: string;
}

export interface Audience {
  id: string;
  label: string;
  kind: "broad" | "segmented";
}

export interface Pixel {
  id: string;
  name: string;
  type: "conversion" | "retargeting";
  status?: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function fetchAdvertisers(): Promise<Advertiser[]> {
  return get<Advertiser[]>("/advertisers");
}

export async function fetchStates(): Promise<GeoState[]> {
  return get<GeoState[]>("/geo/states");
}

export async function fetchCities(stateId: string): Promise<GeoCity[]> {
  return get<GeoCity[]>(`/geo/cities?state_id=${stateId}`);
}

export async function fetchCreatives(advertiserId: string): Promise<Creative[]> {
  return get<Creative[]>(`/creatives?advertiser_id=${advertiserId}`);
}

export async function fetchBroadAudiences(): Promise<Audience[]> {
  return get<Audience[]>("/audiences?kind=broad");
}

export async function fetchSegmentedAudiences(): Promise<Audience[]> {
  return get<Audience[]>("/audiences?kind=segmented");
}

export async function fetchPixels(advertiserId: string): Promise<Pixel[]> {
  return get<Pixel[]>(`/pixels?advertiser_id=${advertiserId}`);
}

export async function createPixel(body: {
  advertiser_id: string;
  name: string;
  type: "conversion" | "retargeting";
}): Promise<Pixel> {
  return post<Pixel>("/pixels", body);
}

export async function saveCampaign(payload: Record<string, unknown>): Promise<{ id: string }> {
  return post<{ id: string }>("/campaigns", payload);
}

export async function fetchCampaigns(advertiserId: string): Promise<Campaign[]> {
  return get<Campaign[]>(`/campaigns?advertiser_id=${advertiserId}`);
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: "ACTIVE" | "PAUSED" | "DRAFT" | "ENDED";
  start_date: string;
  end_date: string;
  budget: number;       // cents
  is_draft: boolean;
}
