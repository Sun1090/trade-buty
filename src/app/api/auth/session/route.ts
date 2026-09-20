import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getServerAuthUser();

    if (!user) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: { id: user.id, email: user.email ?? null },
    });
  } catch (e) {
    console.error("[auth/session] unexpected failure:", e instanceof Error ? e.message : e);
    return NextResponse.json({ user: null, error: "session error" }, { status: 500 });
  }
}
