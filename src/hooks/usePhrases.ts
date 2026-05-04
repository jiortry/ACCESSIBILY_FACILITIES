import { useCallback, useEffect, useMemo, useState } from "react";
import { SEED_PHRASES, type PhraseCategory } from "@/data/phrases";

const STORAGE_KEY = "prompter-mc:phrases-v2";
const COUNTS_KEY = "prompter-mc:counts-v2";

type Counts = Record<string, number>; // key = `${cat}:::${value}`

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const keyOf = (cat: string, val: string) => `${cat}:::${val}`;

export function usePhrases() {
  const [categories, setCategories] = useState<PhraseCategory[]>(() =>
    loadJSON<PhraseCategory[]>(STORAGE_KEY, SEED_PHRASES)
  );
  const [counts, setCounts] = useState<Counts>(() => loadJSON<Counts>(COUNTS_KEY, {}));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
  }, [counts]);

  const sortedCategories = useMemo<PhraseCategory[]>(() => {
    return categories.map((c) => ({
      name: c.name,
      items: [...c.items].sort((a, b) => {
        const da = counts[keyOf(c.name, a)] ?? 0;
        const db = counts[keyOf(c.name, b)] ?? 0;
        if (db !== da) return db - da;
        return c.items.indexOf(a) - c.items.indexOf(b);
      }),
    }));
  }, [categories, counts]);

  const allItems = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => c.items.forEach((i) => set.add(i)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const incrementUse = useCallback((cat: string, val: string) => {
    setCounts((prev) => ({ ...prev, [keyOf(cat, val)]: (prev[keyOf(cat, val)] ?? 0) + 1 }));
  }, []);

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
    setCounts((prev) => {
      const next = { ...prev };
      const oldKey = keyOf(cat, oldVal);
      const newKey = keyOf(cat, trimmed);
      if (next[oldKey] != null) {
        next[newKey] = (next[newKey] ?? 0) + next[oldKey];
        delete next[oldKey];
      }
      return next;
    });
  }, []);

  const deleteItem = useCallback((cat: string, val: string) => {
    setCategories((prev) =>
      prev
        .map((c) => (c.name === cat ? { ...c, items: c.items.filter((i) => i !== val) } : c))
        .filter((c) => c.items.length > 0)
    );
    setCounts((prev) => {
      const next = { ...prev };
      delete next[keyOf(cat, val)];
      return next;
    });
  }, []);

  const resetToSeed = useCallback(() => {
    setCategories(SEED_PHRASES);
    setCounts({});
  }, []);

  return {
    categories: sortedCategories,
    allItems,
    incrementUse,
    addItem,
    editItem,
    deleteItem,
    resetToSeed,
  };
}
