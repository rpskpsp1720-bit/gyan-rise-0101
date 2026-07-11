import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, BookOpen, Check, Lock } from "lucide-react";
import { resolveImage } from "@/lib/apiClient";

function formatPrice(price, currency = "INR") {
  if (price == null || price === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `₹${price}`;
  }
}

export default function BatchCard({ batch, testid = "batch-card", footer }) {
  const isEnrolled = !!batch.is_enrolled;
  const isFree = !batch.price || batch.price === 0;

  return (
    <Card className="card-lift overflow-hidden bg-white border-slate-200 rounded-xl flex flex-col h-full" data-testid={`${testid}-${batch.id}`}>
      <Link to={`/batches/${batch.id}`} className="block">
        <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
          {batch.cover_url ? (
            <img src={resolveImage(batch.cover_url)} alt={batch.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grr-hero-gradient" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/15 to-transparent" />

          {/* Top-right badges */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            {isEnrolled ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white rounded-md font-bold inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> PURCHASED
              </Badge>
            ) : (
              <Badge className={`${isFree ? "bg-blue-100 text-[#1E40AF]" : "bg-[#F97316] text-white"} hover:opacity-100 rounded-md font-bold`}>
                {isFree ? "FREE" : formatPrice(batch.price, batch.currency)}
              </Badge>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            {batch.target_exam && (
              <Badge className="bg-white text-[#1E40AF] hover:bg-white rounded-md border border-white/40 font-bold">
                {batch.target_exam}
              </Badge>
            )}
            {batch.year && <span className="text-white/90 text-xs font-semibold bg-black/30 px-2 py-1 rounded">Batch {batch.year}</span>}
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="font-display font-bold text-lg tracking-tight text-slate-900 line-clamp-2">{batch.name}</h3>
          <p className="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">{batch.description}</p>
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-[#1D4ED8]" /> Full course</span>
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-[#F97316]" /> {batch.year || "All year"}</span>
            {!isEnrolled && !isFree && (
              <span className="inline-flex items-center gap-1 text-amber-600"><Lock className="h-3 w-3" /> Locked</span>
            )}
          </div>
        </div>
      </Link>
      {footer && <div className="px-5 pb-5">{footer}</div>}
    </Card>
  );
}

export { formatPrice };
