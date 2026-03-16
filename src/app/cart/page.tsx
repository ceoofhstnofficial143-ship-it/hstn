"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function CartPage() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Unique key for cart items that accounts for size
  const getItemKey = (item: any) => `${item.productId}-${item.size}`

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("hstn_cart") || "[]")
    setCartItems(items)
    // Select all by default using the unique composite key
    setSelectedIds(items.map((i: any) => getItemKey(i)))
    setLoading(false)
  }, [])

  const updateQuantity = (itemKey: string, delta: number) => {
    const newCart = cartItems.map(item => {
      if (getItemKey(item) === itemKey) {
        const newQty = Math.max(1, (item.qty || 1) + delta)
        return { ...item, qty: newQty }
      }
      return item
    })
    setCartItems(newCart)
    localStorage.setItem("hstn_cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstn-cart-updated"))
  }

  const removeItem = (itemKey: string) => {
    const newCart = cartItems.filter(item => getItemKey(item) !== itemKey)
    setCartItems(newCart)
    setSelectedIds(prev => prev.filter(k => k !== itemKey))
    localStorage.setItem("hstn_cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstn-cart-updated"))
  }

  const toggleSelect = (itemKey: string) => {
    setSelectedIds(prev =>
      prev.includes(itemKey) ? prev.filter(k => k !== itemKey) : [...prev, itemKey]
    )
  }

  const selectedItems = cartItems.filter(item => selectedIds.includes(getItemKey(item)))
  const total = selectedItems.reduce((acc, item) => acc + (item.price * (item.qty || 1)), 0)

  const proceedToCheckout = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one piece for acquisition.")
      return
    }
    // Deep copy and store for checkout
    localStorage.setItem("hstn_checkout_items", JSON.stringify(selectedItems))
    router.push("/checkout")
  }

  const quickBuy = (item: any) => {
    localStorage.setItem("hstn_checkout_items", JSON.stringify([{ ...item }]))
    router.push("/checkout")
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="bg-background min-h-screen animate-fade-in py-10 lg:py-20 px-4 sm:px-6">
      <div className="section-container max-w-5xl">
        <header className="mb-10 lg:mb-16 flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-border pb-8 gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">Acquisition Bag</span>
            <h1 className="text-3xl lg:text-5xl mt-2 italic font-black uppercase tracking-tighter">The Private Vault</h1>
          </div>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-widest hover:text-primary transition-all">
            ← Continue Scouting
          </Link>
        </header>

        {cartItems.length === 0 ? (
          <div className="py-24 lg:py-40 text-center luxury-card border-dashed border-2 bg-accent/5 rounded-[2rem]">
            <span className="text-4xl mb-6 block">🛍️</span>
            <h2 className="text-xl font-bold uppercase tracking-widest">Bag is Empty</h2>
            <p className="text-[10px] text-muted uppercase tracking-widest mt-4">Your next high-velocity drop is waiting.</p>
            <Link href="/" className="luxury-button mt-10 inline-block !py-4 !px-8">Explore Arrivals</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
            {/* List (LEFT) */}
            <div className="lg:col-span-8 space-y-4 lg:space-y-8">
              {cartItems.map((item) => {
                const itemKey = getItemKey(item);
                const isSelected = selectedIds.includes(itemKey);
                
                return (
                  <div key={itemKey} className={`luxury-card p-4 lg:p-6 flex flex-col sm:flex-row gap-4 lg:gap-8 items-start sm:items-center transition-all duration-500 ${isSelected ? 'border-primary/40 bg-primary/5 shadow-xl' : 'opacity-60 grayscale scale-[0.98]'}`}>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <button
                        onClick={() => toggleSelect(itemKey)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border hover:border-black'}`}
                      >
                        {isSelected && <span className="text-black text-[10px] font-bold">✓</span>}
                      </button>

                      <div className="w-20 h-28 lg:w-24 lg:h-32 rounded-2xl overflow-hidden bg-accent/20 flex-shrink-0 relative group">
                        <Image 
                          src={item.image || '/placeholder.jpg'} 
                          alt={item.title} 
                          fill 
                          className="object-cover group-hover:scale-110 transition-transform duration-700" 
                          sizes="(max-width: 640px) 80px, 96px"
                        />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[8px] px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                           {item.size}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-tight line-clamp-1">{item.title}</h3>
                          <div className="flex flex-wrap gap-2 lg:gap-3 mt-1">
                            <p className="text-[9px] text-primary uppercase tracking-widest font-black">Size: {item.size}</p>
                            <span className="text-[9px] text-gray-200">|</span>
                            <p className="text-[9px] text-muted uppercase tracking-widest font-bold">₹{item.price.toLocaleString()}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(itemKey)}
                          className="text-muted hover:text-red-500 transition-all p-2 -mr-2 bg-gray-50 rounded-full"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-4 lg:mt-6 gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                          <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-full border border-border shadow-sm">
                            <button onClick={() => updateQuantity(itemKey, -1)} className="text-muted hover:text-primary font-bold px-2 text-lg">−</button>
                            <span className="text-[11px] font-black w-4 text-center">{item.qty || 1}</span>
                            <button onClick={() => updateQuantity(itemKey, 1)} className="text-muted hover:text-primary font-bold px-2 text-lg">+</button>
                          </div>
                          <button
                            onClick={() => quickBuy(item)}
                            className="text-[8px] uppercase tracking-widest font-bold text-primary border border-primary/20 px-4 py-2 rounded-full hover:bg-primary hover:text-black transition-all bg-primary/5"
                          >
                            Acquire Now ⚡
                          </button>
                        </div>
                        <div className="text-right w-full sm:w-auto border-t sm:border-none pt-4 sm:pt-0">
                           <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Subtotal</p>
                           <p className="text-xl font-black text-foreground">₹ {(item.price * (item.qty || 1)).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary (RIGHT) */}
            <div className="lg:col-span-4">
              <div className="luxury-card p-8 lg:p-10 bg-black text-white border-none sticky top-28 space-y-8 shadow-2xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Transaction Metrics</h3>

                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-500">Selected Pieces</span>
                    <span>{selectedIds.length}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-black border-t border-white/10 pt-6 italic tracking-tighter">
                    <span>Total</span>
                    <span className="text-primary">₹ {total.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={proceedToCheckout}
                  disabled={selectedItems.length === 0}
                  className="luxury-button w-full !bg-primary !text-black !py-5 !text-[11px] uppercase tracking-[0.2em] font-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Initialize Acquisition
                </button>

                <p className="text-[8px] text-center text-white/30 uppercase tracking-[0.2em] leading-relaxed">
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

