import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * R9.10：删除当前账户。
 *
 * 身份从 Supabase SSR cookie 读取，绝不接受客户端传入 user id；
 * 真正的 Auth 删除仅在服务端用 service_role 执行。
 */
export async function DELETE() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "account deletion unavailable" }, { status: 503 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ ok: false, error: "authentication failed" }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: "not authenticated" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ ok: false, error: "account deletion failed" }, { status: 502 });
    }

    // 尽力清掉 SSR auth cookie；用户已经被删除，失败不应改变成功语义。
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "account deletion failed" }, { status: 500 });
  }
}
