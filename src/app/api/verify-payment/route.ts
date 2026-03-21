import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      cart,
      shipping
    } = body;

    // 🔐 1. SIGNATURE VERIFICATION
    let isSignatureValid = false;
    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";
    
    if (mode === "mock") {
      console.log(`[MOCK MODE] Skipping signature protocol. Verification assumed successful.`);
      isSignatureValid = true;
    } else {
      // 🛡️ LIVE SAFEGUARD (Hard block)
      if (!process.env.RAZORPAY_KEY_SECRET) {
        console.error("Critical: RAZORPAY_KEY_SECRET missing.");
        throw new Error("Live verification protocol signature key missing.");
      }

      const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");
      isSignatureValid = (expected === razorpay_signature);
    }

    if (!isSignatureValid) {
      console.error("Critical signature verification protocol breach.");
      return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 400 });
    }

    // 🔐 2. SETUP ADMIN + USER CLIENTS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔐 3. AUTHENTICATION & ORPHAN RECOVERY
    const cookieStore = await cookies();
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    const supabaseUserClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    );

    let user = null;
    if (token) {
        const { data: { user: tUser } } = await supabaseUserClient.auth.getUser(token);
        user = tUser;
    } else {
        const { data: { user: cUser } } = await supabaseUserClient.auth.getUser();
        user = cUser;
    }

    // 🔴 ORPHANED PAYMENT HANDLER
    // If payment succeeded but session is gone (rare network/cookie/exp bug)
    if (!user) {
      console.warn(`Orphaned Payment Detected: ID ${razorpay_payment_id}. Storing ledger record for reconciliation.`);
      
      await supabaseAdmin.from("payments").insert({
        payment_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id,
        status: "orphaned",
        metadata: { cart, shipping, error: 'Session Null at Verification' }
      });
      
      // We can't fulfill the order safely without user context here, but we've recorded it.
      return NextResponse.json({ 
        success: false, 
        message: "Payment captured but authentication lost. Support team will reconcile." 
      }, { status: 401 });
    }

    // 🔐 4. UNIFIED ATOMIC FULFILLMENT (Hardened V13.6 RPC)
    const { data: orderId, error: rpcError } = await supabaseAdmin.rpc("place_order_after_payment", {
      p_cart: cart,
      p_payment_id: razorpay_payment_id,
      p_razorpay_order_id: razorpay_order_id,
      p_is_verified: true,
      p_shipping: shipping,
      p_user_id_override: user.id
    });

    if (rpcError) {
       console.error("[VERIFY] RPC Execution Failed:", rpcError);
       return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
    }

    if (mode === "mock") {
      console.log(`[MOCK MODE] Real order created via engine: ${orderId}`);
    }

    // 🕵️ 5. RELEASE LOCK (Order Secured)
    await supabaseAdmin.rpc("release_checkout_lock", { p_user_id: user.id });

    // 📝 6. CENTRALIZED OBSERVABILITY (Standardized)
    await supabaseAdmin.from("system_events").insert({
        event_type: 'payment_verified',
        source: 'verify_api',
        status: 'success',
        user_id: user.id,
        reference_id: razorpay_payment_id,
        metadata: { order_id: orderId, rzp_order_id: razorpay_order_id }
    });

    return NextResponse.json({ success: true, order_id: orderId });
  } catch (err: any) {
    console.error("Payment node critical failure:", err);
    
    // 🔴 LOG FAILURE
    try {
        const supabaseErrorLog = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await supabaseErrorLog.from("system_events").insert({
            event_type: "payment_failed",
            source: "verify_api",
            status: "failed",
            metadata: { message: err.message }
        });
    } catch {}

    return NextResponse.json({ success: false, error: "Payment node critical failure: " + err.message }, { status: 500 });
  }
}
