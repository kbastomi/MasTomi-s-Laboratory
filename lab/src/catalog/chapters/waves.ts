import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * waves — Gelombang
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const waves: ChapterDef =   {
    id: 'waves',
    order: 6,
    title: L('Gelombang', 'Waves'),
    blurb: L(
      'Getaran yang merambat: gelombang tali, gelombang berdiri, dan suara.',
      'Vibrations that travel — string waves, standing waves and sound.',
    ),
    icon: '🌊',
    accent: '#4cc9f0',
    objectives: [
      L('Menghubungkan frekuensi, panjang gelombang, dan kecepatan rambat.', 'Relate frequency, wavelength and wave speed.'),
      L('Memahami resonansi dan gelombang berdiri.', 'Understand resonance and standing waves.'),
      L('Menjelaskan efek Doppler pada bunyi.', 'Explain the Doppler effect for sound.'),
    ],
    labs: [],
    planned: [
      {
        id: 'waves.transverse',
        title: L('Gelombang Transversal', 'Transverse Wave'),
        blurb: L('Getarkan ujung tali, lihat gelombang merambat.', 'Shake the end of a rope and watch the wave travel.'),
      },
      {
        id: 'waves.standing',
        title: L('Gelombang Berdiri & Resonansi', 'Standing Waves & Resonance'),
        blurb: L('Cari panjang tali yang beresonansi.', 'Find the rope length that resonates.'),
      },
      {
        id: 'waves.doppler',
        title: L('Bunyi & Efek Doppler', 'Sound & Doppler'),
        blurb: L('Sumber bunyi bergerak, frekuensi yang terdengar berubah.', 'A moving source changes the pitch you hear.'),
      },
    ],
  }
