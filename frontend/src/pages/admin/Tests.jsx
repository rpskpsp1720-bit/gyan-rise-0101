import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AdminTests() {
  const [items, setItems] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filterChapter, setFilterChapter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: ch }, { data: s }] = await Promise.all([api.get("/tests"), api.get("/chapters"), api.get("/subjects")]);
    setItems(t); setChapters(ch); setSubjects(s); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterChapter === "all" ? items : items.filter(i => i.chapter_id === filterChapter), [items, filterChapter]);
  const chapterLabel = (id) => {
    const c = chapters.find(x => x.id === id);
    if (!c) return "—";
    const s = subjects.find(x => x.id === c.subject_id);
    return `${c.name} • ${s?.name || ""}`;
  };
  const remove = async () => { try { await api.delete(`/tests/${delId}`); toast.success("Deleted"); setDelId(null); load(); } catch { toast.error("Delete failed"); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">MCQ Tests</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterChapter} onValueChange={setFilterChapter}>
            <SelectTrigger className="w-72 rounded-md" data-testid="tests-chapter-filter"><SelectValue placeholder="All chapters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chapters</SelectItem>
              {chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Link to="/admin/tests/new"><Button className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-test-btn"><Plus className="h-4 w-4 mr-2" />New Test</Button></Link>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Title</th><th className="text-left p-4">Chapter</th><th className="text-left p-4 hidden sm:table-cell">Questions</th><th className="text-left p-4 hidden sm:table-cell">Duration</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} data-testid={`test-row-${t.id}`}>
                  <td className="p-4 font-medium text-slate-900">{t.title}</td>
                  <td className="p-4 text-slate-600">{chapterLabel(t.chapter_id)}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-500">{t.questions?.length || 0}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-500">{t.duration_minutes} min</td>
                  <td className="p-4 text-right">
                    <Link to={`/admin/tests/${t.id}/edit`}>
                      <Button variant="ghost" size="sm" data-testid={`edit-test-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(t.id)} className="text-red-600" data-testid={`delete-test-${t.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-500">No tests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete test?</AlertDialogTitle><AlertDialogDescription>This will also delete all student attempts.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
