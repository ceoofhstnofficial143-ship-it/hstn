"use client"

import { useState } from "react"

const STYLES = [
    { id: "streetwear", label: "Streetwear", icon: "🌃" },
    { id: "co-ord-sets", label: "Co-ord Sets", icon: "🧥" },
    { id: "korean", label: "Korean Style", icon: "🇰🇷" },
    { id: "casual-dresses", label: "Casual Dresses", icon: "👗" },
    { id: "luxury", label: "Luxury", icon: "💎" },
    { id: "trendy-tops", label: "Trendy Tops", icon: "👕" }
]

export default function StyleQuiz({ onComplete }: { onComplete: (styles: string[]) => void }) {
    const [selected, setSelected] = useState<string[]>([])

    const toggleStyle = (id: string) => {
        setSelected(prev => 
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        )
    }

    return (
        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-gray-100 max-w-2xl w-full animate-scale-up">
            <header className="mb-12 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Identity Protocol</span>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter mt-4 leading-tight">Define Your Aesthetic</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-4">Select your primary style archetypes to synchronize your feed.</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
                {STYLES.map((style) => (
                    <button
                        key={style.id}
                        onClick={() => toggleStyle(style.id)}
                        className={`flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all duration-300 ${
                            selected.includes(style.id)
                            ? "bg-black border-black text-white shadow-xl scale-105"
                            : "bg-gray-50 border-transparent text-gray-900 hover:border-gray-200"
                        }`}
                    >
                        <span className="text-3xl mb-4">{style.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{style.label}</span>
                    </button>
                ))}
            </div>

            <button
                onClick={() => onComplete(selected)}
                disabled={selected.length === 0}
                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
                Synchronize Matrix
            </button>
        </div>
    )
}
