"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { rankProducts } from "@/lib/feedRanker"
import ProductCard from "@/components/ProductCard"
import { useRouter, useSearchParams } from "next/navigation"
import ProductSkeleton from "@/components/ProductSkeleton"
import DiscoveryFeed from "@/components/DiscoveryFeed"
import StyleQuiz from "@/components/StyleQuiz"
import OutfitBundleV2 from "@/components/OutfitBundleV2"
import FollowingFeed from "@/components/FollowingFeed"
import { trackEvent } from "@/lib/analytics"

export default function Home() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<any[]>([])
  const [featured, setFeatured] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [query, setQuery] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState<{ products: any[]; categories: any[] }>({ products: [], categories: [] })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showTrending, setShowTrending] = useState(false)
  const [searchCache, setSearchCache] = useState<Record<string, any[]>>({})
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid')
  const [user, setUser] = useState<any>(null)
  const [showQuiz, setShowQuiz] = useState(false)
  const [userStyles, setUserStyles] = useState<string[]>([])
  const pageSize = 12
  const router = useRouter()
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const categories = [
    "ALL",
    "CO-ORD SETS", 
    "TRENDY TOPS",
    "CASUAL DRESSES",
    "KOREAN-STYLE FASHION"
  ]

  const filteredProducts = useMemo(() => {
    return products
  }, [products])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    // Read ?category= from URL (when navigating from another page)
    const urlCategory = searchParams.get('category')
    if (urlCategory) {
      const matched = categories.find(
        c => c.toLowerCase() === urlCategory.toLowerCase()
      )
      if (matched) setSelectedCategory(matched)
    }

    // Listen to hstnlx-category event (when already on homepage)
    const handleCategoryEvent = (e: Event) => {
      const cat = (e as CustomEvent).detail as string
      const matched = categories.find(
        c => c.toLowerCase() === cat.toLowerCase()
      )
      if (matched) {
        setSelectedCategory(matched)
        setQuery('')
        setShowSuggestions(false)
        setViewMode('grid')
      }
    }
    window.addEventListener('hstnlx-category', handleCategoryEvent)

    // Check for saved styles
    const savedStyles = localStorage.getItem('hstnlx_user_styles')
    if (!savedStyles) {
      setShowQuiz(true)
    } else {
      setUserStyles(JSON.parse(savedStyles))
    }

    return () => {
      window.removeEventListener('hstnlx-category', handleCategoryEvent)
    }
  }, [])

  const handleQuizComplete = (styles: string[]) => {
      setUserStyles(styles)
      localStorage.setItem('hstnlx_user_styles', JSON.stringify(styles))
      setShowQuiz(false)
      setViewMode('feed') // Switch to feed to show personalized content
  }

  const loadFeatured = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let queryBuilder = supabase
      .from("products")
      .select(`
        id, title, price, image_url, category, user_id, views,
        profiles!products_user_id_fkey(username)
      `)
      .eq("admin_status", "approved")
      .gte("created_at", twentyFourHoursAgo)
      .limit(6);

    const { data } = await queryBuilder;
    if (data) setFeatured(data)
  }

  const loadNewProducts = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let queryBuilder = supabase
      .from("products")
      .select(`
        id, title, price, image_url, category, user_id, views,
        profiles!products_user_id_fkey(username)
      `)
      .eq("admin_status", "approved")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(6);

    const { data } = await queryBuilder;
    if (data) setNewProducts(data)
  }

  const fetchProducts = async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true)
    else {
      setLoading(true)
      setPage(0)
    }

    const currentPage = isLoadMore ? page + 1 : 0
    const start = currentPage * pageSize
    const end = start + pageSize - 1

    let queryBuilder = supabase
      .from("products")
      .select(`
        id, title, price, image_url, category, user_id, stock, views, admin_status, created_at, video_url, measurements, additional_images,
        profiles!products_user_id_fkey(username)
      `)
      .eq("admin_status", "approved")
      .order("created_at", { ascending: false })
      .range(start, end)
    
    // Server-side filters
    if (selectedCategory && selectedCategory !== "ALL") {
      queryBuilder = queryBuilder.ilike("category", selectedCategory)
    }
    if (priceRange) queryBuilder = queryBuilder.gte("price", priceRange.min).lte("price", priceRange.max)
    if (selectedSize) {
      const { data: variantData } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', selectedSize)
        .gt('stock', 0)
      
      const productIds = variantData?.map(v => v.product_id) || []
      
      if (productIds.length > 0) {
        queryBuilder = queryBuilder.in('id', productIds)
      } else {
        // Return empty results if no products have this size variant
        if (!isLoadMore) {
          setProducts([])
        }
        setHasMore(false)
        setLoading(false)
        setIsLoadingMore(false)
        return
      }
    }
    if (inStockOnly) queryBuilder = queryBuilder.gt("stock", 0)

    const { data, error } = await queryBuilder

    if (error || !data || data.length === 0) {
      if (!isLoadMore) {
        setProducts([])
      }
      setHasMore(false)
      setLoading(false)
      setIsLoadingMore(false)
      return
    }

    setHasMore(data.length === pageSize)

    const userIds = [...new Set(data.map(p => p.user_id))]
    const { data: trustData } = await supabase
      .from("trust_scores")
      .select("user_id, score")
      .in("user_id", userIds)

    const productsWithTrust = data.map(product => {
      const trust = trustData?.find(t => t.user_id === product.user_id)
      return { ...product, trust }
    })

    const ranked = rankProducts(productsWithTrust)
    
    if (isLoadMore) {
      setProducts(prev => [...prev, ...ranked])
      setPage(currentPage)
    } else {
      setProducts(ranked || [])
    }

    setLoading(false)
    setIsLoadingMore(false)
  }

  useEffect(() => {
    if (viewMode === 'grid') {
      fetchProducts()
      loadFeatured()
      loadNewProducts()
    }
  }, [selectedCategory, priceRange, selectedSize, inStockOnly, viewMode])

  useEffect(() => {
    if (viewMode === 'feed' || !hasMore || isLoadingMore || loading) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchProducts(true)
    }, { threshold: 0.1 })

    const target = document.getElementById("infinite-scroll-trigger")
    if (target) observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loading, page, viewMode])

  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // 3️⃣ Handling empty search query
  useEffect(() => {
    if (!initialLoadDone) {
      setInitialLoadDone(true)
      return
    }

    if (query.trim().length === 0) {
      fetchProducts()
      setShowSuggestions(false)
    }
  }, [query])

  const searchProducts = async () => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      fetchProducts()
      return
    }

    // Track search event
    trackEvent('search', { query: trimmedQuery, category: selectedCategory })

    // 6️⃣ Speed Trick: Check Cache
    if (searchCache[trimmedQuery]) {
      setProducts(searchCache[trimmedQuery])
      return
    }

    setLoading(true)
    
    // Log search analytics (Non-blocking)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("search_queries").insert({
        query: trimmedQuery,
        user_id: user?.id || null
      })
    } catch (e) {
      console.error("Search analytics error:", e)
    }

    let queryBuilder = supabase
      .from("products")
      .select(`
        id, title, price, image_url, category, user_id, stock, views, admin_status, created_at, video_url, measurements, additional_images,
        profiles!products_user_id_fkey(username)
      `)
      .eq("admin_status", "approved")
      .or(`title.ilike.%${trimmedQuery}%,category.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    // Apply active filters to search results
    if (selectedCategory && selectedCategory !== "ALL") {
      queryBuilder = queryBuilder.ilike("category", selectedCategory)
    }
    if (priceRange) queryBuilder = queryBuilder.gte("price", priceRange.min).lte("price", priceRange.max)
    if (selectedSize) {
      const { data: variantData } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('size', selectedSize)
        .gt('stock', 0)
      
      const productIds = variantData?.map(v => v.product_id) || []
      
      if (productIds.length > 0) {
        queryBuilder = queryBuilder.in('id', productIds)
      } else {
        // Return empty results if no products have this size variant
        setProducts([])
        setHasMore(false)
        setLoading(false)
        return
      }
    }
    if (inStockOnly) queryBuilder = queryBuilder.gt("stock", 0)

    const { data } = await queryBuilder;

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(p => p.user_id))]
      const { data: trustData } = await supabase.from("trust_scores").select("*").in("user_id", userIds)
      const productsWithTrust = data.map(product => ({ ...product, trust: trustData?.find(t => t.user_id === product.user_id) }))
      const ranked = rankProducts(productsWithTrust)
      const finalResults = ranked ?? []
      
      setProducts(finalResults)
      // Update cache
      setSearchCache(prev => ({ ...prev, [trimmedQuery]: finalResults }))
    } else {
      setProducts([])
    }
    
    setShowSuggestions(false)
    setLoading(false)
  }

  const [trendingTags, setTrendingTags] = useState<string[]>(["Streetwear", "Luxury", "Korean Style"])

  useEffect(() => {
    const fetchTrending = async () => {
      const { data } = await supabase
        .from("products")
        .select("category")
        .eq("admin_status", "approved")
        .order("views", { ascending: false })
        .limit(10)
      
      if (data) {
        const unique = Array.from(new Set(data.map(p => p.category))).filter(Boolean)
        setTrendingTags(unique.length > 0 ? unique : ["Luxury", "Streetwear", "Archive"])
      }
    }
    fetchTrending()
  }, [])

  const generateSuggestions = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length < 1) {
      setSearchSuggestions({ products: [], categories: [] })
      return
    }

    // Query products — starts-with for speed & relevance
    const { data: products } = await supabase
      .from("products")
      .select("id, title, image_url")
      .eq("admin_status", "approved")
      .ilike("title", `${trimmed}%`)
      .limit(5)

    // Query categories from local list (starts-with match)
    const matchingCategories = categories
      .filter(c => c.toLowerCase() !== "all" && c.toLowerCase().startsWith(trimmed.toLowerCase()))
      .map(c => ({ id: c, name: c }))

    setSearchSuggestions({
      products: products ?? [],
      categories: matchingCategories
    })
  }

  // Removed full-screen loading skeleton to prevent UI fluctuation/flickering.
  // Instead, the skeletons render directly in the products grid.

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-xl z-[100] transition-all duration-500">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* 🔍 COMMAND CENTER (Search) */}
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none opacity-40 group-focus-within:opacity-100 transition-opacity">
              <span className="text-xs font-black">CMD+K</span>
            </div>
            <input
              type="text"
              placeholder="Search Archives, Merchants, or Silhouettes..."
              value={query}
              onChange={(e) => { 
                const val = e.target.value;
                setQuery(val);
                if (val.trim().length >= 1) {
                  setShowTrending(false);
                  setShowSuggestions(true);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => generateSuggestions(val), 300);
                } else {
                  setSearchSuggestions({ products: [], categories: [] });
                  setShowSuggestions(false);
                  setShowTrending(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                  setShowTrending(false);
                  searchProducts();
                }
              }}
              onFocus={() => {
                if (query.trim().length >= 1) setShowSuggestions(true);
                else setShowTrending(true);
              }}
              onBlur={() => setTimeout(() => { setShowSuggestions(false); setShowTrending(false); }, 250)}
              className="w-full pl-16 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-black/5 focus:bg-white outline-none text-[11px] font-black uppercase tracking-widest transition-all placeholder:text-gray-300"
            />
            <button onClick={searchProducts} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black text-white rounded-xl hover:bg-primary hover:text-black transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>

            {/* COMMAND CENTER SUGGESTIONS */}
            {(showSuggestions || showTrending) && (
              <div className="absolute top-[calc(100%+16px)] left-0 right-0 bg-white border border-gray-100 rounded-[2.5rem] shadow-[0_45px_100px_-20px_rgba(0,0,0,0.18)] overflow-hidden z-[200] animate-in fade-in slide-in-from-top-6 duration-700">
                <div className="p-8 space-y-10">
                   {/* Results Group */}
                   {showSuggestions && (searchSuggestions.products.length > 0 || searchSuggestions.categories.length > 0) ? (
                     <div className="space-y-8">
                       {searchSuggestions.categories.length > 0 && (
                         <div className="space-y-4">
                           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300">Fleet Segments</span>
                           <div className="flex flex-wrap gap-2">
                             {searchSuggestions.categories.map((cat: any) => (
                               <button key={cat.id} onClick={() => { setSelectedCategory(cat.name); setQuery(""); setShowSuggestions(false); }} className="px-4 py-2 bg-gray-50 hover:bg-black hover:text-white rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
                                 {cat.name}
                               </button>
                             ))}
                           </div>
                         </div>
                       )}
                       
                       {searchSuggestions.products.length > 0 && (
                         <div className="space-y-4">
                           <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300">Asset Discovery</span>
                           <div className="grid grid-cols-1 gap-1">
                             {searchSuggestions.products.map((p: any) => (
                               <button key={p.id} onClick={() => router.push(`/product/${p.id}`)} className="w-full p-4 hover:bg-gray-50 rounded-3xl flex items-center gap-5 transition-all group/item">
                                 <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 relative shadow-sm">
                                   <img src={p.image_url} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-700" />
                                 </div>
                                 <div className="text-left flex-1">
                                   <p className="text-[11px] font-black uppercase tracking-[0.1em]">{p.title}</p>
                                   <div className="flex items-center gap-3 mt-1.5 opacity-40">
                                      <span className="text-[8px] font-black uppercase">Grade A++</span>
                                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                      <span className="text-[8px] font-black uppercase">Institutional Listing</span>
                                   </div>
                                 </div>
                               </button>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                   ) : showTrending ? (
                    <div className="space-y-8">
                      <div className="space-y-6">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300">Current Trending Protocols</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {["OFF-WHITE", "CORTEIZ", "ARCHIVE", "SILHOUETTES"].map(t => (
                             <button key={t} onClick={() => { setQuery(t); searchProducts(); }} className="p-6 bg-gray-50/50 hover:bg-black hover:text-white rounded-[2rem] border border-gray-100 transition-all text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest">{t}</p>
                             </button>
                           ))}
                        </div>
                      </div>
                      
                      <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <span className="text-xl">💎</span>
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest">Personalized Scout</p>
                               <p className="text-[8px] font-bold text-primary uppercase tracking-widest mt-1 italic">V2 Discovery Algorithm Active</p>
                            </div>
                         </div>
                         <button onClick={() => setViewMode('feed')} className="px-6 py-2.5 bg-black text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all">Initialize Feed</button>
                      </div>
                    </div>
                   ) : (
                     <div className="py-12 text-center opacity-30">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Assets Matching Query</p>
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
              {(['grid', 'feed'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all ${viewMode === mode ? 'bg-black text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-600'}`}>
                  {mode}
                </button>
              ))}
            </div>
            <Link href="/cart" className="w-12 h-12 rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-black hover:text-white transition-all relative">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </Link>
          </div>
        </div>
      </header>
      
      {/* 🏛️ GOD-TIER LUXURY HERO */}
      {selectedCategory === "ALL" && !query && viewMode === 'grid' && (
      <section className="relative w-full h-[90vh] bg-black overflow-hidden flex items-center justify-center -mt-[81px]">
        {/* Dynamic Multi-Layer Backdrop */}
        <div className="absolute inset-0">
            <Image 
                src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2671&auto=format&fit=crop" 
                alt="Luxury Fashion Campaign"
                fill
                priority
                className="object-cover object-top opacity-50 contrast-125 scale-105 animate-slow-zoom"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-6xl mx-auto space-y-12">
            <div className="space-y-4 animate-in fade-in slide-in-from-top-8 duration-1000">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-white/10">
                   <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                   <span className="text-[9px] text-white/70 uppercase tracking-[0.4em] font-black">The Institutional Fleet</span>
                </div>
                <h1 className="text-7xl md:text-[9rem] lg:text-[13rem] font-black uppercase text-white tracking-tighter italic leading-[0.75] mix-blend-difference">
                    HSTNLX
                    <span className="block text-[10px] md:text-xs tracking-[0.8em] mt-6 md:mt-10 font-black not-italic opacity-40">Blockchain Verified Acquisitions</span>
                </h1>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20 pt-8 animate-in fade-in duration-1000 delay-500">
                <div className="flex flex-col items-center gap-2">
                   <span className="text-3xl font-black italic tracking-tighter text-white">12.5K+</span>
                   <span className="text-[7px] text-white/40 uppercase tracking-[0.3em] font-black">Assets Secured</span>
                </div>
                <button 
                  onClick={() => document.getElementById('archive-grid')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group relative px-14 py-6 bg-white text-black rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[10px] overflow-hidden hover:scale-110 transition-transform duration-500"
                >
                    <span className="relative z-10 group-hover:tracking-[0.6em] transition-all">Initialize Scouting</span>
                    <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </button>
                <div className="flex flex-col items-center gap-2">
                   <span className="text-3xl font-black italic tracking-tighter text-white">0.05s</span>
                   <span className="text-[7px] text-white/40 uppercase tracking-[0.3em] font-black">Trade Latency</span>
                </div>
            </div>
        </div>

        {/* Cinematic Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-30 hover:opacity-100 transition-opacity">
            <div className="w-[1px] h-16 bg-gradient-to-t from-white to-transparent" />
            <span className="text-[7px] uppercase tracking-[0.5em] font-black text-white">Descend Archive</span>
        </div>
      </section>
      )}

      <main id="archive-grid" className="max-w-7xl mx-auto px-6 py-12 relative z-20 bg-white rounded-t-[4rem] -mt-16">
        {/* 🏷️ CATEGORY PROTOCOL */}
        <div className="flex overflow-x-auto gap-4 pb-12 items-center no-scrollbar group">
          <div className="flex items-center gap-2 px-4 py-3 bg-black text-white rounded-3xl shrink-0">
             <span className="text-xs font-black italic">FLEET:</span>
          </div>
          {categories.slice(0, 8).map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setQuery(""); if (viewMode === 'feed') setViewMode('grid'); }}
              className={`whitespace-nowrap px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 shrink-0 ${
                selectedCategory === cat
                  ? 'border-black bg-black text-white shadow-2xl scale-105'
                  : 'border-gray-50 text-gray-400 hover:border-black hover:text-black hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 🌐 GLOBAL TRUST PROTOCOL */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
           {[
             { label: 'Blockchain ID', icon: '📝', desc: 'Secure Ledger' },
             { label: 'Asset Verified', icon: '💎', desc: 'Premium Specs' },
             { label: 'Direct Trade', icon: '⚡', desc: 'P2P Network' },
             { label: 'Logistics Pro', icon: '📦', desc: 'Global Fleet' }
           ].map((item, i) => (
             <div key={i} className="p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 flex flex-col gap-3 group hover:bg-black transition-all duration-700">
                <span className="text-xl opacity-40 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest group-hover:text-white transition-colors">{item.label}</p>
                   <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">{item.desc}</p>
                </div>
             </div>
           ))}
        </div>

        {viewMode === 'feed' ? (
          <DiscoveryFeed userId={user?.id} userStyles={userStyles} />
        ) : (
          <div className="space-y-16">
                <div className="flex lg:hidden items-center justify-between bg-gray-50 p-4 rounded-2xl mb-6">
                  <div className="flex gap-2">
                    {(['grid', 'feed'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-black text-white' : 'text-gray-400'}`}>
                        {mode}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                    <span>Filters</span>
                  </button>
                </div>

                {/* Desktop View Mode Switcher (Moved from header for consistency) */}
                <div className="hidden lg:flex justify-end mb-6">
                  <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    {(['grid', 'feed'] as const).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

            <div className="flex gap-12">
              <aside className="hidden lg:block w-64 flex-shrink-0 space-y-10 sticky top-28 self-start h-fit">
                {/* Daily Deal (Point 11) */}
                <div className="bg-black rounded-3xl p-6 text-white mb-10 overflow-hidden relative">
                    <div className="relative z-10">
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">Daily Archive deal</span>
                        <h4 className="text-lg font-black uppercase italic leading-tight mt-2 italic tracking-tighter">Elite Co-ord Set</h4>
                        <p className="text-[10px] text-green-400 font-bold mt-2">40% OFF Reserved</p>
                        <button className="mt-4 px-4 py-2 bg-white text-black rounded-full text-[9px] font-black uppercase tracking-widest">Initialize</button>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-20 text-6xl">💎</div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6">Categories</h3>
                  <div className="flex flex-col gap-3">
                    {categories.map((cat) => (
                      <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)}
                        className={`text-left text-[10px] font-bold uppercase tracking-widest transition-all ${selectedCategory === cat ? 'text-black' : 'text-gray-400 hover:text-black'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6">Price Range</h3>
                  <div className="space-y-3">
                    {[{label: "Under ₹500", min: 0, max: 500}, {label: "₹500 - ₹2000", min: 500, max: 2000}, {label: "Over ₹2000", min: 2000, max: 100000}].map((r) => (
                      <label key={r.label} className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="price" checked={priceRange?.min === r.min} onChange={() => setPriceRange(r)} className="accent-black w-4 h-4" />
                        <span className="text-xs font-bold text-gray-500 group-hover:text-black transition-colors">{r.label}</span>
                      </label>
                    ))}
                    {priceRange && <button onClick={() => setPriceRange(null)} className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-2 hover:underline">Reset</button>}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-t border-gray-50 pt-8">Size</h3>
                  <div className="flex flex-wrap gap-2">
                    {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                        className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all border ${
                          selectedSize === size
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-t border-gray-50 pt-8">Availability</h3>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="accent-black w-4 h-4"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-black">In Stock Only</span>
                  </label>
                </div>

                {/* Trending Styles (Point 6) */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-t border-gray-50 pt-8">Trending Now</h3>
                  <div className="flex flex-col gap-3">
                    {trendingTags.map(tag => (
                        <button 
                            key={tag} 
                            onClick={() => { setQuery(tag); searchProducts(); }}
                            className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black transition-all"
                        >
                            #{tag}
                        </button>
                    ))}
                  </div>
                </div>
              </aside>

            <div className="flex-1 space-y-12">
                {/* V2: Personalized Following Feed */}
                <FollowingFeed />

                {/* V2: Outfit Bundles Showcase */}
                {selectedCategory === "ALL" && !query && (
                  <section className="mb-20">
                    <div className="flex items-center gap-4 mb-10">
                      <h2 className="text-sm font-black uppercase tracking-[0.2em] italic text-purple-600">Complete Looks</h2>
                      <div className="h-px flex-1 bg-purple-50" />
                    </div>
                    <OutfitBundleV2 limit={1} />
                  </section>
                )}

                {featured.length > 0 && selectedCategory === "ALL" && (
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <h2 className="text-sm font-black uppercase tracking-[0.2em]">Featured Selection</h2>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      {featured.map(p => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">{selectedCategory === "ALL" ? "The Archive" : selectedCategory}</h2>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-12">
                    {loading ? (
                      [...Array(6)].map((_, i) => (
                         <div key={i} className="animate-pulse">
                           <div className="aspect-square bg-gray-100 rounded-xl mb-4"></div>
                           <div className="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
                           <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                         </div>
                      ))
                    ) : filteredProducts.length > 0 ? (
                      filteredProducts.map(p => <ProductCard key={p.id} product={p} />)
                    ) : (
                      <div className="col-span-full py-12 text-center text-gray-500">
                        <p>No products found matching your criteria.</p>
                      </div>
                    )}
                  </div>
                  
                  {hasMore && (
                    <div id="infinite-scroll-trigger" className="h-40 flex items-center justify-center">
                      <div className="w-10 h-10 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Filter Drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
          <div className="w-full max-w-xs bg-white relative animate-slide-left p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">Refine Archive</h2>
              <button onClick={() => setIsFilterOpen(false)} className="text-xl">✕</button>
            </div>
            
            <div className="space-y-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-6">Categories</h3>
                <div className="flex flex-col gap-3">
                  {categories.map((cat) => (
                    <button 
                      key={cat} 
                      onClick={() => { setSelectedCategory(cat); setIsFilterOpen(false); }}
                      className={`text-left text-[10px] font-bold uppercase tracking-widest transition-all ${selectedCategory === cat ? 'text-black' : 'text-gray-400'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-6">Price Range</h3>
                <div className="space-y-3">
                  {[{label: "Under ₹500", min: 0, max: 500}, {label: "₹500 - ₹2000", min: 500, max: 2000}, {label: "Over ₹2000", min: 2000, max: 100000}].map((r) => (
                    <label key={r.label} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="price_mobile" checked={priceRange?.min === r.min} onChange={() => setPriceRange(r)} className="accent-black w-4 h-4" />
                      <span className="text-xs font-bold text-gray-500 group-hover:text-black transition-colors">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-6">Size</h3>
                <div className="flex flex-wrap gap-2">
                  {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                      className={`w-10 h-10 rounded-lg text-[10px] font-black transition-all border ${
                        selectedSize === size ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-100"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100">
                <button 
                  onClick={() => {
                    setSelectedCategory("ALL");
                    setPriceRange(null);
                    setSelectedSize(null);
                    setInStockOnly(false);
                    setIsFilterOpen(false);
                  }}
                  className="w-full py-4 bg-gray-100 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showQuiz && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
          <StyleQuiz onComplete={handleQuizComplete} />
        </div>
      )}
    </div>
  )
}
