"use client"

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

type Props = {
  images: string[]
  video?: string
  index: number
  setIndex: (i: number) => void
}

export default function MobileGallery({ images, video, index, setIndex }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps'
  })

  const [currentIndex, setCurrentIndex] = useState(index)

  // Sync with parent index
  useEffect(() => {
    setCurrentIndex(index)
  }, [index])

  // Update parent when Embla changes
  const onSelect = useCallback(() => {
    if (!emblaApi) return
    const newIndex = emblaApi.selectedScrollSnap()
    setCurrentIndex(newIndex)
    setIndex(newIndex)
  }, [emblaApi, setIndex])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  // Sync Embla when parent index changes
  useEffect(() => {
    if (!emblaApi) return
    emblaApi.scrollTo(index)
  }, [emblaApi, index])

  const allSlides = video ? [...images, 'video'] : images

  return (
    <div className="md:hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {allSlides.map((slide, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
                {slide === 'video' && video ? (
                  <video
                    src={video}
                    controls
                    className="w-full h-full object-contain"
                    playsInline
                  />
                ) : (
                  <img
                    src={slide}
                    alt={`Product image ${i + 1}`}
                    className="w-full h-full object-contain"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-4">
        {allSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentIndex ? 'bg-black' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
