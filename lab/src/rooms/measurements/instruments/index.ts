/**
 * The four measuring instruments.
 *
 * Each is a working 3D model the student operates by dragging it.
 */
export { VernierCaliper } from './vernier'
export { Micrometer } from './micrometer'
export { OhausBalance } from './balance'
export { Stopwatch } from './stopwatch'
export type { Instrument, InstrumentCtx } from './types'
export { makeGrabHandle, makeLinearScale, makeArcScale } from './scale'
