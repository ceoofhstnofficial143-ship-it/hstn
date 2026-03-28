"use client"

import React, { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import Link from 'next/link'
import Image from 'next/image'

export default function EngagementTriggers() {
    const [activeTrigger, setActiveTrigger] = useState<any>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Initial delay to avoid annoying immediate popups
        const timer = setTimeout(() => {
            checkCartAbandonment()
        }, 15000)

        return () => clearTimeout(timer)
    }, [])

    const checkCartAbandonment = () => {
        const cart = JSON.parse(localStorage.getItem('hstnlx_cart') || '[]')
        if (cart.length > 0) {
            const item = cart[Math.floor(Math.random() * cart.length)]
            setActiveTrigger({
                type: 'abandonment',
                title: 'Institutional Scarcity Alert',
                message: `${item.title} is currently being scouted by 12 others. Secure your acquisition now.`,
                item: item,
                actionLabel: 'Return to Vault',
                actionUrl: '/cart'
            })
            setVisible(true)
            trackEvent('engagement_trigger_shown', { type: 'abandonment', product_id: item.productId })

            // Auto-hide after 10 seconds
            setTimeout(() => setVisible(false), 10000)
        }
    }

    if (!visible || !activeTrigger) return null

    return (
        <div className="fixed bottom-10 right-10 z-[100] animate-in slide-in-from-right-10 fade-in duration-700">
            <div className="bg-black border-2 border-primary/40 text-white p-6 rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] max-w-sm relative overflow-hidden group">
                {/* Backdrop decoration */}
                <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl pointer-events-none group-hover:scale-125 transition-transform duration-1000">⚡</div>
                
                <button 
                  onClick={() => setVisible(false)}
                  className="absolute top-4 right-6 text-white/40 hover:text-white transition-colors text-xs font-black"
                >
                    ✕ CLOSE
                </button>

                <div className="flex gap-6 items-center">
                    {activeTrigger.item?.image && (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 animate-pulse border border-primary/20">
                            <Image src={activeTrigger.item.image} alt="Trigger item" width={64} height={64} className="object-cover" />
                        </div>
                    )}
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">{activeTrigger.title}</h4>
                        <p className="text-[11px] font-bold text-white/80 uppercase tracking-widest leading-relaxed">
                            {activeTrigger.message}
                        </p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between gap-6">
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30 animate-pulse">Critical Priority</span>
                    <Link 
                      href={activeTrigger.actionUrl}
                      onClick={() => {
                        setVisible(false)
                        trackEvent('engagement_trigger_clicked', { type: activeTrigger.type })
                      }}
                      className="bg-primary text-black px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest hover:scale-110 transition-transform shadow-xl hover:shadow-primary/20"
                    >
                        {activeTrigger.actionLabel} →
                    </Link>
                </div>
            </div>
        </div>
    )
}
