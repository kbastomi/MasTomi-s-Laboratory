import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * emag — Listrik & Magnet
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const emag: ChapterDef =   {
    id: 'emag',
    order: 9,
    title: L('Listrik & Magnet', 'Electricity & Magnetism'),
    blurb: L(
      'Arus listrik, medan magnet, dan cara keduanya bertemu di motor.',
      'Electric current, magnetic fields, and where the two meet: the motor.',
    ),
    icon: '🧲',
    accent: '#7ae582',
    objectives: [
      L('Menghitung arus, tegangan, dan hambatan pada rangkaian.', 'Calculate current, voltage and resistance in circuits.'),
      L('Melukis medan magnet di sekitar kawat dan solenoid.', 'Sketch the field around a wire and a solenoid.'),
      L('Menjelaskan induksi elektromagnetik dan motor.', 'Explain electromagnetic induction and motors.'),
    ],
    labs: [],
    planned: [
      {
        id: 'emag.ohm',
        title: L('Hukum Ohm & Rangkaian', "Ohm's Law & Circuits"),
        blurb: L('Rangkaian seri dan paralel dengan penghayati.', 'Series and parallel circuits with real components.'),
      },
      {
        id: 'emag.field',
        title: L('Medan Magnet', 'Magnetic Fields'),
        blurb: L('Medan di sekitar kawat, solenoid, dan magnet.', 'Fields around wires, solenoids and magnets.'),
      },
      {
        id: 'emag.motor',
        title: L('Motor & Induksi', 'Motor & Induction'),
        blurb: L('Gaya magnet pada kawat berarus.', 'Magnetic force on a current-carrying wire.'),
      },
    ],
  }
