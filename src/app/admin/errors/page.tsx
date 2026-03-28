"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type SystemEvent = {
  id?: string
  event_type?: string
  source?: string
  status?: string
  reference_id?: string
  metadata?: any
  created_at?: string
}

export default function AdminErrorsPage() {
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [timeFilter, setTimeFilter] = useState<"all" | "today">("today")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [onlyCritical, setOnlyCritical] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [copyToast, setCopyToast] = useState("")

  const fetchErrors = async () => {
    setLoading(true)
    setError("")

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setError("Admin session missing. Please sign in again.")
        setEvents([])
        setLoading(false)
        return
      }

      const res = await fetch("/api/admin/system-events", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload?.error || "Failed to load error logs")
        setEvents([])
      } else {
        setEvents(payload?.events || [])
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load error logs")
      setEvents([])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchErrors()
  }, [])

  useEffect(() => {
    if (!copyToast) return
    const timer = setTimeout(() => setCopyToast(""), 1800)
    return () => clearTimeout(timer)
  }, [copyToast])

  const filteredEvents = events.filter((ev) => {
    if (timeFilter === "today") {
      if (!ev.created_at) return false
      const created = new Date(ev.created_at)
      const now = new Date()
      const isSameDay =
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate()
      if (!isSameDay) return false
    }

    if (fromDate) {
      if (!ev.created_at) return false
      const created = new Date(ev.created_at)
      const from = new Date(`${fromDate}T00:00:00`)
      if (created < from) return false
    }

    if (toDate) {
      if (!ev.created_at) return false
      const created = new Date(ev.created_at)
      const to = new Date(`${toDate}T23:59:59.999`)
      if (created > to) return false
    }

    if (statusFilter !== "all" && (ev.status || "unknown") !== statusFilter) return false
    if (typeFilter !== "all" && (ev.event_type || "unknown_event") !== typeFilter) return false
    if (sourceFilter !== "all" && (ev.source || "unknown_source") !== sourceFilter) return false
    if (onlyCritical) {
      const eventType = (ev.event_type || "").toLowerCase()
      const status = (ev.status || "").toLowerCase()
      const metaText = JSON.stringify(ev.metadata || {}).toLowerCase()
      const isCritical =
        eventType.includes("critical") ||
        status === "critical" ||
        metaText.includes('"severity":"critical"') ||
        metaText.includes("critical error") ||
        metaText.includes("severity: critical")
      if (!isCritical) return false
    }
    return true
  })

  const statusOptions = Array.from(new Set(events.map((ev) => ev.status || "unknown")))
  const typeOptions = Array.from(new Set(events.map((ev) => ev.event_type || "unknown_event")))
  const sourceOptions = Array.from(new Set(events.map((ev) => ev.source || "unknown_source")))

  const handleCopyJson = async (event: SystemEvent) => {
    const payload = JSON.stringify(event, null, 2)
    try {
      await navigator.clipboard.writeText(payload)
      setCopyToast("Error JSON copied")
    } catch {
      setCopyToast("Copy failed")
    }
  }

  const escapeCsv = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    const str = typeof value === "string" ? value : JSON.stringify(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const handleDownloadCsv = () => {
    const headers = ["created_at", "status", "event_type", "source", "reference_id", "metadata"]
    const rows = filteredEvents.map((ev) => [
      escapeCsv(ev.created_at || ""),
      escapeCsv(ev.status || ""),
      escapeCsv(ev.event_type || ""),
      escapeCsv(ev.source || ""),
      escapeCsv(ev.reference_id || ""),
      escapeCsv(ev.metadata || {}),
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `admin-error-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCopyToast("CSV downloaded")
  }

  const formatDateInput = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const applyQuickRange = (days: 1 | 7 | 30) => {
    const now = new Date()
    const start = new Date()
    start.setDate(now.getDate() - (days - 1))
    setTimeFilter("all")
    setFromDate(formatDateInput(start))
    setToDate(formatDateInput(now))
  }

  const handleClearAllFilters = () => {
    const confirmed = window.confirm(
      "Clear all filters?\n\nThis will NOT delete any error logs. It only resets filter options."
    )
    if (!confirmed) return

    setTimeFilter("today")
    setStatusFilter("all")
    setTypeFilter("all")
    setSourceFilter("all")
    setOnlyCritical(false)
    setFromDate("")
    setToDate("")
    setCopyToast("Filters reset")
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Error Logs</h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">
            Unified app events (success + failure + runtime errors)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-5 py-3 rounded-2xl hover:bg-emerald-200 transition-all"
          >
            Download CSV
          </button>
          <button
            onClick={fetchErrors}
            className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-5 py-3 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"
          >
            Refresh Logs
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-[24px] border border-slate-100 p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as "all" | "today")}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          >
            <option value="today">Today</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          >
            <option value="all">All Status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          >
            <option value="all">All Event Types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          >
            <option value="all">All Sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
          />

          <div className="px-3 py-2 rounded-xl bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500 flex items-center justify-center">
            {filteredEvents.length} visible
          </div>
        </div>
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              onClick={() => applyQuickRange(1)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-all"
            >
              Last 24h
            </button>
            <button
              onClick={() => applyQuickRange(7)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-all"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyQuickRange(30)}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-all"
            >
              Last 30 Days
            </button>
          </div>
          <button
            onClick={() => setOnlyCritical(v => !v)}
            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${onlyCritical ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
          >
            {onlyCritical ? "Only Critical: ON" : "Only Critical: OFF"}
          </button>
          <button
            onClick={handleClearAllFilters}
            className="ml-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-all"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500">Loading error logs...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-sm text-slate-500">No recent errors found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map((ev, idx) => (
              <div key={ev.id || `${ev.created_at}-${idx}`} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700 font-black uppercase tracking-wider">
                    {ev.status || "failed"}
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-black uppercase tracking-wider">
                    {ev.event_type || "unknown_event"}
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-black uppercase tracking-wider">
                    {ev.source || "unknown_source"}
                  </span>
                  </div>
                  <button
                    onClick={() => handleCopyJson(ev)}
                    className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-xl hover:bg-slate-900 hover:text-white transition-all"
                  >
                    Copy JSON
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString() : "No timestamp"}
                  {ev.reference_id ? ` | Ref: ${ev.reference_id}` : ""}
                </p>

                {ev.metadata && (
                  <pre className="mt-3 text-xs bg-slate-50 p-3 rounded-xl overflow-x-auto border border-slate-100 whitespace-pre-wrap break-words">
                    {JSON.stringify(ev.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`fixed left-1/2 -translate-x-1/2 bottom-8 z-[200] transition-all duration-300 ${copyToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        <div className="px-4 py-2 rounded-full bg-black text-white text-[11px] font-black uppercase tracking-wider shadow-xl">
          {copyToast}
        </div>
      </div>
    </div>
  )
}
