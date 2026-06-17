"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  BookOpen, Plus, Camera, Image as ImageIcon, FileText, Calendar, X, Loader2,
  Paperclip, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";

const schema = z.object({
  classId:     z.string().min(1, "Pick a class"),
  subjectId:   z.string().optional(),
  title:       z.string().min(1, "Title required").max(120),
  description: z.string().max(2000).optional(),
  dueDate:     z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface HomeworkRow {
  id: string;
  classId: string;
  subjectId: string | null;
  teacherId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  attachmentUrl: string | null;
  attachmentObjectKey?: string | null;
  attachmentMime: string | null;
}

interface ClassRow { id: string; name: string }
interface SubjectRow { id: string; name: string; classId: string | null }

interface Props {
  homework: HomeworkRow[];
  classes: ClassRow[];
  subjects: SubjectRow[];
  scopedToTeacher: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function HomeworkClient({ homework: initial, classes, subjects, scopedToTeacher }: Props) {
  const router = useRouter();
  const [homework, setHomework] = useState(initial);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<{ objectKey: string; url: string | null; mime: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dueDate: "" },
  });

  const selectedClassId = watch("classId");
  const classSubjects = subjects.filter(s => !s.classId || s.classId === selectedClassId);

  function openCreate() {
    reset({ classId: classes[0]?.id ?? "", title: "", description: "", dueDate: "" });
    setAttachment(null);
    setOpen(true);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("classId", selectedClassId);
      const res = await fetch("/api/homework/upload", { method: "POST", body: form });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error ?? "Upload failed"); return; }
      setAttachment({ objectKey: result.objectKey, url: result.signedUrl, mime: result.mime });
      toast.success("Attachment added");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          subjectId: data.subjectId || null,
          dueDate: data.dueDate || null,
          attachmentUrl: attachment?.objectKey ?? null,
          attachmentMime: attachment?.mime ?? null,
        }),
      });
      const result = await res.json();
      if (!result.ok) { toast.error(result.error); return; }
      const newRow: HomeworkRow = {
        id: result.homework.id,
        classId: result.homework.classId,
        subjectId: result.homework.subjectId,
        teacherId: result.homework.teacherId,
        title: result.homework.title,
        description: result.homework.description,
        dueDate: result.homework.dueDate?.split("T")[0] ?? null,
        createdAt: result.homework.createdAt,
        attachmentUrl: attachment?.url ?? null,
        attachmentObjectKey: result.homework.attachmentUrl ?? null,
        attachmentMime: result.homework.attachmentMime ?? null,
      };
      setHomework(prev => [newRow, ...prev]);
      toast.success("Homework posted");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Homework</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {homework.length} posted{scopedToTeacher ? " · your classes only" : ""}
          </p>
        </div>
        <Button onClick={openCreate} size="md" disabled={classes.length === 0}>
          <Plus /> <span className="hidden sm:inline">Post</span>
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No classes available"
          description={scopedToTeacher ? "You aren't assigned as Class Teacher for any class yet." : "Add a class first."}
        />
      ) : homework.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No homework yet"
          description="Snap a photo of the board or type a note. Parents see it instantly."
          action={<Button onClick={openCreate}><Plus /> Post first homework</Button>}
        />
      ) : (
        <div className="space-y-3">
          {homework.map(h => {
            const cls = classes.find(c => c.id === h.classId);
            const subj = subjects.find(s => s.id === h.subjectId);
            const isImage = h.attachmentMime?.startsWith("image/");
            return (
              <Card key={h.id} className="overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <p className="font-semibold text-sm tracking-tight">{h.title}</p>
                      {cls && <Badge variant="outline">{cls.name}</Badge>}
                      {subj && <Badge variant="secondary">{subj.name}</Badge>}
                    </div>
                    {h.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-2">{h.description}</p>
                    )}
                    {h.dueDate && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1 mb-2">
                        <Calendar className="h-3 w-3" /> Due {formatDate(h.dueDate)}
                      </p>
                    )}
                    {h.attachmentUrl && (
                      isImage ? (
                        <a href={h.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={h.attachmentUrl} alt="" className="max-h-40 rounded-xl border border-border" />
                        </a>
                      ) : (
                        <a href={h.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                          <Paperclip className="h-3 w-3" /> View attachment <ExternalLink className="h-3 w-3" />
                        </a>
                      )
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">
                      Posted {formatDate(h.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[94dvh]">
          <SheetHeader>
            <SheetTitle>Post homework</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Snap the board or type the question.</p>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <SheetBody className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                />
                <Button type="button" variant="outline" size="lg" onClick={() => cameraRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                  Camera
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                  Gallery
                </Button>
              </div>

              {attachment && (
                <div className="rounded-2xl border border-border p-2 bg-muted/30 relative">
                  {attachment.url && attachment.mime.startsWith("image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={attachment.url} alt="" className="w-full max-h-56 object-contain rounded-xl" />
                  ) : (
                    <div className="flex items-center gap-2 p-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs truncate">{attachment.objectKey.split("/").pop()}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Class *</Label>
                  <Select {...register("classId")}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  {errors.classId && <p className="text-destructive text-xs">{errors.classId.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select {...register("subjectId")}>
                    <option value="">—</option>
                    {classSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input placeholder="Page 24 exercises 1-5" {...register("title")} />
                {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} placeholder="Optional notes…" {...register("description")} />
              </div>

              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" {...register("dueDate")} />
              </div>
            </SheetBody>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting || uploading}>
                {submitting ? "Posting…" : "Post"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
