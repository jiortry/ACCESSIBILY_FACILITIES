import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Volume2, RotateCcw, Sparkles, Trash2, Highlighter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PrompterEditor } from "@/components/PrompterEditor";
import { CategoryPanel } from "@/components/CategoryPanel";
import { AddPhraseDialog } from "@/components/AddPhraseDialog";
import { usePhrases } from "@/hooks/usePhrases";
import { useTTS } from "@/hooks/useTTS";

const IMPROVE_PROMPT_INTRO =
  "Sei un assistente per prompt tecnici. Migliora e rendi completo, chiaro e strutturato il testo seguente, in contesto di server Minecraft (Plugin, Bukkit, Paper, Spigot, Fabric, mod, performante, equilibrato, sicurezza, permessi, economia, PvE/PvP). Non inventare fatti: se mancano dettagli, elenchi domande. Mantieni l'intento e il piano dell'utente. L'utente chiede:\n\n";

function escapeForQuotedPrompt(body: string): string {
  return body.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const HIGHLIGHT_PHRASES_KEY = "prompter-mc:highlight-phrases";

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as boolean;
  } catch {
    return fallback;
  }
}

function buildImprovePrompt(userText: string): string {
  return IMPROVE_PROMPT_INTRO + `"${escapeForQuotedPrompt(userText)}"`;
}

const Index = () => {
  const { categories, allItems, addItem, editItem, deleteItem, resetToSeed } = usePhrases();
  const { speak, toggle, speaking } = useTTS();

  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const [highlightPhrases, setHighlightPhrases] = useState(() =>
    loadBool(HIGHLIGHT_PHRASES_KEY, true)
  );
  const [improveMode, setImproveMode] = useState(false);
  const improveBackup = useRef<string>("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = useCallback(
    (cat: string, raw: string) => {
      const value = /^[A-Z\s]+$/.test(raw) && /[A-Z]/.test(raw) ? raw.toLowerCase() : raw;
      const el = editorRef.current;
      const pos = el?.selectionStart ?? text.length;
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const needsSpace = before.length > 0 && !/\s$/.test(before);
      const insertion = (needsSpace ? " " : "") + value + " ";
      const next = before + insertion + after;
      setText(next);
      requestAnimationFrame(() => {
        const e = editorRef.current;
        if (e) {
          const np = (before + insertion).length;
          e.focus();
          e.setSelectionRange(np, np);
        }
      });
    },
    [text]
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Testo copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const toggleImprove = () => {
    if (!improveMode) {
      improveBackup.current = text;
      setText(buildImprovePrompt(text));
      setImproveMode(true);
    } else {
      setText(improveBackup.current);
      setImproveMode(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(HIGHLIGHT_PHRASES_KEY, JSON.stringify(highlightPhrases));
  }, [highlightPhrases]);

  const knownCategories = categories.map((c) => c.name);

  return (
    <main className="h-screen w-screen flex flex-col">
      <header className="mc-block rounded-none border-x-0 border-t-0 px-3 py-2 flex flex-wrap gap-2 items-center">
        <h1 className="mr-2 text-primary font-semibold text-lg">
          PrompterMinecraft
        </h1>
        <button
          className={`mc-btn ${speaking ? "mc-btn-accent" : "mc-btn-primary"}`}
          onClick={() => toggle(text)}
          title={speaking ? "Stop" : "Ascolta tutto"}
        >
          <Volume2 className="h-4 w-4" />
          {speaking ? "Stop" : "Ascolta"}
        </button>
        <button className="mc-btn" onClick={copyAll} title="Copia tutto">
          <Copy className="h-4 w-4" /> Copia
        </button>
        <div className="flex items-center gap-2 border-l-2 border-foreground/15 pl-3 ml-1">
          <Highlighter className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <Label htmlFor="highlight-phrases" className="text-sm cursor-pointer whitespace-nowrap">
            Evidenzia frasi
          </Label>
          <Switch
            id="highlight-phrases"
            checked={highlightPhrases}
            onCheckedChange={setHighlightPhrases}
            title="Colora nel testo le voci riconosciute dal dizionario"
          />
        </div>
        <button
          className={`mc-btn ${improveMode ? "mc-btn-accent" : ""}`}
          onClick={toggleImprove}
          title={
            improveMode
              ? "Ripristina solo il testo che avevi scritto"
              : "Avvolgi il testo nel prompt “Migliora” per un LLM"
          }
        >
          <Sparkles className="h-4 w-4" /> {improveMode ? "Annulla migliora" : "Migliora"}
        </button>
        <button
          className="mc-btn"
          onClick={() => setText("")}
          title="Pulisci editor"
        >
          <Trash2 className="h-4 w-4" /> Pulisci
        </button>
        <div className="ml-auto flex gap-2">
          <AddPhraseDialog knownCategories={knownCategories} onAdd={addItem} />
          <button
            className="mc-btn"
            onClick={() => {
              if (confirm("Ripristinare le frasi d'esempio? Verranno persi i tuoi cambiamenti.")) {
                resetToSeed();
                toast.success("Frasi ripristinate");
              }
            }}
            title="Ripristina set d'esempio"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Editor area */}
      <section className="flex-1 min-h-0 grid grid-rows-[minmax(120px,40%)_1fr] gap-0">
        <div className="mc-block rounded-none border-x-0 m-0 relative">
          <PrompterEditor
            ref={editorRef}
            value={text}
            onChange={setText}
            suggestions={allItems}
            phraseCategories={categories}
            highlightPhrases={highlightPhrases}
            onSpeak={speak}
            onEditPhrase={editItem}
          />
          <div className="absolute bottom-1 right-2 text-xs text-muted-foreground/70 pointer-events-none select-none">
            Tab cicla · Invio conferma · Maiusc+Invio a capo
          </div>
        </div>

        <div className="mc-block rounded-none border-x-0 border-b-0 flex flex-col min-h-0">
          <div className="p-2 border-b-2 border-foreground/15 bg-muted/40">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtra le frasi..."
              className="h-9"
            />
          </div>
          <div className="flex-1 overflow-auto">
            <CategoryPanel
              categories={categories}
              filter={filter}
              onInsert={insertAtCursor}
              onSpeak={speak}
              onEdit={editItem}
              onDelete={deleteItem}
            />
          </div>
        </div>
      </section>
    </main>
  );
};

export default Index;
