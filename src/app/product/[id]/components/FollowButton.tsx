"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface FollowButtonProps {
    sellerId: string
    followerId?: string
}

export default function FollowButton({ sellerId, followerId }: FollowButtonProps) {
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkFollow = async () => {
            if (!followerId) {
                setLoading(false)
                return
            }

            const { data, error } = await (supabase as any)
                .from("follows")
                .select("id")
                .eq("follower_id", followerId)
                .eq("seller_id", sellerId)
                .maybeSingle()

            if (data) setIsFollowing(true)
            setLoading(false)
        }

        checkFollow()
    }, [sellerId, followerId])

    const handleFollow = async () => {
        if (!followerId) {
            alert("Authentication Required: Please sign in to follow sellers.")
            return
        }

        setLoading(true)
        if (isFollowing) {
            // Unfollow
            const { error } = await (supabase as any)
                .from("follows")
                .delete()
                .eq("follower_id", followerId)
                .eq("seller_id", sellerId)

            if (!error) setIsFollowing(false)
        } else {
            // Follow
            const { error } = await (supabase as any)
                .from("follows")
                .insert([{ follower_id: followerId, seller_id: sellerId }])

            if (!error) setIsFollowing(true)
        }
        setLoading(false)
    }

    if (loading) return (
        <div className="w-24 h-8 bg-gray-100 animate-pulse rounded-full" />
    )

    return (
        <button
            onClick={handleFollow}
            className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                isFollowing 
                ? "bg-white border border-gray-200 text-gray-500 hover:text-red-500" 
                : "bg-black text-white hover:bg-gray-800"
            }`}
        >
            {isFollowing ? "Following" : "Follow Seller"}
        </button>
    )
}
