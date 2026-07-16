import { useEffect } from 'react';
import { useInbox } from '../../hooks/useInbox';
import { EmailCard } from './EmailCard';
import { LixoSection } from './LixoSection';
import type { Category, ClassifiedEmail } from '../../types/email';

const ACCENT: Record<Category, string> = {
  alta: '#FF5252',
  media: '#F5A623',
  lixo: '#5A5551',
};

const LABEL: Record<Category, string> = {
  alta: 'Alta Prioridade',
  media: 'Média',
  lixo: 'Lixo',
};

const HINT: Record<Category, string> = {
  alta: 'ação imediata',
  media: 'verificar hoje',
  lixo: 'pode ignorar',
};

interface ColProps {
  category: Category;
  emails: ClassifiedEmail[];
  onConfirm: (e: ClassifiedEmail) => void;
  onMove: (e: ClassifiedEmail, to: Category) => void;
}

function EmailColumn({ category, emails, onConfirm, onMove }: ColProps) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className="pb-3 mb-3 border-b border-[#2E2B26]"
        style={{ borderTop: `2px solid ${ACCENT[category]}` }}
      >
        <div className="flex items-baseline gap-2.5 mt-3">
          <span
            className="font-mono text-[40px] font-black leading-none tabular-nums"
            style={{ color: ACCENT[category] }}
          >
            {emails.length}
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#7D7872] leading-none mb-0.5">
              {LABEL[category]}
            </p>
            <p className="text-[10px] text-[#4A4642]">{HINT[category]}</p>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 space-y-0.5 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[#2E2B26]">
        {emails.length === 0 ? (
          <p className="text-[12px] text-[#3A3630] text-center py-8">Nenhum email aqui.</p>
        ) : (
          emails.map(email => (
            <EmailCard
              key={email.id}
              email={email}
              category={category}
              onConfirm={() => onConfirm(email)}
              onMove={(to) => onMove(email, to)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function InboxPage() {
  const { state, refresh, moveEmail, confirmEmail, markLixoRead, accuracy } = useInbox();
  const { alta, media, lixo, lastUpdated, status, error } = state;

  const total = alta.length + media.length + lixo.length;

  function formatTime(d: Date) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#12110F', color: '#EDE9E3', fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* ── HEADER ─────────────────────── */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-[#2E2B26] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold tracking-[0.06em] uppercase">
            Smart<span style={{ color: '#5EADF7' }}>Inbox</span>
          </span>
          <span className="text-[11px] font-mono text-[#4A4642]">
            {status === 'loading'
              ? 'classificando…'
              : lastUpdated
              ? `${total} emails · ${formatTime(lastUpdated)}`
              : 'nenhum email carregado'}
          </span>
        </div>

        {accuracy !== null && (
          <div className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-900/40 rounded-full px-2.5 py-1 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {accuracy}% precisão
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="text-[11px] text-red-400">{error}</span>
          )}
          <button
            onClick={refresh}
            disabled={status === 'loading'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#2E2B26] text-[11px] text-[#7D7872] hover:text-[#EDE9E3] hover:border-[#4A4642] transition-colors disabled:opacity-40"
          >
            <span className={status === 'loading' ? 'animate-spin' : ''}>↻</span>
            Atualizar caixa
          </button>
        </div>
      </header>

      {/* ── STATS BAR ──────────────────── */}
      <div className="flex items-center gap-0 px-5 bg-[#1A1916] border-b border-[#2E2B26] flex-shrink-0" style={{ height: 36 }}>
        {(['alta', 'media', 'lixo'] as Category[]).map((cat, i) => (
          <div key={cat} className="flex items-center">
            {i > 0 && <div className="w-px h-3.5 bg-[#2E2B26] mx-3" />}
            <div className="flex items-center gap-2 text-[12px]">
              <span
                className="font-mono font-bold tabular-nums px-1.5 py-0.5 rounded text-[11px]"
                style={{
                  background: `${ACCENT[cat]}18`,
                  color: cat === 'lixo' ? '#8A8480' : ACCENT[cat],
                }}
              >
                {state[cat].length}
              </span>
              <span className="text-[#7D7872]">{LABEL[cat]}</span>
            </div>
          </div>
        ))}
        <span className="ml-auto text-[11px] font-mono text-[#3A3630] tabular-nums">
          {total} emails
        </span>
      </div>

      {/* ── EMPTY STATE ────────────────── */}
      {status === 'idle' && total === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-[#4A4642] text-sm">Nenhum email carregado ainda.</p>
          <button
            onClick={refresh}
            className="px-4 py-2 rounded-lg border border-[#2E2B26] text-[#7D7872] hover:text-[#EDE9E3] hover:border-[#5EADF7] transition-colors text-sm"
          >
            ↻ Carregar caixa de entrada
          </button>
        </div>
      )}

      {/* ── LOADING STATE ──────────────── */}
      {status === 'loading' && total === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#2E2B26] border-t-[#5EADF7] rounded-full animate-spin" />
          <p className="text-[11px] text-[#4A4642] font-mono">Buscando e classificando emails…</p>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────── */}
      {total > 0 && (
        <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0">
          {/* Alta + Média columns */}
          <div className="grid grid-cols-2 gap-5 mb-2" style={{ maxHeight: 'calc(55vh)', minHeight: 240 }}>
            <EmailColumn
              category="alta"
              emails={alta}
              onConfirm={(e) => confirmEmail(e, 'alta')}
              onMove={(e, to) => moveEmail(e, 'alta', to)}
            />
            <EmailColumn
              category="media"
              emails={media}
              onConfirm={(e) => confirmEmail(e, 'media')}
              onMove={(e, to) => moveEmail(e, 'media', to)}
            />
          </div>

          {/* Lixo — full width, compact, bulk actions */}
          <LixoSection
            emails={lixo}
            onMarkRead={markLixoRead}
            onMove={(e, to) => moveEmail(e, 'lixo', to)}
          />
        </div>
      )}
    </div>
  );
}
