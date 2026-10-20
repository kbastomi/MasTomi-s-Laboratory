import type * as THREE from 'three'

/**
 * The contract every simulation and demonstration implements.
 *
 * A lab is deliberately small: it owns a group of 3D objects, answers
 * "did anything change?", handles pointer input it wants, and can save and
 * restore its own state. Everything else — camera, quality, panel, language,
 * persistence — is provided by the platform.
 */
export interface LabInstance {
  /** Objects owned by this lab. Added to / removed from the scene automatically. */
  readonly root: THREE.Group

  /**
   * Advance the simulation.
   * @param dt seconds since the last frame (already clamped)
   * @returns true when something changed and the scene must be redrawn
   */
  update(dt: number): boolean

  /** @returns true when the lab consumed the event (the camera then will not orbit). */
  onPointerDown(event: PointerEvent): boolean
  onPointerMove(event: PointerEvent): void
  onPointerUp(event: PointerEvent): void

  /** Build the lab's controls and readouts into the side panel. */
  buildPanel(ctx: PanelContext): void

  /** State for progress saving. Must be JSON-serialisable. */
  serialize(): unknown

  /** Restore a state produced by serialize(). */
  restore(state: unknown): void

  /** Release geometries, materials and textures. */
  dispose(): void
}

/** Camera placement a lab asks for when it opens. */
export interface CameraSpec {
  target: [number, number, number]
  radius: number
  azim: number
  polar: number
}

/** What a lab may switch on or off for its own scene. */
export interface LabRenderingHints {
  /** Disable shadows for this lab (biggest single win on weak GPUs). */
  shadows?: boolean
  /** Disable the room backdrop / floor for this lab. */
  bare?: boolean
}

/** Everything a lab factory receives. */
export interface LabContext {
  /** Ask the platform to redraw the scene on the next frame. */
  invalidate(): void
  /** The lab's own group — already added to the scene. */
  root: THREE.Group
  /** Panel builder bound to the lab's panel section. */
  panel: PanelContext
  /** The active camera, for ray picking. */
  camera: THREE.PerspectiveCamera
  /** The canvas the lab renders into, for ray picking and cursor hints. */
  dom: HTMLElement
  /** Move the camera to frame something — used when a lab switches view. */
  setCamera(spec: CameraSpec): void
}

/** The panel builder handed to a lab. */
export interface PanelContext {
  /** Add a titled section. */
  section(title: string): PanelSection
  /** Free-form element appended straight to the panel. */
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K]
}

export interface PanelSection {
  /** the DOM node this section lives in — hand it to a widget that renders itself */
  readonly host: HTMLElement
  /** A label/value row that the lab updates. */
  readout(label: string, initial?: string): Readout
  /** A slider. Returns an object with get()/set(). */
  slider(opts: SliderOptions): SliderHandle
  /** A typed number — for recording a reading the student has read off an instrument. */
  number(opts: NumberOptions): NumberHandle
  /** A row of mutually exclusive buttons. */
  segmented(opts: SegmentedOptions): SegmentedHandle
  /** A plain button. */
  button(opts: ButtonOptions): HTMLButtonElement
  /** A toggle switch. */
  toggle(opts: ToggleOptions): ToggleHandle
  /** Free-form status text. */
  status(): StatusHandle
  /** A "goal" line that can be marked as achieved. */
  goal(text: string): GoalHandle
  /** An arbitrary element, for custom widgets. */
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K]
}

export interface Readout {
  set(text: string, tone?: Tone): void
}

export interface SliderOptions {
  label: string
  min: number
  max: number
  step?: number
  value: number
  format?: (value: number) => string
  onInput?: (value: number) => void
}

export interface SliderHandle {
  get(): number
  set(value: number): void
  setRange(min: number, max: number): void
  setDisabled(disabled: boolean): void
}

/** A typed number — used when the student records a reading. */
export interface NumberOptions {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  /** shown after the field, e.g. 'mm' */
  suffix?: string
  onChange?: (value: number) => void
}

export interface NumberHandle {
  get(): number
  set(value: number): void
  setDisabled(disabled: boolean): void
}

export interface SegmentedOptions {
  items: { value: string; label: string; sub?: string }[]
  value?: string
  onChange?: (value: string) => void
  /** fixed number of columns (default: as many as fit) */
  cols?: number
}

export interface SegmentedHandle {
  set(value: string): void
}

export interface ButtonOptions {
  label: string
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost'
}

export interface ToggleOptions {
  label: string
  value?: boolean
  onChange?: (value: boolean) => void
}

export interface ToggleHandle {
  set(value: boolean): void
}

export interface StatusHandle {
  set(html: string, tone?: Tone): void
}

export interface GoalHandle {
  setDone(done: boolean, text?: string): void
}

/** Semantic colour roles — kept consistent across every lab. */
export type Tone = 'neutral' | 'input' | 'output' | 'result' | 'warn' | 'bad'

export type LabFactory = (ctx: LabContext) => LabInstance



