"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import GalleryMagnifier from "./GalleryMagnifier"
import GalleryThumbnails from "./GalleryThumbnails"
import GalleryVideo from "./GalleryVideo"

type Props = {
  image_url: string
  additional_images?: string[]
  video_url?: string
  title?: string
}

export default function ProductGallery({
  image_url,
  additional_images,
  video_url,
  title
}: Props) {

  const images = useMemo(() => {
    const list = [
      image_url,
      ...(additional_images || [])
    ]

    return list.filter(Boolean)
  }, [image_url, additional_images])

  const [index, setIndex] = useState(0)

  const isVideo = video_url && index === images.length

  return (
    <div className="grid md:grid-cols-[90px_1fr] gap-4">

      <GalleryThumbnails
        images={images}
        video={video_url}
        index={index}
        setIndex={setIndex}
      />

      <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">

        {isVideo ? (
          <GalleryVideo url={video_url!}/>
        ) : (
          <GalleryMagnifier src={images[index]} />
        )}

      </div>

      {/* Mobile thumbnails */}
      <div className="md:hidden grid grid-cols-5 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`aspect-square border rounded overflow-hidden ${
              index === i ? "border-black" : "border-gray-200"
            }`}
          >
            <img src={img} className="w-full h-full object-cover"/>
          </button>
        ))}
      </div>

    </div>
  )
}
