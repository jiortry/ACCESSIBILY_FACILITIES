import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Copy, Pencil, Trash2, Volume2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PhraseCategory } from "@/data/phrases";
import {
  buildGoogleTranslateTtsUrl,
  findCatalogEntry,
  findHighlightRanges,
  filterRangesForSlice,
  getContextTextBounds,
  type PhraseRange,
} from "@/lib/phraseHighlight";
import { cn } from "@/lib/utils";

/** Suggestion popover under caret (Minecraft-style Tab cycle). */
const TAB_MENU_MAX_H = 192;
const TAB_MENU_MAX_W = 280;

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  /** Categories for dictionary highlighting (same order as pannello). */
  phraseCategories: PhraseCategory[];
  highlightPhrases: boolean;
  onSpeak: (text: string) => void;
  onEditPhrase: (category: string, oldVal: string, newVal: string) => void;
  className?: string;
};

function applyCasing(typed: string, suffix: string): string {
  if (!typed) return suffix;
  if (typed === typed.toUpperCase() && /[a-z]/i.test(typed)) return suffix.toUpperCase();
  if (typed === typed.toLowerCase()) return suffix.toLowerCase();
  return suffix;
}

function getCurrentToken(text: string, caret: number): { token: string; start: number } {
  const before = text.slice(0, caret);
  const m = before.match(/(\S+)$/);
  if (!m) return { token: "", start: caret };
  return { token: m[1], start: caret - m[1].length };
}

function renderHighlightedSlice(slice: string, localRanges: PhraseRange[]): ReactNode[] {
  const sorted = [...localRanges].sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let pos = 0;
  sorted.forEach((r, idx) => {
    if (r.start > pos) nodes.push(<span key={`g-${idx}-p`}>{slice.slice(pos, r.start)}</span>);
    nodes.push(
      <mark
        key={`g-${idx}-m`}
        className="rounded-[2px] px-0.5 text-inherit"
        style={{
          backgroundColor: `hsl(var(${r.colorVar}) / 0.19)`,
          boxShadow: `inset 0 -1.5px 0 0 hsl(var(${r.colorVar}) / 0.42)`,
        }}
      >
        {slice.slice(r.start, r.end)}
      </mark>
    );
    pos = r.end;
  });
  if (pos < slice.length) nodes.push(<span key="tail">{slice.slice(pos)}</span>);
  return nodes;
}

