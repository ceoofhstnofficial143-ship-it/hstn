export default function ProductSkeleton() {
  return (
    <div className="product-card bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200"></div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-6 bg-gray-100 rounded w-1/3 mt-4"></div>
      </div>
    </div>
  )
}
