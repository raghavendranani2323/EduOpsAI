"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Send, MessageSquare, CheckCheck, AlertCircle } from "lucide-react";
import { formatPhone } from "@/lib/format/phone";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string; kind: string; language: string; body: string;
}
interface Message {
  id: string; recipientPhone: string; channel: string; body: string;
  status: string; sentAt: string | null; templateKind: string | null;
}
interface Props {
  templates: Template[];
  messages:  Message[];
  classes:   { id: string; name: string }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  FEE_REMINDER: "Fee reminder", ABSENCE: "Absence alert", EXAM_SCORE: "Exam score",
  BIRTHDAY: "Birthday", HOMEWORK: "Homework", CUSTOM: "Custom",
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  SENT:      <CheckCheck className="h-3.5 w-3.5 text-blue-500" />,
  DELIVERED: <CheckCheck className="h-3.5 w-3.5 text-green-500" />,
  READ:      <CheckCheck className="h-3.5 w-3.5 text-green-600" />,
  FAILED:    <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  QUEUED:    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />,
  DRAFT:     <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />,
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const templateSchema = z.object({
  kind:     z.enum(["FEE_REMINDER", "ABSENCE", "EXAM_SCORE", "BIRTHDAY", "HOMEWORK", "CUSTOM"]),
  language: z.enum(["en", "hi"]),
  body:     z.string().min(5, "Body must be at least 5 characters"),
});
type TemplateForm = z.infer<typeof templateSchema>;

const sendSchema = z.object({
  templateId: z.string().min(1, "Select a template"),
  phones:     z.string().min(10, "Enter at least one phone number"),
});
type SendForm = z.infer<typeof sendSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

export function CommunicationsClient({ templates: initial, messages: initialMsgs }: Props) {
  const router = useRouter();

  const [templates, setTemplates]   = useState(initial);
  const [messages,  setMessages]    = useState(initialMsgs);
  const [tab,       setTab]         = useState<"templates" | "log">("templates");
  const [openTpl,   setOpenTpl]     = useState(false);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [openSend,  setOpenSend]    = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [error,     setError]       = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);

