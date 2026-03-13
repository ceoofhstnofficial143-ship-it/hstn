export default function GalleryVideo({url}:{url:string}){

  return(
    <video
      controls
      className="w-full h-full object-contain"
    >
      <source src={url}/>
    </video>
  )
}
