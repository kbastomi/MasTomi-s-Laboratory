import { L } from '../core/i18n'
import type { ChapterDef } from '../core/lab'

/**
 * The curriculum catalogue.
 *
 * Every chapter lives here with its learning objectives and its roadmap, so
 * adding a lab later is a one-line change in this file plus the lab module
 * itself. Nothing in the engine needs to know a chapter exists.
 */
export const CHAPTERS: ChapterDef[] = [
  {
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
        load: () => import('../rooms/measurements/apparatus'),
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
        load: () => import('../rooms/measurements/density'),
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
        load: () => import('../rooms/measurements/vectors'),
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
  },
  {
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
        load: () => import('../rooms/mechanics/lever'),
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
        load: () => import('../rooms/mechanics/pulley'),
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
        load: () => import('../rooms/mechanics/incline'),
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'waves',
    order: 6,
    title: L('Gelombang', 'Waves'),
    blurb: L(
      'Getaran yang merambat: gelombang tali, gelombang berdiri, dan suara.',
      'Vibrations that travel — string waves, standing waves and sound.',
    ),
    icon: '🌊',
    accent: '#4cc9f0',
    objectives: [
      L('Menghubungkan frekuensi, panjang gelombang, dan kecepatan rambat.', 'Relate frequency, wavelength and wave speed.'),
      L('Memahami resonansi dan gelombang berdiri.', 'Understand resonance and standing waves.'),
      L('Menjelaskan efek Doppler pada bunyi.', 'Explain the Doppler effect for sound.'),
    ],
    labs: [],
    planned: [
      {
        id: 'waves.transverse',
        title: L('Gelombang Transversal', 'Transverse Wave'),
        blurb: L('Getarkan ujung tali, lihat gelombang merambat.', 'Shake the end of a rope and watch the wave travel.'),
      },
      {
        id: 'waves.standing',
        title: L('Gelombang Berdiri & Resonansi', 'Standing Waves & Resonance'),
        blurb: L('Cari panjang tali yang beresonansi.', 'Find the rope length that resonates.'),
      },
      {
        id: 'waves.doppler',
        title: L('Bunyi & Efek Doppler', 'Sound & Doppler'),
        blurb: L('Sumber bunyi bergerak, frekuensi yang terdengar berubah.', 'A moving source changes the pitch you hear.'),
      },
    ],
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    id: 'fluids',
    order: 10,
    title: L('Fluida', 'Fluids'),
    blurb: L(
      'Cairan dan gas: tekanan, gaya apung, dan aliran.',
      'Liquids and gases: pressure, buoyancy and flow.',
    ),
    icon: '💧',
    accent: '#48cae4',
    objectives: [
      L('Menghubungkan tekanan, gaya, dan luas.', 'Relate pressure, force and area.'),
      L('Menjelaskan gaya apung Archimedes.', 'Explain Archimedes’ buoyancy.'),
      L('Menerapkan persamaan Bernoulli pada aliran.', 'Apply Bernoulli to flowing fluid.'),
    ],
    labs: [],
    planned: [
      {
        id: 'fluids.pressure',
        title: L('Tekanan & Pascal', 'Pressure & Pascal'),
        blurb: L('Pompa hidrolik mengirim tekanan ke mana saja.', 'A hydraulic press pushes pressure anywhere.'),
      },
      {
        id: 'fluids.buoyancy',
        title: L('Gaya Apung', 'Buoyancy'),
        blurb: L('Tenggelam, melayang, atau melayang apung.', 'Sink, float, or hover in between.'),
      },
      {
        id: 'fluids.bernoulli',
        title: L('Bernoulli', 'Bernoulli'),
        blurb: L('Alir cepat di tempat sempit.', 'Flow speeds up where the pipe narrows.'),
      },
    ],
  },
  {
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
  },
]

export function chapterById(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

export function allLabs() {
  return CHAPTERS.flatMap((c) => c.labs)
}

export function labById(id: string) {
  return allLabs().find((l) => l.id === id)
}
