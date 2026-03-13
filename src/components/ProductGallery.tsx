"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

/**
 * Amazon‑level Product Gallery
 * Optimized for:
 * - large marketplaces
 * - mobile swipe
 * - lazy loading
 * - minimal re‑renders
 * - safe backend data
 */

type Props = {
  images?: string[] | null | undefined;
  title?: string;
};

export default function ProductGallery({ images, title = "Product" }: Props) {
  /**
   * Sanitize incoming images (API safe)
   */
  const safeImages = useMemo(() => {
    if (!Array.isArray(images)) return [];

    const filtered = images.filter(
      (img) => typeof img === "string" && img.trim().length > 0
    );

    return Array.from(new Set(filtered));
  }, [images]);

  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const startX = useRef(0);
  const endX = useRef(0);

  /**
   * Keep index safe
   */
  useEffect(() => {
    if (safeImages.length === 0) return;
    if (index >= safeImages.length) setIndex(0);
  }, [safeImages, index]);

  /**
   * Navigation functions
   */
  const next = useCallback(() => {
    setIndex((i) => (i === safeImages.length - 1 ? 0 : i + 1));
  }, [safeImages.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? safeImages.length - 1 : i - 1));
  }, [safeImages.length]);

  /**
   * Mobile swipe support
   */
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    endX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    const distance = startX.current - endX.current;

    if (distance > 60) next();
    if (distance < -60) prev();
  };

  /**
   * Keyboard navigation (zoom mode)
   */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!zoomOpen) return;

      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") setZoomOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomOpen, next, prev]);

  /**
   * Preload next image for instant navigation
   */
  useEffect(() => {
    const nextIndex = index + 1;

    if (safeImages[nextIndex]) {
      const img = new Image();
      img.src = safeImages[nextIndex];
    }
  }, [index, safeImages]);

  /**
   * Empty state
   */
  if (safeImages.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-sm">
        No images available
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[90px_1fr] gap-4">
      {/* Thumbnails */}
      <div className="hidden md:flex flex-col gap-2">
        {safeImages.map((img, i) => (
          <button
            key={img + i}
            onMouseEnter={() => setIndex(i)}
            onClick={() => setIndex(i)}
            className={`aspect-square border rounded-lg overflow-hidden transition ${
              i === index
                ? "border-black"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <img
              src={img}
              loading="lazy"
              className="w-full h-full object-cover"
              alt={`${title} thumbnail ${i + 1}`}
            />
          </button>
        ))}
      </div>

      {/* Main image */}
      <div
        className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden group cursor-zoom-in"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => setZoomOpen(true)}
      >
        <img
          src={safeImages[index]}
          alt={`${title} image ${index + 1}`}
          loading="eager"
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />

        {/* Navigation */}
        {safeImages.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
            >
              <ChevronLeft />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {/* zoom icon */}
        <div className="absolute top-4 right-4 bg-white rounded-full p-2 shadow">
          <ZoomIn size={16} />
        </div>
      </div>

      {/* Mobile thumbnails */}
      <div className="md:hidden grid grid-cols-5 gap-2">
        {safeImages.map((img, i) => (
          <button
            key={img + i}
            onClick={() => setIndex(i)}
            className={`aspect-square rounded-lg overflow-hidden border ${
              i === index ? "border-black" : "border-gray-200"
            }`}
          >
            <img
              src={img}
              loading="lazy"
              className="w-full h-full object-cover"
              alt={`${title} thumb ${i + 1}`}
            />
          </button>
        ))}
      </div>

      {/* Zoom modal */}
      {zoomOpen && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setZoomOpen(false)}
            className="absolute top-6 right-6 text-white text-3xl"
          >
            ×
          </button>

          {safeImages.length > 1 && (
            <>
              <button onClick={prev} className="absolute left-6 text-white text-4xl">
                ‹
              </button>

              <button onClick={next} className="absolute right-6 text-white text-4xl">
                ›
              </button>
            </>
          )}

          <img
            src={safeImages[index]}
            className="max-w-[95vw] max-h-[95vh] object-contain"
            alt={`${title} zoom ${index + 1}`}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Runtime safety tests
 */

function testSanitizeImages() {
  const input: any = ["a.jpg", "", null, "b.jpg", "a.jpg"];

  const filtered = input.filter(
    (img: any) => typeof img === "string" && img.trim().length > 0
  );

  const result = Array.from(new Set(filtered));

  console.assert(result.length === 2, "Images should sanitize correctly");
}

function testArrayFallback() {
  const images: any = null;

  const safe = Array.isArray(images) ? images : [];

  console.assert(Array.isArray(safe), "Fallback should be array");
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  testSanitizeImages();
  testArrayFallback();
}
