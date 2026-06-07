import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireInstitution } from "@/lib/tenant/current";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const { user, institution } = await requireInstitution();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Storage not configured" }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "File too large (max 5 MB)" }, { status: 413 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ ok: false, error: `Unsupported type: ${file.type}. Use JPEG/PNG/WebP/PDF.` }, { status: 415 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `${institution.id}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const admin = createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { error } = await admin.storage.from("homework").upload(key, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const { data } = admin.storage.from("homework").getPublicUrl(key);
    return NextResponse.json({ ok: true, url: data.publicUrl, mime: file.type });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
