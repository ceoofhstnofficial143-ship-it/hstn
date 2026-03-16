"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"

interface StyleQuizProps {
    onComplete: (styles: string[]) => void
}

export default function StyleQuiz({ onComplete }: StyleQuizProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selections, setSelections] = useState<string[]>([])
    const [quizItems, setQuizItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchQuizItems = async () => {
            const { data } = await supabase
                .from("products")
                .select("image_url, category, title")
                .limit(10)
            
            if (data) {
                setQuizItems(data)
            }
            setLoading(false)
        }
        fetchQuizItems()
    }, [])

    const handleSwipe = (direction: 'left' | 'right') => {
        const currentItem = quizItems[currentIndex]
        const newSelections = direction === 'right' 
            ? [...selections, currentItem.category] 
            : selections

        if (currentIndex < quizItems.length - 1) {
            setSelections(newSelections)
            setCurrentIndex(currentIndex + 1)
        } else {
            // Quiz complete - filter unique styles
            const uniqueStyles = Array.from(new Set(newSelections))
            onComplete(uniqueStyles)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <div className="w-8 h-8 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
        </div>
    )

    if (!quizItems.length) return null

    return (
        <div className="max-w-md mx-auto text-center px-4">
            <header className="mb-10">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Aesthetic DNA</span>
                <h2 className="text-3xl font-black uppercase tracking-tighter italic mt-2">Personalize Feed</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4">Swipe Right for pieces you love</p>
            </header>

            <div className="relative aspect-[3/4] mb-12 group">
                <div className="absolute inset-0 bg-gray-100 rounded-[32px] overflow-hidden shadow-2xl">
                    <Image 
                        src={quizItems[currentIndex].image_url} 
                        alt="Style choice"
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8 pt-20">
                        <p className="text-white text-xs font-black uppercase tracking-widest opacity-60">
                            {quizItems[currentIndex].category}
                        </p>
                        <h3 className="text-white text-xl font-black italic uppercase tracking-tighter mt-1">
                            {quizItems[currentIndex].title}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-center gap-8">
                <button 
                    onClick={() => handleSwipe('left')}
                    className="w-16 h-16 rounded-full border-2 border-gray-100 flex items-center justify-center text-2xl hover:bg-gray-50 hover:border-black transition-all shadow-lg"
                >
                    ✕
                </button>
                <button 
                    onClick={() => handleSwipe('right')}
                    className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl hover:scale-110 transition-all shadow-2xl"
                >
                    ❤️
                </button>
            </div>

            <div className="mt-12 flex justify-center gap-1">
                {quizItems.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-500 ${
                            i === currentIndex ? 'w-8 bg-black' : 'w-2 bg-gray-100'
                        }`} 
                    />
                ))}
            </div>
        </div>
    )
}

