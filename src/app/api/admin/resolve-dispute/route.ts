import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { createSecureAPIMiddleware } from "@/lib/api-security";

async function disputeHandler(req: NextRequest, { validatedData }: any) {
  try {
    const { dispute_id, action } = validatedData;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔐 Authority Escalation
    );

    // 🕵️ 1. SECURITY AUDIT: Verify Dispute Exists
    const { data: dispute, error: fetchError } = await (supabaseAdmin as any)
        .from("order_disputes")
        .select("*")
        .eq("id", dispute_id)
        .single();
    
    if (fetchError || !dispute) throw new Error(`[ADMIN CRITICAL] Dispute protocol ${dispute_id} not found.`);

    // 🔐 2. CALL HARDENED RPC (Service Role Only)
    const { error: rpcError } = await (supabaseAdmin as any).rpc("resolve_order_dispute", {
        p_dispute_id: dispute_id,
        p_action: action
    });

    if (rpcError) throw new Error(`[RESOLUTION FAILED]: ${rpcError.message}`);

    // 📝 3. AUDIT TRAIL RECORD
    await (supabaseAdmin as any).from("admin_actions").insert({
        action: 'resolve_dispute',
        target_id: dispute_id,
        metadata: { action, order_id: dispute.order_id }
    });

    // 📡 4. SYSTEM EVENT RECORD
    await (supabaseAdmin as any).from("system_events").insert({
        event_type: 'dispute_resolved_api',
        source: 'admin_dispute_api',
        status: 'success',
        reference_id: dispute_id,
        metadata: { action, order_id: dispute.order_id }
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
     console.error("Dispute Resolution Node Failure:", err);
     return NextResponse.json({ error: "Resolution Protocol Failure: " + err.message }, { status: 500 });
  }
}

// 🔐 SECURE ENDPOINT WRAPPER
export const POST = createSecureAPIMiddleware({
  requireAuth: true,
  requiredRole: 'admin',
  validateInput: {
    dispute_id: { required: true, type: 'string' },
    action: { required: true, type: 'string' }
  }
})(disputeHandler as any);
