/// <reference types="vite/client" />

/** Puter.js — https://developer.puter.com/tutorials/free-unlimited-text-to-speech-api */
type PuterTxt2SpeechOptions = Record<string, unknown>;

interface PuterAI {
  txt2speech(
    text: string,
    languageOrOptions?: string | PuterTxt2SpeechOptions
  ): Promise<HTMLAudioElement>;
}

interface PuterGlobal {
  ai: PuterAI;
}

declare global {
  interface Window {
    puter?: PuterGlobal;
  }
}

export {};
