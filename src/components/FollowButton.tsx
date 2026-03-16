"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface FollowButtonProps {
  sellerId: string
  sellerName?: string
  className?: string
}

export default function FollowButton({ sellerId, sellerName, className }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    checkFollow()
  }, [sellerId])

  const checkFollow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", user.id)
        .eq("seller_id", sellerId)
        .maybeSingle()

      if (error) throw error
      setIsFollowing(!!data)
    } catch (err) {
      console.error("Error checking follow status:", err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFollow = async () => {
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Redirect to login or show message
        alert("Please login to follow sellers")
        return
      }

      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("seller_id", sellerId)
        
        if (error) throw error
        setIsFollowing(false)
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: user.id,
            seller_id: sellerId
          })
        
        if (error) throw error
        setIsFollowing(true)
      }
    } catch (err) {
      console.error("Error toggling follow:", err)
      alert("Failed to update follow status")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <button className={`h-10 w-24 bg-gray-100 animate-pulse rounded-full ${className}`} disabled />
    )
  }

  return (
    <button
      onClick={toggleFollow}
      disabled={processing}
      className={`
        px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-[10px] transition-all active:scale-95
        ${isFollowing 
          ? "bg-gray-100 text-gray-400 hover:bg-gray-200" 
          : "bg-black text-white hover:bg-purple-600 shadow-lg shadow-purple-100"
        }
        ${processing ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {processing ? "..." : isFollowing ? "Following" : "Follow"}
    </button>
  )
}
