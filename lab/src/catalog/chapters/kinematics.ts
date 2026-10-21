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
    labs: [
      {
        id: 'kinematics.projectile',
        room: 'kinematics',
        title: L('Gerak Parabola', 'Projectile Motion'),
        blurb: L(
          'Lontarkan bola dan lihat jalurnya: komponen kecepatan, jangkauan, tinggi maksimum — dan bedanya dengan hambatan udara.',
          'Launch a ball and watch its path: the velocity components, the range, the maximum height — and how much air resistance changes them.',
        ),
        tags: [L('gerak parabola', 'projectile motion'), L('komponen', 'components'), L('hambatan udara', 'air resistance')],
        level: 3,
        mode: ['sim', 'demo'],
        concepts: [
          L('R = v₀² sin 2θ / g', 'R = v₀² sin 2θ / g'),
          L('H = v₀² sin²θ / 2g', 'H = v₀² sin²θ / 2g'),
          L('vx konstan, vy berubah', 'vx is constant, vy changes'),
        ],
        estMinutes: 12,
        camera: { target: [1.2, 1.2, 0], radius: 11, azim: 0, polar: 1.3 },
        load: () => import('../../rooms/kinematics/projectile'),
      },
      {
        id: 'kinematics.freefall',
        room: 'kinematics',
        title: L('Jatuh Bebas', 'Free Fall'),
        blurb: L(
          'Lepaskan benda dari ketinggian berbeda. Tanpa hambatan udara, massanya tidak berpengaruh sama sekali.',
          'Drop an object from different heights. Without air resistance its mass makes no difference at all.',
        ),
        tags: [L('jatuh bebas', 'free fall'), L('percepatan gravitasi', 'gravity'), L('hambatan udara', 'air resistance')],
        level: 2,
        mode: ['sim', 'demo'],
        concepts: [
          L('h = ½ g t²', 'h = ½ g t²'),
          L('v = g t', 'v = g t'),
          L('massa tidak berpengaruh tanpa hambatan udara', 'mass makes no difference without air resistance'),
        ],
        estMinutes: 10,
        camera: { target: [0, 3, 0], radius: 12, azim: 0, polar: 1.3 },
        load: () => import('../../rooms/kinematics/freefall'),
      },
    ],
    planned: [
      {
        id: 'kinematics.vt-graph',
        title: L('Grafik v–t', 'Velocity–Time Graph'),
        blurb: L('Luncur, perlambat, dan baca luas di bawah grafik.', 'Launch, decelerate, and read the area under the graph.'),
      },
    ],
  }
