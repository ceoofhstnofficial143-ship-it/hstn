"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface DebugEvent {
  id: string
  event_type: string
  user_id: string | null
  metadata: any
  created_at: string
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [events, setEvents] = useState<DebugEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isDev, setIsDev] = useState(false)

  // Check if development at runtime
  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development')
  }, [])

  useEffect(() => {
    if (!isDev) return
    if (!isOpen) return

    fetchRecentEvents()

    if (autoRefresh) {
      const interval = setInterval(fetchRecentEvents, 5000) // Increased to 5 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen, autoRefresh, filter, isDev])

  const fetchRecentEvents = async () => {
    console.log('🔍 Debug: Fetching events...')
    let query = supabase
      .from('marketplace_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (filter !== 'all') {
      query = query.eq('event_type', filter)
    }

    const { data, error } = await query
    
    if (error) {
      console.error('❌ Debug panel error:', error)
    } else {
      console.log('📊 Debug: Fetched events:', data?.length || 0)
      if (data) setEvents(data)
    }
  }

  // Only show in development - use state instead of direct check
  if (!isDev) return null

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] w-12 h-12 bg-black text-white rounded-full shadow-2xl flex items-center justify-center text-xs font-black border-2 border-white hover:scale-110 transition-transform"
        title="Toggle Debug Panel"
      >
        🐛
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[9999] w-[500px] max-h-[600px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-black p-4 flex justify-between items-center">
            <div>
              <h3 className="text-white text-sm font-black uppercase tracking-widest">Debug Panel</h3>
              <p className="text-gray-500 text-[9px] uppercase tracking-widest mt-1">Real-time event monitoring</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest ${autoRefresh ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Auto
              </button>
              <button
                onClick={fetchRecentEvents}
                className="px-3 py-1 bg-blue-500 text-white rounded text-[9px] font-black uppercase tracking-widest"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 p-3 flex gap-2 overflow-x-auto">
            {['all', 'product_view', 'add_to_cart', 'wishlist_add', 'wishlist_remove', 'search'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
                  filter === type ? 'bg-white text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Events List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {events.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No events found
              </div>
            ) : (
              events.map(event => (
                <div key={event.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      event.event_type === 'product_view' ? 'bg-blue-500/20 text-blue-400' :
                      event.event_type === 'add_to_cart' ? 'bg-green-500/20 text-green-400' :
                      event.event_type === 'wishlist_add' ? 'bg-pink-500/20 text-pink-400' :
                      event.event_type === 'wishlist_remove' ? 'bg-red-500/20 text-red-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {event.event_type}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {event.metadata && (
                      <div className="space-y-0.5">
                        {event.metadata.product_id && (
                          <div>product: {event.metadata.product_id.slice(0, 8)}...</div>
                        )}
                        {event.metadata.seller_id && (
                          <div>seller: {event.metadata.seller_id.slice(0, 8)}...</div>
                        )}
                        {event.metadata.query && (
                          <div>query: "{event.metadata.query}"</div>
                        )}
                        {event.metadata.size && (
                          <div>size: {event.metadata.size}</div>
                        )}
                        {event.metadata.price && (
                          <div>price: ₹{event.metadata.price}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Stats */}
          <div className="bg-gray-800 p-3 border-t border-gray-700">
            <div className="flex justify-between text-[9px] text-gray-500 uppercase tracking-widest">
              <span>Total: {events.length} events</span>
              <span className="text-green-400">● Live</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
