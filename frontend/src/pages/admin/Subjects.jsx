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
import ImageUploadField from "@/components/ImageUploadField";

const empty = { batch_id: "", name: "", icon: "BookOpen", color: "#1D4ED8", cover_url: "" };

export default function AdminSubjects() {
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filterBatch, setFilterBatch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: b }] = await Promise.all([api.get("/subjects"), api.get("/batches")]);
    setItems(s);
    setBatches(b);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterBatch === "all" ? items : items.filter(i => i.batch_id === filterBatch), [items, filterBatch]);
  const batchName = (id) => batches.find(b => b.id === id)?.name || "—";

  const save = async () => {
    if (!form.batch_id || !form.name) { toast.error("Batch and name required"); return; }
    try {
      if (editId) await api.put(`/subjects/${editId}`, form);
      else await api.post(`/subjects`, form);
      toast.success("Saved"); setOpen(false); load();
    } catch { toast.error("Save failed"); }
  };

  const remove = async () => {
    try { await api.delete(`/subjects/${delId}`); toast.success("Deleted"); setDelId(null); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Subjects</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterBatch} onValueChange={setFilterBatch}>
            <SelectTrigger className="w-56 rounded-md" data-testid="subjects-batch-filter"><SelectValue placeholder="All batches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-subject-btn">
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Batch</th>
                <th className="text-left p-4 hidden sm:table-cell">Color</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <tr key={s.id} data-testid={`subject-row-${s.id}`}>
                  <td className="p-4 font-medium text-slate-900">{s.name}</td>
                  <td className="p-4 text-slate-600">{batchName(s.batch_id)}</td>
                  <td className="p-4 hidden sm:table-cell">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 rounded" style={{ background: s.color }} />
                      <span className="text-xs text-slate-500">{s.color}</span>
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(s.id); setForm({ ...empty, ...s }); setOpen(true); }} data-testid={`edit-subject-${s.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(s.id)} className="text-red-600" data-testid={`delete-subject-${s.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">No subjects.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Subject" : "New Subject"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Batch</Label>
              <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                <SelectTrigger data-testid="subject-batch-select"><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="subject-name-input" /></div>
            <div><Label>Icon (lucide name)</Label><Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="Atom, Sigma, Leaf..." data-testid="subject-icon-input" /></div>
            <div><Label>Color (hex)</Label><Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} placeholder="#1D4ED8" data-testid="subject-color-input" /></div>
            <ImageUploadField
              label="Cover image"
              value={form.cover_url}
              onChange={(v) => setForm({ ...form, cover_url: v })}
              testid="subject-cover-upload"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="save-subject-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete subject?</AlertDialogTitle><AlertDialogDescription>Cascade-deletes its chapters, videos, notes and tests.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
