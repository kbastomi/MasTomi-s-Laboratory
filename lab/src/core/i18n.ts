/**
 * Bilingual strings. Indonesian is the default, English is one tap away.
 *
 * Two kinds of strings live here:
 *   - the chrome (menus, buttons, labels) in ./ui.ts
 *   - every lab's own title/blurb/tags, declared next to the lab definition
 */

export type Lang = 'id' | 'en'

export const LANGS: Lang[] = ['id', 'en']

/** A string that exists in both languages. */
export interface Localized {
  id: string
  en: string
}

/** Shorthand for building a Localized pair. */
export const L = (id: string, en: string): Localized => ({ id, en })

const STORAGE_KEY = 'lab.lang'

let current: Lang = 'id'
const listeners = new Set<(lang: Lang) => void>()

function detect(): Lang {
  // an explicit ?lang= wins, then a stored preference, then the browser
  const fromUrl = new URLSearchParams(location.search).get('lang')
  if (fromUrl === 'id' || fromUrl === 'en') return fromUrl
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'id' || stored === 'en') return stored
  } catch {
    /* private mode — fall through */
  }
  const nav = (navigator.language || 'id').toLowerCase()
  return nav.startsWith('en') ? 'en' : 'id'
}

export function getLang(): Lang {
  return current
}

/** Switch language. `persist` false keeps the choice for this page view only. */
export function setLang(lang: Lang, persist = true): void {
  if (lang !== 'id' && lang !== 'en') return
  if (lang === current) return
  current = lang
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
  }
  document.documentElement.lang = lang
  for (const fn of listeners) fn(lang)
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Resolve a Localized pair into the active language. */
export function t(value: Localized): string {
  return value[current] ?? value.id ?? value.en ?? ''
}

/**
 * Resolve a Localized pair and fill in `{placeholders}`.
 *
 *   tf(L('Coba {n} N.', 'Try {n} N.'), { n: 200 })   →  "Coba 200 N." / "Try 200 N."
 */
export function tf(value: Localized, vars: Record<string, string | number>): string {
  let out = t(value)
  for (const [key, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(v))
  }
  return out
}

/** Resolve a list of Localized pairs. */
export function tAll(values: Localized[]): string[] {
  return values.map(t)
}

/**
 * Locale-aware number formatting. Indonesian and English differ in the
 * thousands/decimal separators, so readouts must not hard-code them.
 */
export function num(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(current === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Compact number with a unit, e.g. 9.8 "m/s²". */
export function unit(value: number, suffix: string, decimals = 1): string {
  return `${num(value, decimals)} ${suffix}`
}

export function initLang(): Lang {
  current = detect()
  document.documentElement.lang = current
  try { localStorage.setItem(STORAGE_KEY, current) } catch { /* ignore */ }
  return current
}
