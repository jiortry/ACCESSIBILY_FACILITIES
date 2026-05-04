import { useMemo } from "react";
import { PhraseChip } from "./PhraseChip";
import type { PhraseCategory } from "@/data/phrases";

const COLOR_VARS = ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6", "--cat-7", "--cat-8"];

type Props = {
  categories: PhraseCategory[];
  filter: string;
  onInsert: (cat: string, val: string) => void;
  onSpeak: (val: string) => void;
  onEdit: (cat: string, oldVal: string, newVal: string) => void;
  onDelete: (cat: string, val: string) => void;
};

export function CategoryPanel({ categories, filter, onInsert, onSpeak, onEdit, onDelete }: Props) {
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({ ...c, items: c.items.filter((i) => i.toLowerCase().includes(q)) }))
      .filter((c) => c.items.length > 0);
  }, [categories, filter]);

  if (filtered.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-center">
        Nessuna voce trovata.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {filtered.map((cat, idx) => {
        const colorVar = COLOR_VARS[idx % COLOR_VARS.length];
        return (
          <section
            key={cat.name}
            className="mc-block p-3"
            style={{ borderColor: `hsl(var(${colorVar}) / 0.5)` }}
          >
            <header className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 border-2 border-foreground/30"
                style={{ background: `hsl(var(${colorVar}))` }}
                aria-hidden
              />
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {cat.name}
              </h3>
              <span className="text-xs text-muted-foreground">({cat.items.length})</span>
            </header>
            <div className="flex flex-wrap gap-2">
              {cat.items.map((item) => (
                <PhraseChip
                  key={item}
                  category={cat.name}
                  value={item}
                  colorVar={colorVar}
                  onInsert={(v) => onInsert(cat.name, v)}
                  onSpeak={onSpeak}
                  onEdit={(nv) => onEdit(cat.name, item, nv)}
                  onDelete={() => onDelete(cat.name, item)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
