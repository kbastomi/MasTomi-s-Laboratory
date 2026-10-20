import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * thermo — Termodinamika
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const thermo: ChapterDef =   {
    id: 'thermo',
    order: 8,
    title: L('Termodinamika', 'Thermodynamics'),
    blurb: L(
      'Suhu, kalor, dan perubahan wujud — serta cara mesin kalor mengubah panas jadi kerja.',
      'Temperature, heat and phase changes — and how heat engines turn heat into work.',
    ),
    icon: '🌡️',
    accent: '#ff8fab',
    objectives: [
      L('Menghubungkan kalor, massa, dan perubahan suhu.', 'Connect heat, mass and temperature change.'),
      L('Menerapkan persamaan gas ideal.', 'Apply the ideal gas equation.'),
      L('Menilai efisiensi mesin kalor.', 'Judge the efficiency of a heat engine.'),
    ],
    labs: [],
    planned: [
      {
        id: 'thermo.expansion',
        title: L('Suhu & Pemuaian', 'Temperature & Expansion'),
        blurb: L('Panaskan benda, lihat panjangnya berubah.', 'Heat an object and watch it change length.'),
      },
      {
        id: 'thermo.ideal-gas',
        title: L('Gas Ideal', 'Ideal Gas'),
        blurb: L('P, V, dan T dalam satu tabung.', 'Pressure, volume and temperature in one tube.'),
      },
      {
        id: 'thermo.engine',
        title: L('Mesin Kalor', 'Heat Engine'),
        blurb: L('Ubah siklus, lihat efisiensi berubah.', 'Change the cycle and watch the efficiency move.'),
      },
    ],
  }
