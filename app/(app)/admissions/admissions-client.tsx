"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Phone, Plus, X, ChevronRight, AlertCircle, CheckCircle2, MessageCircle, History, UserRound } from "lucide-react";
import { formatPhone, whatsappLink } from "@/lib/format/phone";
import { todayIST } from "@/lib/format/date";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Lead {
  id:               string;
  studentName:      string;
  guardianName:     string;
  phone:            string;
  interestedClass:  string | null;
  source:           string;
  priority:         string;
  stage:            string;
  nextFollowupAt:   string | null;
  lastNote:         string | null;
  assignedToId:     string | null;
  assignedToName:   string | null;
  lostReason:       string | null;
  convertedToStudentId: string | null;
  convertedAt:      string | null;
  createdAt:        string;
}

interface Props {
  leads:        Lead[];
  classes:      { id: string; name: string }[];
  owners:       { id: string; fullName: string }[];
  dueTodayCount: number;
}

interface Activity {
  id: string;
  kind: string;
  note: string | null;
  createdAt: string;
  actor: { fullName: string };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STAGES: { id: string; label: string }[] = [
  { id: "NEW",            label: "New"            },
  { id: "CONTACTED",      label: "Contacted"      },
  { id: "DEMO_SCHEDULED", label: "Demo Scheduled" },
  { id: "DEMO_ATTENDED",  label: "Demo Attended"  },
  { id: "CONVERTED",      label: "Converted"      },
  { id: "LOST",           label: "Lost"           },
];

const PRIORITY_COLORS: Record<string, string> = {
  HOT:  "bg-red-100 text-red-700",
  WARM: "bg-amber-100 text-amber-700",
  COLD: "bg-blue-100 text-blue-700",
};

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN:  "Walk-in", PHONE: "Phone", INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp", REFERRAL: "Referral", WEBSITE: "Website",
};

// ─── Zod schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  studentName:    z.string().min(1, "Required"),
  guardianName:   z.string().min(1, "Required"),
  phone:          z.string().min(10, "Enter valid phone"),
  interestedClass: z.string().optional(),
  source:         z.enum(["WALK_IN", "PHONE", "INSTAGRAM", "WHATSAPP", "REFERRAL", "WEBSITE"]),
  priority:       z.enum(["HOT", "WARM", "COLD"]),
  stage:          z.enum(["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_ATTENDED", "CONVERTED", "LOST"]),
  nextFollowupAt: z.string().optional(),
  lastNote:       z.string().optional(),
  assignedToId:   z.string().optional(),
  lostReason:     z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Convert modal schema ────────────────────────────────────────────────────

const convertSchema = z.object({
  admissionNo: z.string().optional(),
  classId:     z.string().optional(),
});
type ConvertData = z.infer<typeof convertSchema>;

// ─── Card content (shared by kanban + mobile list) ───────────────────────────

function LeadCardContent({ lead, today }: { lead: Lead; today: string }) {
  const isOverdue = lead.nextFollowupAt && lead.nextFollowupAt < today && lead.stage !== "CONVERTED" && lead.stage !== "LOST";
  const isDueToday = lead.nextFollowupAt === today && lead.stage !== "CONVERTED" && lead.stage !== "LOST";

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{lead.studentName}</p>
          <p className="text-xs text-muted-foreground truncate">{lead.guardianName}</p>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[lead.priority]}`}>
          {lead.priority}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <a
          href={`tel:${lead.phone}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <Phone className="h-3 w-3" />
          {formatPhone(lead.phone)}
        </a>
        {lead.interestedClass && <span className="ml-auto truncate">· {lead.interestedClass}</span>}
      </div>

      {lead.nextFollowupAt && (
        <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-destructive" : isDueToday ? "text-amber-600" : "text-muted-foreground"}`}>
          {isOverdue && <AlertCircle className="h-3 w-3" />}
          Follow-up: {lead.nextFollowupAt}
          {isOverdue && " (overdue)"}
          {isDueToday && " (today)"}
        </div>
      )}

      {lead.lastNote && (
        <p className="text-xs text-muted-foreground line-clamp-2 italic">&quot;{lead.lastNote}&quot;</p>
      )}
      {lead.assignedToName && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <UserRound className="h-3 w-3" /> {lead.assignedToName}
        </p>
      )}
    </>
  );
}

// ─── Draggable card (kanban, md+) ────────────────────────────────────────────

