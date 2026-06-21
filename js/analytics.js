/**
 * analytics.js — EcoScore, progress tracking, and chart rendering.
 * Depends on Chart.js (loaded via CDN), benchmarks.js, profiler.js.
 *
 * @module analytics
 */

'use strict';

const Analytics = (() => {

  let _breakdownChart = null;
  let _trendChart     = null;

  const CATEGORY_COLORS = {
    transport: '#e05252',
    energy:    '#f5a623',
    diet:      '#7ed321',
    shopping:  '#4a90d9',
  };

  // ── ECOSCORE ────────────────────────────────────────────────────────────────

  /**
   * Computes the overall EcoScore (0–100) and per-category scores.
   * Score of 100 means at or below benchmark; decreases as emissions exceed it.
   * @param {{ transport, energy, diet, shopping }} breakdown
   * @returns {{ overall: number, transport: number, energy: number, diet: number, shopping: number }}
   */
  function computeEcoScore(breakdown) {
    const bm  = BENCHMARKS.benchmarks.by_category;
    const wts = BENCHMARKS.ecoscore_weights;

    function catScore(actual, benchmark) {
      if (actual === 0) return 100;
      return Math.max(0, Math.min(100, Math.round((benchmark / actual) * 100)));
    }

    const scores = {
      transport: catScore(breakdown.transport, bm.transport),
      energy:    catScore(breakdown.energy,    bm.energy),
      diet:      catScore(breakdown.diet,      bm.diet),
      shopping:  catScore(breakdown.shopping,  bm.shopping),
    };

    const overall = Math.round(
      scores.transport * wts.transport +
      scores.energy    * wts.energy    +
      scores.diet      * wts.diet      +
      scores.shopping  * wts.shopping
    );

    return { overall, ...scores };
  }

  /**
   * Renders the EcoScore ring SVG and breakdown into the dashboard.
   * @param {{ overall, transport, energy, diet, shopping }} scores
   */
  function renderEcoScore(scores) {
    const numberEl = document.getElementById('ecoscore-number');
    const ringEl   = document.getElementById('ecoscore-ring-fill');
    const breakEl  = document.getElementById('score-breakdown');
    if (!numberEl) return;

    numberEl.textContent = scores.overall;

    // Animate SVG ring (circumference = 2π×50 ≈ 314)
    const circumference = 2 * Math.PI * 50;
    const dash = (scores.overall / 100) * circumference;
    if (ringEl) {
      ringEl.style.strokeDasharray  = `${dash} ${circumference}`;
      ringEl.style.stroke = scores.overall >= 70 ? '#2ea043'
                          : scores.overall >= 40 ? '#f5a623'
                          : '#e05252';
    }

    // Category breakdown bars
    if (breakEl) {
      breakEl.innerHTML = '';
      ['transport', 'energy', 'diet', 'shopping'].forEach(cat => {
        const row = document.createElement('div');
        row.className = 'score-row';

        const label = document.createElement('span');
        label.className = 'score-cat-label';
        label.textContent = _capitalize(cat);

        const bar = document.createElement('div');
        bar.className = 'score-bar-track';
        const fill = document.createElement('div');
        fill.className = 'score-bar-fill';
        fill.style.width = `${scores[cat]}%`;
        fill.style.backgroundColor = CATEGORY_COLORS[cat];
        bar.appendChild(fill);

        const val = document.createElement('span');
        val.className = 'score-cat-val';
        val.textContent = `${scores[cat]}/100`;

        row.appendChild(label);
        row.appendChild(bar);
        row.appendChild(val);
        breakEl.appendChild(row);
      });
    }
  }

  // ── CHARTS ──────────────────────────────────────────────────────────────────

  /**
   * Renders the emissions breakdown doughnut chart.
   * @param {{ transport, energy, diet, shopping }} breakdown
   */
  function renderBreakdownChart(breakdown) {
    const canvas = document.getElementById('breakdown-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = ['Transport', 'Energy', 'Diet', 'Shopping'];
    const data   = [breakdown.transport, breakdown.energy, breakdown.diet, breakdown.shopping];

    // A10 Accessible chart descriptions
    canvas.setAttribute('aria-label', `Doughnut chart showing carbon footprint breakdown. Transport: ${Math.round(breakdown.transport)} kg, Energy: ${Math.round(breakdown.energy)} kg, Diet: ${Math.round(breakdown.diet)} kg, Shopping: ${Math.round(breakdown.shopping)} kg. Total emissions: ${Math.round(breakdown.total)} kg CO₂/year.`);

    if (_breakdownChart) {
      _breakdownChart.data.datasets[0].data = data;
      _breakdownChart.update();
    } else {
      _breakdownChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: Object.values(CATEGORY_COLORS),
            borderColor: '#0d1117',
            borderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${Math.round(ctx.raw)} kg CO₂/year (${Math.round(ctx.raw / breakdown.total * 100)}%)`,
              },
            },
          },
        },
      });
    }

    // Accessible text legend
    const legendEl = document.getElementById('breakdown-legend');
    if (legendEl) {
      legendEl.innerHTML = '';
      labels.forEach((label, i) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = Object.values(CATEGORY_COLORS)[i];
        const text = document.createElement('span');
        text.textContent = `${label}: ${Math.round(data[i])} kg`;
        item.appendChild(dot);
        item.appendChild(text);
        legendEl.appendChild(item);
      });
    }
  }

  /**
   * Renders the trend line chart from progress history.
   * @param {Array<{ month, total, ecoScore }>} history
   */
  function renderTrendChart(history) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas || typeof Chart === 'undefined' || history.length < 2) return;

    // A10 Accessible chart descriptions
    const trendText = history.map(h => `${h.month}: ${(h.total / 1000).toFixed(2)} tonnes`).join(', ');
    canvas.setAttribute('aria-label', `Line chart showing monthly carbon footprint trend. Data: ${trendText}.`);

    if (_trendChart) {
      _trendChart.data.labels = history.map(h => h.month);
      _trendChart.data.datasets[0].data = history.map(h => parseFloat((h.total / 1000).toFixed(2)));
      _trendChart.update();
    } else {
      _trendChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: history.map(h => h.month),
          datasets: [{
            label: 'CO₂ (t/year)',
            data: history.map(h => parseFloat((h.total / 1000).toFixed(2))),
            borderColor: '#2ea043',
            backgroundColor: 'rgba(46,160,67,0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#2ea043',
          }],
        },
        options: {
          responsive: true,
          scales: {
            y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
            x: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } },
          },
          plugins: { legend: { labels: { color: '#c9d1d9' } } },
        },
      });
    }
  }

  // ── INDIA COMPARISON ────────────────────────────────────────────────────────

  /**
   * Renders the India/global comparison card.
   * @param {number} totalKg - User's total in kg CO₂/year
   * @param {string} persona
   */
  function renderComparison(totalKg, persona) {
    const container = document.getElementById('india-comparison');
    if (!container) return;
    container.innerHTML = '';

    const bm = BENCHMARKS.benchmarks;
    const rows = [
      { label: 'Your footprint', value: totalKg, highlight: true },
      { label: `${_capitalize(persona)} average`, value: bm.by_persona[persona] || bm.india },
      { label: 'India average',  value: bm.india },
      { label: 'Global average', value: bm.global },
      { label: 'Paris target',   value: bm.paris_target },
    ];

    const heading = document.createElement('h3');
    heading.className = 'card-title';
    heading.textContent = '📍 How You Compare';
    container.appendChild(heading);

    rows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = row.highlight ? 'compare-row highlight' : 'compare-row';

      const lbl = document.createElement('span');
      lbl.className = 'compare-label';
      lbl.textContent = row.label;

      const val = document.createElement('span');
      val.className = 'compare-value';
      val.textContent = `${(row.value / 1000).toFixed(2)} t/year`;

      const diff = !row.highlight ? _diffBadge(totalKg, row.value) : null;

      rowEl.appendChild(lbl);
      rowEl.appendChild(val);
      if (diff) rowEl.appendChild(diff);
      container.appendChild(rowEl);
    });
  }

  function _diffBadge(userVal, ref) {
    const pct = Math.round(((userVal - ref) / ref) * 100);
    const badge = document.createElement('span');
    badge.className = pct > 0 ? 'diff-badge above' : 'diff-badge below';
    badge.textContent = pct > 0 ? `+${pct}%` : `${pct}%`;
    return badge;
  }

  // ── GOAL PROGRESS ────────────────────────────────────────────────────────────

  /**
   * Renders goal progress card with estimated completion date.
   * @param {number} currentKg
   * @param {string} goal
   * @param {number} predictedKg - from accepted tips
   */
  function renderGoalProgress(currentKg, goal, predictedKg) {
    const container = document.getElementById('goal-progress');
    if (!container) return;
    container.innerHTML = '';

    const target = BENCHMARKS.goal_targets[goal];
    if (!target) return;

    const gap     = Math.max(0, currentKg - target);
    const monthly = Math.max(1, Math.round((currentKg - predictedKg) / 12));
    const months  = monthly > 0 ? Math.ceil(gap / monthly) : null;

    const heading = document.createElement('h3');
    heading.className = 'card-title';
    heading.textContent = '🎯 Goal Progress';
    container.appendChild(heading);

    const goalLabel = document.createElement('p');
    goalLabel.className = 'goal-name';
    goalLabel.textContent = _goalLabel(goal);
    container.appendChild(goalLabel);

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    const progress = target ? Math.min(100, Math.round((target / currentKg) * 100)) : 100;
    fill.style.width = `${progress}%`;
    track.appendChild(fill);
    container.appendChild(track);

    const info = document.createElement('p');
    info.className = 'goal-info';
    info.textContent = gap > 0
      ? `Gap: ${gap} kg remaining${months ? `. At current pace: ~${months} months.` : '.'}`
      : '✅ You\'ve already reached your target!';
    container.appendChild(info);
  }

  // ── HISTORY CARDS ────────────────────────────────────────────────────────────

  /**
   * Renders monthly progress history cards.
   * @param {Array} history - From Profiler.getProgressLog()
   */
  function renderProgressCards(history) {
    const container = document.getElementById('history-cards');
    if (!container) return;
    container.innerHTML = '';

    if (history.length === 0) return;

    const latest = history[history.length - 1];
    const first  = history[0];
    const totalImprovement = first.total > 0
      ? Math.round(((first.total - latest.total) / first.total) * 100)
      : 0;

    // Summary badge
    if (history.length > 1 && totalImprovement > 0) {
      const badge = document.createElement('div');
      badge.className = 'improvement-badge';
      badge.textContent = `🎉 ${totalImprovement}% improvement since you started!`;
      container.appendChild(badge);
    }

    // Monthly cards
    const grid = document.createElement('div');
    grid.className = 'history-grid';
    history.slice(-6).forEach(snap => {
      const card = document.createElement('div');
      card.className = 'history-card';

      const month = document.createElement('div');
      month.className = 'history-month';
      month.textContent = snap.month;

      const total = document.createElement('div');
      total.className = 'history-total';
      total.textContent = `${(snap.total / 1000).toFixed(2)} t`;

      const score = document.createElement('div');
      score.className = 'history-score';
      score.textContent = `EcoScore: ${snap.ecoScore}`;

      card.appendChild(month);
      card.appendChild(total);
      card.appendChild(score);
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  // Intentional module-local copy — modules are IIFEs with no shared scope
  function _capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  function _goalLabel(goal) {
    const labels = {
      save_money: 'Save Money', reduce_co2: 'Reduce CO₂ Fast',
      india_average: 'Reach India Average (1.9 t)', paris_target: 'Hit Paris Target (2.1 t)',
    };
    return labels[goal] || goal;
  }

  return Object.freeze({
    computeEcoScore, renderEcoScore, renderBreakdownChart, renderTrendChart,
    renderComparison, renderGoalProgress, renderProgressCards,
  });
})();
