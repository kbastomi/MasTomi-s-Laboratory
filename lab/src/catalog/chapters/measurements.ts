import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * measurements — Pengukuran & Satuan
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const measurements: ChapterDef =   {
    id: 'measurements',
    order: 1,
    title: L('Pengukuran & Satuan', 'Measurements & Units'),
    blurb: L(
      'Dasar seluruh ilmu alam: mengukur besaran, membandingkannya dengan acuan, dan membaca alat ukur.',
      'The foundation of all science: measuring a quantity, comparing it with a standard, and reading an instrument.',
    ),
    icon: '📐',
    accent: '#f6d365',
    objectives: [
      L('Membaca skala alat ukur dan menulis hasil pengukuran beserta satuannya.', 'Read instrument scales and write a measurement with its unit.'),
      L('Menghitung massa jenis dari hasil pengukuran massa dan volume.', 'Calculate density from measured mass and volume.'),
      L('Mengubah besaran vektor menjadi komponen dan menjumlahkan dua vektor.', 'Resolve a vector into components and add two vectors.'),
    ],
    labs: [
      {
        id: 'measurements.apparatus',
        room: 'measurements',
        title: L('Alat Ukur', 'Measuring Instruments'),
        blurb: L(
          'Jangka pengukur, mikrometer sekrup, timbangan Ohaus, dan stopwatch analog. Baca skalaannya seperti yang dilakukan di lab.',
          'Vernier caliper, micrometer, Ohaus balance and an analog stopwatch. Read their scales the way you would in a real laboratory.',
        ),
        tags: [L('alat ukur', 'instruments'), L('ketelitian', 'precision'), L('skala', 'scale')],
        level: 1,
        mode: ['sim', 'demo'],
        concepts: [
          L('Pembacaan = skala utama + divisi kecil', 'reading = main scale + small division'),
          L('Jangka: 1 divisi = 0,1 mm', 'Vernier: 1 division = 0.1 mm'),
          L('Mikrometer: 1 divisi = 0,01 mm', 'Micrometer: 1 division = 0.01 mm'),
        ],
        estMinutes: 15,
        camera: { target: [2.9, 0.1, 0], radius: 8.2, azim: 0, polar: 0.62 },
        load: () => import('../../rooms/measurements/apparatus'),
      },
      {
        id: 'measurements.density',
        room: 'measurements',
        title: L('Massa Jenis', 'Density'),
        blurb: L(
          'Ukur massa dan volume benda kaca, lalu hitung massa jenisnya — beserta ketidakpastian pembukurannya.',
          'Measure the mass and volume of a glass object, then calculate its density — and how uncertain that density is.',
        ),
        tags: [L('massa jenis', 'density'), L('volume', 'volume'), L('ketidakpastian', 'uncertainty')],
        level: 2,
        mode: ['sim', 'demo'],
        concepts: [
          L('ρ = m / V', 'ρ = m / V'),
          L('δρ/ρ = δm/m + δV/V', 'δρ/ρ = δm/m + δV/V'),
          L('kaca ≈ 2,5 g/cm³', 'glass ≈ 2.5 g/cm³'),
        ],
        estMinutes: 12,
        camera: { target: [0, 1.2, 0], radius: 8, azim: 0, polar: 1.25 },
        load: () => import('../../rooms/measurements/density'),
      },
      {
        id: 'measurements.vectors',
        room: 'measurements',
        title: L('Vektor', 'Vectors'),
        blurb: L(
          'Uraikan vektor menjadi komponen x dan y, lalu jumlahkan dua vektor dengan aturan paralelogram.',
          'Resolve a vector into x and y components, then add two vectors with the parallelogram rule.',
        ),
        tags: [L('vektor', 'vectors'), L('komponen', 'components'), L('resultan', 'resultant')],
        level: 2,
        mode: ['sim', 'demo'],
        concepts: [
          L('Ax = R cos θ,  Ay = R sin θ', 'Ax = R cos θ,  Ay = R sin θ'),
          L('R = A + B', 'R = A + B'),
          L('|R| = √(Rx² + Ry²)', '|R| = √(Rx² + Ry²)'),
        ],
        estMinutes: 12,
        camera: { target: [0, 0.6, 0], radius: 9, azim: 0, polar: 1.05 },
        load: () => import('../../rooms/measurements/vectors'),
      },
    ],
    planned: [
      {
        id: 'measurements.error',
        title: L('Kesalahan Pengukuran', 'Measurement Error'),
        blurb: L('Galat absolut, galat relatif, dan cara membulatkan hasil.', 'Absolute and relative error, and how to round a result.'),
      },
      {
        id: 'measurements.conversion',
        title: L('Konversi Satuan', 'Unit Conversion'),
        blurb: L('Satuan SI, prefiks, dan mengubah antar satuan.', 'SI units, prefixes, and converting between them.'),
      },
      {
        id: 'measurements.dimensional',
        title: L('Analisis Dimensi', 'Dimensional Analysis'),
        blurb: L('Memeriksa apakah satuan sebuah rumus masuk akal.', 'Checking that the units of a formula make sense.'),
      },
    ],
  }
