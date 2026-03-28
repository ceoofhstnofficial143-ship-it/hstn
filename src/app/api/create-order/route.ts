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
    const { cart, shipping } = await req.json();

    // 🕵️ 0. PRICE RE-VALIDATION (SECURITY PROTOCOL)
    // NEVER trust the client-side price. Fetch from source.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let serverAmount = 0;
    const productIds = cart.map((i: any) => i.productId);
    
    // Fetch base prices
    const { data: dbProducts } = await (supabaseAdmin as any)
        .from("products")
        .select("id, price, user_id")
        .in("id", productIds);

    // Fetch variant prices (if any)
    const { data: dbVariants } = await (supabaseAdmin as any)
        .from("product_variants")
        .select("product_id, size, price")
        .in("product_id", productIds);

    const verifiedCart = []; // Initialize verifiedCart
    for (const item of cart) {
        const dbProduct = dbProducts?.find((p: any) => p.id === item.productId);
        if (!dbProduct) throw new Error(`Asset ${item.productId} status: Terminated/Missing.`);
        
        // Priority: Variant Price > Base Price
        const dbVariant = dbVariants?.find((v: any) => v.product_id === item.productId && v.size === item.size);
        const unitPrice = dbVariant?.price || dbProduct.price;
        
        serverAmount += unitPrice * (item.qty || 1);

        // 🛡️ RE-SNAPSHOT FOR SESSION INTEGRITY
        verifiedCart.push({
            ...item,
            price: unitPrice,
            seller_id: dbProduct.user_id // Ensure correct seller gets paid
        });
    }

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
    // 🕵️ 1. CONCURRENCY SHIELD (Lock)
    // Prevents double-order clicks from creating dual Razorpay IDs for same session
    // supabaseAdmin already declared above

    const { data: lockAcquired } = await (supabaseAdmin as any).rpc("acquire_checkout_lock", {
        p_user_id: user.id,
        p_lock_id: `checkout_${Date.now()}`
    });

    if (!lockAcquired) {
        return NextResponse.json({ error: "Checkout protocol already in progress. Wait 30 seconds." }, { status: 429 });
    }

    // 🕵️ 2. MOCK MODE (Bypass Razorpay but save session)
    if (mode === "mock") {
      const mockOrderId = "mock_order_" + Date.now();
      console.log(`[MOCK MODE] Simulation Order Creation: ₹${serverAmount}`);
      
      const { error: insertError } = await (supabaseAdmin as any).from("checkout_sessions").insert({
        user_id: user.id,
        razorpay_order_id: mockOrderId,
        cart: verifiedCart, // 🛡️ VERIFIED
        shipping: shipping,
        status: 'pending'
      });
      
      if (insertError) throw new Error(`[MOCK] Session Storage Failure: ${insertError.message}`);

      return NextResponse.json({
        id: mockOrderId,
        amount: Math.round(serverAmount * 100),
        currency: "INR",
        mock: true
      });
    }

    const razorpay = await getRazorpayClient();
    if (!razorpay) throw new Error("Payment Gateway initialization error.");

    // 🛡️ 3. LIVE ACQUISITION (Persistent Session)
    // Create the session record first so even if Razorpay succeeds but our server crashes, we have the intent
    const { data: session, error: sessionError } = await (supabaseAdmin as any)
        .from("checkout_sessions")
        .insert({
            user_id: user.id,
            cart: verifiedCart, // 🕵️ SOURCE-OF-TRUTH SNAPSHOT
            shipping: shipping,
            status: 'pending'
        })
        .select()
        .single();
    
    if (sessionError) throw new Error(`Session Protocol Initialization Failure: ${sessionError.message}`);

    const razorOrder = await razorpay.orders.create({
      amount: Math.round(serverAmount * 100),
      currency: "INR",
      receipt: `hstnlx_${session.id}`, // Link to our internal session ID
      notes: {
        session_id: session.id, // ✅ FINAL RECONCILIATION KEY
        user_id: user.id,
        user_email: user.email || ""
      }
    }) as any;

    // 🔐 3.5 RECONSTRUCT SESSION LINK
    const { error: updateError } = await (supabaseAdmin as any)
        .from("checkout_sessions")
        .update({ razorpay_order_id: razorOrder.id })
        .eq("id", session.id);
    
    if (updateError) {
       console.error("Session protocol reconstruction failed:", updateError);
       throw new Error(`Protocol Reconstruction Failure: ${updateError.message}`);
    }

    // 🕵️ 4. LOG SUCCESS
    await (supabaseAdmin as any).from("system_events").insert({
        event_type: "payment_created",
        source: "create_order_api",
        status: "success",
        user_id: user.id,
        reference_id: razorOrder.id,
        metadata: { amount: serverAmount, session_id: session.id }
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
            await (supabaseErrorLog as any).rpc("release_checkout_lock", { p_user_id: failedUser.id });
          }
        }
        await (supabaseErrorLog as any).from("system_events").insert({
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
