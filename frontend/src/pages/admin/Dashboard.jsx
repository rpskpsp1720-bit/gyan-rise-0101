import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, Atom, BookOpen, Video, FileText, ClipboardList, Users, Radio, Bell, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const CARDS = [
  { key: "batches", label: "Batches", icon: Library, color: "text-[#1D4ED8]", bg: "bg-blue-50", href: "/admin/batches" },
  { key: "subjects", label: "Subjects", icon: Atom, color: "text-[#1E40AF]", bg: "bg-blue-50", href: "/admin/subjects" },
  { key: "chapters", label: "Chapters", icon: BookOpen, color: "text-emerald-700", bg: "bg-emerald-50", href: "/admin/chapters" },
  { key: "videos", label: "Videos", icon: Video, color: "text-amber-700", bg: "bg-amber-50", href: "/admin/videos" },
  { key: "notes", label: "Notes", icon: FileText, color: "text-purple-700", bg: "bg-purple-50", href: "/admin/notes" },
  { key: "tests", label: "MCQ Tests", icon: ClipboardList, color: "text-[#1D4ED8]", bg: "bg-blue-50", href: "/admin/tests" },
  { key: "live_classes", label: "Live Classes", icon: Radio, color: "text-pink-700", bg: "bg-pink-50", href: "/admin/live-classes" },
  { key: "notifications", label: "Notifications", icon: Bell, color: "text-amber-700", bg: "bg-amber-50", href: "/admin/notifications" },
  { key: "students", label: "Students", icon: Users, color: "text-[#1E40AF]", bg: "bg-blue-50", href: "/admin/students" },
];

export default function AdminDashboard() {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/dashboard/admin");
      setCounts(data.counts);
    })();
  }, []);

  if (!counts) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#F97316] font-semibold">GYAN RISE · Admin Console</div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter text-slate-900 mt-1">
          Run your coaching institute, end to end.
        </h1>
        <p className="text-slate-500 mt-3 max-w-2xl">
          Manage batches, subjects, chapters, videos, notes, MCQ tests and live classes — all from a single control plane.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-stats-grid">
        {CARDS.map(({ key, label, icon: Icon, color, bg, href }) => (
          <Link
            to={href}
            key={key}
            className="bg-white border border-slate-200 rounded-lg p-5 card-lift flex flex-col"
            data-testid={`stat-${key}`}
          >
            <div className="flex items-start justify-between">
              <div className={`h-10 w-10 rounded-md grid place-items-center ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900">{counts[key] ?? 0}</div>
            <div className="text-sm text-slate-500 mt-1">{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
