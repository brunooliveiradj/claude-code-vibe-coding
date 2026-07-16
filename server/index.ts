import 'dotenv/config';
import express from 'express';
import { getAuthUrl, exchangeCode, isAuthenticated, fetchUnreadEmails, markThreadsAsRead } from './gmail';
import { classifyEmails, type Category } from './claude';
import { saveFeedback, getStats } from './db';

const app = express();
app.use(express.json());

const PORT = Number(process.env.SERVER_PORT ?? 3001);

// ── Auth ─────────────────────────────────────────────
app.get('/api/auth/google', (_req, res) => {
  res.redirect(getAuthUrl());
});

app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Código OAuth ausente.');
  try {
    const refreshToken = await exchangeCode(code);
    if (refreshToken) {
      console.log('\n════════════════════════════════════════════');
      console.log('GOOGLE_REFRESH_TOKEN (adicione ao .env.local):');
      console.log(refreshToken);
      console.log('════════════════════════════════════════════\n');
    }
    res.send('Autenticado! Copie o refresh token do terminal para o .env.local e reinicie o servidor. Pode fechar esta aba.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Falha na troca do código OAuth.');
  }
});

app.get('/api/auth/status', (_req, res) => {
  res.json({ authenticated: isAuthenticated() });
});

// ── Classify: busca (call 1) + classifica (call 2) ──
app.post('/api/classify', async (_req, res) => {
  try {
    if (!isAuthenticated()) {
      return res.status(401).json({ error: 'Não autenticado no Gmail. Acesse /api/auth/google.' });
    }

    // Call 1 — dados brutos do Gmail
    const emails = await fetchUnreadEmails(40);
    if (emails.length === 0) {
      return res.json({ alta: [], media: [], lixo: [] });
    }

    // Call 2 — classificação estruturada com contexto de feedback
    const classifications = await classifyEmails(emails);
    const byId = new Map(classifications.map((c) => [c.id, c]));

    const result: Record<Category, unknown[]> = { alta: [], media: [], lixo: [] };
    for (const email of emails) {
      const c = byId.get(email.id);
      const category: Category = c?.category ?? 'media'; // sem classificação → media (revisão manual)
      result[category].push({ ...email, category, reason: c?.reason });
    }

    res.json(result);
  } catch (err) {
    console.error('classify error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
});

// ── Feedback ─────────────────────────────────────────
app.post('/api/feedback', (req, res) => {
  const { emailId, sender, subject, originalCategory, confirmedCategory, correct } = req.body ?? {};
  if (!emailId || !sender || !originalCategory || !confirmedCategory || typeof correct !== 'boolean') {
    return res.status(400).json({ error: 'Payload de feedback incompleto.' });
  }
  try {
    saveFeedback({ emailId, sender, subject: subject ?? '', originalCategory, confirmedCategory, correct });
    res.json({ ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    res.status(500).json({ error: 'Falha ao salvar feedback.' });
  }
});

app.get('/api/feedback/stats', (_req, res) => {
  res.json(getStats());
});

// ── Mark as read (bulk) ──────────────────────────────
app.post('/api/mark-read', async (req, res) => {
  const { threadIds } = req.body ?? {};
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return res.status(400).json({ error: 'threadIds deve ser um array não vazio.' });
  }
  try {
    await markThreadsAsRead(threadIds);
    res.json({ ok: true, marked: threadIds.length });
  } catch (err) {
    console.error('mark-read error:', err);
    res.status(500).json({ error: 'Falha ao marcar como lido.' });
  }
});

app.listen(PORT, () => {
  console.log(`Smart Inbox API rodando em http://localhost:${PORT}`);
  if (!isAuthenticated()) {
    console.log(`→ Gmail não autenticado. Abra http://localhost:3000/api/auth/google para autorizar.`);
  }
});
