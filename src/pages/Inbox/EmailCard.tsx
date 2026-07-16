import { useState } from 'react';
import type { Category, ClassifiedEmail } from '../../types/email';

const AVATAR_COLORS: Record<string, string> = {
  A:'#5EADF7',B:'#7C6DF0',C:'#5BC9A8',D:'#F0907C',E:'#F0C85D',
  F:'#7FBA8A',G:'#9B8AF5',H:'#F57C7C',I:'#6DB8F5',J:'#F5A65D',
  K:'#78C88A',L:'#C87CF0',M:'#F07C9B',N:'#5DC9C9',O:'#F5CF5D',
  P:'#8AB4F0',Q:'#F09B5D',R:'#5BA85A',S:'#F05D5D',T:'#5DC9F0',
  U:'#B07CF0',V:'#F0D07C',W:'#7CF0C8',X:'#F07CB0',Y:'#90C85D',Z:'#F07C5D',
};

function avatarColor(name: string) {
  const ch = name.charAt(0).toUpperCase();
  return AVATAR_COLORS[ch] ?? '#7D7872';
}

interface Props {
  email: ClassifiedEmail;
  category: Category;
  onConfirm: () => void;
  onMove: (to: Category) => void;
}

const OTHER_CATS: Record<Category, Category[]> = {
  alta: ['media', 'lixo'],
  media: ['alta', 'lixo'],
  lixo: ['alta', 'media'],
};

const CAT_LABEL: Record<Category, string> = {
  alta: 'Alta',
  media: 'Média',
  lixo: 'Lixo',
};

const ACCENT: Record<Category, string> = {
  alta: '#FF5252',
  media: '#F5A623',
  lixo: '#5A5551',
};

export function EmailCard({ email, category, onConfirm, onMove }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [showMove, setShowMove] = useState(false);

  function handleConfirm() {
    setConfirmed(true);
    onConfirm();
  }

  const initial = email.sender.charAt(0).toUpperCase();

  return (
    <div
      className="group relative rounded-md px-3 py-2.5 transition-colors hover:bg-white/5"
      style={{ borderLeft: `2px solid ${ACCENT[category]}20` }}
      onMouseEnter={() => {}}
      onMouseLeave={() => setShowMove(false)}
    >
      {/* left accent bar */}
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ background: ACCENT[category], opacity: confirmed ? 0.25 : 0.6 }}
      />

      <div className={confirmed ? 'opacity-30' : ''}>
        {/* sender row */}
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: avatarColor(email.sender) }}
          >
            {initial}
          </div>
          <span className="text-[11px] text-[#7D7872] truncate flex-1">{email.sender}</span>
          <span className="text-[10px] font-mono text-[#4A4642] flex-shrink-0">{email.date}</span>
        </div>

        {/* subject */}
        <p className="text-[13px] font-medium text-[#EDE9E3] leading-snug line-clamp-2 mb-1">
          {email.subject}
        </p>

        {/* snippet */}
        {email.snippet && (
          <p className="text-[11px] text-[#4A4642] truncate">{email.snippet}</p>
        )}

        {/* feedback row — appears on hover */}
        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="text-[11px] px-2 py-0.5 rounded border border-[#2E2B26] text-[#7D7872] hover:border-emerald-800 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors"
          >
            👍 Correto
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMove(v => !v)}
              className="text-[11px] px-2 py-0.5 rounded border border-[#2E2B26] text-[#7D7872] hover:border-red-900 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            >
              👎 Errado
            </button>

            {showMove && (
              <div className="absolute bottom-full left-0 mb-1 bg-[#1F1D1A] border border-[#3A3630] rounded-lg py-1 min-w-[130px] z-20 shadow-xl">
                <p className="text-[10px] text-[#4A4642] px-3 py-1 uppercase tracking-wider">Mover para</p>
                {OTHER_CATS[category].map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setShowMove(false); onMove(cat); }}
                    className="w-full text-left text-[12px] text-[#7D7872] hover:text-[#EDE9E3] hover:bg-[#2A2824] px-3 py-1.5 flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: ACCENT[cat] }}
                    />
                    {CAT_LABEL[cat]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
