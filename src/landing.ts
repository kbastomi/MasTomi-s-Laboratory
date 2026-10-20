/**
 * The landing page at the domain root.
 *
 * It is intentionally plain — no WebGL, no framework — so it paints almost
 * instantly and costs nothing on a phone. The catalogue it shows is imported
 * from the same module the laboratory uses, so the two can never disagree.
 */
import './landing.css'
import { CHAPTERS } from '../lab/src/catalog/chapters'
import { L, getLang, initLang, onLangChange, setLang, t } from '../lab/src/core/i18n'

initLang()

const root = document.getElementById('landing')!

interface Copy {
  eyebrow: string
  title: string
  titleAccent: string
  lede: string
  cta: string
  rooms: string
  roomsSub: string
  live: string
  liveSub: string
  planned: string
  plannedSub: string
  enter: string
  chapters: string
  chaptersSub: string
  built: string
  soon: string
  footer: string
  langLabel: string
}

const COPY: Record<'id' | 'en', Copy> = {
  id: {
    eyebrow: 'Laboratorium fisika virtual',
    title: 'MasTomi’s',
    titleAccent: 'Laboratory',
    lede:
      'Sepuluh ruang, tiap ruang satu bab ilmu fisika. Semua simulasi bisa kamu sentuh, ubah parameternya, dan coba sampai benar-benar paham — bukan sekadar menghafal rumus.',
    cta: 'Masuk ke laboratorium',
    rooms: 'Ruang',
    roomsSub: 'satu untuk tiap bab',
    live: 'Simulasi siap',
    liveSub: 'bisa langsung dicoba',
    planned: 'Direncanakan',
    plannedSub: 'segera hadir',
    enter: 'Buka',
    chapters: 'Isi laboratorium',
    chaptersSub: 'Setiap ruang punya beberapa simulasi dan demonstrasi yang bisa kamu sentuh sendiri.',
    built: 'siap',
    soon: 'segera',
    footer: 'Dibangun dengan three.js — berjalan di browser, tanpa pemasangan apa pun.',
    langLabel: 'Bahasa',
  },
  en: {
    eyebrow: 'A virtual physics laboratory',
    title: 'MasTomi’s',
    titleAccent: 'Laboratory',
    lede:
      'Ten rooms, each one a chapter of physics. Every simulation can be touched, re-tuned and played with until it genuinely makes sense — instead of just memorising a formula.',
    cta: 'Enter the laboratory',
    rooms: 'Rooms',
    roomsSub: 'one per chapter',
    live: 'Simulations ready',
    liveSub: 'open and play now',
    planned: 'Planned',
    plannedSub: 'coming soon',
    enter: 'Open',
    chapters: 'What is inside',
    chaptersSub:
      'Every room holds several simulations and demonstrations you can work with yourself.',
    built: 'ready',
    soon: 'soon',
    footer: 'Built with three.js — runs in the browser, nothing to install.',
    langLabel: 'Language',
  },
}

function render(): void {
  const c = COPY[getLang()]
  const liveCount = CHAPTERS.reduce((n, ch) => n + ch.labs.length, 0)
  const plannedCount = CHAPTERS.reduce((n, ch) => n + ch.planned.length, 0)

  root.innerHTML = `
    <div class="bg-grid" aria-hidden="true"></div>

    <header class="site-head">
      <a class="brand" href="/">
        <span class="mark" aria-hidden="true">⚛</span>
        <span>MasTomi’s Laboratory</span>
      </a>
      <button class="lang" type="button" aria-label="${c.langLabel}">
        <span class="${getLang() === 'id' ? 'on' : ''}">ID</span> ·
        <span class="${getLang() === 'en' ? 'on' : ''}">EN</span>
      </button>
    </header>

    <main>
      <section class="hero">
        <p class="eyebrow">${c.eyebrow}</p>
        <h1>${c.title}<br /><span>${c.titleAccent}</span></h1>
        <p class="lede">${c.lede}</p>
        <a class="cta" href="/lab/">${c.cta} <span aria-hidden="true">→</span></a>

        <div class="stats">
          <div><b>${CHAPTERS.length}</b><span>${c.rooms}</span><i>${c.roomsSub}</i></div>
          <div><b>${liveCount}</b><span>${c.live}</span><i>${c.liveSub}</i></div>
          <div><b>${plannedCount}</b><span>${c.planned}</span><i>${c.plannedSub}</i></div>
        </div>
      </section>

      <section class="chapters">
        <h2>${c.chapters}</h2>
        <p class="sub">${c.chaptersSub}</p>
        <div class="grid">
          ${CHAPTERS.map(
            (ch) => `
            <article class="card" style="--accent:${ch.accent}">
              <div class="ico">${ch.icon}</div>
              <h3>${t(ch.title)}</h3>
              <p>${t(ch.blurb)}</p>
              <div class="meta">
                <span class="tag ${ch.labs.length ? 'ok' : ''}">${ch.labs.length} ${c.built}</span>
                ${ch.planned.length ? `<span class="tag">${ch.planned.length} ${c.soon}</span>` : ''}
              </div>
              <a class="enter" href="/lab/#/room/${ch.id}">${c.enter} <span aria-hidden="true">→</span></a>
            </article>`,
          ).join('')}
        </div>
      </section>
    </main>

    <footer class="site-foot">
      <p>${c.footer}</p>
      <p class="dim">© ${new Date().getFullYear()} MasTomi’s Laboratory</p>
    </footer>
  `

  const langBtn = root.querySelector('.lang') as HTMLButtonElement
  langBtn.addEventListener('click', () => {
    setLang(getLang() === 'id' ? 'en' : 'id')
  })
}

onLangChange(render)
render()
