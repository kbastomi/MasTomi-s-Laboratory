import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * mechanics — Mekanika
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const mechanics: ChapterDef =   {
    id: 'mechanics',
    order: 2,
    title: L('Mekanika', 'Mechanics'),
    blurb: L(
      'Mesin sederhana: cara manusia memperoleh keuntungan terhadap gaya dan gerak.',
      'Simple machines: how humans gain leverage over force and motion.',
    ),
    icon: '⚙️',
    accent: '#38d6c4',
    objectives: [
      L('Menentukan torsi dan lengan gaya pada benda yang berporos.', 'Determine torque and lever arm about a pivot.'),
      L('Menghitung keuntungan mekanis mesin sederhana.', 'Calculate the mechanical advantage of a simple machine.'),
      L('Menganalisis keseimbangan pada sistem katrol dan bidang miring.', 'Analyse equilibrium in pulley and inclined-plane systems.'),
    ],
    labs: [
      {
        id: 'mechanics.lever',
        room: 'mechanics',
        title: L('Tuas', 'Lever'),
        blurb: L(
          'Balok pada sebuah tumpuan. Geser beban dan gaya di kedua lengan, lalu lihat pertengkaran torsi secara langsung.',
          'A beam on a fulcrum. Slide the load and the effort along both arms and watch the torques fight it out.',
        ),
        tags: [L('torsi', 'torque'), L('keuntungan mekanis', 'mechanical advantage'), L('keseimbangan', 'equilibrium')],
        level: 2,
        mode: ['sim', 'demo'],
        concepts: [
          L('τ = F × r', 'τ = F × r'),
          L('MA = lengan gaya / lengan beban', 'MA = effort arm / load arm'),
          L('F₁r₁ = F₂r₂ saat seimbang', 'F₁r₁ = F₂r₂ at equilibrium'),
        ],
        estMinutes: 10,
        camera: { target: [0, 2.6, 0], radius: 13.2, azim: 0, polar: 1.35 },
        load: () => import('../../rooms/mechanics/lever'),
      },
      {
        id: 'mechanics.pulley',
        room: 'mechanics',
        title: L('Katrol', 'Pulley'),
        blurb: L(
          'Katrol tetap, katrol bergerak, dan tackle bertingkat. Hitung jumlah tali penahan beban — itulah keuntungan mekanisnya.',
          'Fixed pulley, movable pulley and block-and-tackle rigs. Count the strands holding the load — that is your advantage.',
        ),
        tags: [L('katrol', 'pulley'), L('keuntungan mekanis', 'mechanical advantage'), L('katrol majemuk', 'block & tackle')],
        level: 3,
        mode: ['sim', 'demo'],
        concepts: [
          L('MA = jumlah untai tali penahan beban', 'MA = number of supporting strands'),
          L('F_in = W / MA', 'F_in = W / MA'),
          L('F_in × s = W × h', 'F_in × s = W × h'),
        ],
        estMinutes: 12,
        camera: { target: [0, 3.1, 0], radius: 15.5, azim: 0, polar: 1.33 },
        load: () => import('../../rooms/mechanics/pulley'),
      },
      {
        id: 'mechanics.incline',
        room: 'mechanics',
        title: L('Bidang Miring', 'Inclined Plane'),
        blurb: L(
          'Naik atau turun diactivated bidang miring. Atur kemiringan dan fri, lihat berapa gaya yang benar-benar dibutuhkan.',
          'Going up or down a ramp. Set the slope and the friction, and see how much push you really need.',
        ),
        tags: [L('bidang miring', 'inclined plane'), L('gaya gesek', 'friction'), L('gaya normal', 'normal force')],
        level: 3,
        mode: ['sim', 'demo'],
        concepts: [
          L('F = mg sin θ', 'F = mg sin θ'),
          L('N = mg cos θ', 'N = mg cos θ'),
          L('f = μN', 'f = μN'),
        ],
        estMinutes: 10,
        camera: { target: [2.9, 1.15, 0], radius: 10.4, azim: 0, polar: 1.44 },
        load: () => import('../../rooms/mechanics/incline'),
      },
    ],
    planned: [
      {
        id: 'mechanics.gears',
        title: L('Roda Gigi', 'Gear Train'),
        blurb: L('Roda gigi bertautan: rasio gigi menentukan kecepatan dan torsi.', 'Interlocking gears: the tooth ratio sets speed and torque.'),
      },
      {
        id: 'mechanics.wheel-axle',
        title: L('Roda & Poros', 'Wheel and Axle'),
        blurb: L('Memutar roda besar versus poros kecil.', 'Turning a big wheel versus a small axle.'),
      },
      {
        id: 'mechanics.com',
        title: L('Pusat Massa', 'Centre of Mass'),
        blurb: L('Di mana titik tumpu harus diletakkan agar benda tidak jatuh.', 'Where to place the pivot so the object does not topple.'),
      },
    ],
  }
