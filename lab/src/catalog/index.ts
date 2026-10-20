import type { ChapterDef } from './types'
import { measurements } from './chapters/measurements'
import { mechanics } from './chapters/mechanics'
import { kinematics } from './chapters/kinematics'
import { dynamics } from './chapters/dynamics'
import { energy } from './chapters/energy'
import { waves } from './chapters/waves'
import { optics } from './chapters/optics'
import { thermo } from './chapters/thermo'
import { emag } from './chapters/emag'
import { fluids } from './chapters/fluids'
import { modern } from './chapters/modern'

/**
 * The curriculum.
 *
 * Each chapter is a file of its own, so adding a simulation means editing
 * one chapter and nothing else — two people working on different chapters
 * never collide in the same file.
 */
export const CHAPTERS: ChapterDef[] = [
  measurements,
  mechanics,
  kinematics,
  dynamics,
  energy,
  waves,
  optics,
  thermo,
  emag,
  fluids,
  modern,
].sort((a, b) => a.order - b.order)

export function chapterById(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

export function allLabs() {
  return CHAPTERS.flatMap((c) => c.labs)
}

export function labById(id: string) {
  return allLabs().find((l) => l.id === id)
}
