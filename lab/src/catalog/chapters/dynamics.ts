import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * dynamics — Dinamika
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const dynamics: ChapterDef =   {
    id: 'dynamics',
    order: 4,
    title: L('Dinamika', 'Dynamics'),
    blurb: L(
      'Mengapa benda bergerak seperti itu — gaya, momentum, dan tumbukan.',
      'Why things move the way they do — forces, momentum and collisions.',
    ),
    icon: '💥',
    accent: '#ff6b6b',
    objectives: [
      L('Menghubungkan resultan gaya dengan percepatan.', 'Connect the net force to acceleration.'),
      L('Memahami kekekalan momentum pada tumbukan.', 'Understand momentum conservation in collisions.'),
      L('Menghitung gaya gesek pada berbagai permukaan.', 'Calculate friction forces on different surfaces.'),
    ],
    labs: [],
    planned: [
      {
        id: 'dynamics.newton',
        title: L('Hukum Newton', "Newton's Laws"),
        blurb: L('Dorong, tarik, dan lihat F = m × a secara langsung.', 'Push, pull, and watch F = ma come alive.'),
      },
      {
        id: 'dynamics.friction',
        title: L('Gaya Gesek', 'Friction'),
        blurb: L('Berhenti di bawah permukaan yang berbeda.', 'Sliding to a stop on different surfaces.'),
      },
      {
        id: 'dynamics.collision',
        title: L('Tumbukan', 'Collisions'),
        blurb: L('Bola-bola bertumbukan: elastis atau tidak.', 'Balls colliding: elastic or not.'),
      },
    ],
  }
