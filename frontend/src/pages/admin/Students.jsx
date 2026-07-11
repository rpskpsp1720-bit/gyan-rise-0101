import React, { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [batchId, setBatchId] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: b }] = await Promise.all([api.get("/students"), api.get("/batches")]);
    setStudents(s); setBatches(b); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const enroll = async () => {
    if (!batchId) { toast.error("Pick a batch"); return; }
    try {
      await api.post(`/enrollments`, { student_id: target.id, batch_id: batchId });
      toast.success(`${target.name} enrolled`);
      setOpen(false); setBatchId(""); load();
    } catch { toast.error("Enroll failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-[#1D4ED8]">Admin</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Students</h1>
        <p className="text-slate-500 mt-2 text-sm">{students.length} students registered.</p>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="students-table">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr><th className="text-left p-4">Student</th><th className="text-left p-4 hidden sm:table-cell">Email</th><th className="text-left p-4">Batches</th><th className="text-right p-4">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map(s => (
                <tr key={s.id} data-testid={`student-row-${s.id}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={s.avatar_url} />
                        <AvatarFallback className="bg-slate-200 text-slate-700">{s.name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-900">{s.name}</div>
                        <div className="text-xs text-slate-500 sm:hidden">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell text-slate-600">{s.email}</td>
                  <td className="p-4 text-slate-600">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-md"><Users className="h-3 w-3" /> {s.enrollment_count}</span>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => { setTarget(s); setOpen(true); }} className="rounded-md" data-testid={`enroll-student-${s.id}`}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Enroll
                    </Button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-slate-500">No students yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll {target?.name} in a batch</DialogTitle></DialogHeader>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger data-testid="enroll-batch-select"><SelectValue placeholder="Select batch" /></SelectTrigger>
            <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={enroll} className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white" data-testid="confirm-enroll-btn">Enroll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
