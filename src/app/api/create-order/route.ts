import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = 'force-dynamic';

const getRazorpayClient = async () => {
  const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";
  
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    if (mode === "mock") {
      return null; // Safe for mock mode
    }
    throw new Error("Razorpay API credentials missing (Required for Live acquisition).");
  }

  const Razorpay = (await import("razorpay")).default;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

export async function POST(req: Request) {
  try {
    const { amount, cart, shipping } = await req.json();

    const mode = process.env.NEXT_PUBLIC_PAYMENT_MODE || "mock";
    
    // 🔐 Identify USER (SUPPORT BOTH COOKIES AND BEARER TOKEN)
    const cookieStore = await cookies();
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

    const supabaseUserClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() { }
        },
      }
    );

    // If cookies failed (e.g. non-SSR user), try manual token verification
    let user = null;
    if (token) {
        const { data: { user: tUser } } = await supabaseUserClient.auth.getUser(token);
        user = tUser;
    } else {
        const { data: { user: cUser } } = await supabaseUserClient.auth.getUser();
        user = cUser;
    }

    if (!user) throw new Error("Authentication protocol required for acquisition.");

    // 🕵️ 1. CONCURRENCY SHIELD (Lock)
    // Prevents double-order clicks from creating dual Razorpay IDs for same session
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: lockAcquired } = await supabaseAdmin.rpc("acquire_checkout_lock", {
        p_user_id: user.id,
        p_lock_id: `checkout_${Date.now()}`
    });

    if (!lockAcquired) {
        return NextResponse.json({ error: "Checkout protocol already in progress. Wait 30 seconds." }, { status: 429 });
    }

    // 🕵️ 2. MOCK MODE (Bypass Razorpay but save session)
    if (mode === "mock") {
      console.log(`[MOCK MODE] Simulation Order Creation: ₹${amount}`);
      await supabaseAdmin.from("checkout_sessions").insert({
        user_id: user.id,
        razorpay_order_id: "mock_order_" + Date.now(),
        cart: cart,
        shipping: shipping,
        status: 'pending'
      });
      
      return NextResponse.json({
        id: "mock_order_" + Date.now(),
        amount: Math.round(amount * 100),
        currency: "INR",
        mock: true
      });
    }

    const razorpay = await getRazorpayClient();
    if (!razorpay) throw new Error("Payment Gateway initialization error.");

    // 🛡️ 3. LIVE ACQUISITION (Persistent Session)
    // Create the session record first so even if Razorpay succeeds but our server crashes, we have the intent
    const { data: session, error: sessionError } = await supabaseAdmin
        .from("checkout_sessions")
        .insert({
            user_id: user.id,
            cart: cart,
            shipping: shipping,
            status: 'pending'
        })
        .select()
        .single();
    
    if (sessionError) throw new Error(`Session Protocol Initialization Failure: ${sessionError.message}`);

    const razorOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `hstnlx_${session.id}`, // Link to our internal session ID
      notes: {
        session_id: session.id, // ✅ FINAL RECONCILIATION KEY
        user_id: user.id,
        user_email: user.email || ""
      }
    }) as any;

    // Link Razorpay ID back to session
    await supabaseAdmin
        .from("checkout_sessions")
        .update({ razorpay_order_id: razorOrder.id })
        .eq("id", session.id);

    // 🕵️ 4. LOG SUCCESS
    await supabaseAdmin.from("system_events").insert({
        event_type: "payment_created",
        source: "create_order_api",
        status: "success",
        user_id: user.id,
        reference_id: razorOrder.id,
        metadata: { amount, session_id: session.id }
    });

    return NextResponse.json(razorOrder);
  } catch (err: any) {
    console.error("Acquisition Protocol Node Failure:", err);
    
    // 🔴 RELEASE LOCK ON FAILURE (so user can retry immediately)
    try {
        const supabaseErrorLog = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        // Release lock so the user isn't blocked for 2 minutes on error
        if (typeof req !== 'undefined') {
          const cookieStore = await cookies();
          const { createServerClient } = await import('@supabase/ssr');
          const sc = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
          );
          const { data: { user: failedUser } } = await sc.auth.getUser();
          if (failedUser) {
            await supabaseErrorLog.rpc("release_checkout_lock", { p_user_id: failedUser.id });
          }
        }
        await supabaseErrorLog.from("system_events").insert({
            event_type: "system_error",
            source: "create_order_api",
            status: "failed",
            metadata: { message: err.message, stack: err.stack?.split('\n')[0] }
        });
    } catch {}

    return NextResponse.json({ error: "Acquisition Protocol Failure: " + err.message }, { status: 500 });
  }
}

// Helper to create client since we use supabase-js inside here
import { createClient } from "@supabase/supabase-js";
