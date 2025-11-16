// FIX: Import `ReactNode` from `react` to use it in the `Message` interface.
import type { ReactNode } from 'react';

export type Sender = 'bot' | 'user';

export interface Message {
  id: number;
  sender: Sender;
  text?: string | ReactNode;
  imageUrl?: string; // For base64 image data
}

export type AppState = 'welcome' | 'about' | 'terms' | 'chat';
export type ConversationStep = 'name' | 'interest' | 'email' | 'done';