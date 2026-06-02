"use client";

import { useState } from "react";
import { Info, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { getAdviceWarning } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * Collapsible General Advice Warning shown on every advisor screen.
 * Country-aware (ATO/IRD/CRA/IRS positioning).
 */
export function AdviceWarning({ country = "AU", className }: { country?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const warning = getAdviceWarning(country);

  return (
    <div className={cn("rounded-xl border border-amber-300/60 bg-amber-50 overflow-hidden", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 transition-colors"
      >
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-800 flex-1">
          General guidance only — not personal financial advice
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-amber-200">
          <p className="text-[11px] leading-relaxed text-amber-800">{warning}</p>
        </div>
      )}
    </div>
  );
}

/** Compact inline disclaimer for chat footers */
export function InlineDisclaimer() {
  return (
    <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
      <Info className="w-2.5 h-2.5" />
      AI guidance only — not a substitute for professional advice. Verify with a licensed adviser.
    </p>
  );
}
