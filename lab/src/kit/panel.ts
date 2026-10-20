import type {
  ButtonOptions,
  GoalHandle,
  PanelContext,
  PanelSection,
  Readout,
  SegmentedHandle,
  SegmentedOptions,
  SliderHandle,
  SliderOptions,
  StatusHandle,
  ToggleHandle,
  ToggleOptions,
  Tone,
} from '../core/lab'

/**
 * Builds the controls and readouts that live in the side panel.
 *
 * On a phone the same panel becomes a bottom sheet — the markup is identical,
 * only the CSS changes — so every lab gets a usable touch layout for free.
 */
export class PanelBuilder implements PanelContext {
  constructor(private host: HTMLElement) {}

  section(title: string): PanelSection {
    const sec = document.createElement('section')
    sec.className = 'panel-section'
    if (title) {
      const h = document.createElement('h3')
      h.className = 'sec-title'
      h.textContent = title
      sec.appendChild(h)
    }
    this.host.appendChild(sec)
    return new SectionBuilder(sec)
  }

  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag)
    if (className) n.className = className
    if (text !== undefined) n.textContent = text
    this.host.appendChild(n)
    return n
  }
}

class SectionBuilder implements PanelSection {
  constructor(readonly host: HTMLElement) {}

  readout(label: string, initial = '—'): Readout {
    const row = document.createElement('div')
    row.className = 'readout'
    const k = document.createElement('span')
    k.className = 'k'
    k.textContent = label
    const v = document.createElement('span')
    v.className = 'v'
    v.textContent = initial
    row.append(k, v)
    this.host.appendChild(row)
    return {
      set: (text, tone) => {
        v.textContent = text
        v.className = 'v' + (tone ? ` tone-${tone}` : '')
      },
    }
  }

  slider(opts: SliderOptions): SliderHandle {
    const row = document.createElement('div')
    row.className = 'slider-row'
    const head = document.createElement('div')
    head.className = 'slider-head'
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = opts.label
    const val = document.createElement('span')
    val.className = 'val'
    head.append(name, val)

    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(opts.min)
    input.max = String(opts.max)
    input.step = String(opts.step ?? 1)
    input.value = String(opts.value)
    input.setAttribute('aria-label', opts.label)

    row.append(head, input)
    this.host.appendChild(row)

    const format = (v: number) => (opts.format ? opts.format(v) : String(v))
    const refresh = () => { val.textContent = format(parseFloat(input.value)) }

    input.addEventListener('input', () => {
      refresh()
      opts.onInput?.(parseFloat(input.value))
    })
    refresh()

    const api: SliderHandle = {
      get: () => parseFloat(input.value),
      set: (v: number) => {
        input.value = String(Math.min(parseFloat(input.max), Math.max(parseFloat(input.min), v)))
        refresh()
      },
      setRange: (min: number, max: number) => {
        input.min = String(min)
        input.max = String(max)
        api.set(api.get())
      },
      setDisabled: (disabled: boolean) => {
        input.disabled = disabled
        row.classList.toggle('is-disabled', disabled)
      },
    }
    return api
  }

  segmented(opts: SegmentedOptions): SegmentedHandle {
    const wrap = document.createElement('div')
    wrap.className = 'seg'
    this.host.appendChild(wrap)

    const buttons = opts.items.map((item) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'seg-btn'
      b.dataset.value = item.value
      const label = document.createElement('span')
      label.className = 't'
      label.textContent = item.label
      b.appendChild(label)
      if (item.sub) {
        const sub = document.createElement('small')
        sub.textContent = item.sub
        b.appendChild(sub)
      }
      b.addEventListener('click', () => {
        setActive(item.value)
        opts.onChange?.(item.value)
      })
      wrap.appendChild(b)
      return b
    })

    function setActive(value: string): void {
      for (const b of buttons) b.classList.toggle('active', b.dataset.value === value)
    }
    if (opts.value !== undefined) setActive(opts.value)

    return { set: setActive }
  }

  button(opts: ButtonOptions): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'btn' + (opts.variant ? ` btn-${opts.variant}` : '')
    b.textContent = opts.label
    if (opts.onClick) b.addEventListener('click', opts.onClick)
    this.host.appendChild(b)
    return b
  }

  toggle(opts: ToggleOptions): ToggleHandle {
    const row = document.createElement('label')
    row.className = 'toggle-row'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = opts.value ?? false
    const span = document.createElement('span')
    span.className = 'toggle-label'
    span.textContent = opts.label
    row.append(input, span)
    this.host.appendChild(row)
    input.addEventListener('change', () => opts.onChange?.(input.checked))
    return { set: (v: boolean) => { input.checked = v } }
  }

  status(): StatusHandle {
    const box = document.createElement('div')
    box.className = 'status'
    this.host.appendChild(box)
    return {
      set: (html: string, tone?: Tone) => {
        box.className = 'status' + (tone ? ` tone-${tone}` : '')
        box.innerHTML = html
      },
    }
  }

  goal(text: string): GoalHandle {
    const g = document.createElement('div')
    g.className = 'goal'
    const star = document.createElement('span')
    star.className = 'star'
    star.textContent = '★'
    const t = document.createElement('span')
    t.className = 'txt'
    t.textContent = text
    g.append(star, t)
    this.host.appendChild(g)
    return {
      setDone: (done: boolean, newText?: string) => {
        g.classList.toggle('done', done)
        if (newText) t.textContent = newText
      },
    }
  }

  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag)
    if (className) n.className = className
    if (text !== undefined) n.textContent = text
    this.host.appendChild(n)
    return n
  }
}
