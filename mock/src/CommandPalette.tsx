import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { searchSymbols, type Symbol } from "./lib/data";
import { Badge, Mono } from "./ui/primitives";

/**
 * ⌘K omnibox, on a Radix Dialog — which renders through `Dialog.Portal`, i.e. ReactDOM.createPortal.
 *
 * This component is the reason the stack question got settled by measurement rather than opinion:
 * under `preact/compat` this exact construct renders nothing and throws
 * `InvalidCharacterError: "[object Object]" did not match the QName production`, while the
 * non-portal Radix primitives work fine.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (s: Symbol) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchSymbols(q, 8), [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      // Radix moves focus into the dialog; this just puts the caret in the field.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      onPick(results[cursor]);
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18%] z-50 w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-white/12 bg-[#11141a] shadow-2xl"
        >
          <Dialog.Title className="sr-only">Search symbols</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
            <span className="text-zinc-500">⌕</span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search symbols, or type a stable key…"
              className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <Badge>esc</Badge>
          </div>
          <ul className="max-h-[46vh] overflow-y-auto py-1">
            {results.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-zinc-500">no symbol matches</li>}
            {results.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    onPick(s);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                    i === cursor ? "bg-sky-500/12" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-zinc-100">{s.name}</span>
                    <Mono>{s.file}</Mono>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Badge tone="blue">{s.pdg_nodes} pdg</Badge>
                    <Badge>{s.blocks} blk</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-white/8 px-3 py-1.5 text-[10px] text-zinc-500">
            <span>↑↓ move</span><span>↵ focus</span>
            <span className="ml-auto">{results.length} of {searchSymbols("", 999).length} candidates</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
