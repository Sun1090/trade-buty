import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: { id: user.id, email: user.email ?? null },
    });
  } catch (e) {
    return NextResponse.json(
      { user: null, error: e instanceof Error ? e.message : "session error" },
      { status: 500 },
    );
  }
}
