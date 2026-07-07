import React, { useEffect, useRef, useState } from "react";
import { api, getToken, API_BASE } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pin, Trash2, Send, Users, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function LiveChat({ liveClassId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!liveClassId) return;
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/chat/${liveClassId}/history`);
        if (!active) return;
        setMessages(data.messages || []);
        setOnline(data.online || 0);
      } catch {}
    })();

    const token = getToken();
    const wsUrl = API_BASE.replace(/^http/, "ws") + `/ws/chat/${liveClassId}?token=${encodeURIComponent(token || "")}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "message") {
          setMessages((m) => [...m, data.message]);
        } else if (data.type === "presence") {
          setOnline(data.online || 0);
        } else if (data.type === "pin") {
          setMessages((m) => m.map((msg) => msg.id === data.message_id ? { ...msg, pinned: data.pinned } : msg));
        } else if (data.type === "delete") {
          setMessages((m) => m.filter((msg) => msg.id !== data.message_id));
        }
      } catch {}
    };

    return () => {
      active = false;
      try { ws.close(); } catch {}
    };
  }, [liveClassId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "message", message: text }));
      setDraft("");
    }
  };
  const pin = (id) => wsRef.current?.send(JSON.stringify({ type: "pin", message_id: id }));
  const del = (id) => wsRef.current?.send(JSON.stringify({ type: "delete", message_id: id }));

  const pinned = messages.filter((m) => m.pinned);
  const others = messages.filter((m) => !m.pinned);

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[640px]" data-testid="live-chat-panel">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 live-dot" : "bg-slate-300"}`} />
          <span className="font-semibold text-slate-900 text-sm">Live Chat</span>
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
        <Button type="submit" disabled={!draft.trim() || !connected} className="h-10 w-10 rounded-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white p-0" data-testid="chat-send-btn">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
