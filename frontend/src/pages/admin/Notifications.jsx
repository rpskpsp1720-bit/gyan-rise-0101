import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, CheckCircle2, Send, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const DEFAULTS = {
  live_class: { label: "Live Class Notification", description: "Send when admin starts a live class." },
  new_batch: { label: "New Batch Notification", description: "Send when a new batch is published." },
  content_upload: { label: "Content Upload Notification", description: "Send when notes, PDFs or recordings are uploaded." },
  custom: { label: "Custom Notification", description: "Send a custom message to all users." },
};

export default function AdminNotifications() {
  const [mode, setMode] = useState("live_class");
  const [entityId, setEntityId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const modeOptions = useMemo(() => Object.entries(DEFAULTS), []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications/history");
      setHistory(data);
    } catch (e) {
      toast.error("Could not load notification history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const send = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/notifications/send", {
        mode,
        entity_id: entityId || undefined,
        title: title || undefined,
        body: body || undefined,
        url: url || undefined,
      });
      toast.success("Notification queued: " + (data.result.success ? `${data.result.success} sent` : "none sent"));
      setTitle("");
      setBody("");
      loadHistory();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#F97316]">Admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tighter text-slate-900 mt-1">Notifications</h1>
          <p className="text-slate-500 mt-2 text-sm">Send push notifications and view history for admin announcements.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          <Bell className="h-4 w-4" /> Supports Android, browser and PWA devices
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="space-y-3">
            <Label>Notification type</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {modeOptions.map(([key, info]) => (
                  <SelectItem key={key} value={key}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-slate-500">{DEFAULTS[mode].description}</div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Entity ID (optional)</Label>
              <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="Live class / batch / note / video ID" />
            </div>
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notification body" />
            </div>
            <div>
              <Label>Open URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/live-classes or /batches/:id" />
            </div>
            <Button onClick={send} disabled={sending} className="w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white">
              <Send className="h-4 w-4 mr-2" /> {sending ? "Sending..." : "Send Notification"}
            </Button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">History</h2>
              <div className="text-sm text-slate-500">Recent notifications sent from the admin panel.</div>
            </div>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading}>
              Refresh
            </Button>
          </div>
          {loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-sm text-slate-500">No notifications sent yet.</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        <div className="text-xs text-slate-500">{item.type.replace("_", " ")} • {new Date(item.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-slate-500">
                        <div>{item.success_count} sent</div>
                        <div>{item.failure_count} failed</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{item.body}</div>
                    {item.url && <div className="mt-2 text-xs text-slate-500">Open URL: {item.url}</div>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
