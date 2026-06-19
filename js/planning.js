/**
 * planning.js — Personalized 4-week action plan generator.
 * Groups ranked recommendations into a progressive weekly schedule.
 * Constraints: max 3 actions/week, easiest first, goal-framed.
 *
 * @module planning
 */

'use strict';

const Planning = (() => {

  /** Difficulty sort order for progressive scheduling. */
  const DIFFICULTY_ORDER = { easy: 1, medium: 2, hard: 3 };

  /**
   * Sorts recommendations for scheduling: easy first, then by score.
   * @param {Object[]} recs
   * @returns {Object[]}
   */
  function sortForPlanning(recs) {
    return [...recs].sort((a, b) => {
      const diffDelta = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
      return diffDelta !== 0 ? diffDelta : b.score - a.score;
    });
  }

  /**
   * Distributes sorted recommendations across 4 weeks.
   * Max 3 actions per week. Unused recs become "stretch goals" for week 4.
   * @param {Object[]} sortedRecs
   * @returns {Object[][]} Array of 4 week arrays
   */
  function distributeToWeeks(sortedRecs) {
    const weeks = [[], [], [], []];
    const MAX_PER_WEEK = 3;

    let weekIndex = 0;
    for (const rec of sortedRecs) {
      if (weekIndex >= 4) break;
      weeks[weekIndex].push(rec);
      if (weeks[weekIndex].length >= MAX_PER_WEEK) weekIndex++;
    }

    // Week 4 stretch: re-include rejected-difficulty ones if week 4 has space
    return weeks;
  }

  /**
   * Computes total CO₂ and money savings for a week's actions.
   * @param {Object[]} weekRecs
   * @returns {{ co2: number, money: number }}
   */
  function weekSavings(weekRecs) {
    return weekRecs.reduce(
      (acc, r) => ({ co2: acc.co2 + r.co2Saving, money: acc.money + r.moneySaving }),
      { co2: 0, money: 0 }
    );
  }

  /**
   * Generates the week title / focus theme.
   * @param {Object[]} weekRecs
   * @param {number} weekNum - 1-based week number
   * @returns {string}
   */
  function weekTheme(weekRecs, weekNum) {
    if (weekRecs.length === 0) return `Week ${weekNum} — Sustain your gains`;
    const cats = weekRecs.map(r => r.category);
    const dominant = cats.sort(
      (a, b) => cats.filter(c => c === b).length - cats.filter(c => c === a).length
    )[0];
    const themes = {
      transport: 'Transport Focus',
      energy:    'Energy Efficiency',
      diet:      'Diet Experiment',
      shopping:  'Mindful Consumption',
    };
    return `Week ${weekNum} — ${themes[dominant] || 'Action Week'}`;
  }

  /**
   * Generates a personalized, goal-framed 4-week action plan.
   * @param {Object[]} rankedRecs - Output from Recommender.generateRecommendations()
   * @param {string} persona - 'student' | 'professional' | 'family'
   * @param {string} goal - Selected goal key
   * @returns {Object[]} Array of 4 week plan objects
   */
  function generateActionPlan(rankedRecs, persona, goal) {
    const sorted     = sortForPlanning(rankedRecs);
    const weeks      = distributeToWeeks(sorted);
    let cumCO2   = 0;
    let cumMoney = 0;

    return weeks.map((weekRecs, i) => {
      const { co2, money } = weekSavings(weekRecs);
      cumCO2   += co2;
      cumMoney += money;
      return {
        week:       i + 1,
        theme:      weekTheme(weekRecs, i + 1),
        actions:    weekRecs,
        savingsCO2:   co2,
        savingsMoney: money,
        cumulativeCO2:   cumCO2,
        cumulativeMoney: cumMoney,
        motivationNote:  _motivationNote(i + 1, goal, persona),
      };
    });
  }

  /**
   * Returns a motivational footnote for each week.
   * @param {number} weekNum
   * @param {string} goal
   * @param {string} persona
   * @returns {string}
   */
  function _motivationNote(weekNum, goal, persona) {
    const notes = [
      'Start small — consistency beats perfection.',
      'You\'re building habits that compound over time.',
      'Each action is making a real measurable difference.',
      'Week 4: Sustain what you\'ve built and explore stretch goals.',
    ];
    return notes[weekNum - 1] || '';
  }

  /**
   * Computes total savings across the entire 4-week plan.
   * @param {Object[]} plan - Output of generateActionPlan
   * @returns {{ co2: number, money: number }}
   */
  function planTotalSavings(plan) {
    return plan.reduce(
      (acc, week) => ({ co2: acc.co2 + week.savingsCO2, money: acc.money + week.savingsMoney }),
      { co2: 0, money: 0 }
    );
  }

  return Object.freeze({ generateActionPlan, planTotalSavings, weekSavings });
})();
