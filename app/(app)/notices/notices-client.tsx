"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, Bell, Pin, Eye } from "lucide-react";

type Audience = "ALL" | "TEACHERS" | "PARENTS" | "CLASS";

interface Notice {
  id: string; authorId: string; title: string; body: string;
  audience: Audience; classId: string | null; pinned: boolean;
  publishedAt: string; expiresAt: string | null;
  readCount?: number; targetCount?: number;
}
interface Props {
  notices: Notice[];
  classes: { id: string; name: string }[];
}

export function NoticesClient({ notices: initial, classes }: Props) {
  const router = useRouter();
  const [notices,  setNotices]  = useState(initial);
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState<Notice | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL" as Audience, classId: "", pinned: false, expiresAt: "" });

  function openCreate() {
    setEditing(null);
    setForm({ title: "", body: "", audience: "ALL", classId: "", pinned: false, expiresAt: "" });
    setOpen(true); setError(null);
  }
  function openEdit(n: Notice) {
    setEditing(n);
    setForm({ title: n.title, body: n.body, audience: n.audience, classId: n.classId ?? "", pinned: n.pinned, expiresAt: n.expiresAt ?? "" });
    setOpen(true); setError(null);
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) { setError("Title and body are required"); return; }
    setSaving(true); setError(null);
    const url    = editing ? `/api/notices/${editing.id}` : "/api/notices";
    const method = editing ? "PATCH" : "POST";
    const payload = { ...form, classId: form.audience === "CLASS" ? (form.classId || null) : null, expiresAt: form.expiresAt || null };
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }

    if (editing) {
      setNotices(prev => prev.map(n => n.id === editing.id ? { ...n, ...payload, expiresAt: payload.expiresAt } : n)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)));
    } else {
      const n = result.notice;
      setNotices(prev => [{ ...n, publishedAt: n.publishedAt, expiresAt: n.expiresAt?.split("T")[0] ?? null }, ...prev]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)));
    }
    setOpen(false); router.refresh();
  }

  async function del(n: Notice) {
    if (!confirm(`Delete notice "${n.title}"?`)) return;
    await fetch(`/api/notices/${n.id}`, { method: "DELETE" });
    setNotices(prev => prev.filter(x => x.id !== n.id));
  }

  async function togglePin(n: Notice) {
    const res = await fetch(`/api/notices/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !n.pinned }) });
    const result = await res.json();
    if (result.ok) {
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !n.pinned } : x).sort((a, b) => Number(b.pinned) - Number(a.pinned)));
    }
  }

  const audienceLabel: Record<Audience, string> = { ALL: "All", TEACHERS: "Teachers", PARENTS: "Parents", CLASS: "Class" };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notices</h1>
          <p className="text-sm text-muted-foreground">{notices.length} notices</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]">
          <Plus className="h-4 w-4" /> Post notice
        </button>
      </div>

      {notices.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notices yet</p>
          <p className="text-sm">Post announcements for students, parents, or staff.</p>
        </div>
      )}

      <div className="space-y-2">
        {notices.map(n => {
          const cls = classes.find(c => c.id === n.classId);
          const date = new Date(n.publishedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
          return (
            <div key={n.id} className={`border rounded-xl p-4 space-y-2 ${n.pinned ? "border-primary/40 bg-primary/5" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                    <p className="font-semibold text-sm">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {audienceLabel[n.audience]}{cls ? ` · ${cls.name}` : ""} · {date}
                    {n.expiresAt ? ` · Expires ${new Date(n.expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}
                  </p>
                  {n.audience !== "TEACHERS" && typeof n.readCount === "number" && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Eye className="h-3 w-3" />
                      <span>
                        {n.readCount} of {n.targetCount ?? 0} parents read
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => togglePin(n)} title={n.pinned ? "Unpin" : "Pin"} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Pin className={`h-4 w-4 ${n.pinned ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                  <button onClick={() => openEdit(n)} className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => del(n)} className="p-2 rounded-lg hover:bg-destructive/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{n.body}</p>
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit notice" : "Post notice"}</h2>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="School closed on Monday"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body *</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Notice details..."
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Audience</label>
                  <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value as Audience }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="ALL">All</option>
                    <option value="TEACHERS">Teachers</option>
                    <option value="PARENTS">Parents</option>
                    <option value="CLASS">Specific class</option>
                  </select>
                </div>
                {form.audience === "CLASS" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Class</label>
                    <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                      className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="">Select</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Expires on (optional)</label>
                <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="rounded" />
                <span className="text-sm">Pin this notice</span>
              </label>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button onClick={save} disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editing ? "Save" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
