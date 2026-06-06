"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import type { InstitutionType } from "@prisma/client";
import { getTerminology } from "@/lib/i18n/terminology";

interface ParsedRow {
  fullName: string;
  admissionNo?: string;
  gender?: string;
  className?: string;
  guardianName?: string;
  guardianPhone?: string;
  error?: string;
}

interface Props {
  classes:         { id: string; name: string }[];
  institutionType: InstitutionType;
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(line => line.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
}

export function ImportClient({ classes, institutionType }: Props) {
  const t      = getTerminology(institutionType);
  const router = useRouter();

  const fileRef = useRef<HTMLInputElement>(null);
  const [rows,     setRows]     = useState<ParsedRow[]>([]);
  const [headers,  setHeaders]  = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ imported: number; errors: number } | null>(null);
  const [fileErr,  setFileErr]  = useState<string | null>(null);

  const classMap = new Map(classes.map(c => [c.name.toLowerCase(), c.id]));

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileErr(null);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const all  = parseCSV(text);
      if (all.length < 2) { setFileErr("CSV must have a header row and at least one data row."); return; }

      const hdrs = all[0].map(h => h.toLowerCase());
      setHeaders(hdrs);

      const nameIdx    = hdrs.indexOf("fullname") !== -1 ? hdrs.indexOf("fullname") : hdrs.indexOf("name");
      const admNoIdx   = hdrs.indexOf("admissionno");
      const genderIdx  = hdrs.indexOf("gender");
      const classIdx   = hdrs.indexOf("class");
      const gNameIdx   = hdrs.indexOf("guardianname");
      const gPhoneIdx  = hdrs.indexOf("guardianphone");

      if (nameIdx === -1) { setFileErr("CSV must have a 'fullName' or 'name' column."); return; }

      const parsed: ParsedRow[] = all.slice(1, 51).map(row => { // preview max 50
        const fullName = row[nameIdx]?.trim();
        if (!fullName) return { fullName: "", error: "Full name is required" };
        const className = classIdx !== -1 ? row[classIdx]?.trim() : undefined;
        const classId   = className ? classMap.get(className.toLowerCase()) : undefined;
        return {
          fullName,
          admissionNo:   admNoIdx  !== -1 ? row[admNoIdx]?.trim()  : undefined,
          gender:        genderIdx !== -1 ? row[genderIdx]?.trim().toUpperCase() : undefined,
          className,
          guardianName:  gNameIdx  !== -1 ? row[gNameIdx]?.trim()  : undefined,
          guardianPhone: gPhoneIdx !== -1 ? row[gPhoneIdx]?.trim() : undefined,
          ...(className && !classId ? { error: `Class "${className}" not found` } : {}),
        };
      });
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!rows.length) return;
    setLoading(true);
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const text = await file.text();
    const all  = parseCSV(text);
    const hdrs = all[0].map(h => h.toLowerCase());
    const nameIdx    = hdrs.indexOf("fullname") !== -1 ? hdrs.indexOf("fullname") : hdrs.indexOf("name");
    const admNoIdx   = hdrs.indexOf("admissionno");
    const genderIdx  = hdrs.indexOf("gender");
    const classIdx   = hdrs.indexOf("class");
    const gNameIdx   = hdrs.indexOf("guardianname");
    const gPhoneIdx  = hdrs.indexOf("guardianphone");

    const students = all.slice(1).filter(row => row[nameIdx]?.trim()).map(row => ({
      fullName:      row[nameIdx].trim(),
      admissionNo:   admNoIdx  !== -1 ? row[admNoIdx]?.trim()  || undefined : undefined,
      gender:        genderIdx !== -1 ? row[genderIdx]?.trim().toUpperCase() || undefined : undefined,
      classId:       classIdx  !== -1 ? classMap.get(row[classIdx]?.trim().toLowerCase() ?? "") || undefined : undefined,
      guardianName:  gNameIdx  !== -1 ? row[gNameIdx]?.trim()  || undefined : undefined,
      guardianPhone: gPhoneIdx !== -1 ? row[gPhoneIdx]?.trim() || undefined : undefined,
    }));

    const res = await fetch("/api/students/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    });
    const data = await res.json() as { ok: boolean; imported: number; errors: number };
    setResult(data.ok ? { imported: data.imported, errors: data.errors } : null);
    setLoading(false);
    if (data.ok && data.errors === 0) setTimeout(() => router.push("/students"), 1500);
  }

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r => r.error);

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/students" className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Import {t.students}</h1>
      </div>

      {/* Template hint */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm space-y-1">
        <p className="font-medium">CSV format</p>
        <p className="text-muted-foreground text-xs font-mono">
          fullName, admissionNo, gender, class, guardianName, guardianPhone
        </p>
        <p className="text-xs text-muted-foreground">
          Required: <code>fullName</code>. Optional: everything else. Max 500 rows per import.
        </p>
      </div>

      {/* File picker */}
      <div
        className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Click to upload CSV</p>
        <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
      </div>

      {fileErr && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fileErr}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Preview — {rows.length} rows ({validRows.length} valid, {invalidRows.length} with errors)
          </p>

          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Adm. No</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">{t.class}</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, i) => (
                    <tr key={i} className={row.error ? "bg-destructive/5" : ""}>
                      <td className="px-3 py-2">{row.fullName || "—"}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">{row.admissionNo || "—"}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">{row.className || "—"}</td>
                      <td className="px-3 py-2">
                        {row.error
                          ? <span className="text-destructive">{row.error}</span>
                          : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result ? (
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${result.errors === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Imported {result.imported} {t.students.toLowerCase()}{result.errors > 0 ? `, ${result.errors} skipped` : ""}.
              {result.errors === 0 && " Redirecting…"}
            </div>
          ) : (
            <button
              onClick={doImport}
              disabled={loading || validRows.length === 0}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium disabled:opacity-60 min-h-[44px]"
            >
              {loading ? "Importing…" : `Import ${validRows.length} ${t.students.toLowerCase()}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
