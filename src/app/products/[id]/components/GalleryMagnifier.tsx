"use client"

import { useRef, useState } from "react"

export default function GalleryMagnifier({ src }: { src: string }) {

  const ref = useRef<HTMLDivElement>(null)
  const [bgPos, setBgPos] = useState("0% 0%")
  const [zoom, setZoom] = useState(false)

  const move = (e: React.MouseEvent) => {

    const rect = ref.current!.getBoundingClientRect()

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setBgPos(`${x}% ${y}%`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      className="relative w-full h-full"
    >

      <img
        src={src}
        className="w-full h-full object-contain"
      />

      {zoom && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: "200%",
            backgroundPosition: bgPos
          }}
        />
      )}

    </div>
  )
}
