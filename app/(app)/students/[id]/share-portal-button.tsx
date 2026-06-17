"use client";

import { useState } from "react";
import { Share2, Copy, MessageCircle, X, Check, RefreshCw, ShieldOff } from "lucide-react";

interface Props {
  studentId: string;
  studentName: string;
}

export function SharePortalButton({ studentId, studentName }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<{ url: string; shareLink: string | null; guardianName: string | null; guardianPhone: string | null; expiresAt: string } | null>(null);
  const [events, setEvents]   = useState<Array<{ id: string; action: string; createdAt: string }>>([]);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  async function open_() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/students/${studentId}/portal-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "GENERATE" }),
    });
    const result = await res.json();
    setLoading(false);
    if (!result.ok) { setError(result.error ?? "Failed"); return; }
    setData(result);
    await loadHistory();
  }

  async function loadHistory() {
    const res = await fetch(`/api/students/${studentId}/portal-token`);
    const result = await res.json();
    if (result.ok) setEvents(result.events);
  }

  async function rotate() {
    if (!confirm("Rotate this link? The old link will stop working immediately.")) return;
    setLoading(true);
    const res = await fetch(`/api/students/${studentId}/portal-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ROTATE" }),
    });
    const result = await res.json();
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    setData(result);
    await loadHistory();
  }

  async function revoke() {
    if (!confirm("Revoke parent access for this link?")) return;
    const res = await fetch(`/api/students/${studentId}/portal-token`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) { setError(result.error); return; }
    setData(null);
    await loadHistory();
  }

  function copy() {
    if (!data) return;
    navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button
        onClick={open_}
        className="flex items-center gap-1.5 border rounded-xl px-3 py-2 text-sm font-medium min-h-[40px] hover:bg-muted"
      >
        <Share2 className="h-4 w-4" />
        Share with parent
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-card border rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-sm">Parent portal link</p>
                <p className="text-xs text-muted-foreground">For {studentName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {loading && <p className="text-sm text-muted-foreground text-center py-4">Generating…</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {data && (
                <>
                  <div className="border rounded-lg p-3 bg-muted/40 break-all text-xs font-mono">
                    {data.url}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copy}
                      className="flex-1 flex items-center justify-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    {data.shareLink ? (
                      <a
                        href={data.shareLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px]"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className="flex-1 text-center text-xs text-muted-foreground self-center">
                        No primary guardian phone on file
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Parent sees attendance, fees, homework and notices. This private link expires on {new Date(data.expiresAt).toLocaleDateString("en-IN")}.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={rotate} className="min-h-[44px] rounded-xl border text-sm font-medium flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Rotate
                    </button>
                    <button onClick={revoke} className="min-h-[44px] rounded-xl border border-destructive/40 text-destructive text-sm font-medium flex items-center justify-center gap-2">
                      <ShieldOff className="h-4 w-4" /> Revoke
                    </button>
                  </div>
                </>
              )}
              {events.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold mb-2">Access history</p>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {events.map(event => (
                      <p key={event.id} className="text-xs text-muted-foreground">
                        {event.action.toLowerCase()} · {new Date(event.createdAt).toLocaleString("en-IN")}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