export const PrompterEditor = forwardRef<HTMLTextAreaElement, Props>(function PrompterEditor(
  {
    value,
    onChange,
    suggestions,
    phraseCategories,
    highlightPhrases,
    onSpeak,
    onEditPhrase,
    className,
  },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = (el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const measureLayerRef = useRef<HTMLDivElement | null>(null);
  const caretProbeRef = useRef<HTMLSpanElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  /** Index in alphabetically sorted matches (Tab cycles like Minecraft). */
  const [pickIndex, setPickIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const suggestionItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const editMeta = useRef<{ mode: "dict" | "free"; cat?: string; oldVal?: string; start: number; end: number } | null>(
    null
  );

  const { token } = useMemo(() => getCurrentToken(value, caret), [value, caret]);

  const matchingSuggestions = useMemo(() => {
    if (!token) return [];
    const lower = token.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(lower) && s.length > token.length)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [token, suggestions]);

  useEffect(() => {
    setPickIndex(0);
  }, [token]);

  useEffect(() => {
    if (matchingSuggestions.length === 0) setPickIndex(0);
    else setPickIndex((i) => Math.min(i, matchingSuggestions.length - 1));
  }, [matchingSuggestions]);

  useLayoutEffect(() => {
    const el = suggestionItemRefs.current[pickIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [pickIndex, matchingSuggestions.length]);

  const pickedPhrase = matchingSuggestions[pickIndex] ?? "";

  const suffix = useMemo(() => {
    if (!token || !pickedPhrase) return "";
    return applyCasing(token, pickedPhrase.slice(token.length));
  }, [token, pickedPhrase]);

  const highlightRanges = useMemo(() => {
    if (!highlightPhrases || !phraseCategories.length) return [];
    return findHighlightRanges(value, phraseCategories);
  }, [value, phraseCategories, highlightPhrases]);

  const showMirrorText = highlightPhrases && value.length > 0;
  const before = value.slice(0, caret);
  const after = value.slice(caret);
  const rangesBefore = useMemo(
    () => filterRangesForSlice(highlightRanges, 0, caret),
    [highlightRanges, caret]
  );
  const rangesAfter = useMemo(
    () => filterRangesForSlice(highlightRanges, caret, value.length),
    [highlightRanges, caret, value.length]
  );

  useLayoutEffect(() => {
    const ta = innerRef.current;
    const mirror = mirrorRef.current;
    const measure = measureLayerRef.current;
    if (ta && measure) {
      const cs = window.getComputedStyle(ta);
      measure.style.font = cs.font;
      measure.style.letterSpacing = cs.letterSpacing;
      measure.style.padding = cs.padding;
    }
    if (ta && mirror) {
      mirror.scrollTop = ta.scrollTop;
      mirror.scrollLeft = ta.scrollLeft;
    }
    if (ta && measure) {
      measure.scrollTop = ta.scrollTop;
      measure.scrollLeft = ta.scrollLeft;
    }
  }, [scroll, value, caret]);

  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    const probe = caretProbeRef.current;
    if (!wrap || !probe || matchingSuggestions.length === 0) return;
    const wrapRect = wrap.getBoundingClientRect();
    const probeRect = probe.getBoundingClientRect();
    const pad = 8;
    let left = probeRect.left - wrapRect.left;
    left = Math.min(left, Math.max(pad, wrapRect.width - TAB_MENU_MAX_W - pad));
    left = Math.max(pad, left);
    const spaceBelow = wrapRect.bottom - probeRect.bottom;
    const flipUp =
      spaceBelow < TAB_MENU_MAX_H + 12 && probeRect.top - wrapRect.top > TAB_MENU_MAX_H + 12;
    let top = flipUp
      ? probeRect.top - wrapRect.top - TAB_MENU_MAX_H - 6
      : probeRect.bottom - wrapRect.top + 4;
    top = Math.max(pad, Math.min(top, wrapRect.height - TAB_MENU_MAX_H - pad));
    setMenuPos({ top, left });
  }, [caret, value, scroll, matchingSuggestions.length]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const handler = () => {
      setCaret(el.selectionStart ?? 0);
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
    };
    el.addEventListener("click", handler);
    el.addEventListener("keyup", handler);
    el.addEventListener("select", handler);
    el.addEventListener("scroll", handler);
    return () => {
      el.removeEventListener("click", handler);
      el.removeEventListener("keyup", handler);
      el.removeEventListener("select", handler);
      el.removeEventListener("scroll", handler);
    };
  }, []);

  const acceptSuffix = () => {
    if (!suffix) return false;
    const insertion = suffix + " ";
    const next = value.slice(0, caret) + insertion + value.slice(caret);
    onChange(next);
    requestAnimationFrame(() => {
      const el = innerRef.current;
      if (el) {
        const pos = caret + insertion.length;
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      }
    });
    return true;
  };

  const readContext = () => {
    const el = innerRef.current;
    if (!el) return { text: "", start: 0, end: 0 };
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    const { start, end } = getContextTextBounds(value, a, b);
    return { text: value.slice(start, end), start, end };
  };

  const handleCopy = async () => {
    const { text } = readContext();
    if (!text.trim()) {
      toast.message("Niente da copiare");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const openEdit = () => {
    const { text, start, end } = readContext();
    if (!text.length) {
      toast.message("Seleziona testo o posiziona il cursore su una parola");
      return;
    }
    const entry = findCatalogEntry(text.trim(), phraseCategories);
    if (entry) {
      editMeta.current = { mode: "dict", cat: entry.cat, oldVal: entry.value, start, end };
      setEditDraft(entry.value);
    } else {
      editMeta.current = { mode: "free", start, end };
      setEditDraft(text);
    }
    setEditOpen(true);
  };

  const applyEditSave = () => {
    const meta = editMeta.current;
    const nextVal = editDraft.trim();
    if (!meta || !nextVal) {
      setEditOpen(false);
      return;
    }
    if (meta.mode === "dict" && meta.cat && meta.oldVal) {
      onEditPhrase(meta.cat, meta.oldVal, nextVal);
      if (nextVal !== meta.oldVal) {
        const { start, end } = meta;
        const patch = value.slice(0, start) + nextVal + value.slice(end);
        onChange(patch);
        requestAnimationFrame(() => {
          const el = innerRef.current;
          if (el) {
            const np = start + nextVal.length;
            el.focus();
            el.setSelectionRange(np, np);
            setCaret(np);
          }
        });
      }
    } else if (meta.mode === "free") {
      const { start, end } = meta;
      const patch = value.slice(0, start) + nextVal + value.slice(end);
      onChange(patch);
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (el) {
          const np = start + nextVal.length;
          el.focus();
          el.setSelectionRange(np, np);
          setCaret(np);
        }
      });
    }
    setEditOpen(false);
  };

  const handleListen = () => {
    const { text } = readContext();
    if (!text.trim()) {
      toast.message("Niente da ascoltare");
      return;
    }
    onSpeak(text);
  };

  const handleGoogle = () => {
    const { text } = readContext();
    if (!text.trim()) {
      toast.message("Seleziona del testo");
      return;
    }
    const url = buildGoogleTranslateTtsUrl(text);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.message("Google Traduttore aperto — usa l’altoparlante per il TTS");
  };

  const handleDelete = () => {
    const { start, end } = readContext();
    if (start === end) {
      toast.message("Niente da eliminare");
      return;
    }
    const patch = value.slice(0, start) + value.slice(end);
    onChange(patch);
    requestAnimationFrame(() => {
      const el = innerRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(start, start);
        setCaret(start);
      }
    });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={wrapperRef} className={`relative h-full ${className ?? ""}`}>
            {/* Invisible layer: same wrap/scroll as textarea to measure caret on-screen */}
            <div
              ref={measureLayerRef}
              aria-hidden
              className="absolute inset-0 z-0 overflow-auto whitespace-pre-wrap break-words opacity-0 pointer-events-none"
              style={{
                fontSize: "15px",
                lineHeight: "1.5",
                scrollbarWidth: "none",
              }}
            >
              {value.slice(0, caret)}
              <span ref={caretProbeRef} className="inline-block w-px h-[1.2em] align-text-bottom" />
            </div>
            {matchingSuggestions.length > 0 && (
              <div
                role="listbox"
                aria-label="Suggerimenti dal dizionario"
                className="absolute z-20 max-w-[min(17.5rem,calc(100%-1rem))] w-[min(17.5rem,calc(100%-1rem))] overflow-y-auto overflow-x-hidden rounded-md border border-border/40 bg-background/82 shadow-md backdrop-blur-md"
                style={{
                  top: menuPos.top,
                  left: menuPos.left,
                  maxHeight: TAB_MENU_MAX_H,
                }}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-[1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90 border-b border-border/30 bg-background/90 backdrop-blur-sm">
                  Tab cicla · Invio conferma · Maiusc+Invio = a capo
                </div>
                <div className="py-1">
                  {matchingSuggestions.map((phrase, i) => {
                    const rest = phrase.slice(token.length);
                    const active = i === pickIndex;
                    return (
                      <div
                        key={`${phrase}-${i}`}
                        ref={(node) => {
                          suggestionItemRefs.current[i] = node;
                        }}
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "mx-1 flex min-h-[1.6rem] items-center rounded px-2 py-0.5 text-[13px] leading-snug transition-colors",
                          active
                            ? "bg-primary/22 text-foreground ring-1 ring-primary/35"
                            : "text-foreground/85 hover:bg-muted/50"
                        )}
                      >
                        <span className="text-muted-foreground/90">{token}</span>
                        <span className={cn("font-medium", active ? "text-primary" : "text-foreground/90")}>
                          {applyCasing(token, rest)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div
              ref={mirrorRef}
              aria-hidden
              className="absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-3 pointer-events-none text-transparent"
              style={{
                font: "inherit",
                lineHeight: "1.5",
                fontSize: "15px",
              }}
            >
              {showMirrorText ? (
                <>
                  <span className="text-foreground">{renderHighlightedSlice(before, rangesBefore)}</span>
                  {suffix && <span className="text-muted-foreground/70">{suffix}</span>}
                  <span className="text-foreground">{renderHighlightedSlice(after, rangesAfter)}</span>
                </>
              ) : (
                <>
                  <span>{before}</span>
                  {suffix && <span className="text-muted-foreground/70">{suffix}</span>}
                  <span>{after}</span>
                </>
              )}
              {"\u200b"}
            </div>
            <textarea
              ref={setRefs}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) {
                  return;
                }
                if (e.key === "Enter" && suffix && matchingSuggestions.length > 0) {
                  e.preventDefault();
                  acceptSuffix();
                  return;
                }
                if (e.key === "Tab") {
                  if (matchingSuggestions.length > 0) {
                    e.preventDefault();
                    setPickIndex((i) => (i + 1) % matchingSuggestions.length);
                  }
                }
              }}
              spellCheck={false}
              placeholder="Scrivi la richiesta o il prompt — Tab cicla i suggerimenti, Invio conferma, Maiusc+Invio a capo"
              className={`absolute inset-0 w-full h-full resize-none bg-transparent p-3 outline-none caret-primary placeholder:text-muted-foreground/60 selection:bg-primary/25 ${
                showMirrorText ? "text-transparent" : "text-foreground"
              }`}
              style={{
                fontSize: "15px",
                lineHeight: "1.5",
              }}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[220px] rounded-sm border-2 border-foreground/25 bg-card p-0 text-popover-foreground shadow-[var(--shadow-block)]">
          <ContextMenuLabel className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground bg-muted/50 border-b border-foreground/10">
            <Sparkles className="inline h-3 w-3 mr-1.5 align-middle text-primary" />
            Azioni editor
          </ContextMenuLabel>
          <div className="p-1">
            <ContextMenuItem
              onSelect={() => void handleCopy()}
              className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15"
            >
              <Copy className="h-4 w-4 opacity-80" />
              Copia
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={openEdit} className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15">
              <Pencil className="h-4 w-4 opacity-80" />
              Modifica
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleListen} className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15">
              <Volume2 className="h-4 w-4 opacity-80" />
              Ascolta
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleGoogle} className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#4285F4] text-[9px] font-bold text-white leading-none">
                G
              </span>
              Google Traduttore
            </ContextMenuItem>
            <ContextMenuSeparator className="bg-foreground/15" />
            <ContextMenuItem
              onSelect={handleDelete}
              className="gap-2 rounded-sm cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 opacity-90" />
              Elimina
            </ContextMenuItem>
          </div>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-sm border-2 border-foreground/25 shadow-[var(--shadow-block)]">
          <DialogHeader>
            <DialogTitle>
              {editMeta.current?.mode === "dict" ? "Modifica voce nel dizionario" : "Modifica testo"}
            </DialogTitle>
          </DialogHeader>
          <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={4} className="resize-y" />
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="mc-btn" onClick={() => setEditOpen(false)}>
              Annulla
            </button>
            <button type="button" className="mc-btn mc-btn-primary" onClick={applyEditSave}>
              Salva
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
