/**
 * calculator.js — Carbon emission computation engine.
 * Consumes BENCHMARKS from benchmarks.js. Never uses inline factors.
 *
 * @module calculator
 */

'use strict';

const Calculator = (() => {

  /**
   * Sanitizes a numeric input — clamps to 0, rejects non-finite values.
   * @param {*} value - Raw input value.
   * @param {number} [max=100000] - Optional upper bound.
   * @returns {number} Sanitized non-negative number.
   */
  function sanitize(value, max = 100000) {
    const n = parseFloat(value);
    if (!isFinite(n) || isNaN(n)) return 0;
    return Math.min(Math.max(n, 0), max);
  }

  /**
   * Computes annual transport emissions in kg CO₂.
   * @param {Object} data
   * @param {string} data.mode - Transport mode key from BENCHMARKS.factors.transport
   * @param {number} data.km_per_week - Weekly kilometres travelled
   * @param {number} data.flights_short - Short-haul flights per year
   * @param {number} data.flights_long - Long-haul flights per year
   * @returns {number} Annual kg CO₂ from transport
   */
  function computeTransport(data) {
    const kmPerWeek  = sanitize(data.km_per_week, 2000);
    const factor     = BENCHMARKS.factors.transport[data.mode] ?? BENCHMARKS.factors.transport.motorcycle;
    const drivingCO2 = kmPerWeek * 52 * factor;

    const shortFlights = sanitize(data.flights_short, 50);
    const longFlights  = sanitize(data.flights_long, 50);
    const flightCO2    = (shortFlights * BENCHMARKS.factors.flights.short_haul)
                       + (longFlights  * BENCHMARKS.factors.flights.long_haul);

    return drivingCO2 + flightCO2;
  }

  /**
   * Computes annual energy (home) emissions in kg CO₂.
   * @param {Object} data
   * @param {number} data.electricity_kwh - Electricity per month (kWh)
   * @param {number} data.lpg_cylinders - LPG cylinders per month
   * @param {number} data.gas_m3 - Natural gas m³ per month
   * @returns {number} Annual kg CO₂ from home energy
   */
  function computeEnergy(data) {
    const region = data.region || 'national';
    const factor = BENCHMARKS.regional_grid_factors[region] || BENCHMARKS.factors.electricity;
    const elec = sanitize(data.electricity_kwh, 5000) * 12 * factor;
    const lpg  = sanitize(data.lpg_cylinders, 20)    * 12 * BENCHMARKS.factors.lpg_cylinder;
    const gas  = sanitize(data.gas_m3, 1000)          * 12 * BENCHMARKS.factors.natural_gas_m3;
    return elec + lpg + gas;
  }

  /**
   * Computes annual diet emissions in kg CO₂.
   * @param {string} dietType - Key in BENCHMARKS.factors.diet
   * @returns {number} Annual kg CO₂ from diet
   */
  function computeDiet(dietType) {
    return BENCHMARKS.factors.diet[dietType] ?? BENCHMARKS.factors.diet.omnivore;
  }

  /**
   * Computes annual shopping/consumption emissions in kg CO₂.
   * @param {Object} data
   * @param {number} data.clothing_per_month - New clothing items per month
   * @param {number} data.electronics_per_year - Electronics bought per year
   * @param {number} data.online_orders_per_week - Online deliveries per week
   * @returns {number} Annual kg CO₂ from shopping
   */
  function computeShopping(data) {
    const f = BENCHMARKS.factors.shopping;
    const clothing   = sanitize(data.clothing_per_month, 100) * 12 * f.clothing_item;
    const electronics = sanitize(data.electronics_per_year, 50) * f.electronics;
    const orders     = sanitize(data.online_orders_per_week, 100) * 52 * f.online_order;
    return clothing + electronics + orders;
  }

  /**
   * Computes full annual breakdown from collected conversation data.
   * @param {Object} userData - Collected from conversation state
   * @returns {{ transport: number, energy: number, diet: number, shopping: number, total: number }}
   */
  function computeBreakdown(userData) {
    const transport = computeTransport(userData.transport);
    const energy    = computeEnergy(userData.energy);
    const diet      = computeDiet(userData.diet);
    const shopping  = computeShopping(userData.shopping);
    const total     = transport + energy + diet + shopping;
    return { transport, energy, diet, shopping, total };
  }

  /**
   * Estimates annual money savings for a given CO₂ reduction action.
   * @param {string} category - 'transport' | 'energy' | 'diet' | 'shopping'
   * @param {number} co2SavedKg - kg CO₂ saved per year
   * @param {Object} userData - Original user data for context
   * @returns {number} Estimated ₹ saved per year
   */
  function estimateMoneySaving(category, co2SavedKg, userData) {
    const f = BENCHMARKS.factors;
    switch (category) {
      case 'transport': {
        const kmSaved = co2SavedKg / (f.transport[userData.transport.mode] || 0.103);
        return kmSaved * (f.fuel_cost_inr / 25); // ₹/km approx (fuel cost / mileage)
      }
      case 'energy': {
        const region = userData?.energy?.region || 'national';
        const factor = BENCHMARKS.regional_grid_factors[region] || BENCHMARKS.factors.electricity;
        const kwhSaved = co2SavedKg / factor;
        return kwhSaved * f.electricity_cost_inr;
      }
      case 'diet':
        return co2SavedKg * 0.8; // approximate ₹ per kg CO₂ for diet changes
      case 'shopping':
        return co2SavedKg * 3.5;
      default:
        return 0;
    }
  }

  /**
   * Returns the percentage share of each category.
   * @param {{ transport, energy, diet, shopping, total }} breakdown
   * @returns {{ transport, energy, diet, shopping }} percentage shares (0-100)
   */
  function categoryPercentages(breakdown) {
    const { total } = breakdown;
    if (total === 0) return { transport: 0, energy: 0, diet: 0, shopping: 0 };
    return {
      transport: (breakdown.transport / total) * 100,
      energy:    (breakdown.energy    / total) * 100,
      diet:      (breakdown.diet      / total) * 100,
      shopping:  (breakdown.shopping  / total) * 100,
    };
  }

  return Object.freeze({ sanitize, computeTransport, computeEnergy, computeDiet,
    computeShopping, computeBreakdown, estimateMoneySaving, categoryPercentages });
})();
