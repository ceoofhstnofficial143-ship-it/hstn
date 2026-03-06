"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import React from "react"

export default function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  const NavLinks = ({ mobile = false }) => (
    <>
      <Link
        href="/products"
        onClick={() => setIsMobileMenuOpen(false)}
        className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-medium uppercase tracking-widest hover:text-primary transition-smooth`}
      >
        Gallery
      </Link>
      {mobile && (
        <>
          <Link
            href="/products?filter=new"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-medium uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            🔥 New Arrivals
          </Link>
          <Link
            href="/products?filter=trending"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-medium uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            ⭐ Trending Now
          </Link>
          <Link
            href="/products?filter=premium"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`${mobile ? 'text-h2 py-4' : 'text-caption'} font-medium uppercase tracking-widest hover:text-primary transition-smooth flex items-center gap-2`}
          >
            💎 Premium Picks
          </Link>
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
            ❤️ Wishlist
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
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u ?? null)
      setLoading(false)
      updateCartCount()
    }
    init()

    const updateCartCount = () => {
      const cart = JSON.parse(localStorage.getItem("hstn-cart") || "[]")
      setCartCount(cart.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0))
    }

    window.addEventListener("storage", updateCartCount)
    window.addEventListener("hstn-cart-updated", updateCartCount)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      subscription.unsubscribe()
      window.removeEventListener("storage", updateCartCount)
      window.removeEventListener("hstn-cart-updated", updateCartCount)
    }
  }, [])

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
            HSTN <span className="text-primary">LUXURY</span>
          </Link>
          <div className="w-32 h-8 bg-muted/10 animate-pulse rounded-full" />
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="w-full border-b bg-background/80 backdrop-blur-md">
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
            HSTN
          </Link>
        </div>

        {/* Center Section: Desktop Search */}
        <div className="hidden lg:block flex-1 mx-6">
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fashion..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-4">
          {/* Mobile Search */}
          <button
            onClick={() => router.push("/products")}
            className="lg:hidden text-xl"
            aria-label="Search"
          >
            🔍
          </button>

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

      {/* Desktop Navigation Bar */}
      <div className="hidden lg:block border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8 py-2">
            <NavLinks />
          </div>
        </div>
      </div>
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

            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fashion..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </form>

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
    </>
  )
}
