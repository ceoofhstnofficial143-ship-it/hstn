"use client"

type Props = {
  images: string[]
  video?: string
  index: number
  setIndex: (i:number)=>void
  emblaApi?: any
}

export default function GalleryThumbnails({
  images,
  video,
  index,
  setIndex,
  emblaApi
}: Props){

  return(
    <div className="hidden md:flex flex-col gap-2">

      {images.map((img,i)=>(
        <button
          key={i}
          onMouseEnter={()=>setIndex(i)}
          onClick={()=>setIndex(i)}
          className={`aspect-square border rounded overflow-hidden
          ${index===i?"border-black":"border-gray-200"}`}
        >
          <img src={img} className="w-full h-full object-cover"/>
        </button>
      ))}

      {video && (
        <button
          onClick={()=>setIndex(images.length)}
          className={`aspect-square border rounded flex items-center justify-center
          ${index===images.length?"border-black":"border-gray-200"}`}
        >
          ▶
        </button>
      )}

    </div>
  )
}
