import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { payout_id, amount, seller_id } = await req.json();

    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🕵️ 1. PROTOCOL CHECK: Is payout ELIGIBLE?
    const { data: payout, error: fetchError } = await supabaseAdmin
        .from("seller_payouts")
        .select("status, order_id")
        .eq("id", payout_id)
        .single();
    
    if (fetchError || !payout) throw new Error("Payout Record Missing.");
    if (payout.status !== 'pending') throw new Error(`Payout Protocol Breach: Status is '${payout.status}'. Only 'pending' payouts can be settled.`);

    // 🏹 2. PROCESS SETTLEMENT VIA RAZORPAY ROUTE
    console.log(`[PAYOUT SETTLEMENT] Dispatching ₹${amount} to Merchant ${seller_id}`);
    
    // TODO: In production, inject Razorpay Route / transfers API here:
    // const transfer = await razorpay.transfers.create({ account: seller.razorpay_account_id, amount: amount * 100, currency: "INR" })
    const referenceId = "TRF_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    
    // 3. SYNCHRONIZE LEDGER
    const { data: updatedPayout, error: updateError } = await supabaseAdmin
        .from("seller_payouts")
        .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            settlement_ref: referenceId
        })
        .eq("id", payout_id)
        .select()
        .single();

    if (updateError) throw new Error(`Ledger Synchronization Failure: ${updateError.message}`);

    // Create Notification for Seller
    await supabaseAdmin.from("notifications").insert({
        user_id: seller_id,
        type: 'payout_settled',
        message: `Institutional settlement of ₹${amount.toLocaleString()} processed. Reference: ${referenceId}`,
        payload: { payout_id, reference_id: referenceId }
    });

    // 📝 4. INSTITUTIONAL AUDIT TRAIL
    await supabaseAdmin.from("admin_actions").insert({
        action: 'payout_processed',
        target_id: payout_id,
        metadata: { amount, seller_id, reference_id: referenceId, order_id: payout.order_id }
    });

    return NextResponse.json({ success: true, payout: updatedPayout });

  } catch (err: any) {
    console.error("Settlement Failure:", err);
    return NextResponse.json({ error: "Settlement Protocol Failure: " + err.message }, { status: 400 });
  }
}
