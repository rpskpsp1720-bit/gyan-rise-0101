import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Radio, Calendar, Clock } from "lucide-react";
import { toYouTubeEmbed } from "@/lib/apiClient";

function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function LiveClassCard({ liveClass, testid = "live-card" }) {
  const isLive = liveClass.status === "live";
  return (
    <Link
      to={`/live-classes`}
      state={{ openId: liveClass.id }}
      className="block"
      data-testid={`${testid}-${liveClass.id}`}
    >
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isLive ? (
                <Badge className="bg-[#F97316] hover:bg-[#F97316] text-white rounded-md inline-flex items-center gap-1.5 px-2.5 py-1 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" />
                  LIVE NOW
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-md border-blue-200 text-[#1E40AF] bg-blue-50">
                  Upcoming
                </Badge>
              )}
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <Radio className="h-3 w-3" /> YouTube Live
              </span>
            </div>
            <h4 className="font-semibold text-slate-900 line-clamp-2">{liveClass.title}</h4>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{liveClass.description}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatWhen(liveClass.start_time)}
          </span>
          <span className="text-[#1D4ED8] font-semibold">Join →</span>
        </div>
      </div>
    </Link>
  );
}
