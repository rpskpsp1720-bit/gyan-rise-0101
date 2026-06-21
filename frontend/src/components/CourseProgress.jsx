import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, TrendingUp } from "lucide-react";

export default function CourseProgress({ batchId, compact = false }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!batchId) return;
    (async () => {
      try {
        const { data } = await api.get(`/progress/completion/${batchId}`);
        setData(data);
      } catch { setData({ pct: 0, completed: 0, total: 0, per_subject: [] }); }
    })();
  }, [batchId]);

  if (!data) return <Skeleton className="h-32 w-full rounded-xl" />;

  if (compact) {
    return (
      <div data-testid={`progress-compact-${batchId}`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Course progress</span>
          <span className="font-semibold text-[#1E40AF]">{data.pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${data.pct}%`, background: "linear-gradient(90deg, #1D4ED8, #F97316)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid={`progress-full-${batchId}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8] font-semibold inline-flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Course completion
          </div>
          <div className="font-display text-4xl font-extrabold tracking-tight text-slate-900 mt-1">{data.pct}%</div>
          <div className="text-sm text-slate-500 inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {data.completed} of {data.total} lessons completed
          </div>
        </div>
        <div className="h-20 w-20 relative">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E5E9F2" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="url(#prog-grad)" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${data.pct} 100`}
            />
            <defs>
              <linearGradient id="prog-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {data.per_subject?.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {data.per_subject.map((s) => (
            <div key={s.id} data-testid={`subject-progress-${s.id}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-700 font-medium">{s.name}</span>
                <span className="text-slate-500">{s.completed}/{s.total} • {s.pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color || "#1D4ED8" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
