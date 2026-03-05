"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function EditProductPage() {
    const params = useParams()
    const id = params?.id as string
    const router = useRouter()

    const [title, setTitle] = useState("")
    const [price, setPrice] = useState("")
    const [description, setDescription] = useState("")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            fetchProduct()
        }
    }, [id])

    const fetchProduct = async () => {
        const { data, error } = await supabase
            .from("products")
            .select("*")
            .eq("id", id)
            .single()

        if (error) {
            alert("Error fetching product")
            router.push("/")
            return
        }

        if (data) {
            setTitle(data.title)
            setPrice(data.price)
            setDescription(data.description)
        }
        setLoading(false)
    }

    const handleUpdate = async () => {
        if (!title || !price || !description) {
            alert("Please fill all fields")
            return
        }

        const { error } = await supabase
            .from("products")
            .update({
                title,
                price: parseFloat(price),
                description,
            })
            .eq("id", id)

        if (error) {
            alert(error.message)
        } else {
            alert("Product updated ✅")
            router.push("/")
        }
    }

    if (loading) return <div className="p-10">Loading...</div>

    return (
        <div className="p-10 max-w-xl mx-auto">
            <Link href="/" className="text-blue-600 underline mb-4 inline-block">
                ← Back to home
            </Link>
            <h1 className="text-3xl font-bold mb-8 text-black">Edit Product ✏️</h1>

            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Title</label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Price"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                </div>

                <button
                    onClick={handleUpdate}
                    className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-lg mt-4"
                >
                    Save Changes
                </button>
            </div>
        </div>
    )
}
