import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const TTS_LANG = "it-IT";

function haltAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.currentTime = 0;
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genRef = useRef(0);

  useEffect(() => {
    return () => {
      genRef.current += 1;
      haltAudio(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    haltAudio(audioRef.current);
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const puter = typeof window !== "undefined" ? window.puter : undefined;
    if (!puter?.ai?.txt2speech) {
      toast.error("Voce non disponibile: ricarica la pagina o controlla la connessione.");
      return;
    }

    genRef.current += 1;
    const myGen = genRef.current;
    haltAudio(audioRef.current);
    audioRef.current = null;
    setSpeaking(true);

    puter.ai
      .txt2speech(trimmed, TTS_LANG)
      .then((audio) => {
        if (myGen !== genRef.current) return;
        audioRef.current = audio;
        audio.onended = () => {
          if (audioRef.current === audio) audioRef.current = null;
          setSpeaking(false);
        };
        audio.onerror = () => {
          if (audioRef.current === audio) audioRef.current = null;
          setSpeaking(false);
          toast.error("Errore durante la riproduzione audio.");
        };
        void audio.play().catch(() => {
          if (myGen !== genRef.current) return;
          setSpeaking(false);
          toast.error("Impossibile avviare la riproduzione.");
        });
      })
      .catch(() => {
        if (myGen !== genRef.current) return;
        setSpeaking(false);
        toast.error("Errore sintesi vocale. Riprova tra poco.");
      });
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (speaking) stop();
      else speak(text);
    },
    [speak, speaking, stop]
  );

  return { speak, toggle, stop, speaking };
}
