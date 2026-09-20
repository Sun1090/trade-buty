import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth/signout] signout failed:", error);
      return NextResponse.json({ ok: false, error: "signout error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/signout] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "signout error" }, { status: 500 });
  }
}
