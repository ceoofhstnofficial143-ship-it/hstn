import { Metadata, ResolvingMetadata } from 'next'
import { supabase } from "@/lib/supabase"
import ProductClient from "./ProductClient"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params
  
  // Fetch product data for SEO
  const { data: product } = await (supabase as any)
    .from("products")
    .select(`*, profiles!products_user_id_fkey(username)`)
    .eq("id", id)
    .single()

  if (!product) {
    return {
      title: 'Asset Not Found | HSTNLX',
    }
  }

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: `${product.title} | ${product.category} | HSTNLX`,
    description: product.description?.slice(0, 160) || `Acquire the latest elite drop from @${product.profiles?.username} on HSTNLX.`,
    openGraph: {
      title: product.title,
      description: product.description,
      images: [product.image_url, ...previousImages],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.description,
      images: [product.image_url],
    },
  }
}

export default function Page() {
  return <ProductClient />
}
