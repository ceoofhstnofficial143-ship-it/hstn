import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { createSecureAPIMiddleware } from "@/lib/api-security";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function refundHandler(req: NextRequest, { validatedData }: any) {
  // Move Razorpay import inside to avoid build-time static analysis
  const Razorpay = (await import("razorpay")).default;
  try {
    const { payment_id, amount, order_id } = validatedData;

    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🕵️ 1. MOCK REVERSAL
    if (mode === "mock") {
      console.log(`[MOCK MODE] Reversal Initiated: ₹${amount} for Payment ${payment_id}`);
      
      const refund_id = "mock_refund_" + Date.now();
      
      // Update Payment Record
      await (supabaseAdmin as any).from("payments").update({
        refund_id,
        refund_status: 'processed',
        refund_amount: amount
      }).eq("payment_id", payment_id);

      // Update Order Status (THE REVERSAL)
      await (supabaseAdmin as any).from("orders").update({
        status: 'refunded',
        payment_status: 'refunded'
      }).eq("id", order_id);

      return NextResponse.json({ success: true, refund_id });
    }

    // 🛡️ 2. LIVE REVERSAL (Financial Protocol)
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay Authority Credentials Missing.");
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Capture Refund in Razorpay Hardware
    const refund = await razorpay.payments.refund(payment_id, {
      amount: Math.round(amount * 100), // convert to paise
      speed: 'normal',
      notes: { order_id }
    });

    // Persist Reversal in HSTNLX Ledger
    await (supabaseAdmin as any).from("payments").update({
        refund_id: refund.id,
        refund_status: 'processed',
        refund_amount: amount
    }).eq("payment_id", payment_id);

    await (supabaseAdmin as any).from("orders").update({
        status: 'refunded',
        payment_status: 'refunded'
    }).eq("id", order_id);

    // 📝 3. INSTITUTIONAL AUDIT TRAIL
    await (supabaseAdmin as any).from("admin_actions").insert({
        action: 'refund_issued',
        target_id: payment_id,
        metadata: { amount, order_id, refund_id: refund.id }
    });

    return NextResponse.json({ success: true, refund });

  } catch (err: any) {
    console.error("Reversal Failure:", err);
    return NextResponse.json({ error: "Reversal Protocol Failure: " + err.message }, { status: 500 });
  }
}

// 🔐 SECURE ENDPOINT WRAPPER
export const POST = createSecureAPIMiddleware({
  requireAuth: true,
  requiredRole: 'admin',
  validateInput: {
    payment_id: { required: true, type: 'string' },
    amount: { required: true, type: 'number' },
    order_id: { required: true, type: 'string' }
  }
})(refundHandler as any);
