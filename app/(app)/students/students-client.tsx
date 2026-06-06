"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, User, ChevronRight } from "lucide-react";
import type { Terminology } from "@/lib/i18n/terminology";

interface Tag   { id: string; label: string; color: string }
interface Class { id: string; name: string }

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

export function StudentsClient({
  students: initialStudents,
  classes,
  total,
  nextCursor: initialCursor,
  currentFilters,
  terminology: t,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  const [students,   setStudents]   = useState(initialStudents);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [loading,    setLoading]    = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("cursor"); // reset pagination on filter change
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [sp, pathname, router]
  );

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => updateFilter("q", val), 400);
  }

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    const params = new URLSearchParams(sp.toString());
    params.set("cursor", nextCursor);
    const res = await fetch(`/api/students?${params.toString()}`);
    const data = await res.json() as { students: Student[]; nextCursor: string | null };
    setStudents(prev => [...prev, ...data.students]);
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={`Search ${t.students.toLowerCase()}…`}
            defaultValue={currentFilters.q}
            onChange={onSearchChange}
            className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
          />
        </div>

        <select
          value={currentFilters.classId}
          onChange={e => updateFilter("classId", e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
        >
          <option value="">All {t.classes.toLowerCase()}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={currentFilters.status}
          onChange={e => updateFilter("status", e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px]"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {/* List */}
      {students.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {t.students.toLowerCase()} found</p>
          {currentFilters.q && <p className="text-sm">Try a different search term.</p>}
        </div>
      )}

      <div className="space-y-2">
        {students.map((s) => {
          const primary = s.guardians[0]?.guardian;
          return (
            <Link
              key={s.id}
              href={`/students/${s.id}`}
              className="flex items-center gap-3 border rounded-xl p-3.5 bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                {s.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{s.fullName}</p>
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
                  {s.class?.name ?? "No class"}
                  {s.admissionNo ? ` · ${s.admissionNo}` : ""}
                  {primary ? ` · ${primary.fullName}` : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="w-full border rounded-xl py-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 min-h-[44px]"
        >
          {loading ? "Loading…" : `Load more (${total - students.length} remaining)`}
        </button>
      )}
    </div>
  );
}
