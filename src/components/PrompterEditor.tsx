import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[]; // sorted unique
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

export const PrompterEditor = forwardRef<HTMLTextAreaElement, Props>(function PrompterEditor(
  { value, onChange, suggestions, className },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = (el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });

  const { token, start } = useMemo(() => getCurrentToken(value, caret), [value, caret]);

  const suffix = useMemo(() => {
    if (!token) return "";
    const lower = token.toLowerCase();
    const match = suggestions.find(
      (s) => s.toLowerCase().startsWith(lower) && s.length > token.length
    );
    if (!match) return "";
    return applyCasing(token, match.slice(token.length));
  }, [token, suggestions]);

  // Sync mirror scroll & measurement
  useLayoutEffect(() => {
    if (mirrorRef.current && innerRef.current) {
      mirrorRef.current.scrollTop = innerRef.current.scrollTop;
      mirrorRef.current.scrollLeft = innerRef.current.scrollLeft;
    }
  }, [scroll, value, caret]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const handler = () => {
      setCaret(el.selectionStart ?? 0);
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
    };
    el.addEventListener("click", handler);
    el.addEventListener("keyup", handler);
    el.addEventListener("scroll", handler);
    return () => {
      el.removeEventListener("click", handler);
      el.removeEventListener("keyup", handler);
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

  // Build mirror content: text up to caret + suffix span + rest
  const before = value.slice(0, caret);
  const after = value.slice(caret);

  return (
    <div className={`relative h-full ${className ?? ""}`}>
      {/* Mirror layer */}
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
        <span>{before}</span>
        {suffix && <span className="text-muted-foreground/70">{suffix}</span>}
        <span>{after}</span>
        {/* trailing space to ensure last line height */}
        {"\u200b"}
      </div>
      <textarea
        ref={setRefs}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            if (acceptSuffix()) {
              e.preventDefault();
            } else {
              e.preventDefault();
            }
          }
        }}
        spellCheck={false}
        placeholder="Scrivi la richiesta o il prompt (Plugin, Paper, config...) — Tab accetta il suggerimento"
        className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 outline-none caret-primary text-foreground placeholder:text-muted-foreground/60"
        style={{
          fontSize: "15px",
          lineHeight: "1.5",
        }}
      />
    </div>
  );
});
