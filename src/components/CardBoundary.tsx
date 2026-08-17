import * as React from 'react';
import { Tv } from 'lucide-react';

const AUTO_RECOVER_MS = 10000;

/**
 * Error boundary for a SINGLE player card.
 *
 * The TVs are unattended, so a card that throws must never take the whole
 * player down (the app-level ErrorBoundary renders a screen with a button
 * nobody is there to click). Instead we show a neutral placeholder and reload
 * the player automatically, so the playlist resumes on its own.
 *
 * The boundary is mounted inside the per-card element, whose React key changes
 * on every rotation — so it remounts (and clears itself) card by card, and one
 * bad card cannot poison the ones after it.
 */
export class CardBoundary extends (React.Component as any) {
  private timer: any = null;

  constructor(props: any) {
    super(props);
    this.state = { failed: false };
  }

  public static getDerivedStateFromError() {
    return { failed: true };
  }

  public componentDidCatch(error: Error) {
    console.error(`[player] card "${this.props.mediaId}" failed to render:`, error);
    if (!this.timer) {
      this.timer = setTimeout(() => window.location.reload(), AUTO_RECOVER_MS);
    }
  }

  public componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  public render() {
    if (this.state.failed) {
      return <CardPlaceholder label={this.props.title || 'Conteúdo indisponível'} detail="Recarregando player..." />;
    }
    return this.props.children;
  }
}

/**
 * Neutral placeholder. Used for render failures and for media the player
 * cannot draw (unknown type on an outdated bundle, or an empty payload) —
 * anything is better than leaving the TV on a black screen.
 */
export const CardPlaceholder = React.memo(({ label, detail }: { label: string; detail?: string }) => (
  <div className="w-full h-full bg-[#050505] flex flex-col items-center justify-center gap-6">
    <div className="relative">
      <div className="absolute inset-0 bg-adsplay/20 blur-3xl rounded-full" />
      <Tv size={72} className="text-zinc-800 relative" />
    </div>
    <div className="text-center space-y-2">
      <p className="text-2xl font-black text-zinc-500 tracking-tight">{label}</p>
      {detail && <p className="text-sm font-bold text-zinc-700 uppercase tracking-[0.2em]">{detail}</p>}
    </div>
  </div>
));
