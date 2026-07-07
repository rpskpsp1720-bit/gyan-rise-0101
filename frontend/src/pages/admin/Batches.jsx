import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ImageUploadField from "@/components/ImageUploadField";
import { resolveImage } from "@/lib/apiClient";
import { formatPrice } from "@/components/BatchCard";

const empty = { name: "", description: "", cover_url: "", target_exam: "", year: "", price: 0, currency: "INR" };

export default function AdminBatches() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/batches");
    setItems(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (b) => { setEditId(b.id); setForm({ ...empty, ...b, year: b.year || "" }); setOpen(true); };

  const save = async () => {
    const payload = {
      ...form,
      year: form.year ? Number(form.year) : null,
      price: form.price === "" || form.price == null ? 0 : Number(form.price),
      currency: form.currency || "INR",
    };
    try {
      if (editId) await api.put(`/batches/${editId}`, payload);
      else await api.post(`/batches`, payload);
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) { toast.error("Save failed"); }
  };

  const remove = async () => {
    try {
      await api.delete(`/batches/${delId}`);
      toast.success("Deleted");
      setDelId(null);
      load();
    } catch (e) { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Batches</h1>
          <p className="text-slate-500 mt-2 text-sm">Create and manage course batches.</p>
        </div>
        <Button onClick={openNew} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md" data-testid="new-batch-btn">
          <Plus className="h-4 w-4 mr-2" /> New Batch
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="batches-table">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4 hidden sm:table-cell">Exam</th>
                <th className="text-left p-4 hidden sm:table-cell">Year</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((b) => (
                <tr key={b.id} data-testid={`batch-row-${b.id}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-20 rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                        {b.cover_url ? <img src={resolveImage(b.cover_url)} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full grr-soft-gradient" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{b.name}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{b.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-slate-600">{b.target_exam}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-600">{b.year}</td>
                  <td className="p-4 hidden sm:table-cell text-slate-600">{formatPrice(b.price, b.currency)}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)} data-testid={`edit-batch-${b.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(b.id)} className="text-red-600 hover:text-red-700" data-testid={`delete-batch-${b.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No batches yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="batch-dialog">
          <DialogHeader><DialogTitle>{editId ? "Edit Batch" : "New Batch"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="batch-name-input" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="batch-description-input" /></div>
            <ImageUploadField
              label="Cover image"
              value={form.cover_url}
              onChange={(v) => setForm({ ...form, cover_url: v })}
              testid="batch-cover-upload"
            />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Target Exam</Label><Input value={form.target_exam} onChange={(e) => setForm({ ...form, target_exam: e.target.value })} placeholder="NEET / JEE / CBSE" data-testid="batch-exam-input" /></div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} data-testid="batch-year-input" /></div>
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="0 for free, 4999 for paid"
                data-testid="batch-price-input"
              />
              <p className="text-xs text-slate-500 mt-1">Use 0 for a free batch, or enter the amount in rupees.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="cancel-batch-btn">Cancel</Button>
            <Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="save-batch-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>This will also delete all subjects, chapters, videos, notes and tests under this batch.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-batch">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-batch">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
