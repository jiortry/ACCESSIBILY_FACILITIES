import { useCallback, useRef, useState } from "react";
import { Copy, Volume2, RotateCcw, Quote, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PrompterEditor } from "@/components/PrompterEditor";
import { CategoryPanel } from "@/components/CategoryPanel";
import { AddPhraseDialog } from "@/components/AddPhraseDialog";
import { usePhrases } from "@/hooks/usePhrases";
import { useTTS } from "@/hooks/useTTS";

const WRAP_PREFIX = "> ";

const Index = () => {
  const { categories, allItems, incrementUse, addItem, editItem, deleteItem, resetToSeed } = usePhrases();
  const { speak, toggle, speaking } = useTTS();

  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const [wrapped, setWrapped] = useState(false);
  const wrapBackup = useRef<string>("");
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
      incrementUse(cat, raw);
      requestAnimationFrame(() => {
        const e = editorRef.current;
        if (e) {
          const np = (before + insertion).length;
          e.focus();
          e.setSelectionRange(np, np);
        }
      });
    },
    [text, incrementUse]
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Testo copiato");
    } catch {
      toast.error("Impossibile copiare");
    }
  };

  const toggleWrap = () => {
    if (!wrapped) {
      wrapBackup.current = text;
      const wrappedText =
        WRAP_PREFIX +
        text
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n");
      setText(wrappedText);
      setWrapped(true);
    } else {
      setText(wrapBackup.current);
      setWrapped(false);
    }
  };

  const knownCategories = categories.map((c) => c.name);

  return (
    <main className="h-screen w-screen flex flex-col">
      {/* Toolbar */}
      <header className="mc-block rounded-none border-x-0 border-t-0 px-3 py-2 flex flex-wrap gap-2 items-center">
        <h1
          className="mr-2 text-primary"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}
        >
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
        <button
          className={`mc-btn ${wrapped ? "mc-btn-accent" : ""}`}
          onClick={toggleWrap}
          title="Quota il testo (involucro)"
        >
          <Quote className="h-4 w-4" /> {wrapped ? "Annulla quote" : "Quote"}
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
          <PrompterEditor ref={editorRef} value={text} onChange={setText} suggestions={allItems} />
          <div className="absolute bottom-1 right-2 text-xs text-muted-foreground/70 pointer-events-none select-none">
            Tab = accetta suggerimento
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
