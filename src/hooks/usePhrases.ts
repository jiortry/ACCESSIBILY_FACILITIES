import { useCallback, useEffect, useMemo, useState } from "react";
import { SEED_PHRASES, type PhraseCategory } from "@/data/phrases";

const STORAGE_KEY = "prompter-mc:phrases-v2";

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function usePhrases() {
  const [categories, setCategories] = useState<PhraseCategory[]>(() =>
    loadJSON<PhraseCategory[]>(STORAGE_KEY, SEED_PHRASES)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  const allItems = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => c.items.forEach((i) => set.add(i)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const addItem = useCallback((cat: string, val: string): { ok: boolean; reason?: string } => {
    const trimmedCat = cat.trim();
    const trimmedVal = val.trim();
    if (!trimmedCat) return { ok: false, reason: "Categoria vuota" };
    if (!trimmedVal) return { ok: false, reason: "Voce vuota" };
    let result: { ok: boolean; reason?: string } = { ok: true };
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.name.toLowerCase() === trimmedCat.toLowerCase());
      if (idx >= 0) {
        if (prev[idx].items.some((i) => i.toLowerCase() === trimmedVal.toLowerCase())) {
          result = { ok: false, reason: "Voce già presente in questa categoria" };
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], items: [...next[idx].items, trimmedVal] };
        return next;
      }
      return [...prev, { name: trimmedCat, items: [trimmedVal] }];
    });
    return result;
  }, []);

  const editItem = useCallback((cat: string, oldVal: string, newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed || trimmed === oldVal) return;
    setCategories((prev) =>
      prev.map((c) =>
        c.name === cat
          ? { ...c, items: c.items.map((i) => (i === oldVal ? trimmed : i)) }
          : c
      )
    );
  }, []);

  const deleteItem = useCallback((cat: string, val: string) => {
    setCategories((prev) =>
      prev
        .map((c) => (c.name === cat ? { ...c, items: c.items.filter((i) => i !== val) } : c))
        .filter((c) => c.items.length > 0)
    );
  }, []);

  const resetToSeed = useCallback(() => {
    setCategories(SEED_PHRASES);
  }, []);

  return {
    categories,
    allItems,
    addItem,
    editItem,
    deleteItem,
    resetToSeed,
  };
}
