import { writable } from 'svelte/store';

export const mobileEditStatus = writable<{
  text: string;
  tone: 'saved' | 'dirty' | 'saving' | 'error';
} | null>(null);
