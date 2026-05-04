import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LS_SEGMENT = "pc_app_sess_k";
const CLICK_THRESHOLD = 50;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const INPUT_MAX_LEN = 64;

function readSegment(): number {
  try {
    const raw = localStorage.getItem(LS_SEGMENT);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSegment(n: number): void {
  try {
    localStorage.setItem(LS_SEGMENT, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore quota / private mode */
  }
}

function parseTemporalInput(raw: string): number | null {
  const s = raw.trim();
  if (!s || s.length > INPUT_MAX_LEN) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    if (s.length <= 10) return Math.round(n * 1000);
    return Math.round(n);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function credentialAccepts(value: string, now: number): boolean {
  const t = parseTemporalInput(value);
  if (t == null) return false;
  return t >= now - WINDOW_MS && t <= now;
}

type PageAccessGateProps = {
  children: ReactNode;
};

export function PageAccessGate({ children }: PageAccessGateProps) {
  const formId = useId();
  const passwordId = `${formId}-pwd`;
  const [gateOpen, setGateOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const gateOpenRef = useRef(false);

  useEffect(() => {
    const initial = readSegment();
    if (initial >= CLICK_THRESHOLD) {
      gateOpenRef.current = true;
      setGateOpen(true);
    }
  }, []);

  const refreshLockout = useCallback(() => {
    const u = lockUntil;
    if (u <= Date.now()) return 0;
    return Math.ceil((u - Date.now()) / 1000);
  }, [lockUntil]);

  const [, forceLockTick] = useState(0);
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = window.setInterval(() => forceLockTick((x) => x + 1), 500);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  useEffect(() => {
    const onClick = () => {
      const next = readSegment() + 1;
      writeSegment(next);
      if (next >= CLICK_THRESHOLD && !gateOpenRef.current) {
        gateOpenRef.current = true;
        setGateOpen(true);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const lockedSeconds = refreshLockout();
  const isLocked = lockedSeconds > 0;

  useEffect(() => {
    if (!isLocked && error != null && /temporaneamente|Attendi ancora/u.test(error)) {
      setError(null);
    }
  }, [isLocked, error]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isLocked) {
      setError(`Troppi tentativi. Attendi ancora ${lockedSeconds}s.`);
      return;
    }
    const now = Date.now();
    if (!credentialAccepts(password, now)) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPassword("");
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLockUntil(now + LOCKOUT_MS);
        setAttempts(0);
        setError("Troppi tentativi errati. Accesso temporaneamente bloccato.");
      } else {
        setError("Password non valida.");
      }
      return;
    }
    writeSegment(0);
    setPassword("");
    setAttempts(0);
    setLockUntil(0);
    setError(null);
    gateOpenRef.current = false;
    setGateOpen(false);
  };

  return (
    <>
      {children}
      <AlertDialog open={gateOpen}>
        <AlertDialogContent
          className="z-[100]"
          onEscapeKeyDown={(ev) => ev.preventDefault()}
          onPointerDownOutside={(ev) => ev.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Verifica accesso</AlertDialogTitle>
            <AlertDialogDescription>
              Per motivi di sicurezza è richiesta la password di accesso per continuare a usare
              l&apos;applicazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form id={formId} onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Password di accesso</Label>
              <Input
                id={passwordId}
                name="access_password"
                type="password"
                inputMode="text"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                maxLength={INPUT_MAX_LEN}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLocked}
                className="font-mono"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${passwordId}-err` : undefined}
              />
              {error ? (
                <p id={`${passwordId}-err`} className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <AlertDialogFooter className="sm:justify-between gap-2">
              <p className="text-xs text-muted-foreground order-last sm:order-first flex-1 text-left">
                Tentativi rimasti: {isLocked ? 0 : Math.max(0, MAX_ATTEMPTS - attempts)}
              </p>
              <button type="submit" className="mc-btn mc-btn-primary h-10 px-4 rounded-md text-sm font-medium" disabled={isLocked}>
                Continua
              </button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
