import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/callback'
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
}

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string): Promise<string | null> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens.refresh_token ?? null;
}

export function isAuthenticated(): boolean {
  const c = oauth2Client.credentials;
  return Boolean(c.refresh_token || process.env.GOOGLE_REFRESH_TOKEN);
}

export interface RawEmail {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
}

function parseSender(from: string): { name: string; email: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2], email: m[2] };
  return { name: from, email: from };
}

/** Busca os N emails não lidos mais recentes do inbox. */
export async function fetchUnreadEmails(max = 40): Promise<RawEmail[]> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: max,
  });

  const messages = list.data.messages ?? [];
  if (messages.length === 0) return [];

  const emails = await Promise.all(
    messages.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = msg.data.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

      const { name, email } = parseSender(header('From'));
      const dateRaw = header('Date');
      const date = dateRaw
        ? new Date(dateRaw).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : '';

      return {
        id: msg.data.id!,
        threadId: msg.data.threadId!,
        sender: name,
        senderEmail: email,
        subject: header('Subject') || '(sem assunto)',
        snippet: msg.data.snippet ?? '',
        date,
      };
    })
  );

  return emails;
}

/** Remove o label UNREAD das threads informadas. */
export async function markThreadsAsRead(threadIds: string[]): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await Promise.all(
    threadIds.map((threadId) =>
      gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      })
    )
  );
}
