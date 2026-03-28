import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { createSecureAPIMiddleware } from "@/lib/api-security";

async function reconcileHandler(req: NextRequest, { validatedData }: any) {
  try {
    const { payment_id, razorpay_order_id, reason } = validatedData;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🕵️ 1. RESOLVE INTENT (Original Session)
    const { data: session } = await (supabaseAdmin as any)
        .from("checkout_sessions")
        .select("*")
        .eq("razorpay_order_id", razorpay_order_id)
        .single();
    
    if (!session) throw new Error(`[RECONCILE CRITICAL] No original intent found for ${razorpay_order_id}. RECOVERY IMPOSSIBLE.`);

    // 🔐 2. CALL MASTER RPC (Safe Idempotency)
    const { data: order_id, error: rpcError } = await (supabaseAdmin as any).rpc("place_order_after_payment", {
        p_cart: session.cart,
        p_payment_id: payment_id,
        p_razorpay_order_id: razorpay_order_id,
        p_is_verified: true,
        p_shipping: session.shipping,
        p_user_id_override: session.user_id
    });

    if (rpcError) throw new Error(`[RECONCILE FAILED]: ${rpcError.message}`);

    // 📝 3. AUDIT TRAIL RECORD
    await (supabaseAdmin as any).from("admin_actions").insert({
        action: 'manual_reconciliation_run',
        target_id: payment_id,
        metadata: { reason, session_id: session.id, reconstructed_order_id: order_id }
    });

    // 📡 4. SYSTEM EVENT RECORD
    await (supabaseAdmin as any).from("system_events").insert({
        event_type: 'manual_reconciliation_success',
        source: 'admin_reconcile_api',
        payment_id: payment_id,
        order_id: order_id,
        status: 'manual_recovery'
    });

    return NextResponse.json({ success: true, order_id });

  } catch (err: any) {
     console.error("Reconciliation Tool Failure:", err);
     return NextResponse.json({ error: "Reconciliation Protocol Failure: " + err.message }, { status: 500 });
  }
}

// 🔐 SECURE ENDPOINT WRAPPER
export const POST = createSecureAPIMiddleware({
  requireAuth: true,
  requiredRole: 'admin',
  validateInput: {
    payment_id: { required: true, type: 'string' },
    razorpay_order_id: { required: true, type: 'string' },
    reason: { required: true, type: 'string' }
  }
})(reconcileHandler as any);
