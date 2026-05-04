import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeLetterDigitBoundaries } from "@/lib/letterDigitBoundaries";

/** Flag per parola (solo ref interno, mai mostrato in UI). */
export type TtsWordFlag = "it" | "en" | "fr" | "sp";

const LANG_DEFAULT: TtsWordFlag = "it";

const BCP47: Record<TtsWordFlag, string> = {
  it: "it-IT",
  en: "en-US",
  fr: "fr-FR",
  sp: "es-ES",
};

/** Prefisso `voice.lang` per SpeechSynthesis (sp → es). */
function voiceLangPrefix(flag: TtsWordFlag): string {
  return flag === "sp" ? "es" : flag;
}

const EN_HINT = new Set([
  "the",
  "a",
  "an",
  "or",
  "and",
  "is",
  "are",
  "was",
  "were",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "from",
  "by",
  "as",
  "if",
  "else",
  "return",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "this",
  "new",
  "class",
  "extends",
  "import",
  "export",
  "default",
  "async",
  "await",
  "function",
  "const",
  "let",
  "var",
  "plugin",
  "api",
  "http",
  "https",
  "json",
  "yaml",
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "list",
  "map",
  "set",
  "key",
  "value",
  "server",
  "client",
  "cache",
  "error",
  "warn",
  "debug",
  "info",
  "stack",
  "trace",
]);

/** Chiavi in forma normalizzata (senza accenti), come `normalizeWord`. */
const FR_HINT = new Set([
  "avec",
  "pour",
  "dans",
  "sur",
  "sous",
  "etre",
  "etait",
  "comme",
  "tout",
  "tous",
  "vous",
  "nous",
  "cette",
  "cela",
  "aussi",
  "tres",
  "plus",
  "mais",
  "donc",
  "alors",
  "quand",
  "ou",
  "comment",
  "pourquoi",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "une",
  "des",
  "les",
  "aux",
]);

const SP_HINT = new Set([
  "que",
  "para",
  "por",
  "como",
  "esta",
  "este",
  "estan",
  "tambien",
  "aqui",
  "alli",
  "muy",
  "mas",
  "menos",
  "pero",
  "cuando",
  "donde",
  "porque",
  "numero",
  "cada",
  "todo",
  "todos",
  "toda",
  "todas",
  "usted",
  "ellos",
  "ellas",
  "habia",
  "hay",
  "son",
  "ser",
]);

function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function detectWordFlag(word: string): TtsWordFlag {
  const lower = word.toLowerCase();
  const w = normalizeWord(word);
  if (!w) return LANG_DEFAULT;

  if (/[ñ¿¡]/.test(lower)) return "sp";
  if (/[çœæ]/.test(lower)) return "fr";
  if (/[àèìòù]/.test(lower)) return "it";
  if (/[áéíóúü]/.test(lower)) {
    if (/[íóú]/.test(lower) && !/[àèò]/.test(lower)) return "sp";
    if (/[ü]/.test(lower)) return "sp";
    return "it";
  }
  if (/[êâîôûëï]/.test(lower)) return "fr";
  if (/[ùû]/.test(lower)) return "fr";

  if (EN_HINT.has(w)) return "en";
  if (FR_HINT.has(w)) return "fr";
  if (SP_HINT.has(w)) return "sp";

  return LANG_DEFAULT;
}

function splitWordsWithSpaces(text: string): { space: string; word: string }[] {
  const out: { space: string; word: string }[] = [];
  const re = /\S+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const space = text.slice(last, m.index);
    out.push({ space, word: m[0] });
    last = m.index + m[0].length;
  }
  return out;
}

type Segment = { flag: TtsWordFlag; text: string };

function buildSegments(text: string): { segments: Segment[]; wordFlags: { word: string; flag: TtsWordFlag }[] } {
  const parts = splitWordsWithSpaces(text);
  const wordFlags: { word: string; flag: TtsWordFlag }[] = [];
  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const { space, word } of parts) {
    const flag = detectWordFlag(word);
    wordFlags.push({ word, flag });
    if (!current) {
      current = { flag, text: space + word };
    } else if (current.flag === flag) {
      current.text += space + word;
    } else {
      segments.push(current);
      current = { flag, text: space + word };
    }
  }
  if (current) segments.push(current);

  return { segments, wordFlags };
}

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const genRef = useRef(0);
  /** Ultima analisi per parola (it/en/fr/sp): solo memoria interna, non in UI. */
  const lastWordFlagsRef = useRef<{ word: string; flag: TtsWordFlag }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const warm = () => {
      void window.speechSynthesis.getVoices();
    };
    warm();
    window.speechSynthesis.onvoiceschanged = warm;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const pickVoice = useCallback((flag: TtsWordFlag): SpeechSynthesisVoice | null => {
    const prefix = voiceLangPrefix(flag);
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ?? null;
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!("speechSynthesis" in window) || !trimmed) return;

      const normalized = normalizeLetterDigitBoundaries(trimmed);
      const { segments, wordFlags } = buildSegments(normalized);
      lastWordFlagsRef.current = wordFlags;

      genRef.current += 1;
      const gen = genRef.current;
      window.speechSynthesis.cancel();

      if (segments.length === 0) return;

      setSpeaking(true);
      let index = 0;

      const speakNext = () => {
        if (gen !== genRef.current) return;
        if (index >= segments.length) {
          setSpeaking(false);
          return;
        }
        const { text: chunk, flag } = segments[index++];
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = BCP47[flag];
        const voice = pickVoice(flag);
        if (voice) u.voice = voice;
        u.rate = 1;
        u.onend = () => speakNext();
        u.onerror = () => {
          if (gen !== genRef.current) return;
          setSpeaking(false);
        };
        window.speechSynthesis.speak(u);
      };

      speakNext();
    },
    [pickVoice]
  );

  const toggle = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      if (window.speechSynthesis.speaking) {
        stop();
      } else {
        speak(text);
      }
    },
    [speak, stop]
  );

  return { speak, toggle, stop, speaking };
}
