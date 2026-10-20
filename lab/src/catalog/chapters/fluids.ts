import { L } from '../../core/i18n'
import type { ChapterDef } from '../types'

/**
 * fluids — Fluida
 *
 * One chapter of the curriculum: its learning goals, the simulations that
 * are built, and the roadmap of the ones that are still to come.
 */
export const fluids: ChapterDef =   {
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
  }
