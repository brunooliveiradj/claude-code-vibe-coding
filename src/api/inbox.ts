import type { ClassifiedEmail, Feedback } from '../types/email';

const BASE = '/api';

export async function fetchAndClassify(): Promise<{
  alta: ClassifiedEmail[];
  media: ClassifiedEmail[];
  lixo: ClassifiedEmail[];
}> {
  const res = await fetch(`${BASE}/classify`, { method: 'POST' });
  if (!res.ok) throw new Error(`Erro ao classificar: ${res.statusText}`);
  return res.json();
}

export async function saveFeedback(feedback: Feedback): Promise<void> {
  const res = await fetch(`${BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!res.ok) throw new Error(`Erro ao salvar feedback: ${res.statusText}`);
}

export async function markThreadsRead(threadIds: string[]): Promise<void> {
  const res = await fetch(`${BASE}/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadIds }),
  });
  if (!res.ok) throw new Error(`Erro ao marcar como lido: ${res.statusText}`);
}

export async function getFeedbackStats(): Promise<{
  total: number;
  correct: number;
}> {
  const res = await fetch(`${BASE}/feedback/stats`);
  if (!res.ok) return { total: 0, correct: 0 };
  return res.json();
}