  const { register: regTpl, handleSubmit: hsTpl, reset: resetTpl, formState: { errors: tplErrors } } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema) as Resolver<TemplateForm>,
    defaultValues: { kind: "CUSTOM", language: "en" },
  });

  const { register: regSend, handleSubmit: hsSend, reset: resetSend, watch: watchSend, formState: { errors: sendErrors } } = useForm<SendForm>({
    resolver: zodResolver(sendSchema) as Resolver<SendForm>,
    defaultValues: { templateId: "", phones: "" },
  });

  const selectedTemplate = templates.find(t => t.id === watchSend("templateId"));

  function openCreateTpl() { setEditingTpl(null); resetTpl({ kind: "CUSTOM", language: "en", body: "" }); setOpenTpl(true); setError(null); }
  function openEditTpl(t: Template) { setEditingTpl(t); resetTpl({ kind: t.kind as TemplateForm["kind"], language: t.language as TemplateForm["language"], body: t.body }); setOpenTpl(true); setError(null); }
  function closeTpl() { setOpenTpl(false); setEditingTpl(null); setError(null); }

  async function onTplSubmit(data: TemplateForm) {
    setSaving(true); setError(null);
    const url    = editingTpl ? `/api/communications/templates/${editingTpl.id}` : "/api/communications/templates";
    const method = editingTpl ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }
    if (editingTpl) {
      setTemplates(prev => prev.map(t => t.id === editingTpl.id ? { ...t, ...data } : t));
    } else {
      setTemplates(prev => [result.template, ...prev]);
    }
    closeTpl(); setSaving(false);
  }

  async function deleteTpl(t: Template) {
    if (!confirm(`Delete template "${KIND_LABELS[t.kind]}"?`)) return;
    const res = await fetch(`/api/communications/templates/${t.id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) { alert(result.error); return; }
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  }

  async function onSendSubmit(data: SendForm) {
    setSaving(true); setError(null); setSendResult(null);
    const phones = data.phones.split(/[\n,]+/).map(p => p.trim().replace(/\D/g, "")).filter(p => p.length >= 10).map(p => `+91${p.slice(-10)}`);
    if (!phones.length) { setError("No valid phone numbers found"); setSaving(false); return; }

    const res    = await fetch("/api/communications/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: data.templateId, recipientPhones: phones }) });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setSendResult({ sent: result.sent, failed: result.failed });
    resetSend();
    router.refresh();
  }

  // WhatsApp deep-link for manual send
  function waLink(phone: string, body: string) {
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Communications</h1>
        <div className="flex gap-2">
          <button onClick={() => setOpenSend(true)} className="flex items-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium min-h-[44px] hover:bg-muted">
            <Send className="h-4 w-4" /> Send
          </button>
          <button onClick={openCreateTpl} className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]">
            <Plus className="h-4 w-4" /> Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["templates", "log"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {t === "templates" ? `Templates (${templates.length})` : `Message log (${messages.length})`}
          </button>
        ))}
      </div>

      {/* Templates list */}
      {tab === "templates" && (
        <div className="space-y-2">
          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">Add a template to send messages to guardians.</p>
            </div>
          )}
          {templates.map(t => (
            <div key={t.id} className="border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">{KIND_LABELS[t.kind] ?? t.kind}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t.language.toUpperCase()}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditTpl(t)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Edit</button>
                  <button onClick={() => deleteTpl(t)} className="text-xs text-destructive hover:underline px-2 py-1">Delete</button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Message log */}
      {tab === "log" && (
        <div className="space-y-2">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No messages sent yet</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className="border rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-2">
                {STATUS_ICONS[m.status] ?? null}
                <span className="font-medium text-sm">{formatPhone(m.recipientPhone)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{m.sentAt ?? "—"}</span>
              </div>
              {m.templateKind && (
                <p className="text-xs text-primary font-medium">{KIND_LABELS[m.templateKind] ?? m.templateKind}</p>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{m.body}</p>
              <a
                href={waLink(m.recipientPhone, m.body)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline"
              >
                Open in WhatsApp →
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Template form modal */}
      {openTpl && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeTpl} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editingTpl ? "Edit template" : "New template"}</h2>
              <button onClick={closeTpl} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={hsTpl(onTplSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Kind *</label>
                  <select {...regTpl("kind")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Language</label>
                  <select {...regTpl("language")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body *</label>
                <textarea
                  {...regTpl("body")}
                  rows={5}
                  placeholder={"Dear {{guardian_name}}, …"}
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Variables: {"{{guardian_name}} {{student_name}} {{amount}} {{due_date}} {{class_name}} {{institution_name}}"}</p>
                {tplErrors.body && <p className="text-destructive text-xs mt-1">{tplErrors.body.message}</p>}
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeTpl} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editingTpl ? "Save" : "Add template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send modal */}
      {openSend && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setOpenSend(false); setError(null); setSendResult(null); }} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Send message</h2>
              <button onClick={() => { setOpenSend(false); setError(null); setSendResult(null); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {sendResult ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center space-y-1">
                  <CheckCheck className="h-6 w-6 text-green-600 mx-auto" />
                  <p className="font-semibold text-green-900">{sendResult.sent} sent{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}</p>
                </div>
                <button onClick={() => { setOpenSend(false); setSendResult(null); }} className="w-full border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Close</button>
              </div>
            ) : (
              <form onSubmit={hsSend(onSendSubmit)} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Template *</label>
                  <select {...regSend("templateId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">— select —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{KIND_LABELS[t.kind] ?? t.kind} ({t.language.toUpperCase()})</option>)}
                  </select>
                  {sendErrors.templateId && <p className="text-destructive text-xs mt-1">{sendErrors.templateId.message}</p>}
                </div>

                {selectedTemplate && (
                  <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">{selectedTemplate.body}</div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone numbers *</label>
                  <textarea
                    {...regSend("phones")}
                    rows={4}
                    placeholder={"9876543210\n9876543211, 9876543212"}
                    className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">One per line or comma-separated. +91 added automatically.</p>
                  {sendErrors.phones && <p className="text-destructive text-xs mt-1">{sendErrors.phones.message}</p>}
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => { setOpenSend(false); setError(null); }} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-2">
                    <Send className="h-4 w-4" />
                    {saving ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
