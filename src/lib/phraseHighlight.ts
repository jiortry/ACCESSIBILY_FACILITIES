import type { PhraseCategory } from "@/data/phrases";
import { categoryColorVar } from "@/lib/categoryColors";

export type PhraseRange = { start: number; end: number; colorVar: string };

const WORD = /\p{L}|\p{N}/u;

export function isWordChar(ch: string): boolean {
  return ch.length > 0 && WORD.test(ch);
}

/** First category in list wins when the same phrase appears twice. */
export function buildPhraseColorMap(categories: PhraseCategory[]): Map<string, string> {
  const map = new Map<string, string>();
  categories.forEach((cat, idx) => {
    const colorVar = categoryColorVar(idx);
    cat.items.forEach((item) => {
      const key = item.toLowerCase();
      if (!map.has(key)) map.set(key, colorVar);
    });
  });
  return map;
}

function boundaryOk(text: string, start: number, end: number): boolean {
  const okStart = start === 0 || !isWordChar(text[start - 1]!);
  const okEnd = end === text.length || !isWordChar(text[end]!);
  return okStart && okEnd;
}

/**
 * Greedy left-to-right: longest phrase wins at each position; no overlapping highlights.
 */
export function findHighlightRanges(text: string, categories: PhraseCategory[]): PhraseRange[] {
  const colorByPhrase = buildPhraseColorMap(categories);
  const phrases = [...colorByPhrase.entries()]
    .map(([low, colorVar]) => ({ phrase: low, colorVar, len: low.length }))
    .sort((a, b) => b.len - a.len);

  const textLower = text.toLowerCase();
  const used: boolean[] = new Array(text.length).fill(false);
  const ranges: PhraseRange[] = [];

  let i = 0;
  while (i < text.length) {
    let best: PhraseRange | null = null;
    for (const { phrase, colorVar, len } of phrases) {
      if (i + len > text.length) continue;
      if (textLower.slice(i, i + len) !== phrase) continue;
      if (!boundaryOk(text, i, i + len)) continue;
      let overlap = false;
      for (let j = i; j < i + len; j++) {
        if (used[j]!) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      if (!best || len > best.end - best.start) {
        best = { start: i, end: i + len, colorVar };
      }
    }
    if (best) {
      for (let j = best.start; j < best.end; j++) used[j] = true;
      ranges.push(best);
      i = best.end;
    } else {
      i++;
    }
  }
  return ranges;
}

export function filterRangesForSlice(
  ranges: PhraseRange[],
  sliceStart: number,
  sliceEnd: number
): PhraseRange[] {
  return ranges
    .filter((r) => r.start < sliceEnd && r.end > sliceStart)
    .map((r) => ({
      start: Math.max(0, r.start - sliceStart),
      end: Math.min(sliceEnd - sliceStart, r.end - sliceStart),
      colorVar: r.colorVar,
    }))
    .filter((r) => r.end > r.start);
}

export function findCatalogEntry(
  trimmed: string,
  categories: PhraseCategory[]
): { cat: string; value: string } | null {
  const t = trimmed.toLowerCase();
  for (const c of categories) {
    for (const item of c.items) {
      if (item.toLowerCase() === t) return { cat: c.name, value: item };
    }
  }
  return null;
}

/** Bounds of the word under the caret (empty range if on whitespace / punctuation). */
export function getWordBoundsAt(text: string, caret: number): { start: number; end: number } {
  const len = text.length;
  if (len === 0) return { start: 0, end: 0 };
  let pos = Math.min(Math.max(0, caret), len);
  if (pos === len) pos = len - 1;
  if (!isWordChar(text[pos]!)) {
    if (pos > 0 && isWordChar(text[pos - 1]!)) pos--;
    else return { start: caret, end: caret };
  }
  let start = pos;
  let end = pos + 1;
  while (start > 0 && isWordChar(text[start - 1]!)) start--;
  while (end < len && isWordChar(text[end]!)) end++;
  return { start, end };
}

/** Selection if non-empty, otherwise the word at caret. */
export function getContextTextBounds(
  text: string,
  selStart: number,
  selEnd: number
): { start: number; end: number } {
  if (selStart !== selEnd) return { start: selStart, end: selEnd };
  return getWordBoundsAt(text, selStart);
}

export function buildGoogleTranslateTtsUrl(fragment: string): string {
  const q = fragment.trim();
  const params = new URLSearchParams({
    sl: "auto",
    tl: "it",
    text: q,
    op: "translate",
  });
  return `https://translate.google.com/?${params.toString()}`;
}
