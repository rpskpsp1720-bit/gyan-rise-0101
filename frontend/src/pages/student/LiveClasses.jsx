import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, toYouTubeEmbed } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Radio, Calendar } from "lucide-react";
import LiveChat from "@/components/LiveChat";
import VideoWatermark from "@/components/VideoWatermark";

function formatWhen(iso) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

export default function LiveClasses() {
  const location = useLocation();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/live-classes");
      setItems(data);
      const preferred = location.state?.openId ? data.find((d) => d.id === location.state.openId) : null;
      setActive(preferred || data.find((d) => d.status === "live") || data[0] || null);
      setLoading(false);
    })();
  }, [location.state]);

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#F97316] font-semibold">Streaming Now</div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tighter text-slate-900 mt-1">Live Classes</h1>
        <p className="text-slate-500 mt-2">YouTube live streams with real-time class chat.</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500">
          No live classes scheduled.
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {active && (
              <>
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-slate-200 no-context" data-testid="live-player" onContextMenu={(e)=>e.preventDefault()}>
                  <iframe
                    key={active.id}
                    src={toYouTubeEmbed(active.youtube_url)}
                    title={active.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                  {/* Title-bar click trap — discourages "Watch on YouTube" navigation
                      without touching iframe sizing/playback. Stays well above the
                      controls bar so play/pause, progress and fullscreen all work. */}
                  <div
                    aria-hidden="true"
                    className="absolute top-0 left-0 right-0 h-11 z-10"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    data-testid="yt-title-shield"
                  />
                  <VideoWatermark name={user?.name} email={user?.email} />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {active.status === "live" ? (
                        <Badge className="bg-[#F97316] hover:bg-[#F97316] text-white rounded-md font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-white live-dot mr-1.5" /> LIVE NOW
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-md">{active.status}</Badge>
                      )}
                      <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{formatWhen(active.start_time)}</span>
                    </div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">{active.title}</h2>
                    <p className="text-slate-500 mt-2 text-sm max-w-2xl">{active.description}</p>
                  </div>
                </div>

                {/* Sessions selector */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 thin-scroll overflow-x-auto">
                  <div className="flex gap-2 min-w-min">
                    {items.map(lc => {
                      const isActive = active?.id === lc.id;
                      return (
                        <button
                          key={lc.id}
                          onClick={() => setActive(lc)}
                          className={`flex-shrink-0 text-left p-3 rounded-lg border transition-colors min-w-[220px] ${isActive ? "border-[#1D4ED8] bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                          data-testid={`live-list-item-${lc.id}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {lc.status === "live" ? (
                              <Badge className="bg-[#F97316] hover:bg-[#F97316] text-white text-[10px] rounded-md px-1.5">LIVE</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] rounded-md px-1.5">{lc.status}</Badge>
                            )}
                            <span className="text-[11px] text-slate-500">{formatWhen(lc.start_time)}</span>
                          </div>
                          <div className="font-semibold text-slate-900 text-sm line-clamp-2">{lc.title}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {active && <LiveChat liveClassId={active.id} />}
        </div>
      )}
    </div>
  );
}
