import { useState, useCallback } from 'react';
import type { Category, ClassifiedEmail, Feedback, InboxState } from '../types/email';
import { fetchAndClassify, saveFeedback, markThreadsRead, getFeedbackStats } from '../api/inbox';

const INITIAL: InboxState = {
  alta: [],
  media: [],
  lixo: [],
  totalFeedbacks: 0,
  correctFeedbacks: 0,
  lastUpdated: null,
  status: 'idle',
  error: null,
};

export function useInbox() {
  const [state, setState] = useState<InboxState>(INITIAL);

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading', error: null }));
    try {
      const [emails, stats] = await Promise.all([
        fetchAndClassify(),
        getFeedbackStats(),
      ]);
      setState(s => ({
        ...s,
        ...emails,
        totalFeedbacks: stats.total,
        correctFeedbacks: stats.correct,
        lastUpdated: new Date(),
        status: 'idle',
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }));
    }
  }, []);

  const moveEmail = useCallback(async (
    email: ClassifiedEmail,
    fromCat: Category,
    toCat: Category,
  ) => {
    setState(s => {
      const fromList = s[fromCat].filter(e => e.id !== email.id);
      const toList = [{ ...email, category: toCat }, ...s[toCat]];
      return {
        ...s,
        [fromCat]: fromList,
        [toCat]: toList,
        totalFeedbacks: s.totalFeedbacks + 1,
      };
    });

    const feedback: Feedback = {
      emailId: email.id,
      sender: email.senderEmail,
      subject: email.subject,
      originalCategory: fromCat,
      confirmedCategory: toCat,
      correct: false,
    };
    await saveFeedback(feedback).catch(console.error);
  }, []);

  const confirmEmail = useCallback(async (email: ClassifiedEmail, cat: Category) => {
    setState(s => ({
      ...s,
      totalFeedbacks: s.totalFeedbacks + 1,
      correctFeedbacks: s.correctFeedbacks + 1,
    }));

    const feedback: Feedback = {
      emailId: email.id,
      sender: email.senderEmail,
      subject: email.subject,
      originalCategory: cat,
      confirmedCategory: cat,
      correct: true,
    };
    await saveFeedback(feedback).catch(console.error);
  }, []);

  const markLixoRead = useCallback(async (ids: string[]) => {
    const threadIds = state.lixo
      .filter(e => ids.includes(e.id))
      .map(e => e.threadId);

    setState(s => ({
      ...s,
      lixo: s.lixo.filter(e => !ids.includes(e.id)),
    }));

    await markThreadsRead(threadIds).catch(console.error);
  }, [state.lixo]);

  const accuracy = state.totalFeedbacks === 0
    ? null
    : Math.round((state.correctFeedbacks / state.totalFeedbacks) * 100);

  return { state, refresh, moveEmail, confirmEmail, markLixoRead, accuracy };
}
