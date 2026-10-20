import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * modern — Fisika Modern
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const modern: ChapterDef =   {
    id: 'modern',
    order: 11,
    title: L('Fisika Modern', 'Modern Physics'),
    blurb: L(
      'Dunia kuantum: atom, foton, dan radioaktivitas.',
      'The quantum world: atoms, photons and radioactivity.',
    ),
    icon: '⚛️',
    accent: '#a0c4ff',
    objectives: [
      L('Membedakan model atom Bohr dari model Rutherford.', 'Compare the Bohr and Rutherford atom models.'),
      L('Menjelaskan efek fotoelektrik dan dualisme gelombang-partikel.', 'Explain the photoelectric effect and wave-particle duality.'),
      L('Menghitung waktu paruh pelebaran radioaktif.', 'Calculate radioactive half-life.'),
    ],
    labs: [],
    planned: [
      {
        id: 'modern.atom',
        title: L('Model Atom', 'Atomic Models'),
        blurb: L('Model Thomson, Rutherford, dan Bohr.', 'Thomson, Rutherford and Bohr side by side.'),
      },
      {
        id: 'modern.photoelectric',
        title: L('Efek Fotoelektrik', 'Photoelectric Effect'),
        blurb: L('Kunci foton mattered: energi dan frekuensi.', 'Light quanta: energy and threshold frequency.'),
      },
      {
        id: 'modern.radioactivity',
        title: L('Radioaktivitas', 'Radioactivity'),
        blurb: L('Laju pelingan isotop dan waktu paruh.', 'Decay rates and half-lives.'),
      },
    ],
  }
