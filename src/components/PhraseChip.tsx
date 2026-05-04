import { useState } from "react";
import { Volume2, MoreVertical } from "lucide-react";
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

  return (
    <>
      <div
        className="mc-chip text-sm"
        style={{ borderColor: `hsl(var(${colorVar}) / 0.6)` }}
      >
        <button
          onClick={() => onInsert(value)}
          className="px-2.5 py-1 text-left lowercase hover:brightness-110 transition"
          style={{
            background: `hsl(var(${colorVar}) / 0.18)`,
            color: "hsl(var(--foreground))",
          }}
          title={`Inserisci • ${category}`}
        >
          {value}
        </button>
        <button
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
