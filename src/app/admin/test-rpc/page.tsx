"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function RPCTestPage() {
    const [status, setStatus] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const runTest = async () => {
        setLoading(true)
        setStatus(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Authentication Required. Sign in first.")

            // 🕵️ 1. SCOUT FOR REPLENISHED ASSET (Stock > 0 only)
            const { data: products, error: scoutError } = await supabase
                .from("products")
                .select("id, user_id, title, stock")
                .gt("stock", 0) // ONLY FETCH ITEMS WITH AVAILABLE STOCK
                .limit(1)

            if (scoutError || !products || products.length === 0) {
                throw new Error("No available stock in the marketplace! Please increase stock for at least one product in your database first.")
            }

            const realProduct = products[0]
            console.log("SCOUTED ASSET:", realProduct)

            // 🛡️ 2. EXECUTE HARDENED ENGINE (V13.8+)
            const { data, error } = await supabase.rpc("place_order_after_payment", {
                p_cart: [
                    {
                        productId: realProduct.id,
                        seller_id: realProduct.user_id,
                        qty: 1,
                        size: "M",
                        title: realProduct.title,
                        price: 999
                    }
                ],
                p_payment_id: "replenish_test_" + Date.now(),
                p_razorpay_order_id: "replenish_rzp_" + Date.now(),
                p_is_verified: true,
                p_shipping: {
                    fullName: "Harshit Replenished",
                    phone: "9999999999",
                    address: "Secure HQ, Port Blair",
                    city: "Port Blair",
                    pincode: "744101"
                }
            })

            setStatus({ data, error, scoutedProduct: realProduct.title, remainingStock: realProduct.stock })
        } catch (err: any) {
            setStatus({ error: err.message })
        }
        setLoading(false)
    }

    return (
        <main className="min-h-screen bg-black text-white p-20">
            <div className="section-container max-w-2xl">
                <header className="mb-10">
                    <span className="text-caption uppercase tracking-[0.4em] text-primary font-bold">Inventory Terminal</span>
                    <h1 className="text-display mt-2 italic uppercase">Final Protocol Sync</h1>
                </header>

                <div className="luxury-card p-10 bg-white/5 border-none rounded-[2rem] space-y-6">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 leading-relaxed">
                        This terminal now filters for **In-Stock Assets** to ensure the transaction engine executes with a verified, purchasable product.
                    </p>

                    <button
                        onClick={runTest}
                        disabled={loading}
                        className="luxury-button w-full !bg-primary !text-black !py-4 font-black uppercase tracking-widest text-[11px]"
                    >
                        {loading ? 'SCOUTING & EXECUTING...' : 'RUN FINAL STOCK TEST'}
                    </button>

                    {status && (
                        <div className="mt-8 p-6 bg-black rounded-2xl border border-white/10 font-mono text-[10px] overflow-auto max-h-80">
                            <p className="text-primary mb-2 uppercase font-black tracking-widest">// ENGINE RESPONSE</p>
                            {status.scoutedProduct && <p className="mb-4 text-white/60 uppercase text-[9px]">Asset Scouted: {status.scoutedProduct} | Stock: {status.remainingStock}</p>}
                            <pre>{JSON.stringify({ data: status.data, error: status.error }, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
