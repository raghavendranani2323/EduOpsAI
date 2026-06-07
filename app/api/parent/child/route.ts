import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { findChildrenForPhone } from "@/lib/parent/children";

const SELECTED_CHILD_COOKIE = "eduops_parent_child";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.phone) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const childId = body.childId;
  if (!childId) return NextResponse.json({ ok: false, error: "Missing childId" }, { status: 400 });

  const children = await findChildrenForPhone(`+${user.phone}`);
  if (!children.some(c => c.id === childId)) {
    return NextResponse.json({ ok: false, error: "Not authorized for this child" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_CHILD_COOKIE, childId, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true });
}
