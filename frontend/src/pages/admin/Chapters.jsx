import React, { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const empty = { subject_id: "", name: "", order: 0 };

export default function AdminChapters() {
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filterSubject, setFilterSubject] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: b }] = await Promise.all([api.get("/chapters"), api.get("/subjects"), api.get("/batches")]);
    setItems(c); setSubjects(s); setBatches(b); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterSubject === "all" ? items : items.filter(i => i.subject_id === filterSubject), [items, filterSubject]);
  const subjectLabel = (id) => {
    const s = subjects.find(x => x.id === id);
    if (!s) return "—";
    const b = batches.find(x => x.id === s.batch_id);
    return `${s.name} • ${b?.name || ""}`;
  };

  const save = async () => {
    if (!form.subject_id || !form.name) { toast.error("Subject and name required"); return; }
    try {
      const payload = { ...form, order: Number(form.order) || 0 };
      if (editId) await api.put(`/chapters/${editId}`, payload);
      else await api.post(`/chapters`, payload);
      toast.success("Saved"); setOpen(false); load();
    } catch { toast.error("Save failed"); }
  };

  const remove = async () => {
    try { await api.delete(`/chapters/${delId}`); toast.success("Deleted"); setDelId(null); load(); } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Chapters</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-72 rounded-md" data-testid="chapters-subject-filter"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{subjectLabel(s.id)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-chapter-btn">
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Name</th><th className="text-left p-4">Subject</th><th className="text-left p-4 hidden sm:table-cell">Order</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} data-testid={`chapter-row-${c.id}`}>
                  <td className="p-4 font-medium text-slate-900">{c.name}</td>
                  <td className="p-4 text-slate-600">{subjectLabel(c.subject_id)}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-500">{c.order}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(c.id); setForm({ ...empty, ...c }); setOpen(true); }} data-testid={`edit-chapter-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(c.id)} className="text-red-600" data-testid={`delete-chapter-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">No chapters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Chapter" : "New Chapter"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger data-testid="chapter-subject-select"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{subjectLabel(s.id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="chapter-name-input" /></div>
            <div><Label>Order</Label><Input type="number" value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} data-testid="chapter-order-input" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="save-chapter-btn">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete chapter?</AlertDialogTitle><AlertDialogDescription>Cascade-deletes videos, notes, tests.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
