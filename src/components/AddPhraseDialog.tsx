import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Props = {
  knownCategories: string[];
  onAdd: (cat: string, val: string) => { ok: boolean; reason?: string };
};

export function AddPhraseDialog({ knownCategories, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("");
  const [val, setVal] = useState("");

  const submit = () => {
    const res = onAdd(cat, val);
    if (!res.ok) {
      toast.error(res.reason ?? "Errore");
      return;
    }
    toast.success("Voce aggiunta");
    setCat("");
    setVal("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="mc-btn mc-btn-primary">
          <Plus className="h-4 w-4" /> Aggiungi
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova voce</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Categoria</label>
            <Input
              list="known-cats"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              placeholder="es. Saluti"
            />
            <datalist id="known-cats">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Voce</label>
            <Textarea
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="testo della frase"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <button className="mc-btn" onClick={() => setOpen(false)}>
            Annulla
          </button>
          <button className="mc-btn mc-btn-primary" onClick={submit}>
            Salva
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
