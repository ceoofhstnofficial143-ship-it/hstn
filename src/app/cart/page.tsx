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
    const items = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")
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
    localStorage.setItem("hstnlx_cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstnlx-cart-updated"))
  }

  const removeItem = (itemKey: string) => {
    const newCart = cartItems.filter(item => getItemKey(item) !== itemKey)
    setCartItems(newCart)
    setSelectedIds(prev => prev.filter(k => k !== itemKey))
    localStorage.setItem("hstnlx_cart", JSON.stringify(newCart))
    window.dispatchEvent(new Event("hstnlx-cart-updated"))
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
    localStorage.setItem("hstnlx_checkout_items", JSON.stringify(selectedItems))
    router.push("/checkout")
  }

  const quickBuy = (item: any) => {
    localStorage.setItem("hstnlx_checkout_items", JSON.stringify([{ ...item }]))
    router.push("/checkout")
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="bg-white min-h-screen animate-fade-in py-12 lg:py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-gray-100 pb-12">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
               <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
               <span className="text-[8px] font-black uppercase tracking-[0.3em] text-primary">Secure Acquisition Layer</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
              The Vault
            </h1>
          </div>
          <Link href="/" className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-all">
            <span className="group-hover:-translate-x-2 transition-transform">←</span>
            Resume Scouting
          </Link>
        </header>

        {cartItems.length === 0 ? (
          <div className="py-40 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 flex flex-col items-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl shadow-xl mb-10 opacity-20">💼</div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Vault is Empty</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] mt-4 font-black">Institutional assets awaiting scout initialization.</p>
            <Link href="/" className="mt-12 px-12 py-5 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all shadow-2xl">Initialize scouting</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* List (LEFT) */}
            <div className="lg:col-span-7 space-y-8">
              {cartItems.map((item) => {
                const itemKey = getItemKey(item);
                const isSelected = selectedIds.includes(itemKey);
                
                return (
                  <div key={itemKey} className={`group relative flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] transition-all duration-700 border-2 ${isSelected ? 'bg-white border-black shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] scale-100 sm:scale-[1.02]' : 'bg-gray-50/30 border-transparent opacity-60 grayscale-0 border-gray-100'}`}>
                    
                    {/* Top Section Desktop / Left Section Mobile */}
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="flex flex-col items-center justify-center">
                        <button
                          onClick={() => toggleSelect(itemKey)}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 flex-shrink-0 ${isSelected ? 'bg-black border-black' : 'border-gray-300 hover:border-black'}`}
                        >
                          {isSelected && <span className="text-white text-[8px] sm:text-[10px] font-black italic">✓</span>}
                        </button>
                      </div>

                      <Link href={`/product/${item.productId}`} className="w-20 h-28 sm:w-24 sm:h-32 lg:w-32 lg:h-44 rounded-2xl overflow-hidden flex-shrink-0 relative bg-gray-100 shadow-xl group-hover:shadow-2xl transition-all duration-700">
                        <Image 
                          src={item.image || '/placeholder.jpg'} 
                          alt={item.title} 
                          fill 
                          className="object-cover group-hover:scale-110 transition-transform duration-1000" 
                          sizes="(max-width: 640px) 80px, 128px"
                        />
                      </Link>
                      
                      {/* Mobile Delete Option (Visible only on Mobile) */}
                      <button
                        onClick={() => removeItem(itemKey)}
                        className="sm:hidden ml-auto w-8 h-8 flex flex-shrink-0 items-center justify-center bg-gray-100 hover:bg-black hover:text-white rounded-full text-xs transition-all"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 w-full space-y-4 sm:space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="w-full">
                           <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-[0.5em] text-gray-300 line-clamp-1">Grade A Entry</span>
                           <h3 className="text-sm sm:text-lg font-black italic tracking-tighter uppercase mt-1 leading-tight line-clamp-2">{item.title}</h3>
                           <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-3">
                              <span className="px-2 sm:px-3 py-1 bg-black text-white text-[8px] sm:text-[9px] font-black rounded-lg">SIZE: {item.size}</span>
                              <span className="text-[9px] sm:text-[10px] font-black text-primary italic tracking-tight">₹{item.price.toLocaleString()} / unit</span>
                           </div>
                        </div>
                        {/* Desktop Delete Option */}
                        <button
                          onClick={() => removeItem(itemKey)}
                          className="hidden sm:flex flex-shrink-0 w-8 h-8 items-center justify-center bg-gray-100 hover:bg-black hover:text-white rounded-full text-xs transition-all opacity-0 group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pt-4 border-t border-gray-100/50">
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                          <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                             <button onClick={() => updateQuantity(itemKey, -1)} className="w-7 h-7 sm:w-8 sm:h-8 text-sm font-black hover:text-primary transition-all">−</button>
                             <span className="w-6 sm:w-8 text-center text-[10px] sm:text-[11px] font-black italic">{item.qty || 1}</span>
                             <button onClick={() => updateQuantity(itemKey, 1)} className="w-7 h-7 sm:w-8 sm:h-8 text-sm font-black hover:text-primary transition-all">+</button>
                          </div>
                          <button
                            onClick={() => quickBuy(item)}
                            className="px-3 sm:px-4 py-2 bg-black text-white text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-primary hover:text-black transition-all flex-shrink-0"
                          >
                            Buy Now
                          </button>
                        </div>
                        <div className="w-full xl:w-auto text-left xl:text-right flex items-center xl:block justify-between bg-gray-50 xl:bg-transparent p-3 xl:p-0 rounded-xl xl:rounded-none">
                           <p className="text-[7px] font-black uppercase tracking-[0.4em] text-gray-400 xl:text-gray-300 xl:mb-1">Subtotal</p>
                           <p className="text-lg sm:text-xl font-black italic tracking-tighter">₹{(item.price * (item.qty || 1)).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary (RIGHT) */}
            <div className="lg:col-span-5">
              <div className="bg-black text-white p-10 lg:p-14 rounded-[3.5rem] sticky top-28 space-y-12 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -mr-20 -mt-20" />
                
                <div>
                   <span className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-500">Transaction Registry</span>
                   <h3 className="text-3xl font-black italic uppercase tracking-tighter mt-2">Manifest Summary</h3>
                </div>

                {/* 📦 LOGISTICS INCENTIVE PROTOCOL */}
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Logistics Bonus</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                      {total >= 3000 ? 'Unlocked: Free Deployment' : `₹${(Math.max(0, 3000 - total)).toLocaleString()} to unlock Free Shipping`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, (total / 3000) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-6">
                   <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Authorized Pieces</span>
                      <span className="text-sm font-black italic tracking-tighter">{selectedIds.length}</span>
                   </div>
                   <div className="flex justify-between items-center py-4 border-b border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Logistics Node</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Direct Delivery</span>
                   </div>
                   <div className="flex justify-between items-end pt-10">
                      <div className="space-y-1">
                         <span className="text-[9px] font-black uppercase tracking-[0.5em] text-gray-500">Net Valuation</span>
                         <p className="text-5xl font-black italic tracking-tighter text-primary">₹{total.toLocaleString()}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4 pt-10">
                   <button
                    onClick={proceedToCheckout}
                    disabled={selectedItems.length === 0}
                    className="w-full py-6 bg-white text-black rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] hover:scale-105 transition-all shadow-2xl disabled:opacity-20 flex items-center justify-center gap-10 group"
                   >
                     <span>Initialize Acquisition</span>
                     <span className="group-hover:translate-x-2 transition-transform">→</span>
                   </button>
                   
                   {/* 🛡️ BUYER PROTECTION REGISTRY */}
                   <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                      <div className="flex items-center gap-3">
                         <span className="text-lg">🛡️</span>
                         <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Escrow Guarantee Active</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[7px] font-black uppercase tracking-widest text-primary mb-1">Return Protocol</p>
                            <p className="text-[7px] text-white/50 uppercase tracking-widest">7-Day Inspection</p>
                         </div>
                         <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[7px] font-black uppercase tracking-widest text-primary mb-1">Authentic</p>
                            <p className="text-[7px] text-white/50 uppercase tracking-widest">Verified Assets</p>
                         </div>
                      </div>
                   </div>

                   <p className="text-[7px] text-center text-white/30 uppercase tracking-[0.3em] leading-relaxed">
                     By initializing, you confirm adherence to the <br /> HSTNLX Global Trust Protocol.
                   </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

