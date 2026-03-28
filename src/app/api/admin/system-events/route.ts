import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSecureAPIMiddleware } from "@/lib/api-security";

async function handler(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server logging not configured" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await (supabaseAdmin as any)
      .from("system_events")
      .select("id, event_type, source, status, reference_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch events" }, { status: 500 });
  }
}

export const GET = createSecureAPIMiddleware({
  requireAuth: true,
  requiredRole: "admin",
  rateLimit: true,
  cors: true,
})(handler as any);

