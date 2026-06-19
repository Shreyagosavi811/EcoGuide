/**
 * storyteller.js — Narrative carbon footprint breakdown generator.
 * Produces human-readable, data-driven stories from emission breakdowns.
 * Avoids generic text — all outputs reference the user's actual numbers.
 *
 * @module storyteller
 */

'use strict';

const Storyteller = (() => {

  /**
   * Returns how the user compares to a reference (percentile language).
   * @param {number} userVal - User's value (kg CO₂)
   * @param {number} reference - Benchmark value
   * @returns {{ pct: number, direction: string, label: string }}
   */
  function compareToReference(userVal, reference) {
    const pct = Math.abs(Math.round(((userVal - reference) / reference) * 100));
    const direction = userVal > reference ? 'above' : 'below';
    let label;
    if (pct < 5)       label = 'roughly on par with';
    else if (pct < 20) label = `${pct}% ${direction}`;
    else if (pct < 50) label = `${pct}% ${direction}`;
    else               label = `${pct}% ${direction}`;
    return { pct, direction, label };
  }

  /**
   * Returns the dominant (highest) emission category.
   * @param {{ transport, energy, diet, shopping }} breakdown
   * @returns {string} category key
   */
  function dominantCategory(breakdown) {
    const cats = ['transport', 'energy', 'diet', 'shopping'];
    return cats.reduce((a, b) => breakdown[a] >= breakdown[b] ? a : b);
  }

  /**
   * Generates a contextual insight sentence for one category.
   * @param {string} category
   * @param {number} value - kg CO₂ per year
   * @param {number} benchmark - India average for this category
   * @param {number} totalPct - percentage of total
   * @returns {string}
   */
  function categoryInsight(category, value, benchmark, totalPct) {
    const { pct, direction } = compareToReference(value, benchmark);
    const roundedT = (value / 1000).toFixed(2);
    const pctStr = Math.round(totalPct);

    const templates = {
      transport: {
        above: `Your transport emissions (${roundedT} t) make up ${pctStr}% of your total — ${pct}% above the India average for this category. This is the highest-impact area for change.`,
        below: `Your transport footprint (${roundedT} t) is ${pct}% below the India average — good work keeping trips efficient.`,
      },
      energy: {
        above: `Home energy accounts for ${pctStr}% of your footprint (${roundedT} t), which is ${pct}% above India's residential average. Simple appliance changes can help significantly.`,
        below: `Your home energy use (${roundedT} t, ${pctStr}%) is ${pct}% below average — your household is relatively efficient.`,
      },
      diet: {
        above: `Your diet contributes ${roundedT} t (${pctStr}% of total), sitting ${pct}% above India's average. Reducing meat frequency has the largest dietary impact.`,
        below: `Your diet footprint (${roundedT} t, ${pctStr}%) is ${pct}% below average — your food choices are already helping.`,
      },
      shopping: {
        above: `Shopping and consumption adds ${roundedT} t (${pctStr}%), which is ${pct}% above average. Buying less and buying second-hand makes a measurable difference.`,
        below: `Your shopping footprint (${roundedT} t, ${pctStr}%) is already below average — keep maintaining mindful consumption.`,
      },
    };

    const t = templates[category] || {};
    return t[direction] || `${category}: ${roundedT} t CO₂/year (${pctStr}% of total).`;
  }

  /**
   * Generates a complete narrative story from the user's emissions breakdown.
   * @param {{ transport, energy, diet, shopping, total }} breakdown
   * @param {string} persona - 'student' | 'professional' | 'family'
   * @param {string} goal - Selected goal key
   * @returns {string[]} Array of paragraph strings
   */
  function generateStory(breakdown, persona, goal) {
    const paragraphs = [];
    const bm = BENCHMARKS.benchmarks;
    const categoryBm = bm.by_category;
    const totalT = (breakdown.total / 1000).toFixed(2);
    const personaAvg = bm.by_persona[persona] || bm.india;
    const { label: indiaLabel } = compareToReference(breakdown.total, bm.india);
    const { label: personaLabel } = compareToReference(breakdown.total, personaAvg);
    const dominant = dominantCategory(breakdown);
    const cats = ['transport', 'energy', 'diet', 'shopping'];
    const percentages = cats.reduce((acc, c) => {
      acc[c] = breakdown.total > 0 ? (breakdown[c] / breakdown.total) * 100 : 0;
      return acc;
    }, {});

    // Opening summary
    const personaLabels = { student: 'student', professional: 'working professional', family: 'household' };
    paragraphs.push(
      `Your annual carbon footprint is estimated at ${totalT} t CO₂ — ${indiaLabel} the India average of 1.9 t, ` +
      `and ${personaLabel} the typical ${personaLabels[persona] || 'person'} average.`
    );

    // Dominant category deep dive
    const domValue = breakdown[dominant];
    const domPct = Math.round(percentages[dominant]);
    paragraphs.push(
      `${_capitalize(dominant)} is your biggest source at ${domPct}% of your total (${(domValue / 1000).toFixed(2)} t). ` +
      categoryInsight(dominant, domValue, categoryBm[dominant], percentages[dominant])
    );

    // Secondary insights for other notable categories
    const others = cats.filter(c => c !== dominant && percentages[c] > 15);
    others.forEach(cat => {
      paragraphs.push(categoryInsight(cat, breakdown[cat], categoryBm[cat], percentages[cat]));
    });

    // Goal-aligned closing message
    const goalMessages = {
      save_money:    `Based on your Save Money goal, the tips below are sorted to maximise your ₹ savings first.`,
      reduce_co2:    `To reach your Reduce CO₂ Fast goal, we've prioritised the highest-impact actions first.`,
      india_average: `To reach India's average of 1.9 t, you need to cut ${Math.max(0, Math.round(breakdown.total - 1900))} kg CO₂ — entirely achievable within 3–6 months.`,
      paris_target:  `Your Paris Agreement target is 2.1 t/year. Accepting the top 3 recommended actions could get you there.`,
    };
    paragraphs.push(goalMessages[goal] || 'Your personalised action plan is ready below.');

    return paragraphs;
  }

  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return Object.freeze({ generateStory, compareToReference, dominantCategory, categoryInsight });
})();
