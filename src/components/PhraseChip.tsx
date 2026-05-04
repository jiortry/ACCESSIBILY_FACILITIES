import { useRef, useState } from "react";
import { Volume2, MoreVertical } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildGoogleTranslateTtsUrl } from "@/lib/phraseHighlight";
import { toast } from "sonner";

type Props = {
  category: string;
  value: string;
  colorVar: string; // e.g. "--cat-1"
  onInsert: (val: string) => void;
  onSpeak: (val: string) => void;
  onEdit: (newVal: string) => void;
  onDelete: () => void;
};

export function PhraseChip({ category, value, colorVar, onInsert, onSpeak, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  /** Testo da Traduttore / copia: selezione al click destro, altrimenti tutta la voce. */
  const contextTextRef = useRef("");
  const chipRootRef = useRef<HTMLDivElement | null>(null);

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) contextTextRef.current = "";
        }}
      >
        <ContextMenuTrigger asChild>
          <div
            ref={chipRootRef}
            className="mc-chip text-sm"
            style={{ borderColor: `hsl(var(${colorVar}) / 0.6)` }}
            onContextMenu={() => {
              const root = chipRootRef.current;
              const sel = window.getSelection();
              const str = sel?.toString().trim() ?? "";
              if (!str || !root || !sel || sel.rangeCount < 1) {
                contextTextRef.current = value;
                return;
              }
              const common = sel.getRangeAt(0).commonAncestorContainer;
              const node = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement;
              if (node && root.contains(node)) contextTextRef.current = str;
              else contextTextRef.current = value;
            }}
          >
            <button
              type="button"
              onClick={() => onInsert(value)}
              className="px-2.5 py-1 text-left lowercase hover:brightness-110 transition select-text"
              style={{
                background: `hsl(var(${colorVar}) / 0.18)`,
                color: "hsl(var(--foreground))",
              }}
              title={`Inserisci • ${category}`}
            >
              {value}
            </button>
            <button
              type="button"
              onClick={() => onSpeak(value)}
              className="px-2 border-l-2 border-foreground/15 hover:bg-accent/30 transition"
              style={{ background: `hsl(var(${colorVar}) / 0.28)` }}
              title="Ascolta"
              aria-label="Ascolta"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-1.5 border-l-2 border-foreground/15 hover:bg-accent/30 transition"
                  style={{ background: `hsl(var(${colorVar}) / 0.28)` }}
                  aria-label="Altre azioni"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setDraft(value);
                    setEditing(true);
                  }}
                >
                  Modifica
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(value);
                      toast.success("Copiato negli appunti");
                    } catch {
                      toast.error("Impossibile copiare");
                    }
                  }}
                >
                  Copia
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[200px] rounded-sm border-2 border-foreground/25 bg-card p-0 text-popover-foreground shadow-[var(--shadow-block)]">
          <div className="p-1">
            <ContextMenuItem
              className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15"
              onSelect={() => {
                const t = contextTextRef.current.trim() || value;
                if (!t.trim()) {
                  toast.message("Niente da tradurre");
                  return;
                }
                window.open(buildGoogleTranslateTtsUrl(t), "_blank", "noopener,noreferrer");
                toast.message("Google Traduttore aperto — usa l’altoparlante per il TTS");
              }}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#4285F4] text-[9px] font-bold text-white leading-none">
                G
              </span>
              Google Traduttore
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15"
              onSelect={() => onSpeak(contextTextRef.current.trim() || value)}
            >
              <Volume2 className="h-4 w-4 opacity-80" />
              Ascolta
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2 rounded-sm cursor-pointer focus:bg-primary/15"
              onSelect={async () => {
                const t = contextTextRef.current.trim() || value;
                try {
                  await navigator.clipboard.writeText(t);
                  toast.success("Copiato negli appunti");
                } catch {
                  toast.error("Impossibile copiare");
                }
              }}
            >
              Copia
            </ContextMenuItem>
          </div>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica voce — {category}</DialogTitle>
          </DialogHeader>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
          <DialogFooter>
            <button className="mc-btn" onClick={() => setEditing(false)}>
              Annulla
            </button>
            <button
              className="mc-btn mc-btn-primary"
              onClick={() => {
                onEdit(draft);
                setEditing(false);
              }}
            >
              Salva
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
