/**
 * Hash routing.
 *
 * Hash URLs work on every static host with zero server configuration —
 * Cloudflare Pages, plain nginx, GitHub Pages, even a file:// copy on a USB
 * stick. That matters because this project will move from Cloudflare Pages to
 * a VPS later and the URLs should not have to change.
 *
 *   #/                      the chapter index
 *   #/room/mechanics        one chapter
 *   #/lab/mechanics/lever  one lab
 */
export type Route =
  | { name: 'home' }
  | { name: 'room'; chapterId: string }
  | { name: 'lab'; chapterId: string; labId: string }
  | { name: 'unknown'; path: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '')
  if (!path) return { name: 'home' }
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)

  if (parts[0] === 'room' && parts[1]) {
    return { name: 'room', chapterId: parts[1] }
  }
  if (parts[0] === 'lab' && parts[1] && parts[2]) {
    return { name: 'lab', chapterId: parts[1], labId: `${parts[1]}.${parts[2]}` }
  }
  return { name: 'unknown', path }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'room':
      return `#/room/${route.chapterId}`
    case 'lab':
      return `#/lab/${route.chapterId}/${route.labId.replace(`${route.chapterId}.`, '')}`
    case 'unknown':
      return `#/${route.path}`
  }
}

export class Router {
  private listeners = new Set<(route: Route) => void>()

  constructor() {
    window.addEventListener('hashchange', () => this.emit())
  }

  onChange(fn: (route: Route) => void): () => void {
    this.listeners.add(fn)
    fn(this.current())
    return () => this.listeners.delete(fn)
  }

  current(): Route {
    return parseHash(location.hash)
  }

  go(route: Route, replace = false): void {
    const hash = routeToHash(route)
    if (location.hash === hash) {
      this.emit()
      return
    }
    if (replace) history.replaceState(null, '', hash)
    else location.hash = hash
    if (replace) this.emit()
  }

  private emit(): void {
    const route = this.current()
    for (const fn of this.listeners) fn(route)
  }
}
