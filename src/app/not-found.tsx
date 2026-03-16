import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mb-8">
        <span className="text-3xl grayscale">🔍</span>
      </div>
      
      <span className="text-caption uppercase tracking-[0.3em] text-primary font-bold mb-2">404 - Archive Missing</span>
      <h1 className="text-display text-4xl lg:text-6xl font-black italic uppercase tracking-tighter mb-6">Piece not found</h1>
      
      <p className="text-body text-muted max-w-md mb-12">
        The asset you are looking for has either been decommissioned, acquired by another collector, or never existed in the HSTN records.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="luxury-button !bg-foreground !text-white !px-12"
        >
          Discover New Drops
        </Link>
        <Link
          href="/"
          className="luxury-button !px-12"
        >
          Explore Archive
        </Link>
      </div>
      
      <div className="mt-16 pt-8 border-t border-border w-full max-w-lg">
        <p className="text-[10px] text-muted uppercase tracking-widest font-mono">
          Protocol: RECORD_NOT_FOUND
        </p>
      </div>
    </div>
  )
}
