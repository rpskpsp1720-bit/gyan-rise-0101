import React from "react";
import { Quote, BadgeCheck } from "lucide-react";

/**
 * FounderCard
 * A clean, professional welcome card highlighting the founder &
 * lead educator. Purely presentational — no data fetching, no
 * functional impact on existing flows.
 *
 * variant:
 *   "default" — standalone card (white surface, used inside dashboards)
 *   "light"   — softer surface for use on tinted/gradient backgrounds
 *   "compact" — slimmer, ideal for sidebars/login forms
 */
export default function FounderCard({ variant = "default", className = "" }) {
  const isCompact = variant === "compact";
  const surface =
    variant === "light"
      ? "bg-white/85 backdrop-blur border border-white/60"
      : "bg-white border border-slate-200";

  return (
    <section
      data-testid="founder-card"
      className={`${surface} rounded-2xl shadow-sm overflow-hidden ${className}`}
      aria-label="Founder and lead educator welcome message"
    >
      {/* Top stripe header */}
      <div className="grr-hero-gradient h-1.5 w-full" aria-hidden="true" />

      <div className={isCompact ? "p-4 sm:p-5" : "p-5 sm:p-7"}>
        {/* Identity row */}
        <div className="flex items-center gap-4">
          <div
            className={`shrink-0 rounded-xl overflow-hidden ring-2 ring-white shadow-md bg-slate-100 ${
              isCompact ? "h-12 w-12" : "h-14 w-14"
            }`}
          >
            <img
              src="/founder-256.jpg"
              srcSet="/founder-128.jpg 128w, /founder-256.jpg 256w, /founder-512.jpg 512w"
              sizes={isCompact ? "48px" : "56px"}
              alt="Rana Pratap Singh — Founder & Lead Educator"
              className="h-full w-full object-cover"
              loading="lazy"
              data-testid="founder-photo"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#F97316] font-semibold">
              Founder &amp; Lead Educator
            </div>
            <h3
              data-testid="founder-name"
              className={`font-display font-extrabold tracking-tight text-slate-900 leading-tight ${
                isCompact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
              }`}
            >
              Rana Pratap Singh
            </h3>
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] sm:text-sm text-slate-600">
              <BadgeCheck className="h-3.5 w-3.5 text-[#1D4ED8]" />
              Engineer &amp; Educator
            </div>
          </div>
        </div>

        {/* Welcome / mission */}
        <p
          data-testid="founder-welcome"
          className={`text-slate-700 leading-relaxed ${
            isCompact ? "mt-4 text-[13.5px]" : "mt-5 text-sm sm:text-[15px]"
          }`}
        >
          Learn with{" "}
          <span className="font-semibold text-slate-900">
            Rana Pratap Singh, Engineer &amp; Educator
          </span>
          . Our mission is to help students achieve academic success through
          quality education, discipline, and continuous growth.
        </p>

        {/* Quote */}
        <blockquote
          data-testid="founder-quote"
          className={`relative rounded-xl border-l-4 border-[#F97316] bg-orange-50/70 ${
            isCompact ? "mt-4 p-3" : "mt-5 p-4"
          }`}
        >
          <Quote
            className="absolute right-3 top-3 h-5 w-5 text-[#FDBA74]"
            aria-hidden="true"
          />
          <p className="font-display italic text-slate-800 text-[14px] sm:text-[15px] leading-snug pr-7">
            “Success comes from consistency, hard work, and never giving up.”
          </p>
          <footer className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-500 font-semibold">
            — Rana Pratap Singh
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
