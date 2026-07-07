import React, { useEffect, useState, useMemo } from "react";
import { api, formatDuration } from "@/lib/apiClient";
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

const empty = { chapter_id: "", title: "", description: "", url: "", duration_seconds: 0, order: 0 };

export default function AdminVideos() {
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
    const [{ data: v }, { data: ch }, { data: s }] = await Promise.all([api.get("/videos"), api.get("/chapters"), api.get("/subjects")]);
    setItems(v); setChapters(ch); setSubjects(s); setLoading(false);
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
    const payload = { ...form, duration_seconds: Number(form.duration_seconds) || 0, order: Number(form.order) || 0 };
    try {
      if (editId) await api.put(`/videos/${editId}`, payload);
      else await api.post(`/videos`, payload);
      toast.success("Saved"); setOpen(false); load();
    } catch { toast.error("Save failed"); }
  };
  const remove = async () => { try { await api.delete(`/videos/${delId}`); toast.success("Deleted"); setDelId(null); load(); } catch { toast.error("Delete failed"); } };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Videos</h1>
          <p className="text-slate-500 mt-2 text-sm">Paste a YouTube / streaming URL to publish a lesson.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterChapter} onValueChange={setFilterChapter}>
            <SelectTrigger className="w-72 rounded-md" data-testid="videos-chapter-filter"><SelectValue placeholder="All chapters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chapters</SelectItem>
              {chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-video-btn">
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Title</th><th className="text-left p-4">Chapter</th><th className="text-left p-4 hidden sm:table-cell">Duration</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} data-testid={`video-row-${v.id}`}>
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{v.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-md">{v.url}</div>
                  </td>
                  <td className="p-4 text-slate-600">{chapterLabel(v.chapter_id)}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-500">{formatDuration(v.duration_seconds)}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(v.id); setForm({ ...empty, ...v }); setOpen(true); }} data-testid={`edit-video-${v.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(v.id)} className="text-red-600" data-testid={`delete-video-${v.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">No videos.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Video" : "New Video"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Chapter</Label>
              <Select value={form.chapter_id} onValueChange={(v) => setForm({ ...form, chapter_id: v })}>
                <SelectTrigger data-testid="video-chapter-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{chapters.map(c => <SelectItem key={c.id} value={c.id}>{chapterLabel(c.id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="video-title-input" /></div>
            <div><Label>YouTube / Video URL</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." data-testid="video-url-input" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="video-description-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Duration (sec)</Label><Input type="number" value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: e.target.value })} data-testid="video-duration-input" /></div>
              <div><Label>Order</Label><Input type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} data-testid="video-order-input" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="save-video-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete video?</AlertDialogTitle><AlertDialogDescription>This action is permanent.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