function LeadCard({ lead, onClick, today }: { lead: Lead; onClick: () => void; today: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-background border rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing shadow-sm touch-none"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <LeadCardContent lead={lead} today={today} />
    </div>
  );
}

// ─── Droppable column ────────────────────────────────────────────────────────

function KanbanColumn({
  stage, leads, onCardClick, today,
}: {
  stage: { id: string; label: string };
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  today: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="font-semibold text-sm">{stage.label}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[200px] rounded-xl p-2 transition-colors ${isOver ? "bg-primary/5 border-2 border-dashed border-primary/30" : "bg-muted/30"}`}
      >
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} today={today} />
        ))}
        {leads.length === 0 && (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AdmissionsClient({ leads: initial, classes, owners, dueTodayCount }: Props) {
  const router = useRouter();
  const today  = todayIST();

  const [leads, setLeads]         = useState(initial);
  const [selected, setSelected]   = useState<Lead | null>(null);
  const [openForm, setOpenForm]   = useState(false);
  const [editing, setEditing]     = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState("NEW");
  const [activities, setActivities]   = useState<Activity[]>([]);
  const [activityNote, setActivityNote] = useState("");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { source: "WALK_IN", priority: "WARM", stage: "NEW" },
  });

  const {
    register: regConvert,
    handleSubmit: handleConvert,
    reset: resetConvert,
  } = useForm<ConvertData>({
    resolver: zodResolver(convertSchema) as Resolver<ConvertData>,
  });

  // dnd-kit sensors — pointer + touch (for mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function openCreate() {
    setEditing(null);
    reset({ source: "WALK_IN", priority: "WARM", stage: "NEW", nextFollowupAt: "" });
    setOpenForm(true);
    setError(null);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    reset({
      studentName:    lead.studentName,
      guardianName:   lead.guardianName,
      phone:          lead.phone,
      interestedClass: lead.interestedClass ?? "",
      source:         lead.source as FormData["source"],
      priority:       lead.priority as FormData["priority"],
      stage:          lead.stage as FormData["stage"],
      nextFollowupAt: lead.nextFollowupAt ?? "",
      lastNote:       lead.lastNote ?? "",
      assignedToId:   lead.assignedToId ?? "",
      lostReason:     lead.lostReason ?? "",
    });
    setOpenForm(true);
    setSelected(null);
    setError(null);
  }

  function closeForm() { setOpenForm(false); setEditing(null); setError(null); }

  async function openLead(lead: Lead) {
    setSelected(lead);
    const res = await fetch(`/api/leads/${lead.id}/activities`);
    const result = await res.json();
    setActivities(result.ok ? result.activities : []);
  }

  async function recordActivity(kind: "NOTE" | "CALL" | "WHATSAPP") {
    if (!selected) return;
    const res = await fetch(`/api/leads/${selected.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, note: activityNote || undefined }),
    });
    const result = await res.json();
    if (!result.ok) { setError(result.error); return; }
    setActivityNote("");
    await openLead(selected);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError(null);
    const payload = {
      ...data,
      nextFollowupAt: data.nextFollowupAt || null,
      lastNote: data.lastNote || null,
      assignedToId: data.assignedToId || null,
      lostReason: data.lostReason || null,
    };
    const url    = editing ? `/api/leads/${editing.id}` : "/api/leads";
    const method = editing ? "PATCH" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (!result.ok) { setError(result.error); setSaving(false); return; }

    if (editing) {
      setLeads(prev => prev.map(l => l.id === editing.id ? {
        ...l,
        ...payload,
        assignedToName: owners.find(owner => owner.id === payload.assignedToId)?.fullName ?? null,
      } : l));
    } else {
      setLeads(prev => [...prev, { ...result.lead, nextFollowupAt: result.lead.nextFollowupAt?.split("T")[0] ?? null, createdAt: result.lead.createdAt?.split("T")[0] ?? today }]);
    }
    closeForm();
    router.refresh();
    setSaving(false);
  }

  async function deleteLead(lead: Lead) {
    if (!confirm(`Delete lead for ${lead.studentName}?`)) return;
    const res    = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.ok) { alert(result.error); return; }
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    setSelected(null);
  }

  async function moveStage(lead: Lead, newStage: string) {
    if (lead.stage === newStage || !STAGES.find(s => s.id === newStage)) return;
    const lostReason = newStage === "LOST"
      ? prompt("Why was this admission enquiry lost?")?.trim()
      : undefined;
    if (newStage === "LOST" && !lostReason) return;

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: newStage, lostReason: lostReason ?? l.lostReason } : l));
    setSelected(prev => prev && prev.id === lead.id ? { ...prev, stage: newStage, lostReason: lostReason ?? prev.lostReason } : prev);

    const res    = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage, ...(lostReason ? { lostReason } : {}) }),
    });
    const result = await res.json();
    if (!result.ok) {
      // Rollback
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, stage: lead.stage } : l));
      setSelected(prev => prev && prev.id === lead.id ? { ...prev, stage: lead.stage } : prev);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead) return;
    await moveStage(lead, String(over.id));
  }

  async function submitConvert(data: ConvertData) {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/leads/${selected.id}/convert`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const result = await res.json();
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, stage: "CONVERTED", convertedToStudentId: result.studentId } : l));
    setSelected(null);
    setConverting(false);
    router.push(`/students/${result.studentId}`);
  }

  const visibleLeads = showOverdueOnly
    ? leads.filter((lead) => lead.nextFollowupAt && lead.nextFollowupAt < today && !["CONVERTED", "LOST"].includes(lead.stage))
    : leads;
  const grouped = (() => {
    const map: Record<string, Lead[]> = {};
    STAGES.forEach(stage => { map[stage.id] = []; });
    visibleLeads.forEach(lead => { if (map[lead.stage]) map[lead.stage].push(lead); });
    return map;
  })();
  const activeLead  = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admissions</h1>
          <p className="text-sm text-muted-foreground">
            {leads.filter(l => l.stage !== "CONVERTED" && l.stage !== "LOST").length} active leads
            {dueTodayCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {dueTodayCount} follow-up{dueTodayCount > 1 ? "s" : ""} due</span>
            )}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Add lead
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowOverdueOnly(value => !value)}
        className={`min-h-[44px] rounded-xl border px-4 text-sm font-medium ${showOverdueOnly ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-background"}`}
      >
        {showOverdueOnly ? "Showing overdue follow-ups" : "Show overdue follow-ups"}
      </button>

      {/* Mobile: stage chips + vertical list (no drag) */}
      <div className="md:hidden space-y-3">
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-1 scrollbar-none">
          {STAGES.map(stage => {
            const count = grouped[stage.id]?.length ?? 0;
            const active = mobileStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setMobileStage(stage.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium min-h-[40px] transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stage.label}
                <span className={`ml-1.5 text-xs ${active ? "text-primary-foreground/80" : ""}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {(grouped[mobileStage] ?? []).map(lead => (
            // div, not button — card content contains a tel: link
            <div
              key={lead.id}
              role="button"
              tabIndex={0}
              onClick={() => openLead(lead)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLead(lead); } }}
              className="w-full text-left bg-background border rounded-xl p-3 space-y-2 shadow-sm active:bg-muted/50 transition-colors cursor-pointer"
            >
              <LeadCardContent lead={lead} today={today} />
            </div>
          ))}
          {(grouped[mobileStage] ?? []).length === 0 && (
            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-xl">
              No leads in {STAGES.find(s => s.id === mobileStage)?.label}
            </div>
          )}
        </div>
      </div>

      {/* Kanban board (md+) */}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="hidden md:flex w-full max-w-full min-w-0 gap-4 overflow-x-auto overscroll-x-contain pb-4">
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={grouped[stage.id] ?? []}
              onCardClick={openLead}
              today={today}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="bg-background border rounded-xl p-3 shadow-xl w-[280px]">
              <p className="font-medium text-sm">{activeLead.studentName}</p>
              <p className="text-xs text-muted-foreground">{activeLead.guardianName}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Lead detail drawer */}
      {selected && !openForm && !converting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{selected.studentName}</h2>
                <p className="text-sm text-muted-foreground">{selected.guardianName}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-muted shrink-0"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Phone</span>
                <a href={`tel:${selected.phone}`} className="font-medium hover:underline">{formatPhone(selected.phone)}</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Stage</span>
                <select
                  value={selected.stage}
                  onChange={e => moveStage(selected, e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-medium bg-background min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Move to stage"
                >
                  {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Priority</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[selected.priority]}`}>{selected.priority}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Source</span>
                <span>{SOURCE_LABELS[selected.source] ?? selected.source}</span>
              </div>
              {selected.interestedClass && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Interested in</span>
                  <span>{selected.interestedClass}</span>
                </div>
              )}
              {selected.nextFollowupAt && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Follow-up</span>
                  <span className={selected.nextFollowupAt < today ? "text-destructive" : ""}>{selected.nextFollowupAt}</span>
                </div>
              )}
              {selected.lastNote && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Note</span>
                  <span className="italic">{selected.lastNote}</span>
                </div>
              )}
              {selected.assignedToName && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Owner</span>
                  <span>{selected.assignedToName}</span>
                </div>
              )}
              {selected.lostReason && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Lost reason</span>
                  <span>{selected.lostReason}</span>
                </div>
              )}
              {selected.convertedToStudentId && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <a href={`/students/${selected.convertedToStudentId}`} className="underline text-sm">View student profile</a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${selected.phone}`} onClick={() => recordActivity("CALL")} className="min-h-[44px] rounded-xl border flex items-center justify-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4" /> Call
              </a>
              <a
                href={whatsappLink(selected.phone, `Namaste ${selected.guardianName}, following up about ${selected.studentName}'s admission enquiry.`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => recordActivity("WHATSAPP")}
                className="min-h-[44px] rounded-xl border flex items-center justify-center gap-2 text-sm font-medium"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" /> Activity</div>
              <div className="flex gap-2">
                <input value={activityNote} onChange={event => setActivityNote(event.target.value)} placeholder="Quick note…" className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm" />
                <button type="button" onClick={() => recordActivity("NOTE")} className="min-h-[44px] px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Add</button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-2">
                {activities.map(activity => (
                  <div key={activity.id} className="text-xs border-l-2 pl-2">
                    <p className="font-medium">{activity.kind.replaceAll("_", " ")} · {activity.actor.fullName}</p>
                    {activity.note && <p className="text-muted-foreground">{activity.note}</p>}
                    <p className="text-muted-foreground">{new Date(activity.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-xs text-muted-foreground">No activity recorded yet.</p>}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => deleteLead(selected)}
                className="border border-destructive text-destructive rounded-xl py-2.5 px-3 text-sm font-medium min-h-[44px]"
              >
                Delete
              </button>
              <button
                onClick={() => openEdit(selected)}
                className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]"
              >
                Edit
              </button>
              {selected.stage !== "CONVERTED" && selected.stage !== "LOST" && (
                <button
                  onClick={() => { setConverting(true); resetConvert(); setError(null); }}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium min-h-[44px] flex items-center justify-center gap-1"
                >
                  Admit <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {selected && converting && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConverting(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Admit {selected.studentName}</h2>
              <button onClick={() => setConverting(false)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground">This creates a student profile and marks the lead as converted.</p>

            <form onSubmit={handleConvert(submitConvert)} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Admission no. (optional)</label>
                <input
                  {...regConvert("admissionNo")}
                  placeholder="e.g. 2024-001"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assign class (optional)</label>
                <select {...regConvert("classId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">— select —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setConverting(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Admitting…" : "Admit student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit lead form */}
      {openForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing ? "Edit lead" : "New lead"}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Student name *</label>
                  <input {...register("studentName")} placeholder="Rahul Sharma" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {errors.studentName && <p className="text-destructive text-xs mt-1">{errors.studentName.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Guardian name *</label>
                  <input {...register("guardianName")} placeholder="Suresh Sharma" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {errors.guardianName && <p className="text-destructive text-xs mt-1">{errors.guardianName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone *</label>
                  <input {...register("phone")} placeholder="9876543210" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Interested class</label>
                  <input {...register("interestedClass")} placeholder="Class 5" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Source *</label>
                  <select {...register("source")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority *</label>
                  <select {...register("priority")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="HOT">Hot</option>
                    <option value="WARM">Warm</option>
                    <option value="COLD">Cold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Stage *</label>
                  <select {...register("stage")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Follow-up date</label>
                  <input type="date" {...register("nextFollowupAt")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Note</label>
                <textarea
                  {...register("lastNote")}
                  rows={2}
                  placeholder="Parents want afternoon batch…"
                  className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Lead owner</label>
                  <select {...register("assignedToId")} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm bg-background">
                    <option value="">Unassigned</option>
                    {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Lost reason</label>
                  <input {...register("lostReason")} placeholder="Required when lost" className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm" />
                </div>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeForm} className="flex-1 border rounded-xl py-2.5 text-sm font-medium min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 min-h-[44px]">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
