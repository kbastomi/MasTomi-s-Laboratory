import './styles/base.css'
import './styles/components.css'

import { App } from './app'
import { initLang } from './core/i18n'

/**
 * Bootstrap.
 *
 * The language is resolved before anything is drawn, so the first paint is
 * already in the right language — no flash of English on an Indonesian device.
 */
initLang()

const root = document.getElementById('app')
if (!root) throw new Error('#app is missing from the document')

const app = new App(root)
void app.boot()

/* handy for tinkering from the browser console */
;(window as unknown as { APP: App }).APP = app
