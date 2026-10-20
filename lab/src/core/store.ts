/**
 * Local progress store.
 *
 * Every lab can serialise its own state; this module keeps those blobs in
 * localStorage so a student's work survives a reload, and hands them to the
 * optional backend (see api.ts) for syncing when one exists.
 */
const KEY = 'lab.progress.v1'

export interface ProgressRecord {
  /** lab id, e.g. 'mechanics.lever' */
  labId: string
  /** opaque state produced by the lab's serialize() */
  state: unknown
  /** the student marked the lab as finished */
  done: boolean
  updatedAt: number
}

type StoreShape = Record<string, ProgressRecord>

function read(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as StoreShape) : {}
  } catch {
    return {}
  }
}

function write(shape: StoreShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(shape))
  } catch {
    /* private mode or quota — progress simply is not persisted */
  }
}

export const store = {
  get(labId: string): ProgressRecord | null {
    return read()[labId] ?? null
  },

  /** Save a lab's state. */
  set(labId: string, state: unknown, done?: boolean): void {
    const shape = read()
    const prev = shape[labId]
    shape[labId] = {
      labId,
      state,
      done: done ?? prev?.done ?? false,
      updatedAt: Date.now(),
    }
    write(shape)
  },

  markDone(labId: string, done = true): void {
    const shape = read()
    const prev = shape[labId]
    shape[labId] = {
      labId,
      state: prev?.state ?? null,
      done,
      updatedAt: Date.now(),
    }
    write(shape)
  },

  isDone(labId: string): boolean {
    return !!read()[labId]?.done
  },

  /** Completed labs within one chapter (or across all of them). */
  doneIn(chapterId?: string): number {
    const shape = read()
    return Object.values(shape).filter(
      (r) => r.done && (!chapterId || r.labId.startsWith(`${chapterId}.`)),
    ).length
  },

  /** Everything we know about, for the backend sync payload. */
  all(): ProgressRecord[] {
    return Object.values(read())
  },

  clear(): void {
    write({})
  },
}
