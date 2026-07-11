import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import BatchCard from "@/components/BatchCard";
import BuyButton from "@/components/BuyButton";
import LiveClassCard from "@/components/LiveClassCard";
import CourseProgress from "@/components/CourseProgress";
import { Link } from "react-router-dom";
import { FileText, ClipboardList, PlayCircle, ArrowRight, Sparkles, Flame, Zap, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import FounderCard from "@/components/FounderCard";
import DeveloperFooter from "@/components/DeveloperFooter";
import SupportFAB from "@/components/SupportFAB";

function SectionHeader({ title, action, kicker }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        {kicker && <div className="text-xs uppercase tracking-[0.25em] text-[#F97316] font-semibold mb-1">{kicker}</div>}
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [continueWatching, setContinueWatching] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    const [{ data: d }, { data: cw }, { data: ab }] = await Promise.all([
      api.get("/dashboard/student"),
      api.get("/progress/continue-watching"),
      api.get("/batches"),
    ]);
    setData(d);
    setContinueWatching(cw);
    setAllBatches(ab);
  };

  useEffect(() => {
    (async () => {
      try { await loadAll(); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { batches = [], live_classes = [], latest_notes = [], latest_tests = [] } = data || {};

  return (
    <div className="space-y-12">
      {/* Welcome hero */}
      <section
        className="relative overflow-hidden rounded-2xl grr-hero-gradient text-white p-6 sm:p-10"
        data-testid="welcome-hero"
      >
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=85&w=1600')", backgroundSize: "cover" }} />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[#FED7AA] font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" /> GYAN RISE · Daily Briefing
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter leading-[1.05]">
            Hello, {user?.name?.split(" ")[0]} — one chapter today brings you closer to <span className="text-[#FDBA74]">your rank.</span>
          </h1>
          <p className="mt-4 text-white/85 max-w-lg">
            You're enrolled in <span className="font-bold">{batches.length}</span> batch{batches.length === 1 ? "" : "es"}. Keep your streak alive 🔥
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/batches">
              <Button className="bg-white hover:bg-orange-50 text-[#1E40AF] rounded-lg font-semibold" data-testid="go-batches-btn">
                Continue Learning <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/live-classes">
              <Button variant="outline" className="rounded-lg border-white/40 text-white hover:bg-white/10 hover:text-white" data-testid="go-live-btn">
                <Flame className="h-4 w-4 mr-2 text-[#FDBA74]" /> See Live Classes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Founder welcome */}
      <FounderCard />

      {/* Progress overview */}
      {batches.length > 0 && (
        <section>
          <SectionHeader title="Your Progress" kicker="Track every chapter" />
          <div className="grid lg:grid-cols-2 gap-4" data-testid="progress-overview">
            {batches.slice(0, 2).map((b) => (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-slate-500">{b.target_exam} • {b.year}</div>
                    <Link to={`/batches/${b.id}`} className="font-display text-lg font-bold tracking-tight text-slate-900 hover:text-[#1E40AF]">
                      {b.name}
                    </Link>
                  </div>
                  <Zap className="h-5 w-5 text-[#F97316]" />
                </div>
                <CourseProgress batchId={b.id} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming live */}
      {live_classes.length > 0 && (
        <section>
          <SectionHeader
            title="Upcoming Live Classes"
            action={<Link to="/live-classes" className="text-sm text-[#1D4ED8] font-semibold hover:underline">View all →</Link>}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="upcoming-live-grid">
            {live_classes.slice(0, 3).map((lc) => (
              <LiveClassCard key={lc.id} liveClass={lc} />
            ))}
          </div>
        </section>
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <SectionHeader title="Continue Watching" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="continue-watching-grid">
            {continueWatching.slice(0, 6).map((p) => {
              const pct = p.duration_seconds ? Math.min(100, Math.round((p.position_seconds / p.duration_seconds) * 100)) : 0;
              return (
                <Link key={p.video_id} to={`/videos/${p.video_id}`} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all" data-testid={`continue-watching-${p.video_id}`}>
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
                      <div className="text-[11px] text-slate-500 mt-1">{pct}% watched</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* My Batches (Purchased) */}
      <section>
        <SectionHeader
          title="Purchased Batches"
          kicker="Your library"
          action={<Link to="/batches" className="text-sm text-[#1D4ED8] font-semibold hover:underline">All batches →</Link>}
        />
        {batches.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500" data-testid="purchased-empty">
            You haven't purchased any batch yet. Scroll down to explore available batches.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="my-batches-grid">
            {batches.slice(0, 6).map((b) => <BatchCard key={b.id} batch={b} testid="purchased-batch" />)}
          </div>
        )}
      </section>

      {/* Available batches (not purchased yet) */}
      {(() => {
        const available = allBatches.filter(b => !b.is_enrolled);
        if (available.length === 0) return null;
        return (
          <section>
            <SectionHeader
              title="Explore More Batches"
              kicker="Unlock more content"
              action={<Link to="/batches" className="text-sm text-[#F97316] font-semibold hover:underline inline-flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Browse all →</Link>}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="available-batches-grid">
              {available.slice(0, 3).map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  testid="available-batch"
                  footer={<BuyButton batch={b} onSuccess={loadAll} />}
                />
              ))}
            </div>
          </section>
        );
      })()}

      {/* Latest notes + tests */}
      <section className="grid lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Latest Notes" />
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" data-testid="latest-notes-list">
            {latest_notes.length === 0 && <div className="p-6 text-slate-500 text-sm">No notes yet.</div>}
            {latest_notes.map((n) => (
              <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 hover:bg-slate-50" data-testid={`note-${n.id}`}>
                <div className="h-10 w-10 rounded-lg bg-blue-50 text-[#1D4ED8] grid place-items-center"><FileText className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{n.title}</div>
                  <div className="text-xs text-slate-500 truncate">{n.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <SectionHeader title="Latest Tests" />
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100" data-testid="latest-tests-list">
            {latest_tests.length === 0 && <div className="p-6 text-slate-500 text-sm">No tests yet.</div>}
            {latest_tests.map((t) => (
              <Link key={t.id} to={`/tests/${t.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50" data-testid={`test-${t.id}`}>
                <div className="h-10 w-10 rounded-lg bg-orange-50 text-[#EA580C] grid place-items-center"><ClipboardList className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{t.title}</div>
                  <div className="text-xs text-slate-500">{t.questions?.length || 0} questions • {t.duration_minutes} min</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Platform development credit */}
      <DeveloperFooter />

      {/* Floating customer-support button */}
      <SupportFAB />
    </div>
  );
}
