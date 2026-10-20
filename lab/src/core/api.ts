/**
 * The one and only place the front-end talks to a server.
 *
 * The laboratory is a static site by default: it runs perfectly well with no
 * backend at all, keeping progress in localStorage. When a Node backend is
 * present (the future LEMP + Node.js deployment) it is detected at boot and
 * the extra features — cross-device progress, accounts and classrooms,
 * analytics — switch themselves on.
 *
 * Nothing in a lab may call fetch() directly; labs call the higher-level
 * helpers in this module so the "no backend" case is handled in one place.
 */

const PROBE_TIMEOUT_MS = 3000

/**
 * Where the optional backend lives.
 *
 * The static build has no backend at all, so it must not even ask — a probe
 * that 404s would leave a red line in the browser console for every student.
 * Set `VITE_API_BASE=/api` at build time when a Node backend is deployed
 * (the future LEMP + Node.js setup) and the extra features switch themselves on.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export interface Capabilities {
  accounts: boolean
  progress: boolean
  analytics: boolean
}

export interface AnalyticsEvent {
  type: string
  labId?: string
  chapterId?: string
  data?: Record<string, unknown>
  at: number
}

class ApiClient {
  /** false until the probe finishes; then reflects the server's answer */
  available = false
  capabilities: Capabilities = { accounts: false, progress: false, analytics: false }
  /** set when the probe failed — used to show "local mode" in the UI */
  reason = ''

  private queue: AnalyticsEvent[] = []
  private flushTimer = 0

  /** Ask the server what it can do. Safe to call when there is no server. */
  async probe(): Promise<boolean> {
    if (!API_BASE) {
      /* no backend configured — stay in local-only mode, and stay quiet */
      this.available = false
      this.reason = 'no API base configured'
      return false
    }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as Partial<Capabilities> & { ok?: boolean }
      this.available = true
      this.capabilities = {
        accounts: !!body.accounts,
        progress: body.progress !== false,
        analytics: !!body.analytics,
      }
    } catch (err) {
      this.available = false
      this.capabilities = { accounts: false, progress: false, analytics: false }
      this.reason = err instanceof Error ? err.message : String(err)
    }
    return this.available
  }

  /* ------------------------------------------------------------ progress */
  async putProgress(labId: string, state: unknown): Promise<void> {
    if (!this.available || !this.capabilities.progress) return
    try {
      await fetch(`${API_BASE}/progress/${encodeURIComponent(labId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
        keepalive: true,
      })
    } catch {
      /* the local copy already holds it; a failed sync is not fatal */
    }
  }

  async getProgress(labId: string): Promise<unknown | null> {
    if (!this.available || !this.capabilities.progress) return null
    try {
      const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(labId)}`)
      if (!res.ok) return null
      const body = (await res.json()) as { state?: unknown }
      return body.state ?? null
    } catch {
      return null
    }
  }

  /* ----------------------------------------------------------- analytics */
  track(type: string, labId?: string, chapterId?: string, data?: Record<string, unknown>): void {
    if (!this.available || !this.capabilities.analytics) return
    this.queue.push({ type, labId, chapterId, data, at: Date.now() })
    if (!this.flushTimer) {
      this.flushTimer = window.setTimeout(() => this.flush(), 4000)
    }
  }

  private flush(): void {
    this.flushTimer = 0
    if (!this.queue.length) return
    const batch = this.queue.splice(0, this.queue.length)
    try {
      const body = JSON.stringify({ events: batch })
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE}/events`, new Blob([body], { type: 'application/json' }))
      } else {
        void fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        })
      }
    } catch {
      /* analytics must never break a lesson */
    }
  }
}

export const api = new ApiClient()
