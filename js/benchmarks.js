/**
 * benchmarks.js — Centralized emission factors and reference benchmarks.
 * Single source of truth for all numeric constants.
 * Never hardcode emission factors outside this file.
 *
 * Sources:
 *  - IPCC AR6 WG3, 2022 — transport emission factors
 *  - CEA India, 2023 — electricity grid emission factor
 *  - MoPNG India, 2023 — LPG cylinder emission factor
 *  - ICAO Carbon Emissions Calculator — aviation factors
 *  - Poore & Nemecek, Oxford 2018, Science — diet factors
 *  - World Bank, 2022 — per capita CO₂ benchmarks
 *  - IPCC SR1.5, 2018 — Paris Agreement target
 *
 * @module benchmarks
 */

'use strict';

const BENCHMARKS = Object.freeze({

  /**
   * Emission factors in kg CO₂ per unit.
   * @type {Object}
   */
  factors: Object.freeze({

    /** Transport — kg CO₂ per km (IPCC AR6 WG3 Table 10.8) */
    transport: Object.freeze({
      petrol_car:     0.192,
      diesel_car:     0.171,
      motorcycle:     0.103,
      public_transit: 0.089,
      walk_cycle:     0.000,
    }),

    /** Flights — kg CO₂ per one-way flight (ICAO Carbon Emissions Calculator) */
    flights: Object.freeze({
      short_haul: 255,
      long_haul:  1620,
    }),

    /** Electricity — kg CO₂ per kWh (CEA India 2023 Grid Emission Factor) */
    electricity: 0.716,

    /** LPG — kg CO₂ per 14.2kg cylinder (MoPNG India 2023) */
    lpg_cylinder: 29.5,

    /** Natural gas — kg CO₂ per m³ (IPCC AR6) */
    natural_gas_m3: 2.04,

    /** Diet — kg CO₂ per year (Poore & Nemecek, Oxford 2018, Science) */
    diet: Object.freeze({
      vegan:        1100,
      vegetarian:   1500,
      pescatarian:  1900,
      omnivore:     2500,
      meat_heavy:   3300,
    }),

    /** Shopping — approximate kg CO₂ per unit (IPCC consumption sector) */
    shopping: Object.freeze({
      clothing_item:  27,   // per item
      electronics:    70,   // per device per year
      online_order:   0.5,  // per delivery
    }),

    /** Fuel cost for financial savings — ₹ per litre (India avg 2024) */
    fuel_cost_inr: 102,

    /** Electricity cost — ₹ per kWh (India residential avg 2024) */
    electricity_cost_inr: 6.5,

    /** LPG cost — ₹ per cylinder (India 2024) */
    lpg_cost_inr: 850,
  }),

  /**
   * Population-level CO₂ benchmarks in kg per year.
   * @type {Object}
   */
  benchmarks: Object.freeze({
    global:        4700,  // World Bank 2022 global per capita
    india:         1900,  // World Bank 2022 India per capita
    paris_target:  2100,  // IPCC SR1.5 — 1.5°C-aligned per capita budget

    /**
     * Persona-specific averages derived from India national average.
     * Methodology: India avg adjusted by IPCC sector weightings for
     * urban lifestyle patterns (CEA 2023, MoPNG 2023).
     */
    by_persona: Object.freeze({
      student:      1400,  // India avg × 0.74 (shared resources, campus transport)
      professional: 2200,  // India avg × 1.16 (commute, business travel)
      family:       2600,  // India avg × 1.37 per person (car, appliances)
    }),

    /** India average breakdown by category in kg CO₂ per year */
    by_category: Object.freeze({
      transport: 650,   // CEA + MoPNG sector data
      energy:    570,   // CEA 2023 residential
      diet:      500,   // Poore & Nemecek 2018, India weighted
      shopping:  180,   // IPCC consumption estimate
    }),
  }),

  /**
   * Goal targets in kg CO₂ per year.
   * @type {Object}
   */
  goal_targets: Object.freeze({
    save_money:    null,  // no fixed CO₂ target — maximise ₹ savings
    reduce_co2:    null,  // no fixed target — maximise CO₂ reduction
    india_average: 1900,  // World Bank 2022
    paris_target:  2100,  // IPCC SR1.5
  }),

  /**
   * EcoScore weights by category.
   * Must sum to 1.0.
   * @type {Object}
   */
  ecoscore_weights: Object.freeze({
    transport: 0.35,
    energy:    0.30,
    diet:      0.25,
    shopping:  0.10,
  }),

  /**
   * Goal scoring weights: co2 + money + preference must sum to 1.0.
   * @type {Object}
   */
  goal_weights: Object.freeze({
    save_money:    { co2: 0.20, money: 0.60, preference: 0.20 },
    reduce_co2:    { co2: 0.70, money: 0.10, preference: 0.20 },
    india_average: { co2: 0.55, money: 0.25, preference: 0.20 },
    paris_target:  { co2: 0.70, money: 0.10, preference: 0.20 },
  }),

  /** Regional India electricity grid emission factors (kg CO₂/kWh) */
  regional_grid_factors: Object.freeze({
    northern: 0.792,
    southern: 0.685,
    eastern:  0.812,
    western:  0.735,
    northeastern: 0.518,
    national: 0.716
  }),
});
