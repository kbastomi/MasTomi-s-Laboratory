import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * energy — Usaha & Energi
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const energy: ChapterDef =   {
    id: 'energy',
    order: 5,
    title: L('Usaha & Energi', 'Work & Energy'),
    blurb: L(
      'Energi berpindah dari satu bentuk ke bentuk lain — dan bagaimana kerja dihitung.',
      'Energy moving between forms — and how work is counted.',
    ),
    icon: '⚡',
    accent: '#ffd166',
    objectives: [
      L('Menghubungkan usaha dengan perubahan energi kinetik.', 'Relate work to the change in kinetic energy.'),
      L('Menyimpan dan melepaskan energi potensial.', 'Store and release potential energy.'),
      L('Menghitung daya dan efisiensi mesin.', 'Calculate power and machine efficiency.'),
    ],
    labs: [],
    planned: [
      {
        id: 'energy.ke-pe',
        title: L('Energi Kinetik & Potensial', 'Kinetic & Potential Energy'),
        blurb: L('Jatuh bola dari ketinggian berbeda, bandingkan energi.', 'Drop a ball from different heights and compare the energy.'),
      },
      {
        id: 'energy.spring',
        title: L('Pegas', 'Spring'),
        blurb: L('Kompres pegas, gunakan Hooke.', 'Compress a spring and use Hooke’s law.'),
      },
      {
        id: 'energy.power',
        title: L('Daya & Efisiensi', 'Power & Efficiency'),
        blurb: L('Berapa cepat pekerjaanmu selesai, dan berapa banyak yang hilang.', 'How fast you finish the job, and how much is wasted.'),
      },
    ],
  }
