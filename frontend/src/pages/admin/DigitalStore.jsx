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

const empty = { title: "", description: "", thumbnail_url: "", drive_link: "", category: "", price: 0, currency: "INR", published: false };

export default function AdminDigitalStore() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/digital-store");
      setItems(data);
    } catch (e) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.drive_link) { toast.error("Title and Google Drive link required"); return; }
    try {
      if (editId) await api.put(`/digital-store/${editId}`, form);
      else await api.post(`/digital-store`, form);
      toast.success("Saved"); setOpen(false); load();
    } catch (err) { toast.error("Save failed"); }
  };

  const remove = async () => { try { await api.delete(`/digital-store/${delId}`); toast.success("Deleted"); setDelId(null); load(); } catch { toast.error("Delete failed"); } };

  const publish = async (id) => { try { await api.post(`/digital-store/${id}/publish`); toast.success("Published"); load(); } catch { toast.error("Publish failed"); } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Digital Store</h1>
          <p className="text-slate-500 mt-2 text-sm">Manage PDFs available for purchase.</p>
        </div>
        <div>
          <Button onClick={() => { setEditId(null); setForm(empty); setOpen(true); }} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md"><Plus className="h-4 w-4 mr-2" /> New</Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-48 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Title</th><th className="text-left p-4">Category</th><th className="text-left p-4">Price</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(n => (
                <tr key={n.id}>
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-500 truncate max-w-md">{n.description}</div>
                  </td>
                  <td className="p-4 text-slate-600">{n.category || '—'}</td>
                  <td className="p-4 text-slate-600">{(n.price || 0) > 0 ? `${n.currency || 'INR'} ${n.price}` : 'Free'}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditId(n.id); setForm({ ...empty, ...n, drive_link: n.drive_file_id || '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDelId(n.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                    {!n.published && <Button size="sm" onClick={() => publish(n.id)} className="ml-2">Publish</Button>}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">No items.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit PDF" : "New PDF"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Thumbnail URL</Label><Input value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
            <div><Label>Google Drive Link or File ID</Label><Input value={form.drive_link} onChange={e => setForm({ ...form, drive_link: e.target.value })} placeholder="https://drive.google.com/file/d/FILEID/view?usp=sharing" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Price</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value || 0) })} /></div>
            </div>
            <div className="flex items-center gap-2"><input id="pub" type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /><Label htmlFor="pub">Published</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete PDF?</AlertDialogTitle><AlertDialogDescription>This is permanent.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
