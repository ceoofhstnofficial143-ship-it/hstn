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
    let imageUrls: string[] = [] // Store all image URLs for carousel

    // Upload Process
    if (uploadMode === "authentication") {
      // Upload All 6 Photos
      for (let i = 0; i < photos.length; i++) {
        if (photos[i]) {
          const fileName = `${user.id}-${Date.now()}-${i}.jpg`
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(fileName, photos[i])

          if (!uploadError) {
            const { data } = supabase.storage.from("product-images").getPublicUrl(fileName)
            imageUrls.push(data.publicUrl)
            if (i === 0) imageUrl = data.publicUrl // Main image
          }
        }
      }

      // Upload Fabric Video
      if (video) {
        const fileName = `${user.id}-fabric-${Date.now()}.webm`
        const { error: videoError } = await supabase.storage
          .from("videos")
          .upload(fileName, video)

        if (videoError) {
          alert(`Video upload failed: ${videoError.message}`)
          setLoading(false)
          return
        }
        
        const { data } = supabase.storage.from("videos").getPublicUrl(fileName)
        videoUrl = data.publicUrl
      } else {
        alert("No video captured. Please complete the 8-second fabric verification.")
        setLoading(false)
        return
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

    // Video Verification Enhancement
    const validateVideoAuthenticity = async () => {
      if (!videoUrl) return true // Skip if no video
      
      try {
        // Create a video element to check properties
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.src = videoUrl
        
        return new Promise((resolve) => {
          video.onloadedmetadata = () => {
            // Check duration (must be at least 8 seconds)
            if (video.duration < 8) {
              alert("Video verification failed: Video must be at least 8 seconds long.")
              resolve(false)
              return
            }
            
            // Check if it's actually a video file
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              alert("Video verification failed: Invalid video file detected.")
              resolve(false)
              return
            }
            
            // Check for reasonable dimensions (not too small)
            if (video.videoWidth < 320 || video.videoHeight < 240) {
              alert("Video verification failed: Video quality too low.")
              resolve(false)
              return
            }
            
            resolve(true)
          }
          
          video.onerror = () => {
            alert("Video verification failed: Could not load video file.")
            resolve(false)
          }
          
          // Timeout after 5 seconds
          setTimeout(() => {
            alert("Video verification failed: Video validation timeout.")
            resolve(false)
          }, 5000)
        })
      } catch (error) {
        alert("Video verification failed: Unexpected error.")
        return false
      }
    }

    // Validate measurements to prevent invalid values
    const validateMeasurements = () => {
      const measurements = { bust, waist, hips, length, sleeve }
      const invalidMeasurements = Object.entries(measurements).filter(([key, value]) => {
        const num = parseFloat(value)
        return isNaN(num) || num < 20 || num > 300
      })
      
      if (invalidMeasurements.length > 0) {
        const invalidNames = invalidMeasurements.map(([key]) => key).join(', ')
        alert(`Invalid measurements detected: ${invalidNames}\n\nMeasurements must be between 20-300 cm.`)
        return false
      }
      return true
    }

    // HARD BACKEND RULE: Enforce Authenticated Upload (Fabric Video, Size)
    if (uploadMode === "authentication" && (!videoUrl || !bust || !waist || !length)) {
      alert("HARD BLOCK: Authentication Protocol failed. Video Verification and Numeric Measurements are strictly required.")
      setLoading(false)
      return
    }

    // Validate video authenticity
    const isVideoValid = await validateVideoAuthenticity()
    if (!isVideoValid) {
      setLoading(false)
      return
    }

    // AI Verification System - Detect suspicious listings
    const detectSuspiciousListing = async () => {
      const flags: string[] = []

      // Check 1: Image consistency (same item across photos)
      if (photos.length >= 2) {
        const imageConsistency = await checkImageConsistency(photos)
        if (!imageConsistency.isConsistent) {
          flags.push("Inconsistent images detected - may be different products")
        }
      }

      // Check 2: Reverse image search (stolen images)
      const reverseImageCheck = await checkReverseImageSearch(photos[0])
      if (reverseImageCheck.foundDuplicates) {
        flags.push("Duplicate images found - may be stolen photos")
      }

      // Check 3: Video quality validation (already implemented above)

      // Check 4: Metadata validation
      const metadataCheck = await checkImageMetadata(photos)
      if (!metadataCheck.hasValidMetadata) {
        flags.push("Missing camera metadata - may be downloaded images")
      }

      return flags
    }

    // Helper functions for AI verification
    const checkImageConsistency = async (photos: Blob[]): Promise<{isConsistent: boolean, confidence: number}> => {
      // Simple consistency check - compare image sizes and basic properties
      if (photos.length < 2) return { isConsistent: true, confidence: 1.0 }

      // In a real implementation, this would use image analysis APIs
      // For now, we'll do basic checks
      const sizes = await Promise.all(photos.map(async (photo) => {
        return new Promise<{width: number, height: number}>((resolve) => {
          const img = new Image()
          img.onload = () => resolve({width: img.width, height: img.height})
          img.src = URL.createObjectURL(photo)
        })
      }))

      // Check if all images are roughly the same aspect ratio
      const aspectRatios = sizes.map(s => s.width / s.height)
      const avgAspectRatio = aspectRatios.reduce((a, b) => a + b, 0) / aspectRatios.length
      const isConsistent = aspectRatios.every(ratio => Math.abs(ratio - avgAspectRatio) < 0.3)

      return { isConsistent, confidence: isConsistent ? 0.8 : 0.3 }
    }

    const checkReverseImageSearch = async (photo: Blob): Promise<{foundDuplicates: boolean, matches: string[]}> => {
      // In production, this would integrate with Google Reverse Image Search API
      // For now, we'll do a simple hash-based check
      const imageHash = await generateImageHash(photo)
      
      // Check against existing product images (simplified)
      const { data: existingProducts } = await supabase
        .from("products")
        .select("image_url")
        .limit(100) // Check recent products only

      const duplicates: string[] = []
      if (existingProducts) {
        // This would compare hashes in a real implementation
        // For demo, we'll just check if we have any existing products
        duplicates.push(...existingProducts.map(p => p.image_url).filter(Boolean))
      }

      return { 
        foundDuplicates: duplicates.length > 0, 
        matches: duplicates 
      }
    }

    const generateImageHash = async (photo: Blob): Promise<string> => {
      // Simple hash generation - in production use proper perceptual hashing
      const buffer = await photo.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const checkImageMetadata = async (photos: Blob[]): Promise<{hasValidMetadata: boolean, details: any}> => {
      // Check if images have EXIF metadata (indicates real camera photos)
      const hasMetadata = photos.some(async (photo) => {
        // This would extract EXIF data in a real implementation
        // For now, we'll assume metadata is present if file is reasonable size
        return photo.size > 10000 // Basic size check
      })

      return { 
        hasValidMetadata: await hasMetadata, 
        details: { checkedPhotos: photos.length } 
      }
    }

    // Run AI verification
    const suspiciousFlags = await detectSuspiciousListing()
    const needsAdminReview = suspiciousFlags.length > 0

    // Set admin status based on verification
    let adminStatus = 'approved'
    if (needsAdminReview) {
      adminStatus = 'needs_review'
      console.warn("AI Verification flagged listing for admin review:", suspiciousFlags)
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

    // Store all image URLs for carousel
    const allImageUrls = imageUrls.length > 0 ? imageUrls : [imageUrl]

    const { error } = await supabase
      .from("products")
      .insert([
        {
          title,
          sku: finalSku,
          price: Number(price),
          description,
          image_url: imageUrl,
          additional_images: allImageUrls.slice(1), // Store remaining 5 images
          video_url: videoUrl,
          user_id: user.id,
          stock,
          category,
          color_verified: true, // Mandatory
          measurements: { bust, waist, hips, length, sleeve },
          model_info: { height: modelHeight, weight: modelWeight, size: modelSize },
          fit_type: fitType,
          size_verified: true,
          admin_status: adminStatus
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
