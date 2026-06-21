import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const empty = { chapter_id: "", title: "", description: "", url: "" };

export default function AdminNotes() {
  const [items, setItems] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filterChapter, setFilterChapter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: n }, { data: ch }, { data: s }] = await Promise.all([api.get("/notes"), api.get("/chapters"), api.get("/subjects")]);
    setItems(n); setChapters(ch); setSubjects(s); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterChapter === "all" ? items : items.filter(i => i.chapter_id === filterChapter), [items, filterChapter]);
  const chapterLabel = (id) => {
    const c = chapters.find(x => x.id === id);
    if (!c) return "—";
    const s = subjects.find(x => x.id === c.subject_id);
    return `${c.name} • ${s?.name || ""}`;
  };

  const save = async () => {
    if (!form.chapter_id || !form.title || !form.url) { toast.error("Chapter, title and URL required"); return; }
    try {
      if (editId) await api.put(`/notes/${editId}`, form);
      else await api.post(`/notes`, form);
      toast.success("Saved"); setOpen(false); load();
    } catch { toast.error("Save failed"); }
  };
  const remove = async () => { try { await api.delete(`/notes/${delId}`); toast.success("Deleted"); setDelId(null); load(); } catch { toast.error("Delete failed"); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Notes (PDFs)</h1>
          <p className="text-slate-500 mt-2 text-sm">Add a hosted PDF URL — students can read inline or download.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterChapter} onValueChange={setFilterChapter}>
            <SelectTrigger className="w-72 rounded-md" data-testid="notes-chapter-filter"><SelectValue placeholder="All chapters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chapters</SelectItem>
              {chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-note-btn">
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Title</th><th className="text-left p-4">Chapter</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(n => (
                <tr key={n.id} data-testid={`note-row-${n.id}`}>
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-md">{n.url}</div>
                  </td>
                  <td className="p-4 text-slate-600">{chapterLabel(n.chapter_id)}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(n.id); setForm({ ...empty, ...n }); setOpen(true); }} data-testid={`edit-note-${n.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(n.id)} className="text-red-600" data-testid={`delete-note-${n.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-slate-500">No notes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Note" : "New Note"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Chapter</Label>
              <Select value={form.chapter_id} onValueChange={(v) => setForm({ ...form, chapter_id: v })}>
                <SelectTrigger data-testid="note-chapter-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="note-title-input" /></div>
            <div><Label>PDF URL</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} data-testid="note-url-input" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="note-description-input" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="save-note-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete note?</AlertDialogTitle><AlertDialogDescription>This is permanent.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
