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
    let result = products

    if (selectedCategory !== "ALL") {
      result = result.filter((p) =>
        p.category?.toLowerCase() === selectedCategory.toLowerCase()
      )
    }

    if (inStockOnly) {
      result = result.filter((p) => p.stock > 0)
    }

    return result
  }, [products, selectedCategory, selectedSize, inStockOnly])

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
      setProducts(ranked ?? [])
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
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="w-full max-w-2xl relative search-container">
            <input
              type="text"
              placeholder="Search products, sellers, categories..."
              value={query}
              onChange={(e) => { 
                const val = e.target.value;
                setQuery(val);
                if (val.trim().length >= 1) {
                  setShowTrending(false);
                  setShowSuggestions(true);
                  // Proper debounce using ref
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
                if (query.trim().length >= 1) {
                  setShowSuggestions(true);
                } else {
                  setShowTrending(true);
                }
              }}
              onBlur={() => setTimeout(() => { setShowSuggestions(false); setShowTrending(false); }, 250)}
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:ring-2 focus:ring-black outline-none text-sm font-medium"
            />
            <button onClick={searchProducts} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-lg hover:bg-gray-800">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && (searchSuggestions.products.length > 0 || searchSuggestions.categories.length > 0) && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-2xl mt-2 overflow-hidden z-50">
                {searchSuggestions.products.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Products</span>
                    </div>
                    {searchSuggestions.products.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/product/${p.id}`)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title} className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">👗</div>
                        )}
                        <span className="text-sm font-semibold text-gray-800 truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchSuggestions.categories.length > 0 && (
                  <div className={searchSuggestions.products.length > 0 ? "border-t border-gray-50" : ""}>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Categories</span>
                    </div>
                    {searchSuggestions.categories.map((c: any) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCategory(c.name); setQuery(""); setShowSuggestions(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-base">📂</span>
                        <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Trending Searches — shown when input is empty and box is focused */}
            {showTrending && !query.trim() && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-2xl mt-2 overflow-hidden z-50">
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">🔥 Trending Searches</span>
                </div>
                {trendingTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setQuery(tag); setShowTrending(false); setShowSuggestions(false); searchProducts(); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <span className="text-base">🔍</span>
                    <span className="text-sm font-medium text-gray-700">{tag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 hidden md:flex ml-4">
            {(['grid', 'feed'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
                {mode}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* 🎬 God-Tier Luxury Hero Section */}
      {selectedCategory === "ALL" && !query && viewMode === 'grid' && (
      <section className="relative w-full h-[85vh] md:h-[90vh] bg-black overflow-hidden flex items-center justify-center -mt-[73px]">
        {/* Cinematic Backdrop */}
        <div className="absolute inset-0 opacity-60">
            <Image 
                src="https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2671&auto=format&fit=crop" 
                alt="Luxury Fashion Campaign"
                fill
                priority
                className="object-cover object-top scale-105 animate-slow-zoom"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto flex flex-col items-center mt-20">
            <span className="text-[10px] md:text-xs text-white/70 uppercase tracking-[0.5em] font-bold mb-6 block animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                The Institutional Archive
            </span>
            <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black uppercase text-white tracking-tighter italic leading-[0.8] mb-8 animate-slide-up mix-blend-overlay">
                HSTNLX
            </h1>
            <p className="max-w-md mx-auto text-xs md:text-sm text-white/60 uppercase tracking-widest leading-relaxed mb-12 animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                Curated peer-to-peer acquisition network for high-fidelity garments and exclusive silhouettes.
            </p>
            <button 
                onClick={() => {
                  document.getElementById('archive-grid')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="luxury-button !bg-white !text-black hover:!bg-black hover:!text-white hover:border hover:border-white transition-all duration-500 !px-12 !py-5 shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-fade-in"
                style={{ animationDelay: '600ms', animationFillMode: 'both' }}
            >
                Initialize Scouting
            </button>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center animate-bounce duration-1000">
            <span className="text-[8px] uppercase tracking-widest font-black mb-2">Descend</span>
            <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </section>
      )}

      <main id="archive-grid" className="max-w-7xl mx-auto px-4 py-8 relative z-20 bg-white">
        
        {/* Horizontal Category Pills for easy access (Mobile & Desktop) */}
        <div className="flex overflow-x-auto gap-3 pb-6 mb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setQuery("");
                setShowSuggestions(false);
                if (viewMode === 'feed') setViewMode('grid');
              }}
              className={`whitespace-nowrap px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all bg-white border shrink-0 ${
                selectedCategory === cat
                  ? 'border-black bg-black text-white shadow-lg'
                  : 'border-gray-200 text-gray-500 hover:border-black hover:text-black hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
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
