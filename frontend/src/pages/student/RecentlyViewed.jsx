import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatDuration } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayCircle, Clock } from "lucide-react";

export default function RecentlyViewed() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/progress/recently-viewed");
      setItems(data);
    })();
  }, []);

  if (items == null) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#F97316] font-semibold">History</div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-900 mt-1">Recently Viewed</h1>
        <p className="text-slate-500 mt-2">Pick up exactly where you left off.</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500" data-testid="recent-empty">
          You haven't watched any lessons yet. Browse a batch to start.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recently-viewed-grid">
          {items.map((p) => {
            const pct = p.duration_seconds ? Math.min(100, Math.round((p.position_seconds / p.duration_seconds) * 100)) : 0;
            return (
              <Link key={p.video_id} to={`/videos/${p.video_id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all" data-testid={`recent-${p.video_id}`}>
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-lg grr-soft-gradient grid place-items-center text-[#1D4ED8] flex-shrink-0">
                    <PlayCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500">{p.subject?.name} • {p.chapter?.name}</div>
                    <h4 className="font-semibold text-slate-900 mt-0.5 line-clamp-2">{p.video?.title}</h4>
                    <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1D4ED8, #F97316)" }} />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>{pct}% watched</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(p.video?.duration_seconds)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
