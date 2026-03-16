"use client"

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Expose supabase globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).supabase = supabase;
      console.log('🔧 Supabase client exposed globally for debugging');
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
      console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    }
  }, [])

  return <>{children}</>
}
