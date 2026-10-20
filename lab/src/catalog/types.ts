import type { CameraSpec, LabFactory } from '../core/lab'
import type { Localized } from '../core/i18n'

/**
 * The catalogue's own types.
 *
 * These describe *content* — what the curriculum contains — as opposed to
 * `core/lab.ts`, which describes the *runtime contract* every simulation
 * implements. The catalogue depends on the core, never the other way round.
 */

/** What a lab may switch on or off for its own scene. */
export interface LabRenderingHints {
  /** Disable shadows for this lab (the biggest single win on a weak GPU). */
  shadows?: boolean
  /** Disable the room backdrop / floor for this lab. */
  bare?: boolean
}

/** The static description of a lab, declared next to its implementation. */
export interface LabDef {
  /** 'chapter.lab', e.g. 'mechanics.lever' */
  id: string
  /** chapter id, e.g. 'mechanics' */
  room: string
  title: Localized
  blurb: Localized
  tags: Localized[]
  /** school grade difficulty, 1 (easy) .. 5 (hard) */
  level: 1 | 2 | 3 | 4 | 5
  /** which kinds of experience this lab offers */
  mode: ('sim' | 'demo')[]
  /** the physics the student is meant to take away */
  concepts: Localized[]
  estMinutes: number
  camera?: CameraSpec
  rendering?: LabRenderingHints
  /** lazy load — keeps the initial download small */
  load: () => Promise<{ default: LabFactory }>
}

/** A planned but not-yet-built lab, shown as a locked card. */
export interface PlannedLab {
  id: string
  title: Localized
  blurb: Localized
}

/** A chapter of the curriculum — one "room" in the laboratory. */
export interface ChapterDef {
  id: string
  order: number
  title: Localized
  blurb: Localized
  icon: string
  accent: string
  objectives: Localized[]
  /** built labs */
  labs: LabDef[]
  /** roadmap for the labs that are still to come */
  planned: PlannedLab[]
}
