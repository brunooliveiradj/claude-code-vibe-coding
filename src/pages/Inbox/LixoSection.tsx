import { useState, useMemo } from 'react';
import type { Category, ClassifiedEmail } from '../../types/email';

interface Props {
  emails: ClassifiedEmail[];
  onMarkRead: (ids: string[]) => void;
  onMove: (email: ClassifiedEmail, to: Category) => void;
}

export function LixoSection({ emails, onMarkRead, onMove }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const allSelected = selected.size === emails.length && emails.length > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(emails.map(e => e.id)));
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleMarkRead() {
    const ids = selected.size > 0 ? [...selected] : emails.map(e => e.id);
    onMarkRead(ids);
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  const groups = useMemo(() => {
    const map = new Map<string, ClassifiedEmail[]>();
    for (const e of emails) {
      const domain = e.senderEmail.split('@')[1] ?? e.sender;
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(e);
    }
    return map;
  }, [emails]);

  return (
    <section className="mt-6 border border-[#2E2B26] rounded-xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1C1A17] border-b border-[#2E2B26]">
        <button onClick={toggleAll} className="flex-shrink-0">
          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            allSelected
              ? 'bg-[#5A5551] border-[#5A5551]'
              : 'border-[#3A3630] hover:border-[#5A5551]'
          }`}>
            {allSelected && <span className="text-[#EDE9E3] text-[10px] leading-none">✓</span>}
          </div>
        </button>

        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className="font-mono text-2xl font-bold text-[#5A5551] tabular-nums leading-none">
            {emails.length}
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#7D7872]">Lixo</p>
            <p className="text-[10px] text-[#4A4642]">newsletters · cold outreach · automáticos</p>
          </div>
          <span className={`ml-auto text-[#4A4642] text-sm transition-transform ${collapsed ? '-rotate-90' : ''}`}>▾</span>
        </button>

        <button
          onClick={handleMarkRead}
          disabled={emails.length === 0}
          className="flex-shrink-0 text-[11px] px-3 py-1.5 rounded-md border border-[#2E2B26] text-[#7D7872] hover:border-[#5A5551] hover:text-[#EDE9E3] transition-colors disabled:opacity-30"
        >
          {selectedCount > 0
            ? `Marcar ${selectedCount} como lido`
            : 'Marcar todos como lido'}
        </button>
      </div>

      {/* list */}
      {!collapsed && (
        <div className="divide-y divide-[#1E1C19]">
          {emails.length === 0 && (
            <p className="text-[12px] text-[#4A4642] text-center py-8">Nenhum email de baixa prioridade.</p>
          )}
          {emails.map(email => (
            <LixoRow
              key={email.id}
              email={email}
              selected={selected.has(email.id)}
              onToggle={() => toggle(email.id)}
              onMove={(to) => onMove(email, to)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface RowProps {
  email: ClassifiedEmail;
  selected: boolean;
  onToggle: () => void;
  onMove: (to: Category) => void;
}

function LixoRow({ email, selected, onToggle, onMove }: RowProps) {
  return (
    <div className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#1C1A17] ${selected ? 'bg-[#1C1A17]' : ''}`}>
      <button onClick={onToggle} className="flex-shrink-0">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          selected
            ? 'bg-[#5A5551] border-[#5A5551]'
            : 'border-[#2E2B26] hover:border-[#5A5551]'
        }`}>
          {selected && <span className="text-[#EDE9E3] text-[10px] leading-none">✓</span>}
        </div>
      </button>

      <span className="text-[11px] text-[#4A4642] w-28 truncate flex-shrink-0">{email.sender}</span>

      <span className="text-[12px] text-[#6B6560] flex-1 truncate">{email.subject}</span>

      <span className="text-[10px] font-mono text-[#3A3630] flex-shrink-0">{email.date}</span>

      {/* move buttons — appear on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onMove('alta')}
          className="text-[10px] px-2 py-0.5 rounded border border-[#2E2B26] text-[#7D7872] hover:border-red-900 hover:text-red-400 transition-colors"
          title="Mover para Alta"
        >
          → Alta
        </button>
        <button
          onClick={() => onMove('media')}
          className="text-[10px] px-2 py-0.5 rounded border border-[#2E2B26] text-[#7D7872] hover:border-amber-900 hover:text-amber-400 transition-colors"
          title="Mover para Média"
        >
          → Média
        </button>
      </div>
    </div>
  );
}
