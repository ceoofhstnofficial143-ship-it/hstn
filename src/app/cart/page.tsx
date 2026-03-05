"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("hstn-cart") || "[]")
    setCartItems(items)
    // Select all by default
    setSelectedIds(items.map((i: any) => i.id))
    setLoading(false)
  }, [])

  const updateQuantity = (id: string, delta: number) => {
    const newCart = cartItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, (item.quantity || 1) + delta)
        return { ...item, quantity: newQty }
      }
      return item
    })
    setCartItems(newCart)
    localStorage.setItem("hstn-cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstn-cart-updated"))
  }

  const removeItem = (id: string) => {
    const newCart = cartItems.filter(item => item.id !== id)
    setCartItems(newCart)
    setSelectedIds(prev => prev.filter(i => i !== id))
    localStorage.setItem("hstn-cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstn-cart-updated"))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const selectedItems = cartItems.filter(item => selectedIds.includes(item.id))
  const total = selectedItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0)

  const proceedToCheckout = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one piece for acquisition.")
      return
    }
    localStorage.setItem("hstn-checkout-items", JSON.stringify(selectedItems))
    router.push("/checkout")
  }

  const quickBuy = (item: any) => {
    localStorage.setItem("hstn-checkout-items", JSON.stringify([{ ...item }]))
    router.push("/checkout")
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="bg-background min-h-screen animate-fade-in py-20 px-6">
      <div className="section-container max-w-5xl">
        <header className="mb-16 flex justify-between items-end border-b border-border pb-8">
          <div>
            <span className="text-caption uppercase tracking-widest text-primary font-bold">Acquisition Bag</span>
            <h1 className="text-display mt-2 italic text-h1">The Holding Gallery</h1>
          </div>
          <Link href="/products" className="text-caption font-bold uppercase tracking-widest hover:text-primary transition-smooth">
            ← Add More Pieces
          </Link>
        </header>

        {cartItems.length === 0 ? (
          <div className="py-40 text-center luxury-card border-dashed border-2 bg-accent/5">
            <span className="text-4xl mb-6 block">🛍️</span>
            <h2 className="text-h3 font-bold uppercase tracking-widest">Gallery is Empty</h2>
            <p className="text-caption text-muted mt-4">Your next high-velocity drop is waiting.</p>
            <Link href="/products" className="luxury-button mt-10 inline-block">Explore Arrivals</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* List (LEFT) */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-8">
              {cartItems.map((item) => (
                <div key={item.id} className={`luxury-card p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center transition-smooth ${selectedIds.includes(item.id) ? 'border-primary/40 bg-primary/5' : 'opacity-60'}`}>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-smooth shrink-0 ${selectedIds.includes(item.id) ? 'bg-primary border-primary' : 'border-border'}`}
                    >
                      {selectedIds.includes(item.id) && <span className="text-black text-[10px] font-bold">✓</span>}
                    </button>

                    <div className="w-20 h-24 sm:w-24 sm:h-32 rounded-xl sm:rounded-2xl overflow-hidden bg-accent/20 flex-shrink-0">
                      <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                    </div>
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-body font-bold uppercase tracking-tight">{item.title}</h3>
                        <p className="text-[10px] text-muted uppercase tracking-widest font-bold mt-1">{item.category}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted hover:text-red-500 transition-smooth p-2 -mr-2"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-4 sm:mt-6 gap-4">
                      <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center gap-4 bg-background px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-border">
                          <button onClick={() => updateQuantity(item.id, -1)} className="text-muted hover:text-primary font-bold px-2">−</button>
                          <span className="text-[11px] sm:text-caption font-bold w-4 text-center">{item.quantity || 1}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="text-muted hover:text-primary font-bold px-2">+</button>
                        </div>
                        <button
                          onClick={() => quickBuy(item)}
                          className="text-[8px] sm:text-[9px] uppercase tracking-widest font-bold text-primary border border-primary/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full hover:bg-primary hover:text-black transition-smooth"
                        >
                          Quick Buy ⚡
                        </button>
                      </div>
                      <p className="text-body font-bold text-primary self-end sm:self-auto">₹ {(item.price * (item.quantity || 1)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary (RIGHT) */}
            <div className="lg:col-span-4">
              <div className="luxury-card p-10 bg-foreground text-background border-none sticky top-28 space-y-8">
                <h3 className="text-caption font-bold uppercase tracking-widest text-primary">Transaction Metrics</h3>

                <div className="space-y-4">
                  <div className="flex justify-between text-caption font-medium uppercase tracking-widest">
                    <span className="text-white/40">Selected Pieces</span>
                    <span className="text-white">{selectedIds.length}</span>
                  </div>
                  <div className="flex justify-between text-h3 font-bold border-t border-white/10 pt-4">
                    <span className="text-white">Total</span>
                    <span className="text-primary tracking-tight">₹ {total.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={proceedToCheckout}
                  className="luxury-button w-full !bg-primary !text-black !py-5 !text-[11px] uppercase tracking-[0.2em] font-bold shadow-[0_10px_30px_rgba(var(--primary-rgb),0.3)]"
                >
                  Initialize Acquisition
                </button>

                <p className="text-[9px] text-center text-white/30 uppercase tracking-widest leading-relaxed">
                  Prices include verified protocol auditing. <br /> Security clearance required at next step.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
