import React, { useState, useEffect } from "react";
import { Phone, MessageCircle, X, Headphones } from "lucide-react";

/**
 * SupportFAB
 * Floating customer-support button (bottom-right, fixed) that opens
 * a contact card with Call / WhatsApp actions.
 *
 * Purely additive — does not affect any existing functionality.
 */

const SUPPORT_PHONE_DISPLAY = "+91 73806 96927";
const SUPPORT_PHONE_TEL = "+917380696927"; // E.164, no spaces — for tel: + wa.me
const SUPPORT_WA_TEXT =
  "Hi, I need help with my GYAN RISE account.";

export default function SupportFAB() {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const waUrl = `https://wa.me/${SUPPORT_PHONE_TEL.replace(
    /^\+/,
    ""
  )}?text=${encodeURIComponent(SUPPORT_WA_TEXT)}`;

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close customer support" : "Open customer support"}
        aria-expanded={open}
        data-testid="support-fab-button"
        className={`fixed z-[60] bottom-12 right-5 sm:right-6 h-14 w-14 sm:h-15 sm:w-15 rounded-full shadow-xl shadow-emerald-600/30
          flex items-center justify-center text-white transition-all duration-300
          ${open
            ? "bg-slate-900 hover:bg-slate-800 rotate-90"
            : "bg-[#25D366] hover:bg-[#1FBB58] hover:scale-105 animate-grr-pulse"}`}
      >
        {open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-orange-500 ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      {/* Backdrop on small screens */}
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-slate-900/30 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-0"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Popup card */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-card-title"
          data-testid="support-fab-card"
          className="fixed z-[60] bottom-32 right-4 sm:right-6 left-4 sm:left-auto w-auto sm:w-[340px] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden grr-pop-in"
        >
          {/* Header */}
          <div className="grr-hero-gradient px-5 py-4 text-white">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur grid place-items-center shrink-0">
                <Headphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div
                  id="support-card-title"
                  className="font-display text-lg font-extrabold tracking-tight leading-tight"
                >
                  Customer Support
                </div>
                <a
                  href={`tel:${SUPPORT_PHONE_TEL}`}
                  data-testid="support-card-phone"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/90 hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="font-semibold tracking-wide">{SUPPORT_PHONE_DISPLAY}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              Need help with courses, payments, batches, or live classes?
              Contact our support team — we typically reply within minutes
              during business hours.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <a
                href={`tel:${SUPPORT_PHONE_TEL}`}
                data-testid="support-call-button"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-sm font-semibold transition-colors"
              >
                <Phone className="h-4 w-4" /> Call Now
              </a>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="support-whatsapp-button"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-[#25D366] hover:bg-[#1FBB58] text-white text-sm font-semibold transition-colors"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp Chat
              </a>
            </div>

            <p className="mt-3 text-[11px] text-slate-400 text-center">
              Available 9 AM – 9 PM IST · Mon to Sat
            </p>
          </div>
        </div>
      )}
    </>
  );
}
