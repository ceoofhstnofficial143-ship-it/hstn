"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveCamera from "@/components/LiveCamera"

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("Co-ord sets")
  const [stock, setStock] = useState(1)
  const [sku, setSku] = useState("")
  const [loading, setLoading] = useState(false)

  // Size Reliability Framework
  const [bust, setBust] = useState("")
  const [waist, setWaist] = useState("")
  const [hips, setHips] = useState("")
  const [length, setLength] = useState("")
  const [sleeve, setSleeve] = useState("")
  const [modelHeight, setModelHeight] = useState("")
  const [modelWeight, setModelWeight] = useState("")
  const [modelSize, setModelSize] = useState("")

  const FIT_TYPES = [
    { label: "True to Size", value: "true_to_size" },
    { label: "Relaxed Fit", value: "relaxed" },
    { label: "Slim Fit", value: "slim" },
    { label: "Oversized", value: "oversized" },
    { label: "Cropped", value: "cropped" },
    { label: "Stretch", value: "stretch" },
  ]

  const [fitType, setFitType] = useState<string>(FIT_TYPES[0]?.value ?? "true_to_size")

  const buildSku = (userId: string) => {
    const short = userId.slice(0, 6).toUpperCase()
    const ts = Date.now().toString(36).toUpperCase()
    return `HSTN-${short}-${ts}`
  }

  // Authenticated Media
  const [photos, setPhotos] = useState<Blob[]>([])
  const [video, setVideo] = useState<Blob | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [standardImage, setStandardImage] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<"authentication" | "standard">("authentication")

  const categories = [
    { name: "Co-ord sets", range: "₹699–₹1299" },
    { name: "Trendy tops", range: "₹399–₹799" },
    { name: "Casual dresses", range: "₹799–₹1499" },
    { name: "Korean-style fashion", range: "Viral/Trendy" },
    { name: "Other Luxury", range: "Bespoke" }
  ]

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.push("/login")
      } else {
        setUser(data.session.user)
      }
      setLoadingUser(false)
    }
    getSession()
  }, [router])

  const handleCameraComplete = (capturedPhotos: Blob[], capturedVideo: Blob) => {
    setPhotos(capturedPhotos)
    setVideo(capturedVideo)
    setMediaReady(true)
    setShowCamera(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!mediaReady) {
      alert("Please complete the authentication protocol with all 6 photos and the fabric motion video.")
      return
    }

    setLoading(true)
    let imageUrl = ""
    let videoUrl = ""

    // Upload Process
    if (uploadMode === "authentication") {
      // Upload Main Photo (Front View)
      if (photos[0]) {
        const fileName = `${user.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, photos[0])

        if (!uploadError) {
          const { data } = supabase.storage.from("product-images").getPublicUrl(fileName)
          imageUrl = data.publicUrl
        }
      }

      // Upload Fabric Video
      if (video) {
        const fileName = `${user.id}-fabric-${Date.now()}.webm`
        const { error: videoError } = await supabase.storage
          .from("product-videos")
          .upload(fileName, video)

        if (!videoError) {
          const { data } = supabase.storage.from("product-videos").getPublicUrl(fileName)
          videoUrl = data.publicUrl
        }
      }
    } else {
      // Standard Upload
      if (standardImage) {
        const fileName = `std-${user.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, standardImage)

        if (!uploadError) {
          const { data } = supabase.storage.from("product-images").getPublicUrl(fileName)
          imageUrl = data.publicUrl
        }
      }
    }

    const finalSku = sku || buildSku(user.id)

    // HARD BACKEND RULE: Enforce Authenticated Upload (Fabric Video, Size)
    if (uploadMode === "authentication" && (!videoUrl || !bust || !waist || !length)) {
      alert("HARD BLOCK: Authentication Protocol failed. Video Verification and Numeric Measurements are strictly required.")
      setLoading(false)
      return
    }

    // Ensure SKU is globally unique before hitting the UNIQUE constraint
    const { data: existingSku, error: skuCheckError } = await supabase
      .from("products")
      .select("id")
      .eq("sku", finalSku)
      .maybeSingle()

    if (skuCheckError) {
      alert(`SKU check failed: ${skuCheckError.message}`)
      setLoading(false)
      return
    }

    if (existingSku) {
      alert("This SKU already exists. Please retry – HSTN will generate a new institutional SKU.")
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from("products")
      .insert([
        {
          title,
          sku: finalSku,
          price: Number(price),
          description,
          image_url: imageUrl,
          video_url: videoUrl,
          user_id: user.id,
          stock,
          category,
          color_verified: true, // Mandatory
          measurements: { bust, waist, hips, length, sleeve },
          model_info: { height: modelHeight, weight: modelWeight, size: modelSize },
          fit_type: fitType,
          size_verified: true,
          admin_status: 'pending' // Force admin review initially
        },
      ])

    if (error) {
      alert(error.message)
    } else {
      alert("Authenticated Listing Published Successfully 🏛️")
      router.push("/seller/dashboard")
    }
    setLoading(false)
  }

  if (loadingUser) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  if (showCamera) {
    return <LiveCamera onCaptureComplete={handleCameraComplete} onCancel={() => setShowCamera(false)} />
  }

  return (
    <main className="bg-background min-h-screen animate-fade-in py-20 px-6">
      <div className="section-container max-w-5xl">
        <header className="mb-16 text-center">
          <span className="text-caption uppercase tracking-widest text-primary font-bold">Authenticated Protocol</span>
          <h1 className="text-display mt-2 italic">The Gold Standard</h1>
          <p className="text-body text-muted mt-4 max-w-2xl mx-auto">
            Our strict verification protocol prevents fraud. Only live camera sessions are accepted.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Media Authentication Grid (LEFT) */}
          <div className="lg:col-span-5 space-y-10">
            <div className="flex gap-4 p-1 bg-accent/20 rounded-2xl mb-8">
              <div className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-primary text-black text-center">
                Gold Verified Only 🛡️
              </div>
            </div>

            <div className={`luxury-card aspect-[4/5] border-dashed border-2 flex flex-col items-center justify-center p-8 transition-smooth bg-accent/5 ${mediaReady || standardImage ? 'border-primary/50' : 'border-border'}`}>
              {uploadMode === "authentication" ? (
                mediaReady ? (
                  <div className="grid grid-cols-2 gap-4 w-full h-full overflow-y-auto p-2 no-scrollbar">
                    {photos.map((blob, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden relative border border-white/10">
                        <img src={URL.createObjectURL(blob)} className="w-full h-full object-cover" alt="" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[8px] text-white px-2 py-0.5 rounded-full uppercase font-bold">Step {i + 1}</div>
                      </div>
                    ))}
                    <div className="aspect-square rounded-xl overflow-hidden relative border border-primary/20 bg-primary/5 flex items-center justify-center">
                      <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Video ✓</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
                      <span className="text-3xl">🛡️</span>
                    </div>
                    <p className="text-caption font-bold uppercase tracking-widest text-foreground">Protocol Mode</p>
                    <p className="text-[10px] text-muted/60 mt-4 leading-relaxed max-w-[200px] mx-auto uppercase">
                      Required for "Gold Verified" Badge <br /> **LIVE SESSION ONLY**
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="luxury-button mt-8 !py-3 !px-8 !text-[10px] !bg-primary !text-black border-none"
                    >
                      Authenticate Now
                    </button>

                    <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl text-left">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mb-2">Color Accuracy Protocol 🎨</p>
                      <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed">
                        Natural light reference is mandatory. AI filters or heavy grading are strictly restricted. Violation triggers Trust Index penalties.
                      </p>
                      <p className="text-[9px] text-muted uppercase tracking-widest px-8 mt-2">Maximum file size: 50MB</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center w-full">
                  {standardImage ? (
                    <div className="w-full h-full relative group">
                      <img src={URL.createObjectURL(standardImage)} className="w-full h-64 object-cover rounded-2xl mb-4" />
                      <button
                        type="button"
                        onClick={() => setStandardImage(null)}
                        className="text-[10px] uppercase font-bold text-red-500"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
                        <span className="text-2xl">📸</span>
                      </div>
                      <p className="text-caption font-bold uppercase tracking-widest mb-4">Gallery Upload</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setStandardImage(e.target.files?.[0] || null)}
                        className="hidden"
                        id="std-upload"
                      />
                      <label
                        htmlFor="std-upload"
                        className="luxury-button !bg-foreground !text-background !py-3 !px-8 !text-[10px] cursor-pointer"
                      >
                        Select Piece Photo
                      </label>
                      <p className="text-[9px] text-muted mt-6 uppercase tracking-widest px-8">Note: Standard listings do not receive the Gold Trust badge.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {mediaReady && (
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="text-[10px] uppercase tracking-widest text-primary font-bold hover:underline"
              >
                Retake Authenticated Session
              </button>
            )}
          </div>

          {/* Configuration (RIGHT) */}
          <div className="lg:col-span-7 space-y-12">
            <div className="space-y-8">
              <div className="p-8 bg-foreground text-background rounded-[32px] border-none">
                <label className="text-caption uppercase tracking-widest font-bold block mb-4 text-primary">Strategic Category</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-4 rounded-2xl text-left border transition-smooth ${category === cat.name ? 'border-primary bg-primary/10' : 'border-white/10 opacity-40'}`}
                    >
                      <p className="text-caption font-bold uppercase tracking-tight text-white">{cat.name}</p>
                      <p className="text-[10px] text-white/40 mt-1">{cat.range}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="text-caption uppercase tracking-widest font-bold block mb-2">Institutional SKU ID</label>
                  <div className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body font-mono text-xs flex items-center justify-between">
                    <span className="text-muted">Auto-generated by HSTN on publish</span>
                  </div>
                  <p className="text-[9px] text-muted mt-2 uppercase tracking-widest">HSTN assigns a unique institutional SKU linked to video & metadata.</p>
                </div>

                <div>
                  <label className="text-caption uppercase tracking-widest font-bold block mb-2">Acquisition Title</label>
                  <input
                    required
                    placeholder="e.g. Sage Green Co-ord Set"
                    className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body focus:bg-white focus:border-primary outline-none transition-smooth"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-caption uppercase tracking-widest font-bold block mb-2">Strategic Price (₹)</label>
                    <input
                      required
                      type="number"
                      placeholder="999"
                      className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body focus:bg-white focus:border-primary outline-none transition-smooth"
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-caption uppercase tracking-widest font-bold block mb-2">Pieces Available</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={stock}
                      className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body focus:bg-white focus:border-primary outline-none transition-smooth"
                      onChange={(e) => setStock(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-caption uppercase tracking-widest font-bold block mb-2">The Collection Story</label>
                  <textarea
                    required
                    placeholder="Describe the occasion, fit, and aesthetic..."
                    className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body h-32 focus:bg-white focus:border-primary outline-none transition-smooth resize-none"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* SIZE RELIABILITY FRAMEWORK SECTION */}
                <div className="pt-10 border-t border-border space-y-10">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">Size Reliability Framework 📏</span>
                    <h3 className="text-h3 mt-4 font-bold">Standardized Measurements (CM)</h3>
                    <p className="text-[10px] text-muted uppercase tracking-widest mt-2 leading-relaxed font-bold">
                      Mandatory for authenticated status. numeric metrics only.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      { label: "Bust", val: bust, set: setBust },
                      { label: "Waist", val: waist, set: setWaist },
                      { label: "Hips", val: hips, set: setHips },
                      { label: "Length", val: length, set: setLength },
                      { label: "Sleeve", val: sleeve, set: setSleeve }
                    ].map(m => (
                      <div key={m.label}>
                        <label className="text-[9px] uppercase tracking-widest font-bold block mb-2 text-muted">{m.label}</label>
                        <input
                          required={uploadMode === "authentication"}
                          type="number"
                          placeholder="--"
                          value={m.val}
                          className="w-full bg-accent/20 border-none rounded-xl px-4 py-3 text-caption font-bold text-center outline-none focus:ring-1 ring-primary"
                          onChange={(e) => m.set(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="text-caption uppercase tracking-widest font-bold block mb-4">Fit Classification Tag</label>
                    <div className="grid grid-cols-3 gap-2">
                      {FIT_TYPES.map(({ label, value }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFitType(value)}
                          className={`py-3 rounded-lg text-[9px] font-bold uppercase tracking-tighter border transition-smooth ${fitType === value ? 'bg-primary border-primary text-black' : 'border-border text-muted hover:border-primary/40'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                    <div className="space-y-4">
                      <label className="text-caption uppercase tracking-widest font-bold block">Model Reference Context</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <input
                            required={uploadMode === "authentication"}
                            placeholder="Ht (cm)"
                            value={modelHeight}
                            className="w-full bg-accent/20 border-none rounded-xl px-4 py-4 text-[10px] font-bold text-center outline-none"
                            onChange={(e) => setModelHeight(e.target.value)}
                          />
                        </div>
                        <div>
                          <input
                            placeholder="Wt (kg)"
                            value={modelWeight}
                            className="w-full bg-accent/20 border-none rounded-xl px-4 py-4 text-[10px] font-bold text-center outline-none"
                            onChange={(e) => setModelWeight(e.target.value)}
                          />
                        </div>
                        <div>
                          <input
                            required={uploadMode === "authentication"}
                            placeholder="Size Worn"
                            value={modelSize}
                            className="w-full bg-accent/20 border-none rounded-xl px-4 py-4 text-[10px] font-bold text-center outline-none"
                            onChange={(e) => setModelSize(e.target.value)}
                          />
                        </div>
                      </div>
                      <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed">Example: Model is 165cm wearing Size S.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`luxury-button w-full uppercase tracking-[0.2em] font-bold !text-sm ${loading ? 'opacity-50' : ''}`}
            >
              {loading ? "Publishing Transaction..." : "Authenticate & Publish 🛡️"}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
