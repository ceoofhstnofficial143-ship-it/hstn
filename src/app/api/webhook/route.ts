import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature")!;
    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";

    // 🕵️ MOCK MODE (kyc/age compliance)
    if (mode === "mock") {
      console.log(`[MOCK MODE] Webhook simulation bypassing active listener.`);
      return NextResponse.json({ status: "mock_ok" });
    }

    // 🔐 1. SIGNATURE AUTHENTICATION (FAIL-FAST)
    if (mode !== "mock") {
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            console.error("CRITICAL MISSION FAILURE: RAZORPAY_WEBHOOK_SECRET is NOT set. Platform reconciliation is BLOCKED.");
            throw new Error("Institutional Authority Secret Missing.");
        }
        
        const expected = crypto
          .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
          .update(body)
          .digest("hex");

        if (expected !== signature) {
          console.error("Unauthorized Webhook Breach Attempt Detected.");
          return new NextResponse("Unauthorized", { status: 401 });
        }
    }

    const event = JSON.parse(body);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🕵️ 2. CENTRALIZED OBSERVABILITY (Standardized)
    await supabaseAdmin.from("system_events").insert({
        event_type: "webhook_received",
        source: 'webhook_api',
        status: 'success',
        reference_id: event.payload?.payment?.entity?.id || null,
        metadata: { event_type: event.event, rzp_order_id: event.payload?.payment?.entity?.order_id }
    });

    // 🟢 2. PAYMENT CAPTURED EVENT (Standardized)
    if (event.event === "payment.captured") {
        const { order_id: rzp_order_id, id: rzp_payment_id } = event.payload.payment.entity;

        console.log(`[WEBHOOK MIRROR] Reconciling: ${rzp_payment_id}`);

        const { data: session } = await supabaseAdmin
            .from("checkout_sessions")
            .select("*")
            .eq("razorpay_order_id", rzp_order_id)
            .single();

        if (!session) {
            await supabaseAdmin.from("system_events").insert({
                event_type: "order_failed",
                source: "webhook_api",
                status: "failed",
                reference_id: rzp_payment_id,
                metadata: { reason: "Missing Session", rzp_order_id }
            });
            return NextResponse.json({ status: "recovery_impossible" });
        }

        // 🔒 Call DUAL-CHANNEL Idempotent RPC (V13.2)
        const { data: orderId, error: rpcError } = await supabaseAdmin.rpc("place_order_after_payment", {
            p_cart: session.cart,
            p_payment_id: rzp_payment_id,
            p_razorpay_order_id: rzp_order_id,
            p_is_verified: true,
            p_shipping: session.shipping,
            p_user_id_override: session.user_id // Authority Override
        });

        if (rpcError) {
             await supabaseAdmin.from("system_events").insert({
                event_type: "order_failed",
                source: "webhook_api",
                status: "failed",
                reference_id: rzp_payment_id,
                metadata: { reason: rpcError.message }
            });
            return NextResponse.json({ status: "mirror_rpc_failed" }, { status: 500 });
        }

        console.log(`[WEBHOOK MIRROR SUCCESS]: ${orderId}`);
        await supabaseAdmin.rpc("release_checkout_lock", { p_user_id: session.user_id });
    }

    // 🟢 3. PAYMENT REFUNDED EVENT (Standardized)
    if (event.event === "payment.refunded") {
        const { id: rzp_payment_id, refund_id, amount_refunded } = event.payload.payment.entity;
        
        await supabaseAdmin.from("payments").update({
            refund_id: refund_id,
            refund_status: 'processed',
            refund_amount: amount_refunded / 100
        }).eq("payment_id", rzp_payment_id);

        await supabaseAdmin.from("orders").update({
            status: 'refunded',
            payment_status: 'refunded'
        }).eq("payment_id", rzp_payment_id);

        await supabaseAdmin.from("system_events").insert({
            event_type: "refund_processed",
            source: "webhook_api",
            status: "success",
            reference_id: rzp_payment_id,
            metadata: { refund_id, amount: amount_refunded / 100 }
        });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Webhook critical node error:", err);
    try {
        const supabaseErrorLog = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await supabaseErrorLog.from("system_events").insert({
            event_type: "system_error",
            source: "webhook_api",
            status: "failed",
            metadata: { message: err.message }
        });
    } catch {}
    return NextResponse.json({ status: "error", error: err.message }, { status: 500 });
  }
}
