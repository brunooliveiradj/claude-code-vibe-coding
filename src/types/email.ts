export type Category = 'alta' | 'media' | 'lixo';

export interface Email {
  id: string;
  threadId: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
}

export interface ClassifiedEmail extends Email {
  category: Category;
  reason?: string;
}

export interface Feedback {
  emailId: string;
  sender: string;
  subject: string;
  originalCategory: Category;
  confirmedCategory: Category;
  correct: boolean;
}

export interface InboxState {
  alta: ClassifiedEmail[];
  media: ClassifiedEmail[];
  lixo: ClassifiedEmail[];
  totalFeedbacks: number;
  correctFeedbacks: number;
  lastUpdated: Date | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}
