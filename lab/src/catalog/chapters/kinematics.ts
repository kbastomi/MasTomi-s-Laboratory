import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * kinematics — Kinematika
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const kinematics: ChapterDef =   {
    id: 'kinematics',
    order: 3,
    title: L('Kinematika', 'Kinematics'),
    blurb: L(
      'Geraknya seperti apa: posisi, kecepatan, percepatan — tanpa menjawab “mengapa”.',
      'How things move: position, velocity, acceleration — described without asking why.',
    ),
    icon: '📈',
    accent: '#ff9f43',
    objectives: [
      L('Membaca grafik posisi, kecepatan, dan percepatan.', 'Read position, velocity and acceleration graphs.'),
      L('Menganalisis gerak parabola dan gerak jatuh bebas.', 'Analyse projectile motion and free fall.'),
      L('Menghubungkan percepatan dengan perubahan kecepatan.', 'Link acceleration to the change in velocity.'),
    ],
    labs: [],
    planned: [
      {
        id: 'kinematics.projectile',
        title: L('Gerak Parabola', 'Projectile Motion'),
        blurb: L('Lontarkan bola, lihat jalur dan komponen kecepatannya.', 'Launch a ball; watch its path and its velocity components.'),
      },
      {
        id: 'kinematics.freefall',
        title: L('Jatuh Bebas', 'Free Fall'),
        blurb: L('Lepaskan bola dari ketinggian berbeda.', 'Drop a ball from different heights.'),
      },
      {
        id: 'kinematics.vt-graph',
        title: L('Grafik v–t', 'Velocity–Time Graph'),
        blurb: L('Luncur, perlambat, dan baca luas di bawah grafik.', 'Launch, decelerate, and read the area under the graph.'),
      },
    ],
  }
