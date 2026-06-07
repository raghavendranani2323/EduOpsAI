"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, User, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Terminology } from "@/lib/i18n/terminology";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface Tag   { id: string; label: string; color: string }
interface Class { id: string; name: string; section: string | null }

interface Student {
  id: string;
  fullName: string;
  admissionNo: string | null;
  gender: string | null;
  status: string;
  class: Class | null;
  studentTags: { tag: Tag }[];
  guardians: { guardian: { fullName: string; phone: string } }[];
}

interface Props {
  students: Student[];
  classes: Class[];
  total: number;
  nextCursor: string | null;
  currentFilters: { q: string; classId: string; status: string };
  terminology: Terminology;
}

interface StudentsResponse {
  students: Student[];
  total: number;
  nextCursor: string | null;
}

export function StudentsClient({
  students: initialStudents,
  classes,
  total: initialTotal,
  nextCursor: initialCursor,
  currentFilters,
  terminology: t,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const queryParams = new URLSearchParams();
  if (currentFilters.q) queryParams.set("q", currentFilters.q);
  if (currentFilters.classId) queryParams.set("classId", currentFilters.classId);
  if (currentFilters.status) queryParams.set("status", currentFilters.status);
  const qs = queryParams.toString();

  const { data, isFetching } = useCachedQuery<StudentsResponse>(
    ["students", currentFilters.q, currentFilters.classId, currentFilters.status],
    async () => {
      const res = await fetch(`/api/students?${qs}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    {
      cacheKey: `students:${qs}`,
      initialData: { students: initialStudents, total: initialTotal, nextCursor: initialCursor },
      ssrSeeded: true,
    },
  );

  const students = data?.students ?? initialStudents;
  const total = data?.total ?? initialTotal;
  const [cursor, setCursor] = useState(data?.nextCursor ?? initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extras, setExtras] = useState<Student[]>([]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("cursor");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [sp, pathname, router],
  );

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => updateFilter("q", val), 350);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams(qs);
    params.set("cursor", cursor);
    const res = await fetch(`/api/students?${params.toString()}`);
    const more = (await res.json()) as StudentsResponse;
    setExtras(prev => [...prev, ...more.students]);
    setCursor(more.nextCursor);
    setLoadingMore(false);
  }

  function classLabel(cls: Class | null) {
    if (!cls) return "No class";
    return `${cls.name}${cls.section ? `-${cls.section}` : ""}`;
  }

  const allStudents = [...students, ...extras];
  const remaining = total - allStudents.length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder={`Search ${t.students.toLowerCase()}…`}
            defaultValue={currentFilters.q}
            onChange={onSearchChange}
            className="pl-9"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        <Select
          value={currentFilters.classId}
          onChange={e => updateFilter("classId", e.target.value)}
          className="w-auto"
        >
          <option value="">All {t.classes.toLowerCase()}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{classLabel(c)}</option>
          ))}
        </Select>

        <Select
          value={currentFilters.status}
          onChange={e => updateFilter("status", e.target.value)}
          className="w-auto"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="ALL">All</option>
        </Select>
      </div>

      {allStudents.length === 0 && !isFetching && (
        <EmptyState
          icon={User}
          title={`No ${t.students.toLowerCase()} found`}
          description={currentFilters.q ? "Try a different search term." : `Add your first ${t.student.toLowerCase()}.`}
        />
      )}

      <div className="space-y-2">
        {allStudents.map((s, idx) => {
          const primary = s.guardians[0]?.guardian;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(idx * 0.008, 0.15) }}
            >
              <Link
                href={`/students/${s.id}`}
                className="flex items-center gap-3 border rounded-xl p-3.5 bg-card hover:bg-muted/50 transition-colors active:scale-[0.99]"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {s.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{s.fullName}</p>
                    {s.studentTags.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="text-xs rounded-full px-2 py-0.5 font-medium"
                        style={{ backgroundColor: tag.color + "22", color: tag.color }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {classLabel(s.class)}
                    {s.admissionNo ? ` · ${s.admissionNo}` : ""}
                    {primary ? ` · ${primary.fullName}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </motion.div>
          );
        })}
      </div>

      {cursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="tap w-full border rounded-xl py-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : `Load more (${remaining} remaining)`}
        </button>
      )}
    </div>
  );
}
