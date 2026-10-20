import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * optics — Optika
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const optics: ChapterDef =   {
    id: 'optics',
    order: 7,
    title: L('Optika', 'Optics'),
    blurb: L(
      'Perjalanan cahaya: pantulan, pembiasan, dan disperse.',
      'The journey of light: reflection, refraction and dispersion.',
    ),
    icon: '🔦',
    accent: '#b388ff',
    objectives: [
      L('Menerapkan hukum pemantulan dan pembiasan.', 'Apply the laws of reflection and refraction.'),
      L('Menentukan titik fokus pada cermin dan lensa.', 'Locate the focus of mirrors and lenses.'),
      L('Menjelaskan kenapa prisma memecah cahaya putih.', 'Explain why a prism splits white light.'),
    ],
    labs: [],
    planned: [
      {
        id: 'optics.mirrors',
        title: L('Cermin', 'Mirrors'),
        blurb: L('Cermin datar, cekung, dan cembung.', 'Flat, concave and convex mirrors.'),
      },
      {
        id: 'optics.lenses',
        title: L('Lensa', 'Lenses'),
        blurb: L('Lensa cekung dan cembung membentuk bayangan.', 'Concave and convex lenses forming images.'),
      },
      {
        id: 'optics.prism',
        title: L('Prisma & Dispersi', 'Prism & Dispersion'),
        blurb: L('Pecahkan cahaya putih menjadi spektrum.', 'Split white light into a spectrum.'),
      },
    ],
  }
