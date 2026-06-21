import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, BookOpen, PlayCircle, FileText, ClipboardList } from "lucide-react";

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [batch, setBatch] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await api.get(`/subjects/${subjectId}`);
      setSubject(s);
      const [{ data: ch }, { data: b }] = await Promise.all([
        api.get(`/chapters`, { params: { subject_id: subjectId } }),
        api.get(`/batches/${s.batch_id}`),
      ]);
      setChapters(ch);
      setBatch(b);
      setLoading(false);
    })();
  }, [subjectId]);

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500" data-testid="breadcrumb">
        <Link to="/batches" className="hover:text-slate-900">Batches</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <Link to={`/batches/${batch?.id}`} className="hover:text-slate-900">{batch?.name}</Link>
        <ChevronRight className="inline h-3 w-3 mx-1" />
        <span className="text-slate-900">{subject?.name}</span>
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">{batch?.target_exam}</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">
          {subject?.name}
        </h1>
        <p className="text-slate-500 mt-2">{chapters.length} chapters • Tap to start</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100" data-testid="chapters-list">
        {chapters.length === 0 && <div className="p-6 text-slate-500 text-sm">No chapters yet.</div>}
        {chapters.map((c, i) => (
          <Link
            key={c.id}
            to={`/chapters/${c.id}`}
            className="flex items-center gap-4 p-5 hover:bg-slate-50 group"
            data-testid={`chapter-item-${c.id}`}
          >
            <div
              className="h-12 w-12 rounded-md grid place-items-center font-display font-bold text-white"
              style={{ background: subject?.color || "#1D4ED8" }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-slate-900 text-lg tracking-tight">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1 inline-flex items-center gap-4">
                <span className="inline-flex items-center gap-1"><PlayCircle className="h-3 w-3" /> Videos</span>
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Notes</span>
                <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Tests</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-900" />
          </Link>
        ))}
      </div>
    </div>
  );
}
