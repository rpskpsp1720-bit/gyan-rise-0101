import React from "react";
import { Code2, Sparkles, Phone } from "lucide-react";

/**
 * DeveloperFooter
 * A subtle, professional "Platform Development" credit footer.
 * Purely presentational — does not affect layout flow above it
 * or any application functionality.
 */
export default function DeveloperFooter({ className = "" }) {
  return (
    <footer
      data-testid="developer-footer"
      className={`mt-10 pt-6 border-t border-slate-200/70 ${className}`}
      aria-label="Platform development credit"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-900 text-white grid place-items-center shrink-0">
            <Code2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-semibold">
              Platform Development
            </div>
            <div className="text-sm font-semibold text-slate-800 leading-tight">
              <span data-testid="developer-name">Shivam Chauhan</span>
              <span className="text-slate-400 font-normal"> · Web Application Developer</span>
            </div>
            <a
              href="tel:+918858166635"
              data-testid="developer-phone"
              className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-slate-600 hover:text-[#1D4ED8] transition-colors"
              aria-label="Call developer at 8858166635"
            >
              <Phone className="h-3 w-3" />
              <span className="font-medium tracking-wide">8858166635</span>
            </a>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[#1D4ED8] font-semibold">
          <Sparkles className="h-3 w-3" />
          Dream Big. Build Bigger.
        </div>
      </div>

      <p
        data-testid="developer-description"
        className="mt-3 text-[12.5px] leading-relaxed text-slate-500 max-w-2xl"
      >
        Designed and developed with a vision to make quality education accessible
        through technology, innovation, and modern digital learning experiences.
      </p>

      <p
        data-testid="developer-quote"
        className="mt-2 text-[11.5px] italic text-slate-400"
      >
        “Dream Big. Build Bigger. Keep Learning.”
      </p>
    </footer>
  );
}
