"use client"

import { useState, useRef, useEffect } from "react"

interface LiveCameraProps {
    onCaptureComplete: (photos: Blob[], video: Blob) => void
    onCancel: () => void
}

const PHOTO_STEPS = [
    { label: "Front View", hint: "Full view from the front" },
    { label: "Back View", hint: "Full view from the back" },
    { label: "Left Side View", hint: "Profile view from the left side" },
    { label: "Right Side View", hint: "Profile view from the right side" },
    { label: "Close Fabric (Texture)", hint: "Hold fabric close to camera to show weave" },
    { label: "Color Reference Frame", hint: "Natural daylight + neutral backdrop for true color" }
]

export default function LiveCamera({ onCaptureComplete, onCancel }: LiveCameraProps) {
    const [step, setStep] = useState(0) // 0-5 photos, 6 video
    const [isCameraActive, setIsCameraActive] = useState(false)
    const [capturedPhotos, setCapturedPhotos] = useState<Blob[]>([])
    const [isRecording, setIsRecording] = useState(false)
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
    const [timeLeft, setTimeLeft] = useState(8)

    const [cameraError, setCameraError] = useState<string | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])

    useEffect(() => {
        startCamera()
        return () => stopCamera()
    }, [])

    const startCamera = async () => {
        setCameraError(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: { exact: "environment" }, 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setIsCameraActive(true)
            }
        } catch (err: any) {
            console.error("Camera access denied", err)
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setCameraError("Camera hardware not found on this device.")
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCameraError("Camera access denied. Please enable it in browser settings.")
            } else {
                setCameraError("Unable to initialize HSTN Secure Camera.")
            }
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
        }
    }

    const capturePhoto = () => {
        if (!videoRef.current) return
        const canvas = document.createElement("canvas")
        
        // HD Fashion Marketplace Quality - 1600px square for premium fashion
        const targetSize = 1600
        canvas.width = targetSize
        canvas.height = targetSize
        
        const ctx = canvas.getContext("2d")
        if (ctx) {
            // Professional fashion photography lighting correction
            ctx.filter = "brightness(1.1) contrast(1.15) saturate(1.05)"
            
            // Calculate center crop from video source
            const sourceSize = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight)
            const offsetX = (videoRef.current.videoWidth - sourceSize) / 2
            const offsetY = (videoRef.current.videoHeight - sourceSize) / 2
            
            // Draw high-quality image
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(
                videoRef.current,
                offsetX, offsetY, sourceSize, sourceSize,  // Source rectangle
                0, 0, targetSize, targetSize              // HD destination
            )
            
            // Convert to WebP for fashion marketplace (75% quality - optimal balance)
            canvas.toBlob((blob) => {
                if (blob) {
                    const newPhotos = [...capturedPhotos, blob]
                    setCapturedPhotos(newPhotos)
                    if (step < 5) {
                        setStep(step + 1)
                    } else {
                        setStep(6) // Move to video
                    }
                }
            }, "image/webp", 0.75)
        }
    }

    const startRecording = () => {
        if (!streamRef.current) return
        chunksRef.current = []
        
        // Check for MIME type support
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
            ? "video/webm;codecs=vp8"
            : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "video/mp4"
        
        try {
            const recorder = new MediaRecorder(streamRef.current, { mimeType })
            mediaRecorderRef.current = recorder

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType })
                setVideoBlob(blob)
                setStep(7) // Complete
            }

            recorder.onerror = (e) => {
                console.error("MediaRecorder error:", e)
                alert("Recording failed. Please try again.")
                setIsRecording(false)
            }

            recorder.start(100) // Collect data every 100ms for better reliability
            setIsRecording(true)
            setTimeLeft(8)

            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer)
                        // Force stop after timeout
                        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                            mediaRecorderRef.current.stop()
                        }
                        setIsRecording(false)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } catch (err) {
            console.error("Failed to start recording:", err)
            alert("Video recording not supported on this device. Please try a different browser.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }

    const handleFinalize = () => {
        if (videoBlob) {
            onCaptureComplete(capturedPhotos, videoBlob)
        }
    }

    if (cameraError) {
        return (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 animate-fade-in text-center">
                <div className="luxury-card max-w-sm p-12 bg-red-500/5 border-red-500/20 space-y-8">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                        <span className="text-3xl">🚫</span>
                    </div>
                    <div>
                        <h2 className="text-h3 font-bold text-white mb-2 uppercase tracking-tighter">Protocol Violation</h2>
                        <p className="text-caption text-red-500/80 leading-relaxed uppercase tracking-widest font-bold">{cameraError}</p>
                    </div>
                    <div className="pt-4 space-y-4">
                        <button
                            onClick={startCamera}
                            className="luxury-button w-full !bg-white !text-black !py-4 !text-[10px]"
                        >
                            Retry Connection
                        </button>
                        <button
                            onClick={onCancel}
                            className="text-[10px] uppercase tracking-widest text-white/40 font-bold hover:text-white transition-smooth"
                        >
                            Exit Protocol
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="relative w-full max-w-lg aspect-[3/4] bg-neutral-900 rounded-[40px] overflow-hidden shadow-2xl border border-white/10">
                {/* Camera Feed */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                />

                {/* Overlays */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
                    <header className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                                {step < 6 ? `Photo ${step + 1} of 6` : step === 6 ? "Video Verification" : "Authenticated"}
                            </span>
                            <h2 className="text-white text-h3 font-bold drop-shadow-lg">
                                {step < 6 ? PHOTO_STEPS[step].label : step === 6 ? "Fabric Motion" : "Capture Complete"}
                            </h2>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white pointer-events-auto hover:bg-white/20 transition-smooth"
                        >
                            ✕
                        </button>
                    </header>

                    {step < 6 && (
                        <div className="text-center space-y-4">
                            <p className="text-white/80 text-caption uppercase tracking-widest font-bold bg-black/40 backdrop-blur-md py-2 px-4 rounded-xl inline-block mx-auto">
                                {PHOTO_STEPS[step].hint}
                            </p>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="text-center space-y-6">
                            {isRecording ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center animate-pulse">
                                        <span className="text-white font-bold text-h2">{timeLeft}s</span>
                                    </div>
                                    <p className="text-red-500 text-caption font-bold uppercase tracking-widest animate-pulse">Recording Fabric Touch...</p>
                                </div>
                            ) : (
                                <p className="text-white/80 text-caption uppercase tracking-widest font-bold bg-black/40 backdrop-blur-md py-2 px-4 rounded-xl">
                                    Include 3s stationary close-up under natural light
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Grid Overlay for Photos */}
                {step < 6 && (
                    <div className="absolute inset-0 border-[0.5px] border-white/20 grid grid-cols-3 grid-rows-4 pointer-events-none">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="border-[0.5px] border-white/10" />
                        ))}
                    </div>
                )}

                {/* Scanning Animation */}
                <div className="absolute inset-x-0 h-0.5 bg-primary/30 top-0 animate-scan pointer-events-none shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />

                {/* Watermark */}
                <div className="absolute bottom-10 right-10 flex flex-col items-end opacity-40 pointer-events-none">
                    <span className="text-[8px] uppercase tracking-[0.4em] text-white font-bold mb-1">Authenticated by</span>
                    <span className="text-caption font-bold text-primary italic tracking-tight">HSTN PROTOCOL</span>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-12 w-full max-w-lg flex flex-col items-center gap-8">
                {step < 6 && (
                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 -m-4 border border-primary/20 rounded-full animate-ping" />
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full bg-white p-1.5 hover:scale-105 active:scale-95 transition-smooth flex items-center justify-center group relative z-10"
                        >
                            <div className="w-full h-full rounded-full border-4 border-foreground/10 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-foreground group-hover:bg-primary transition-smooth" />
                            </div>
                        </button>
                    </div>
                )}

                {step === 6 && !isRecording && (
                    <button
                        onClick={startRecording}
                        className="luxury-button !bg-primary !text-black !py-5 !px-12 !text-sm flex items-center gap-4 group"
                    >
                        <span className="w-3 h-3 bg-black rounded-full animate-pulse group-hover:scale-125 transition-smooth" />
                        Initialize Live Verification
                    </button>
                )}

                {step === 7 && (
                    <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-4">
                            <button
                                onClick={() => { setStep(0); setCapturedPhotos([]); setVideoBlob(null); }}
                                className="px-8 py-4 rounded-full border border-white/30 text-white font-bold uppercase tracking-widest text-[10px]"
                            >
                                Retake All
                            </button>
                            <button
                                onClick={handleFinalize}
                                className="luxury-button !bg-primary !text-black !py-4 !px-10 !text-[10px]"
                            >
                                Authenticate & Save
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-smooth ${i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-2 bg-white/10'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Footer Toast */}
            <div className="mt-auto text-white/40 text-[9px] uppercase tracking-[0.4em] font-bold">
                HSTN Proprietary High-Resolution Capture
            </div>
        </div>
    )
}
