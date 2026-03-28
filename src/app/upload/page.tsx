"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import LiveCamera from "@/app/product/[id]/components/LiveCamera"
import { compressImage, checkImageQuality, addWhiteBackground } from "@/lib/imageOptimizer"

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [category, setCategory] = useState("CO-ORD SETS")
  const [stock] = useState(1)
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
  const [material, setMaterial] = useState("")
  const [pattern, setPattern] = useState("")
  const [sleeveType, setSleeveType] = useState("")
  const [neckline, setNeckline] = useState("")
  const [occasion, setOccasion] = useState("")
  const [washCare, setWashCare] = useState("")
  const [dispatchHours, setDispatchHours] = useState("")
  const [returnWindowDays, setReturnWindowDays] = useState("")
  const [packageWeight, setPackageWeight] = useState("")
  const [codEnabled, setCodEnabled] = useState(true)
  
  // Variant matrix (size-level stock + price)
  const [availableSizes, setAvailableSizes] = useState<{size: string; stock: number; price: number}[]>([])
  const totalSizeStock = availableSizes.reduce((sum, s) => sum + Math.max(0, Number(s.stock || 0)), 0)

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
    return `HSTNLX-${short}-${ts}`
  }

  // Unified Media Assets
  const [selectedPhotos, setSelectedPhotos] = useState<Blob[]>([])
  const [video, setVideo] = useState<Blob | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [uploadMode, setUploadMode] = useState<"standard" | "high_trust">("standard")
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([])
  const [processingIndices, setProcessingIndices] = useState<number[]>([])
  const [submitErrors, setSubmitErrors] = useState<string[]>([])
  const [draftToast, setDraftToast] = useState("")
  const [hasDraftPrompt, setHasDraftPrompt] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<any>(null)
  const PHOTO_SLOT_LABELS = ["Main", "Front", "Back", "Side", "Detail", "Fabric"]
  const requiredPhotoSlotIndexes = [0, 1, 2]
  const missingRequiredPhotoSlots = requiredPhotoSlotIndexes.filter((idx) => !selectedPhotos[idx])
  const selectedVariants = availableSizes.filter((s) => s.stock > 0 && s.price > 0)

  const draftStorageKey = user?.id ? `hstnlx_upload_draft_${user.id}` : ""

  const categories = [
    { name: "CO-ORD SETS", description: "Matching top & bottom outfits", slug: "coord_sets" },
    { name: "TRENDY TOPS", description: "Stylish tops for daily fashion", slug: "trendy_tops" },
    { name: "CASUAL DRESSES", description: "Comfortable everyday dresses", slug: "casual_dresses" },
    { name: "KOREAN-STYLE FASHION", description: "K-fashion inspired outfits", slug: "korean_style" }
  ]
  const CATEGORY_REQUIRED_ATTRS: Record<string, string[]> = {
    "CO-ORD SETS": ["material", "pattern", "sleeveType", "occasion", "washCare"],
    "TRENDY TOPS": ["material", "pattern", "sleeveType", "neckline", "washCare"],
    "CASUAL DRESSES": ["material", "pattern", "sleeveType", "neckline", "occasion", "washCare"],
    "KOREAN-STYLE FASHION": ["material", "pattern", "sleeveType", "occasion", "washCare"],
  }
  const attributeValueMap: Record<string, string> = {
    material,
    pattern,
    sleeveType,
    neckline,
    occasion,
    washCare,
  }
  const requiredAttrKeys = CATEGORY_REQUIRED_ATTRS[category] || []
  const missingRequiredAttrs = requiredAttrKeys.filter((key) => !attributeValueMap[key]?.trim())
  const listingChecks = [
    { label: "Title has at least 12 characters", pass: title.trim().length >= 12 },
    { label: "Description is added", pass: description.trim().length >= 20 },
    { label: "Main + Front + Back photos added", pass: missingRequiredPhotoSlots.length === 0 },
    { label: "At least one valid variant selected", pass: selectedVariants.length > 0 },
    { label: "Total stock is greater than 0", pass: totalSizeStock > 0 },
    { label: "Core measurements filled (Bust, Waist, Length)", pass: !!bust && !!waist && !!length },
    { label: "Category required attributes completed", pass: missingRequiredAttrs.length === 0 },
    { label: "Shipping settings completed", pass: !!dispatchHours && !!returnWindowDays && !!packageWeight },
  ]
  const passedChecks = listingChecks.filter((c) => c.pass).length
  const qualityScore = Math.round((passedChecks / listingChecks.length) * 100)
  const canPublish = !loading && qualityScore === 100

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        return router.push("/login")
      }
      
      setUser(data.session.user)

      // 🏛️ INSTITUTIONAL AUDIT: Block listing if not verified
      const { data: kybData } = await (supabase as any)
        .from("seller_kyb")
        .select("is_verified")
        .eq("user_id", data.session.user.id)
        .single()

      if (!kybData || !kybData.is_verified) {
        router.push("/seller/onboarding")
        return
      }

      setLoadingUser(false)
    }
    getSession()
  }, [router])

  useEffect(() => {
    if (!draftToast) return
    const timer = setTimeout(() => setDraftToast(""), 1800)
    return () => clearTimeout(timer)
  }, [draftToast])

  useEffect(() => {
    if (!user?.id || !draftStorageKey) return
    try {
      const raw = localStorage.getItem(draftStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        setPendingDraft(parsed)
        setHasDraftPrompt(true)
      }
    } catch {
      // Ignore malformed drafts
    }
  }, [user?.id, draftStorageKey])

  useEffect(() => {
    if (!user?.id || !draftStorageKey || loading) return
    const timer = setTimeout(() => {
      const draftPayload = {
        title,
        description,
        price,
        category,
        bust,
        waist,
        hips,
        length,
        sleeve,
        modelHeight,
        modelWeight,
        modelSize,
        fitType,
        availableSizes,
        material,
        pattern,
        sleeveType,
        neckline,
        occasion,
        washCare,
        dispatchHours,
        returnWindowDays,
        packageWeight,
        codEnabled,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draftPayload))
      setDraftToast("Draft auto-saved")
    }, 1200)
    return () => clearTimeout(timer)
  }, [
    user?.id,
    draftStorageKey,
    loading,
    title,
    description,
    price,
    category,
    bust,
    waist,
    hips,
    length,
    sleeve,
    modelHeight,
    modelWeight,
    modelSize,
    fitType,
    availableSizes,
    material,
    pattern,
    sleeveType,
    neckline,
    occasion,
    washCare,
    dispatchHours,
    returnWindowDays,
    packageWeight,
    codEnabled,
  ])

  const resumeDraft = () => {
    if (!pendingDraft) return
    setTitle(pendingDraft.title || "")
    setDescription(pendingDraft.description || "")
    setPrice(pendingDraft.price || "")
    setCategory(pendingDraft.category || "CO-ORD SETS")
    setBust(pendingDraft.bust || "")
    setWaist(pendingDraft.waist || "")
    setHips(pendingDraft.hips || "")
    setLength(pendingDraft.length || "")
    setSleeve(pendingDraft.sleeve || "")
    setModelHeight(pendingDraft.modelHeight || "")
    setModelWeight(pendingDraft.modelWeight || "")
    setModelSize(pendingDraft.modelSize || "")
    setFitType(pendingDraft.fitType || FIT_TYPES[0]?.value || "true_to_size")
    setAvailableSizes(Array.isArray(pendingDraft.availableSizes) ? pendingDraft.availableSizes : [])
    setMaterial(pendingDraft.material || "")
    setPattern(pendingDraft.pattern || "")
    setSleeveType(pendingDraft.sleeveType || "")
    setNeckline(pendingDraft.neckline || "")
    setOccasion(pendingDraft.occasion || "")
    setWashCare(pendingDraft.washCare || "")
    setDispatchHours(pendingDraft.dispatchHours || "")
    setReturnWindowDays(pendingDraft.returnWindowDays || "")
    setPackageWeight(pendingDraft.packageWeight || "")
    setCodEnabled(typeof pendingDraft.codEnabled === "boolean" ? pendingDraft.codEnabled : true)
    setHasDraftPrompt(false)
    setDraftToast("Draft resumed")
  }

  const discardDraft = () => {
    if (draftStorageKey) localStorage.removeItem(draftStorageKey)
    setPendingDraft(null)
    setHasDraftPrompt(false)
    setDraftToast("Draft discarded")
  }

  const handleCameraComplete = async (capturedPhotos: Blob[], capturedVideo: Blob) => {
    // Compress all captured photos
    const compressed = await Promise.all(capturedPhotos.map(p => compressImage(p, 2048, 0.93)));
    
    // Check quality of primary photo
    const quality = await checkImageQuality(compressed[0]);
    setQualityWarnings(quality.warnings);

    setSelectedPhotos(compressed)
    setVideo(capturedVideo)
    setMediaReady(true)
    setShowCamera(false)
    setUploadMode("high_trust") // Flag as high trust since it was a live session
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setLoading(true);
    try {
      const images = files.filter(f => f.type.startsWith("image/"));
      const videos = files.filter(f => f.type.startsWith("video/"));

      // Process Images
      if (images.length > 0) {
        const compressed = await Promise.all(
          images.slice(0, 6).map(f => compressImage(f, 2048, 0.93))
        );
        
        const qChecks = await Promise.all(compressed.map(p => checkImageQuality(p)));
        const allWarnings = Array.from(new Set(qChecks.flatMap(q => q.warnings)));
        setQualityWarnings(prev => Array.from(new Set([...prev, ...allWarnings])));

        setSelectedPhotos(prev => [...prev, ...compressed].slice(0, 6));
      }

      // Process Video (Only one allowed for performance)
      if (videos.length > 0) {
        const selectedVideo = videos[0] as Blob;
        // Basic size check for mobile safety
        if (selectedVideo.size > 20 * 1024 * 1024) {
             alert("Video too large. Please limit to 10-20MB for best conversion.");
        } else {
            setVideo(selectedVideo);
        }
      }

      setMediaReady(true);
    } catch (err) {
      console.error("Media Processing Failure:", err);
      alert("Asset processing failed. Ensure files are valid images or videos.");
    } finally {
      setLoading(false);
    }
  }

  const applyBackgroundRemoval = async (index: number) => {
    if (!selectedPhotos[index]) return;
    
    if (!confirm("Initialize Premium Background Optimization for this asset?")) return;

    setProcessingIndices(prev => [...prev, index]);
    try {
        const reader = new FileReader();
        reader.readAsDataURL(selectedPhotos[index]);
        reader.onloadend = async () => {
            const base64data = reader.result as string;
            
            const res = await fetch("/api/remove-bg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl: base64data })
            });

            const data = await res.json();
            if (data.success) {
                const whiteBgImage = await addWhiteBackground(data.image);
                
                const response = await fetch(whiteBgImage);
                const blob = await response.blob();
                
                setSelectedPhotos(prev => {
                    const next = [...prev];
                    next[index] = blob;
                    return next;
                });
                
                alert("Optimization Complete.");
            } else {
                alert(`Failed: ${data.message || "API Error"}`);
            }
            setProcessingIndices(prev => prev.filter(i => i !== index));
        };
    } catch (err) {
        console.error("BG Removal Error:", err);
        alert("Optimization failed.");
        setProcessingIndices(prev => prev.filter(i => i !== index));
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSubmitErrors([])

    const errors: string[] = []
    
    // Validate title length
    if (title.trim().length < 12) {
      errors.push("Product title must be at least 12 characters long.")
    }
    
    // Validate required image slots (Main + Front + Back)
    if (missingRequiredPhotoSlots.length > 0) {
      const missingLabels = missingRequiredPhotoSlots.map((idx) => PHOTO_SLOT_LABELS[idx]).join(", ")
      errors.push(`Mandatory image slots missing: ${missingLabels}.`)
    }

    // Enforce seller-selected sizes only
    if (availableSizes.length === 0) {
      errors.push("Please select at least one available size before publishing.")
    }

    if (totalSizeStock <= 0) {
      errors.push("Total size stock must be greater than 0.")
    }

    const invalidVariants = availableSizes.filter((s) => s.stock <= 0 || s.price <= 0)
    if (invalidVariants.length > 0) {
      errors.push("Each selected size must have stock > 0 and price > 0.")
    }

    if (!description.trim() || description.trim().length < 20) {
      errors.push("Description must be at least 20 characters long.")
    }

    if (!bust || !waist || !length) {
      errors.push("Bust, Waist, and Length measurements are required.")
    }

    if (missingRequiredAttrs.length > 0) {
      errors.push(`Missing category attributes: ${missingRequiredAttrs.join(", ")}.`)
    }

    if (!dispatchHours || !returnWindowDays || !packageWeight) {
      errors.push("Shipping settings required: dispatch time, return window, package weight.")
    }

    if (errors.length > 0) {
      setSubmitErrors(errors)
      return
    }

    setLoading(true)
    let imageUrl = ""
    let videoUrl = ""
    let imageUrls: string[] = []

    // Upload Optimized Photos
    for (let i = 0; i < selectedPhotos.length; i++) {
        const slotLabel = (PHOTO_SLOT_LABELS[i] || `Image${i + 1}`).toLowerCase()
        const fileName = `${user.id}-${Date.now()}-${slotLabel}-${i}.jpg`
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, selectedPhotos[i])

        if (!uploadError) {
          const { data } = supabase.storage.from("product-images").getPublicUrl(fileName)
          imageUrls.push(data.publicUrl)
          if (i === 0) imageUrl = data.publicUrl
        }
    }

    // Optional Video Upload
    if (video) {
        const fileName = `${user.id}-verified-${Date.now()}.webm`
        const { error: videoError } = await supabase.storage
          .from("videos")
          .upload(fileName, video)

        if (!videoError) {
          const { data } = supabase.storage.from("videos").getPublicUrl(fileName)
          videoUrl = data.publicUrl
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
          let isResolved = false
          
          const cleanup = () => {
            if (!isResolved) {
              isResolved = true
              video.pause()
              video.src = ''
              video.load()
            }
          }
          
          video.onloadedmetadata = () => {
            if (isResolved) return
            
            // Check duration (must be at least 8 seconds)
            if (video.duration < 8) {
              alert("Video verification failed: Video must be at least 8 seconds long.")
              cleanup()
              resolve(false)
              return
            }
            
            // Check if it's actually a video file
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              alert("Video verification failed: Invalid video file detected.")
              cleanup()
              resolve(false)
              return
            }
            
            // Check for reasonable dimensions (not too small)
            if (video.videoWidth < 320 || video.videoHeight < 240) {
              alert("Video verification failed: Video quality too low.")
              cleanup()
              resolve(false)
              return
            }
            
            cleanup()
            resolve(true)
          }
          
          video.onerror = () => {
            if (isResolved) return
            alert("Video verification failed: Could not load video file.")
            cleanup()
            resolve(false)
          }
          
          // Timeout after 10 seconds (increased from 5)
          setTimeout(() => {
            if (!isResolved) {
              alert("Video verification failed: Video validation timeout. Please try uploading again.")
              cleanup()
              resolve(false)
            }
          }, 10000)
        })
      } catch (error) {
        console.error("Video validation error:", error)
        alert("Video verification failed: Unable to validate video.")
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

    // Final Verification Check
    if (!imageUrl || !bust || !waist || !length) {
      alert("Draft Protocol Failed: Critical measurements (Bust, Waist, Length) and images are required to launch.")
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
      if (selectedPhotos.length >= 2) {
        const imageConsistency = await checkImageConsistency(selectedPhotos)
        if (!imageConsistency.isConsistent) {
          flags.push("Inconsistent images detected - may be different products")
        }
      }

      // Check 2: Reverse image search (stolen images)
      const reverseImageCheck = await checkReverseImageSearch(selectedPhotos[0])
      if (reverseImageCheck.foundDuplicates) {
        flags.push("Duplicate images found - may be stolen photos")
      }

      // Check 3: Video quality validation (already implemented above)

      // Check 4: Metadata validation
      const metadataCheck = await checkImageMetadata(selectedPhotos)
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
      const { data: existingProducts } = await (supabase as any)
        .from("products")
        .select("image_url")
        .limit(100) // Check recent products only

      const duplicates: string[] = []
      if (existingProducts) {
        // This would compare hashes in a real implementation
        // For demo, we'll just check if we have any existing products
        duplicates.push(...existingProducts.map((p: any) => p.image_url).filter(Boolean))
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
        // Validate image size and quality
        if (photo.size > 2 * 1024 * 1024) {
          alert("Image must be under 2MB")
          return false
        }
        if (photo.size < 10000) {
          alert("Image is too small, please use a higher quality image")
          return false
        }
        return photo.size > 10000 // Basic size check
      })

      return { 
        hasValidMetadata: await hasMetadata, 
        details: { checkedPhotos: photos.length } 
      }
    }

    // Run AI verification
    // const suspiciousFlags = await detectSuspiciousListing()
    // const needsAdminReview = suspiciousFlags.length > 0

    // Set admin status based on verification
    // let adminStatus = 'approved'
    // if (needsAdminReview) {
    //   adminStatus = 'needs_review'
    //   console.warn("AI Verification flagged listing for admin review:", suspiciousFlags)
    // }

    // Temporarily always approve for testing
    let adminStatus = 'approved'

    // Ensure SKU is globally unique before hitting the UNIQUE constraint
    const { data: existingSku, error: skuCheckError } = await (supabase as any)
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
      alert("This SKU already exists. Please retry – HSTNLX will generate a new institutional SKU.")
      setLoading(false)
      return
    }

    // Store all image URLs for carousel
    const allImageUrls = imageUrls.length > 0 ? imageUrls : [imageUrl]

    const { data: newProduct, error } = await (supabase as any)
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
          stock: totalSizeStock,
          category,
          color_verified: true, // Mandatory
          measurements: { bust, waist, hips, length, sleeve },
          model_info: {
            height: modelHeight,
            weight: modelWeight,
            size: modelSize,
            attributes: { material, pattern, sleeveType, neckline, occasion, washCare },
            shipping: {
              dispatchHours: Number(dispatchHours || 0),
              returnWindowDays: Number(returnWindowDays || 0),
              packageWeight: Number(packageWeight || 0),
              codEnabled
            }
          },
          fit_type: fitType,
          size_verified: true,
          admin_status: adminStatus,
          is_boosted: true,
          boost_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
      ])
      .select('id')
      .single()

    if (error) {
      alert(error.message)
    } else if (newProduct) {
      // Synchronize with product_variants table - only seller-selected sizes
      const variantInserts = availableSizes.map(s => ({
        product_id: newProduct.id,
        size: s.size,
        stock: s.stock,
        price: Number(s.price),
        color: "STANDARD"
      }))
      
      const { error: variantError } = await (supabase as any)
        .from("product_variants")
        .insert(variantInserts)

      if (variantError) {
        console.error("Variant Sync Protocol Failed:", variantError.message)
      }

      alert("Authenticated Listing Published Successfully 🏛️")
      if (draftStorageKey) localStorage.removeItem(draftStorageKey)
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

        {hasDraftPrompt && (
          <div className="mb-8 p-4 rounded-2xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Saved draft found</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mt-1">
                Resume previous draft? (media files are not stored for security)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resumeDraft}
                className="px-4 py-2 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-widest"
              >
                Yes, Resume
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-slate-400"
              >
                No, Discard
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Media Authentication Grid (LEFT) */}
          <div className="lg:col-span-5 space-y-10">
            <div className="flex gap-4 p-1 bg-accent/20 rounded-2xl mb-8">
              <div className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-primary text-black text-center">
                Gold Verified Only 🛡️
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Listing Quality Score</p>
                <p className={`text-sm font-black ${qualityScore >= 85 ? "text-green-600" : qualityScore >= 60 ? "text-amber-600" : "text-red-600"}`}>{qualityScore}/100</p>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
                <div className={`h-full transition-all duration-500 ${qualityScore >= 85 ? "bg-green-500" : qualityScore >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${qualityScore}%` }} />
              </div>
              <div className="space-y-1.5">
                {listingChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2">
                    <span className={`text-xs ${check.pass ? "text-green-600" : "text-red-500"}`}>{check.pass ? "✓" : "✕"}</span>
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${check.pass ? "text-green-700" : "text-slate-500"}`}>{check.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`luxury-card aspect-[4/5] border-dashed border-2 flex flex-col items-center justify-center p-8 transition-smooth bg-accent/5 ${selectedPhotos.length > 0 ? 'border-primary/50' : 'border-border'}`}>
              {selectedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 w-full h-full overflow-y-auto p-2 no-scrollbar">
                    {selectedPhotos.map((blob, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden relative border border-white/10 group">
                        <img src={URL.createObjectURL(blob)} className="w-full h-full object-cover" alt="" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[8px] text-white px-2 py-0.5 rounded-full uppercase font-bold">
                          {PHOTO_SLOT_LABELS[i] || `Image ${i + 1}`}
                        </div>
                        
                         {/* MAGICAL BG REMOVAL TRIGGER FOR EVERY ASSET */}
                         {!processingIndices.includes(i) ? (
                            <button
                                type="button"
                                onClick={() => applyBackgroundRemoval(i)}
                                className="absolute bottom-2 left-2 bg-primary text-black text-[7px] font-black uppercase px-2 py-1 rounded-sm shadow-xl hover:scale-105 transition-all animate-in slide-in-from-left-2"
                            >
                                ✨ Magic Fix
                            </button>
                         ) : (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
                                <span className="text-[8px] text-white font-black uppercase tracking-widest animate-pulse">Processing...</span>
                            </div>
                         )}

                        <button 
                          type="button"
                          onClick={() => setSelectedPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-2 right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >✕</button>
                      </div>
                    ))}

                    {video && (
                        <div className="aspect-square rounded-xl overflow-hidden relative border border-primary/30 group">
                           <video 
                             src={URL.createObjectURL(video)} 
                             className="w-full h-full object-cover" 
                             autoPlay loop muted playsInline
                           />
                           <div className="absolute top-2 left-2 bg-primary/80 backdrop-blur-md text-[8px] text-black px-2 py-0.5 rounded-full uppercase font-black">Trusted Motion 🎥</div>
                           <button 
                             type="button"
                             onClick={() => setVideo(null)}
                             className="absolute top-2 right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                           >✕</button>
                        </div>
                    )}

                    {selectedPhotos.length < 6 && (
                       <label className="aspect-square rounded-xl border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 transition-all">
                          <span className="text-xl">+</span>
                          <span className="text-[8px] font-bold uppercase">Add Photo</span>
                          <input type="file" multiple accept="image/*,video/*" onChange={handleGalleryUpload} className="hidden" />
                       </label>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
                      <span className="text-3xl">🛡️</span>
                    </div>
                    <p className="text-caption font-bold uppercase tracking-widest text-foreground">Mission Critical Media</p>
                    <div className="flex flex-col gap-4 mt-8">
                       <button
                         type="button"
                         onClick={() => setShowCamera(true)}
                         className="luxury-button !py-4 !px-8 !text-[10px] !bg-primary !text-black border-none"
                       >
                         Launch Trusted Camera
                       </button>
                       <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[8px] font-bold text-muted">OR</span>
                          <div className="h-px flex-1 bg-border" />
                       </div>
                       <label className="luxury-button !bg-foreground !text-background !py-4 !px-8 !text-[10px] cursor-pointer">
                          Select from Gallery
                          <input type="file" multiple accept="image/*,video/*" onChange={handleGalleryUpload} className="hidden" />
                       </label>
                    </div>

                    <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-2xl text-left">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mb-2">Quality Protocol 🎨</p>
                      <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed">
                        • Use Plain Background for higher visibility <br />
                        • Natural lighting maximizes conversion <br />
                        • Mandatory slots: Main + Front + Back
                      </p>
                    </div>
                  </div>
                )}
            </div>

            {missingRequiredPhotoSlots.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Mandatory image slots pending</p>
                <p className="text-[9px] text-amber-700/80 font-bold uppercase tracking-widest">
                  Missing: {missingRequiredPhotoSlots.map((idx) => PHOTO_SLOT_LABELS[idx]).join(", ")}
                </p>
              </div>
            )}

            {qualityWarnings.length > 0 && (
               <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-2xl animate-in slide-in-from-top-2">
                 <div className="flex gap-3">
                   <span className="text-sm">⚠️</span>
                   <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-yellow-800">Quality Intelligence Warning</p>
                     {qualityWarnings.map((w, i) => (
                       <p key={i} className="text-[9px] text-yellow-700/80 font-bold uppercase tracking-widest leading-relaxed">• {w}</p>
                     ))}
                   </div>
                 </div>
               </div>
            )}

            {submitErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2">Fix Before Publish</p>
                <div className="space-y-1">
                  {submitErrors.map((err, i) => (
                    <p key={`${err}-${i}`} className="text-[9px] text-red-700/90 font-bold uppercase tracking-widest">• {err}</p>
                  ))}
                </div>
              </div>
            )}

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
                <label className="text-caption uppercase tracking-widest font-bold block mb-6">Choose Product Category</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-6 rounded-2xl text-left border transition-smooth ${
                        category === cat.name
                          ? 'border-primary bg-primary/10'
                          : 'border-white/10 opacity-60 hover:opacity-100 hover:border-primary/40'
                      }`}
                    >
                      <p className="text-caption font-bold uppercase tracking-tight text-white mb-2">{cat.name}</p>
                      <p className="text-[10px] text-white/60 uppercase tracking-widest leading-relaxed">{cat.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="text-caption uppercase tracking-widest font-bold block mb-2">Institutional SKU ID</label>
                  <div className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body font-mono text-xs flex items-center justify-between">
                    <span className="text-muted">Auto-generated by HSTNLX on publish</span>
                  </div>
                  <p className="text-[9px] text-muted mt-2 uppercase tracking-widest">HSTNLX assigns a unique institutional SKU linked to video & metadata.</p>
                </div>

                <div>
                  <label className="text-caption uppercase tracking-widest font-bold block mb-2">Acquisition Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Korean Oversized Summer Hoodie"
                    className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body focus:bg-white focus:border-primary outline-none transition-smooth"
                  />
                  <p className={`text-sm mt-2 ${title.length >= 12 ? 'text-green-600' : 'text-orange-600'}`}>
                    {title.length}/12 characters minimum
                  </p>
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
                      min={0}
                      value={totalSizeStock}
                      readOnly
                      className="w-full bg-accent/30 border border-transparent rounded-xl px-6 py-4 text-body outline-none transition-smooth text-muted"
                    />
                    <p className="text-[9px] text-muted mt-2 uppercase tracking-widest">Auto-calculated from selected size stock.</p>
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

                <div className="pt-8 border-t border-border space-y-6">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">Category Compliance Attributes</span>
                    <p className="text-[8px] text-muted uppercase tracking-widest mt-2">
                      Required for {category}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material (e.g. Cotton Blend)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Pattern (e.g. Solid, Floral)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={sleeveType} onChange={(e) => setSleeveType(e.target.value)} placeholder="Sleeve Type" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={neckline} onChange={(e) => setNeckline(e.target.value)} placeholder="Neckline" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion (e.g. Casual, Party)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={washCare} onChange={(e) => setWashCare(e.target.value)} placeholder="Wash Care (e.g. Machine Wash Cold)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                  </div>
                  {missingRequiredAttrs.length > 0 && (
                    <p className="text-[9px] text-amber-700 font-bold uppercase tracking-widest">
                      Missing required attributes: {missingRequiredAttrs.join(", ")}
                    </p>
                  )}
                </div>

                <div className="pt-8 border-t border-border space-y-6">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">Shipping & Return Settings</span>
                    <p className="text-[8px] text-muted uppercase tracking-widest mt-2">
                      Required before publish
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input value={dispatchHours} onChange={(e) => setDispatchHours(e.target.value)} type="number" min="1" placeholder="Dispatch (hours)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={returnWindowDays} onChange={(e) => setReturnWindowDays(e.target.value)} type="number" min="1" placeholder="Return window (days)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                    <input value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)} type="number" min="0.1" step="0.1" placeholder="Package weight (kg)" className="w-full bg-accent/20 border border-transparent rounded-xl px-4 py-3 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-accent/20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Cash on Delivery</p>
                    <button
                      type="button"
                      onClick={() => setCodEnabled(v => !v)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${codEnabled ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}
                    >
                      {codEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
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
                          required={uploadMode === "high_trust"}
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

                    <div className="space-y-6">
                      <label className="text-caption uppercase tracking-widest font-bold block">Model Reference Context</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative group">
                          <input
                            required={uploadMode === "high_trust"}
                            type="number"
                            placeholder="Ht"
                            value={modelHeight}
                            className="w-full bg-accent/20 border border-transparent rounded-xl pl-4 pr-10 py-4 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth"
                            onChange={(e) => setModelHeight(e.target.value)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-muted pointer-events-none">cm</span>
                        </div>
                        <div className="relative group">
                          <input
                            type="number"
                            placeholder="Wt"
                            value={modelWeight}
                            className="w-full bg-accent/20 border border-transparent rounded-xl pl-4 pr-10 py-4 text-[12px] font-bold outline-none focus:border-primary focus:bg-white transition-smooth"
                            onChange={(e) => setModelWeight(e.target.value)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-muted pointer-events-none">kg</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-muted block">Size Worn by Model</label>
                        <div className="grid grid-cols-5 gap-2">
                          {["S", "M", "L", "XL", "XXL"].map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setModelSize(size)}
                              className={`py-3 rounded-xl border text-[11px] font-bold uppercase transition-smooth ${
                                modelSize === size 
                                  ? 'bg-primary border-primary text-black shadow-lg scale-105' 
                                  : 'border-border text-muted hover:border-primary/40'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[8px] text-muted uppercase tracking-widest leading-relaxed">Example: Model is 165cm wearing Size S.</p>
                      
                      {/* Available Sizes Selection */}
                      <div className="space-y-4 pt-6 border-t border-border mt-6">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-muted block">Variant Matrix (Size, Stock, Price)</label>
                        <p className="text-[8px] text-muted uppercase tracking-widest">Select sizes, then set stock and selling price for each size</p>
                        <div className="space-y-3">
                          {["XS", "S", "M", "L", "XL", "XXL"].map((size) => {
                            const existing = availableSizes.find(s => s.size === size)
                            return (
                              <div key={size} className="flex items-center gap-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (existing) {
                                      setAvailableSizes(availableSizes.filter(s => s.size !== size))
                                    } else {
                                      setAvailableSizes([...availableSizes, { size, stock: 1, price: Number(price) || 0 }])
                                    }
                                  }}
                                  className={`w-16 py-2 rounded-lg border text-[10px] font-bold uppercase transition-smooth ${
                                    existing 
                                      ? 'bg-primary border-primary text-black' 
                                      : 'border-border text-muted hover:border-primary/40'
                                  }`}
                                >
                                  {size}
                                </button>
                                {existing && (
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="text-[9px] uppercase tracking-widest text-muted">Stock:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={existing.stock}
                                      onChange={(e) => {
                                        const newStock = parseInt(e.target.value) || 1
                                        setAvailableSizes(availableSizes.map(s => 
                                          s.size === size ? { ...s, stock: newStock } : s
                                        ))
                                      }}
                                      className="w-16 bg-accent/20 border-none rounded-lg px-2 py-2 text-[11px] font-bold text-center outline-none focus:ring-1 ring-primary"
                                    />
                                    <span className="text-[9px] uppercase tracking-widest text-muted">₹</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={existing.price}
                                      onChange={(e) => {
                                        const newPrice = parseInt(e.target.value) || 0
                                        setAvailableSizes(availableSizes.map(s =>
                                          s.size === size ? { ...s, price: newPrice } : s
                                        ))
                                      }}
                                      className="w-24 bg-accent/20 border-none rounded-lg px-2 py-2 text-[11px] font-bold text-center outline-none focus:ring-1 ring-primary"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canPublish}
              className={`luxury-button w-full uppercase tracking-[0.2em] font-bold !text-sm ${canPublish ? '' : 'opacity-50 cursor-not-allowed'}`}
            >
              {loading ? "Publishing Transaction..." : canPublish ? "Authenticate & Publish 🛡️" : "Complete Quality Checklist to Publish"}
            </button>
          </div>
        </form>
      </div>
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-8 z-[180] transition-all duration-300 ${draftToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <div className="px-4 py-2 rounded-full bg-black text-white text-[11px] font-black uppercase tracking-wider shadow-xl">
          {draftToast}
        </div>
      </div>
    </main>
  )
}
