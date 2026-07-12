import React, { useEffect, useRef, useState, useCallback } from "react";
import { api, getToken, API_BASE } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, Trash2, Send, Users, Shield, WifiOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

// Merge incoming messages into existing state, dedup by id, keep sorted by created_at.
function mergeMessages(existing, incoming) {
  const map = new Map();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(a.created_at).getTime() || 0;
    const db = new Date(b.created_at).getTime() || 0;
    return da - db;
  });
}

/**
 * LiveChat — hybrid transport:
 *   • SEND: always via HTTP POST /chat/{id}/send  (works even when WS is down —
 *           this is the actual fix for the "message not sending on live" bug
 *           caused by Render dropping WebSockets on cold-starts / free tier).
 *   • RECEIVE: WebSocket in real-time when connected, fallback to polling
 *           /chat/{id}/history every 4s when WS is disconnected.
 *   • PIN / DELETE (admin): also via HTTP for reliability.
 */
export default function LiveChat({ liveClassId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const wsRef = useRef(null);
  const listRef = useRef(null);
  const pollTimerRef = useRef(null);
  const messagesRef = useRef([]);

  // Keep a ref of the current messages so pollers/handlers stay stable without re-subscribing
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Load history once and start polling as an "always-on" safety net.
  // WS (below) will layer real-time delivery on top when it's up.
  const loadHistory = useCallback(async () => {
    if (!liveClassId) return;
    try {
      const { data } = await api.get(`/chat/${liveClassId}/history`);
      setMessages((prev) => mergeMessages(prev, data.messages || []));
      setOnline(data.online || 0);
    } catch (err) {
      // silent — the UI will show empty state; retries happen via poll
    }
  }, [liveClassId]);

  useEffect(() => {
    if (!liveClassId) return undefined;
    // reset state when switching live class
    setMessages([]);
    setOnline(0);
    setConnected(false);
    loadHistory();

    // Poll every 4s as fallback — cheap and resilient.
    pollTimerRef.current = setInterval(loadHistory, 4000);

    // Try to open WebSocket for real-time push. Non-fatal if it fails.
    let ws = null;
    let closedByUs = false;
    const token = getToken();
    try {
      const wsUrl = API_BASE.replace(/^http/, "ws") + `/ws/chat/${liveClassId}?token=${encodeURIComponent(token || "")}`;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // We fall back to polling automatically — no reconnect churn needed.
      };
      ws.onerror = () => setConnected(false);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "message") {
            setMessages((m) => mergeMessages(m, [data.message]));
          } else if (data.type === "presence") {
            setOnline(data.online || 0);
          } else if (data.type === "pin") {
            setMessages((m) => m.map((msg) => msg.id === data.message_id ? { ...msg, pinned: data.pinned } : msg));
          } else if (data.type === "delete") {
            setMessages((m) => m.filter((msg) => msg.id !== data.message_id));
          }
        } catch { /* ignore malformed */ }
      };
    } catch {
      // WS constructor failed — poller is already running, so we're fine.
    }

    return () => {
      closedByUs = true;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      try { ws && ws.close(); } catch { /* ignore */ }
      // Suppress unused var warning
      void closedByUs;
    };
  }, [liveClassId, loadHistory]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      // ALWAYS send via HTTP — reliable regardless of WS state.
      const { data: msg } = await api.post(`/chat/${liveClassId}/send`, { message: text });
      // Optimistically add to our own list so the sender sees it immediately
      // (WS broadcast may or may not echo back — merge dedup handles both).
      setMessages((m) => mergeMessages(m, [msg]));
      setDraft("");
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to send message";
      toast.error(typeof detail === "string" ? detail : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const pin = async (id) => {
    try {
      const { data } = await api.post(`/chat/${liveClassId}/messages/${id}/pin`);
      setMessages((m) => m.map((msg) => msg.id === id ? { ...msg, pinned: data.pinned } : msg));
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const del = async (id) => {
    try {
      await api.delete(`/chat/${liveClassId}/messages/${id}`);
      setMessages((m) => m.filter((msg) => msg.id !== id));
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  const pinned = messages.filter((m) => m.pinned);
  const others = messages.filter((m) => !m.pinned);

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[640px]" data-testid="live-chat-panel">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 live-dot" : "bg-amber-400"}`} />
          <span className="font-semibold text-slate-900 text-sm">Live Chat</span>
          {!connected && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
              <WifiOff className="h-2.5 w-2.5" /> polling
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500" data-testid="online-count">
          <Users className="h-3.5 w-3.5" /> {online} online
        </span>
      </div>

      {pinned.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <div className="text-[10px] uppercase tracking-widest text-amber-700 font-bold mb-1 inline-flex items-center gap-1"><Pin className="h-3 w-3" />Pinned</div>
          <div className="space-y-1">
            {pinned.map((m) => (
              <div key={m.id} className="text-xs text-amber-900" data-testid={`pinned-msg-${m.id}`}>
                <span className="font-semibold">{m.user_name}:</span> {m.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto thin-scroll px-3 py-3 space-y-3" data-testid="chat-messages">
        {others.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-10">No messages yet. Say hello 👋</div>
        )}
        {others.map((m) => {
          const isMine = m.user_id === user?.id;
          const isAdminMsg = m.user_role === "admin";
          return (
            <div key={m.id} className={`flex items-start gap-2 group ${isMine ? "flex-row-reverse" : ""}`} data-testid={`chat-msg-${m.id}`}>
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={m.user_avatar} />
                <AvatarFallback className="bg-slate-200 text-slate-700 text-[10px]">{m.user_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                <div className="text-[11px] text-slate-500 mb-0.5 inline-flex items-center gap-1">
                  {isAdminMsg && <Shield className="h-3 w-3 text-[#F97316]" />}
                  <span className={isAdminMsg ? "text-[#EA580C] font-semibold" : ""}>{m.user_name}</span>
                  <span className="opacity-70">• {formatTime(m.created_at)}</span>
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-[#1D4ED8] text-white rounded-tr-sm" : isAdminMsg ? "bg-orange-50 text-slate-900 border border-orange-100 rounded-tl-sm" : "bg-slate-100 text-slate-900 rounded-tl-sm"}`}>
                  {m.message}
                </div>
                {isAdmin && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-1">
                    <button onClick={() => pin(m.id)} className="text-[10px] text-slate-500 hover:text-amber-600 inline-flex items-center gap-0.5" data-testid={`pin-msg-${m.id}`}>
                      <Pin className="h-3 w-3" />{m.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={() => del(m.id)} className="text-[10px] text-slate-500 hover:text-red-600 inline-flex items-center gap-0.5" data-testid={`delete-msg-${m.id}`}>
                      <Trash2 className="h-3 w-3" />Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="p-3 border-t border-slate-100 flex items-center gap-2" data-testid="chat-form">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full h-10"
          maxLength={500}
          data-testid="chat-input"
        />
        <Button
          type="submit"
          disabled={!draft.trim() || sending}
          className="h-10 w-10 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white p-0 disabled:opacity-60"
          data-testid="chat-send-btn"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
