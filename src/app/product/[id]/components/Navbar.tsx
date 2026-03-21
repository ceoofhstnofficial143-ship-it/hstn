"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import React from "react"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [wishlistCount, setWishlistCount] = useState(0)

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)



  const fetchWishlistCount = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", user.id);

    setWishlistCount(data?.length || 0)
  }

  const handleCategoryClick = (category: string) => {
    setIsMobileMenuOpen(false)
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent('hstnlx-category', { detail: category }))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } else {
      router.push(`/?category=${encodeURIComponent(category)}`)
    }
  }

  const NavLinks = ({ mobile = false }) => (
    <>
      {/* Gallery link removed as per user request — home page shows products directly */}
      {mobile && (
        <>
          <button
            onClick={() => handleCategoryClick("ALL")}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} w-full font-medium uppercase tracking-widest hover:text-primary transition-smooth text-left flex items-center gap-2`}
          >
            🌟 All Products
          </button>
          <button
            onClick={() => handleCategoryClick("CO-ORD SETS")}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} w-full font-medium uppercase tracking-widest hover:text-primary transition-smooth text-left flex items-center gap-2`}
          >
            👗 Co-ord Sets
          </button>
          <button
            onClick={() => handleCategoryClick("TRENDY TOPS")}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} w-full font-medium uppercase tracking-widest hover:text-primary transition-smooth text-left flex items-center gap-2`}
          >
            👚 Trendy Tops
          </button>
          <button
            onClick={() => handleCategoryClick("CASUAL DRESSES")}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} w-full font-medium uppercase tracking-widest hover:text-primary transition-smooth text-left flex items-center gap-2`}
          >
            🥻 Casual Dresses
          </button>
          <button
            onClick={() => handleCategoryClick("KOREAN-STYLE FASHION")}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} w-full font-medium uppercase tracking-widest hover:text-primary transition-smooth text-left flex items-center gap-2`}
          >
            ✨ Korean-Style
          </button>
        </>
      )}
      {user && (
        <>
          <Link
            href="/orders"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-semibold uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            🛍 My Orders
          </Link>
          <Link
            href="/wishlist"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-semibold uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            ❤️ Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
          </Link>
          <Link
            href="/seller/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-semibold uppercase tracking-widest hover:text-primary transition-smooth`}
          >
            Dashboard
          </Link>
          <Link
            href="/profile"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-semibold uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            👤 My Profile
          </Link>
        </>
      )}
    </>
  )

  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    const updateCartCount = () => {
      const cart = JSON.parse(localStorage.getItem("hstnlx_cart") || "[]")
      setCartCount(cart.reduce((acc: number, item: any) => acc + (item.qty || 1), 0))
    }

    // 1. Initial Cart Count
    updateCartCount()

    // 2. Event Listeners
    window.addEventListener("storage", updateCartCount)
    window.addEventListener("hstnlx-cart-updated", updateCartCount)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // 4. Initial Auth Check
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener("storage", updateCartCount)
      window.removeEventListener("hstnlx-cart-updated", updateCartCount)
    }
  }, [])

  // 5. Reactive Wishlist Fetch & Listeners
  useEffect(() => {
    if (user) {
      fetchWishlistCount()
    } else {
      setWishlistCount(0)
    }

    const handler = () => fetchWishlistCount()
    window.addEventListener("hstnlx-wishlist-updated", handler)
    return () => window.removeEventListener("hstnlx-wishlist-updated", handler)
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (loading) {
    return (
      <header className="w-full border-b bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
          <Link href="/" className="text-h3 font-bold tracking-tight text-foreground">
            HSTNLX <span className="text-primary">LUXURY</span>
          </Link>
          <div className="w-32 h-8 bg-muted/10 animate-pulse rounded-full" />
        </div>
      </header>
    )
  }

  return (
    <div className="relative">
      <header className="w-full border-b bg-background/80 backdrop-blur-md relative z-[100]">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">

        {/* Left Section: Mobile Menu + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden text-2xl"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
          <Link href="/" className="text-xl font-bold text-foreground hover:opacity-80 transition-smooth">
            HSTNLX
          </Link>
          {/* Desktop NavLinks moved to top row next to logo */}
          <div className="hidden lg:flex items-center gap-8 ml-8">
            <NavLinks />
          </div>
        </div>

        {/* Center Section Search Removed as per user request */}

        {/* Right Section: Actions */}
        <div className="flex items-center gap-4">


          {/* Cart */}
          <Link href="/cart" className="relative group">
            <span className="text-2xl">🛒</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-primary text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          {/* Mobile Auth Links */}
          <div className="lg:hidden flex items-center gap-2">
            {!user ? (
              <>
                <Link href="/login" className="text-xs font-bold uppercase tracking-widest px-3 py-2 bg-black text-white rounded-lg">
                  Login
                </Link>
                <Link href="/signup" className="text-xs font-bold uppercase tracking-widest px-3 py-2 border border-black text-black rounded-lg">
                  Join
                </Link>
              </>
            ) : null}
          </div>

          {/* Desktop Auth Links */}
          <div className="hidden lg:flex items-center gap-4">
            {!user ? (
              <>
                <Link href="/login" className="text-caption font-semibold uppercase tracking-widest hover:text-primary transition-smooth hidden md:block">
                  Login
                </Link>
                <Link href="/signup" className="luxury-button !py-2 !px-6 !text-xs uppercase tracking-widest hidden md:block">
                  Join
                </Link>
              </>
            ) : (
              <>
                <Link href="/upload" className="luxury-button !py-2 !px-6 !text-xs uppercase tracking-widest hidden md:block">
                  Sell
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-caption font-semibold uppercase tracking-widest text-red-500 hover:text-red-700 transition-smooth hidden md:block"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile Profile */}
          {user && (
            <Link href="/profile" className="lg:hidden text-2xl">
              👤
            </Link>
          )}
        </div>

      </div>

      {/* NavLinks moved up */}
    </header>



    {/* Mobile Menu Overlay - Outside header to prevent clipping */}
    {isMobileMenuOpen && (
      <div className="fixed inset-0 z-[9999] lg:hidden">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        
        {/* Menu Content */}
        <div className="absolute top-[57px] left-0 right-0 bottom-0 bg-background overflow-y-auto">
          <div className="flex flex-col p-8 space-y-4">
            {/* Close Button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="self-end text-2xl mb-4"
              aria-label="Close menu"
            >
              ✕
            </button>



            <NavLinks mobile />

            <div className="pt-8 mt-4 border-t border-border space-y-6">
              {!user ? (
                <div className="grid grid-cols-2 gap-4">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="luxury-button !bg-accent/10 !text-foreground text-center !py-4"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="luxury-button text-center !py-4"
                  >
                    Join
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <Link
                    href="/upload"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="luxury-button block text-center !py-4"
                  >
                    List New Asset
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-center py-4 text-red-500 font-bold uppercase tracking-widest text-xs"
                  >
                    Terminate Session (Logout)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
