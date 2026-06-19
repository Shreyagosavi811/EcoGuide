/**
 * recommender.js — Dynamic recommendation engine.
 * Generates, scores, and ranks recommendations using templates.
 * Produces confidence scores and human-readable explanations.
 *
 * @module recommender
 */

'use strict';

const Recommender = (() => {

  /**
   * Recommendation template pool.
   * Each template is a function receiving user context and returning a rec object.
   * @type {Array<Function>}
   */
  const TEMPLATES = [
    // ── TRANSPORT ─────────────────────────────────────────────────────────────
    (ctx) => ctx.transport.mode !== 'public_transit' && ctx.transport.km_per_week > 20 ? {
      id: 'switch_to_transit',
      category: 'transport',
      title: 'Switch to public transport',
      description: `Replace ${Math.round(ctx.transport.km_per_week * 0.5)} km/week of your ${_modeLabel(ctx.transport.mode)} trips with bus or train.`,
      co2Saving: Math.round(ctx.transport.km_per_week * 0.5 * 52 *
        (BENCHMARKS.factors.transport[ctx.transport.mode] - BENCHMARKS.factors.transport.public_transit)),
      moneySaving: Math.round(ctx.transport.km_per_week * 0.5 * 52 *
        (BENCHMARKS.factors.fuel_cost_inr / 25)),
      difficulty: 'easy',
    } : null,

    (ctx) => ctx.transport.mode === 'motorcycle' && ctx.transport.km_per_week > 30 ? {
      id: 'carpool',
      category: 'transport',
      title: 'Start a carpool or ride-share',
      description: `Sharing rides for your ${ctx.transport.km_per_week} km/week commute halves your transport emissions.`,
      co2Saving: Math.round(ctx.transport.km_per_week * 0.5 * 52 * BENCHMARKS.factors.transport.motorcycle),
      moneySaving: Math.round(ctx.transport.km_per_week * 0.5 * 52 * (BENCHMARKS.factors.fuel_cost_inr / 30)),
      difficulty: 'medium',
    } : null,

    (ctx) => (ctx.transport.flights_short + ctx.transport.flights_long) >= 2 ? {
      id: 'reduce_flights',
      category: 'transport',
      title: 'Replace one flight with a train journey',
      description: 'Trains emit up to 90% less CO₂ than short-haul flights per km.',
      co2Saving: BENCHMARKS.factors.flights.short_haul,
      moneySaving: 3500,
      difficulty: 'medium',
    } : null,

    (ctx) => ctx.transport.km_per_week > 10 ? {
      id: 'cycle_short_trips',
      category: 'transport',
      title: 'Cycle or walk for trips under 3 km',
      description: 'Short local trips under 3 km account for significant emissions and are ideal for cycling.',
      co2Saving: Math.round(ctx.transport.km_per_week * 0.2 * 52 *
        (BENCHMARKS.factors.transport[ctx.transport.mode] || 0.103)),
      moneySaving: Math.round(ctx.transport.km_per_week * 0.2 * 52 * (BENCHMARKS.factors.fuel_cost_inr / 25)),
      difficulty: 'easy',
    } : null,

    // ── ENERGY ────────────────────────────────────────────────────────────────
    (ctx) => ctx.energy.electricity_kwh > 100 ? {
      id: 'switch_led',
      category: 'energy',
      title: 'Switch to LED lighting throughout your home',
      description: 'LEDs use 75% less energy than incandescent bulbs and last 25× longer.',
      co2Saving: Math.round(ctx.energy.electricity_kwh * 0.1 * 12 * BENCHMARKS.factors.electricity),
      moneySaving: Math.round(ctx.energy.electricity_kwh * 0.1 * 12 * BENCHMARKS.factors.electricity_cost_inr),
      difficulty: 'easy',
    } : null,

    (ctx) => ctx.energy.electricity_kwh > 200 ? {
      id: 'five_star_appliances',
      category: 'energy',
      title: 'Upgrade to 5-star BEE-rated appliances',
      description: 'Replacing 3 old appliances with 5-star rated models cuts energy use significantly.',
      co2Saving: Math.round(ctx.energy.electricity_kwh * 0.18 * 12 * BENCHMARKS.factors.electricity),
      moneySaving: Math.round(ctx.energy.electricity_kwh * 0.18 * 12 * BENCHMARKS.factors.electricity_cost_inr),
      difficulty: 'hard',
    } : null,

    (ctx) => ctx.energy.electricity_kwh > 50 ? {
      id: 'unplug_standby',
      category: 'energy',
      title: 'Unplug devices on standby',
      description: 'Standby power ("vampire load") can account for 5–10% of home electricity use.',
      co2Saving: Math.round(ctx.energy.electricity_kwh * 0.07 * 12 * BENCHMARKS.factors.electricity),
      moneySaving: Math.round(ctx.energy.electricity_kwh * 0.07 * 12 * BENCHMARKS.factors.electricity_cost_inr),
      difficulty: 'easy',
    } : null,

    (ctx) => ctx.energy.lpg_cylinders >= 1 ? {
      id: 'reduce_lpg',
      category: 'energy',
      title: 'Reduce LPG usage with a pressure cooker',
      description: 'Pressure cookers reduce cooking time and gas use by up to 30%.',
      co2Saving: Math.round(ctx.energy.lpg_cylinders * 0.3 * 12 * BENCHMARKS.factors.lpg_cylinder),
      moneySaving: Math.round(ctx.energy.lpg_cylinders * 0.3 * 12 * BENCHMARKS.factors.lpg_cost_inr),
      difficulty: 'easy',
    } : null,

    // ── DIET ──────────────────────────────────────────────────────────────────
    (ctx) => ['meat_heavy', 'omnivore'].includes(ctx.diet) ? {
      id: 'meatless_monday',
      category: 'diet',
      title: 'Try Meatless Monday (1 day per week)',
      description: 'Cutting meat one day a week reduces your diet footprint by ~14% annually.',
      co2Saving: Math.round((BENCHMARKS.factors.diet[ctx.diet] - BENCHMARKS.factors.diet.vegetarian) * 0.14),
      moneySaving: 2600,
      difficulty: 'easy',
    } : null,

    (ctx) => ['meat_heavy', 'omnivore', 'pescatarian'].includes(ctx.diet) ? {
      id: 'reduce_red_meat',
      category: 'diet',
      title: 'Replace red meat with chicken or legumes 3× per week',
      description: 'Beef produces 5–10× more emissions than chicken or plant proteins.',
      co2Saving: Math.round((BENCHMARKS.factors.diet[ctx.diet] - BENCHMARKS.factors.diet.vegetarian) * 0.35),
      moneySaving: 4200,
      difficulty: 'medium',
    } : null,

    (ctx) => ctx.diet === 'meat_heavy' ? {
      id: 'shift_vegetarian',
      category: 'diet',
      title: 'Shift to a predominantly vegetarian diet',
      description: 'Moving from meat-heavy to vegetarian reduces diet emissions by ~55%.',
      co2Saving: BENCHMARKS.factors.diet.meat_heavy - BENCHMARKS.factors.diet.vegetarian,
      moneySaving: 7000,
      difficulty: 'hard',
    } : null,

    // ── SHOPPING ──────────────────────────────────────────────────────────────
    (ctx) => ctx.shopping.clothing_per_month > 2 ? {
      id: 'slow_fashion',
      category: 'shopping',
      title: 'Buy second-hand or adopt a "buy less" clothing rule',
      description: 'Fast fashion is one of the most carbon-intensive industries globally.',
      co2Saving: Math.round(ctx.shopping.clothing_per_month * 0.5 * 12 * BENCHMARKS.factors.shopping.clothing_item),
      moneySaving: Math.round(ctx.shopping.clothing_per_month * 0.5 * 12 * 800),
      difficulty: 'medium',
    } : null,

    (ctx) => ctx.shopping.online_orders_per_week > 2 ? {
      id: 'batch_orders',
      category: 'shopping',
      title: 'Batch online orders to reduce deliveries',
      description: 'Combining orders reduces last-mile delivery trips and packaging waste.',
      co2Saving: Math.round(ctx.shopping.online_orders_per_week * 0.4 * 52 * BENCHMARKS.factors.shopping.online_order),
      moneySaving: 500,
      difficulty: 'easy',
    } : null,
  ];

  /** Maps transport mode key to display label. */
  function _modeLabel(mode) {
    const labels = {
      petrol_car: 'car', diesel_car: 'car', motorcycle: 'bike',
      public_transit: 'bus/train', walk_cycle: 'walking/cycling',
    };
    return labels[mode] || mode;
  }

  /**
   * Computes a goal-alignment score (0–1) for a recommendation.
   * @param {Object} rec
   * @param {string} goal
   * @returns {number}
   */
  function _goalAlignment(rec, goal) {
    const w = BENCHMARKS.goal_weights[goal] || BENCHMARKS.goal_weights.reduce_co2;
    const co2Norm   = Math.min(rec.co2Saving / 700, 1);
    const moneyNorm = Math.min(rec.moneySaving / 20000, 1);
    return (co2Norm * w.co2) + (moneyNorm * w.money);
  }

  /**
   * Computes the overall recommendation score (0–100).
   * @param {Object} rec
   * @param {string} goal
   * @param {Object} profile
   * @returns {number}
   */
  function scoreRecommendation(rec, goal, profile) {
    const w            = BENCHMARKS.goal_weights[goal] || BENCHMARKS.goal_weights.reduce_co2;
    const co2Norm      = Math.min(rec.co2Saving / 700, 1);
    const moneyNorm    = Math.min(rec.moneySaving / 20000, 1);
    const prefScore    = Profiler.preferenceScore(rec, profile);
    const raw = (co2Norm * w.co2 * 100) + (moneyNorm * w.money * 100) + (prefScore * w.preference * 100);
    return Math.min(100, Math.round(raw));
  }

  /**
   * Computes recommendation confidence percentage (0–100).
   * confidence = goalMatch×0.4 + historyMatch×0.3 + impactScore×0.3
   * @param {Object} rec
   * @param {string} goal
   * @param {Object} profile
   * @returns {number}
   */
  function computeConfidence(rec, goal, profile) {
    const goalMatch    = _goalAlignment(rec, goal);
    const accepted     = profile.acceptedByCategory[rec.category] || 0;
    const rejected     = profile.rejectedByCategory[rec.category] || 0;
    const historyMatch = (accepted + rejected) === 0 ? 0.5 : accepted / (accepted + rejected);
    const impactScore  = Math.min(rec.co2Saving / 700, 1);
    const confidence   = (goalMatch * 0.4) + (historyMatch * 0.3) + (impactScore * 0.3);
    return Math.min(100, Math.round(confidence * 100));
  }

  /**
   * Builds human-readable explanation bullets for a recommendation.
   * @param {Object} rec
   * @param {string} goal
   * @param {Object} profile
   * @param {{ transport, energy, diet, shopping, total }} breakdown
   * @returns {string[]} Array of reason strings
   */
  function buildExplanation(rec, goal, profile, breakdown) {
    const reasons = [];
    const pct = breakdown.total > 0
      ? Math.round((breakdown[rec.category] / breakdown.total) * 100)
      : 0;

    if (pct >= 30) {
      reasons.push(`${_capitalize(rec.category)} is ${pct}% of your total footprint`);
    }

    const goalLabels = {
      save_money: 'Save Money', reduce_co2: 'Reduce CO₂ Fast',
      india_average: 'Reach India Average', paris_target: 'Hit Paris Target',
    };
    reasons.push(`Matches your "${goalLabels[goal] || goal}" goal`);

    const accepted = profile.acceptedByCategory[rec.category] || 0;
    if (accepted > 1) {
      reasons.push(`You've acted on ${rec.category} tips before`);
    }

    if (rec.difficulty === 'easy') {
      reasons.push('Low effort with high impact ratio');
    }

    if (rec.moneySaving > 3000) {
      reasons.push(`Saves ₹${rec.moneySaving.toLocaleString('en-IN')}/year`);
    }

    return reasons;
  }

  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generates, scores, and ranks recommendations for the current user context.
   * @param {Object} userData - Full user data from conversation
   * @param {{ transport, energy, diet, shopping, total }} breakdown - Computed emissions
   * @param {string} goal - Selected goal key
   * @param {Object} profile - Current behavioral profile
   * @returns {Array<Object>} Ranked recommendation objects (top 6)
   */
  function generateRecommendations(userData, breakdown, goal, profile) {
    const ctx = {
      transport: userData.transport,
      energy:    userData.energy,
      diet:      userData.diet,
      shopping:  userData.shopping,
      persona:   userData.persona,
      goal,
    };

    const recs = TEMPLATES
      .map(fn => fn(ctx))
      .filter(Boolean)
      .map(rec => ({
        ...rec,
        score:       scoreRecommendation(rec, goal, profile),
        confidence:  computeConfidence(rec, goal, profile),
        explanation: buildExplanation(rec, goal, profile, breakdown),
        accepted:    false,
      }));

    // Sort by score descending, return top 6
    return recs.sort((a, b) => b.score - a.score).slice(0, 6);
  }

  return Object.freeze({
    generateRecommendations, scoreRecommendation, computeConfidence, buildExplanation,
  });
})();
