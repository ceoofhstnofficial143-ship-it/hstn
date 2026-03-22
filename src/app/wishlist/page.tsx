"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function WishlistPage() {
    const router = useRouter()
    const [items, setItems] = useState<any[]>([])
    const [collections, setCollections] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'all' | 'collections'>('all')
    const [isCreatingCollection, setIsCreatingCollection] = useState(false)
    const [newCollectionName, setNewCollectionName] = useState("")
    const [isSharing, setIsSharing] = useState(false)
    const [shareCollectionId, setShareCollectionId] = useState<string | null>(null)
    const [shareEmail, setShareEmail] = useState("")
    const [isAddingToCollection, setIsAddingToCollection] = useState(false)
    const [selectedItemForCollection, setSelectedItemForCollection] = useState<any>(null)

    useEffect(() => {
        fetchData()
        
        const handler = () => fetchData()
        window.addEventListener("hstnlx-wishlist-updated", handler)
        return () => window.removeEventListener("hstnlx-wishlist-updated", handler)
    }, [])

    const fetchData = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            setLoading(false)
            return
        }

        // Optimized single-query acquisition
        const { data: merged, error: wishlistErr } = await supabase
            .from("wishlist")
            .select(`
                id, 
                product_id, 
                collection_id, 
                created_at,
                products (id, title, price, image_url, category)
            `)
            .eq("user_id", session.user.id)

        if (wishlistErr || !merged) {
            setLoading(false)
            setItems([])
            return
        }

        setItems(merged)

        // Fetch collections separately
        const { data: collectionsRes } = await supabase
            .from("wishlist_collections")
            .select("*")
            .eq("user_id", session.user.id)

        if (collectionsRes) setCollections(collectionsRes)

        setLoading(false)
    }

    const shareCollection = async () => {
        if (!shareEmail.trim() || !shareCollectionId) return
        
        // In a real V2 system, we'd insert into a 'collection_shares' table
        // and send a notification/email. For simulation:
        alert(`Collaboration Invite Sent to ${shareEmail} for Board Access.`)
        setIsSharing(false)
        setShareEmail("")
    }

    const addItemToCollection = async (collectionId: string) => {
        if (!selectedItemForCollection) return
        
        const { error } = await supabase
            .from("wishlist")
            .update({ collection_id: collectionId })
            .eq("id", selectedItemForCollection.id)
            
        if (!error) {
            setItems(items.map(item => 
                item.id === selectedItemForCollection.id 
                    ? { ...item, collection_id: collectionId } 
                    : item
            ))
            setIsAddingToCollection(false)
            setSelectedItemForCollection(null)
            alert("Asset synchronized to Mood Board.")
        }
    }

    const createCollection = async () => {
        if (!newCollectionName.trim()) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
            .from("wishlist_collections")
            .insert([{ user_id: user.id, name: newCollectionName }])
            .select()
            .single()

        if (data) {
            setCollections([...collections, data])
            setIsCreatingCollection(false)
            setNewCollectionName("")
        }
    }

    const removeItem = async (id: string) => {
        const { error } = await supabase.from("wishlist").delete().eq("id", id)
        if (!error) {
            setItems(items.filter(item => item.id !== id))
            window.dispatchEvent(new Event("hstnlx-wishlist-updated"))
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
    )

    return (
        <main className="bg-background min-h-screen animate-fade-in py-20 px-6">
            <div className="section-container max-w-6xl">
                <header className="mb-20 space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-10 gap-8">
                        <div>
                            <span className="text-caption uppercase tracking-[0.3em] text-primary font-bold">Personal Curation</span>
                            <h1 className="text-display mt-2 italic text-h1 uppercase tracking-tighter">The Private Vault</h1>
                            <p className="text-muted text-caption mt-4 font-medium max-w-md uppercase tracking-widest leading-relaxed">
                                A secured collection of high-velocity assets reserved for your future acquisitions.
                            </p>
                        </div>
                        <div className="flex items-center gap-6 bg-accent/10 px-6 py-4 rounded-2xl border border-border">
                            <div className="text-center">
                                <p className="text-[10px] text-muted uppercase font-bold tracking-widest leading-none mb-1">Total Assets</p>
                                <span className="text-xl font-black text-foreground">{items.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                            <button 
                                onClick={() => setView('all')}
                                className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'all' ? 'bg-black text-white shadow-lg' : 'text-gray-400'}`}
                            >All Assets</button>
                            <button 
                                onClick={() => setView('collections')}
                                className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'collections' ? 'bg-black text-white shadow-lg' : 'text-gray-400'}`}
                            >Mood Boards</button>
                        </div>
                        {view === 'collections' && (
                            <button 
                                onClick={() => setIsCreatingCollection(true)}
                                className="px-6 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-xl"
                            >+ New Board</button>
                        )}
                    </div>
                </header>

                {view === 'all' ? (
                    items.length === 0 ? (
                        <div className="py-40 text-center luxury-card border-dashed border-2 bg-accent/5 max-w-2xl mx-auto rounded-[32px]">
                            <span className="text-5xl mb-8 block opacity-40">🕳️</span>
                            <h2 className="text-h3 font-bold uppercase tracking-[0.2em]">Vault Status: Empty</h2>
                            <p className="text-caption text-muted mt-4 uppercase tracking-widest">No assets have been secured yet.</p>
                            <Link href="/" className="luxury-button mt-12 inline-flex items-center gap-3">Scout New Assets →</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                            {items.map((item) => {
                                const product = item.products
                                if (!product) return null
                                return (
                                    <div key={item.id} className="group flex flex-col h-full bg-white rounded-[2rem] overflow-hidden border border-border hover:shadow-2xl transition-all duration-700 hover:-translate-y-2">
                                        <div className="relative aspect-[3/4] overflow-hidden">
                                            <Link href={`/product/${product.id}`} className="absolute inset-0 z-10" />
                                            <Image src={product.image_url || 'https://images.unsplash.com/photo-1594932224010-74f43a02476b?q=80&w=2000'} alt={product.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="33vw" />
                                            <button onClick={() => removeItem(item.id)} className="absolute top-6 right-6 z-20 w-12 h-12 bg-white/90 backdrop-blur-xl rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">✕</button>
                                        </div>
                                        <div className="p-8">
                                            <h2 className="text-lg font-bold uppercase tracking-tight mb-2 line-clamp-1">{product.title}</h2>
                                            <p className="text-xl font-black text-primary mb-4">₹{product.price.toLocaleString()}</p>
                                            
                                            <div className="flex flex-col gap-3">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedItemForCollection(item)
                                                        setIsAddingToCollection(true)
                                                    }} 
                                                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-all border border-gray-100 py-3 rounded-xl"
                                                >
                                                    {item.collection_id ? "Change Board" : "+ Add to Board"}
                                                </button>
                                                <button onClick={() => router.push(`/product/${product.id}`)} className="luxury-button !py-4 !text-[10px] uppercase tracking-widest font-bold">Initialize Acquisition</button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {collections.map((col) => (
                            <div key={col.id} className="group aspect-square bg-gray-50 rounded-[3rem] border border-gray-100 p-8 flex flex-col justify-end hover:bg-black transition-all duration-700 cursor-pointer overflow-hidden relative">
                                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                                    {col.thumbnail_url && <Image src={col.thumbnail_url} alt="" fill className="object-cover" />}
                                </div>
                                <div className="z-10 group-hover:translate-x-4 transition-transform duration-700">
                                   <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2">Mood Board</p>
                                   <h3 className="text-2xl font-black uppercase text-gray-900 group-hover:text-white italic tracking-tighter leading-tight">{col.name}</h3>
                                   <div className="flex items-center gap-4 mt-6">
                                       <button 
                                           onClick={(e) => {
                                               e.stopPropagation()
                                               setShareCollectionId(col.id)
                                               setIsSharing(true)
                                           }}
                                           className="text-[9px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-all border border-primary/20 px-4 py-2 rounded-full hover:bg-primary hover:text-black"
                                       >
                                           Invite Collaborator 👥
                                       </button>
                                   </div>
                                </div>
                            </div>
                        ))}
                        {collections.length === 0 && (
                            <div className="col-span-full py-40 text-center text-gray-400 uppercase text-xs font-bold tracking-widest">No Mood Boards Created</div>
                        )}
                    </div>
                )}
            </div>

            {isCreatingCollection && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsCreatingCollection(false)} />
                    <div className="bg-white rounded-[3rem] p-12 w-full max-w-xl relative shadow-2xl animate-scale-up">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-8 leading-tight">Initialize Mood Board</h2>
                        <input 
                            type="text"
                            placeholder="Board Name (e.g. Summer Matrix)"
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 ring-black mb-8"
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setIsCreatingCollection(false)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all">Cancel</button>
                            <button onClick={createCollection} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest bg-black text-white rounded-2xl shadow-xl hover:bg-gray-800 transition-all">Confirm Board</button>
                        </div>
                    </div>
                </div>
            )}

            {isSharing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSharing(false)} />
                    <div className="bg-white rounded-[3rem] p-12 w-full max-w-xl relative shadow-2xl animate-scale-up text-center">
                        <span className="text-4xl mb-6 block">👥</span>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-4 leading-tight">Board Collaboration</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">Invite friends to curate this Mood Board with you.</p>
                        <input 
                            type="email"
                            placeholder="Enter collaborator's digital address"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 ring-black mb-8"
                        />
                        <div className="flex gap-4">
                            <button onClick={() => setIsSharing(false)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all">Dismiss</button>
                            <button onClick={shareCollection} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest bg-primary text-black rounded-2xl shadow-xl hover:opacity-80 transition-all">Send Invite</button>
                        </div>
                    </div>
                </div>
            )}

            {isAddingToCollection && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAddingToCollection(false)} />
                    <div className="bg-white rounded-[3rem] p-12 w-full max-w-xl relative shadow-2xl animate-scale-up">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-8 leading-tight text-center">Select Destination Board</h2>
                        <div className="grid grid-cols-1 gap-4 mb-8 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                            {collections.map(col => (
                                <button 
                                    key={col.id} 
                                    onClick={() => addItemToCollection(col.id)}
                                    className="w-full p-6 text-left bg-gray-50 rounded-2xl hover:bg-black hover:text-white transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-widest">{col.name}</span>
                                        <span className="opacity-0 group-hover:opacity-40">➔</span>
                                    </div>
                                </button>
                            ))}
                            {collections.length === 0 && (
                                <p className="text-center py-8 text-gray-400 font-bold uppercase tracking-widest text-[10px]">No boards identified. Create one first.</p>
                            )}
                        </div>
                        <button onClick={() => setIsAddingToCollection(false)} className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all">Cancel Sync</button>
                    </div>
                </div>
            )}
        </main>
    )
}
