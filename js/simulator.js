/**
 * simulator.js — Interactive What-If carbon forecast simulator.
 * Binds sliders to live recalculation without modifying saved user data.
 *
 * @module simulator
 */

'use strict';

const Simulator = (() => {

  let _baseData      = null;
  let _baseBreakdown = null;
  let _debounceTimer = null;
  let _listenersBound = false;

  /**
   * Slider configuration per user input.
   * @type {Array<Object>}
   */
  const SLIDER_CONFIGS = [
    {
      id:    'sim_km_per_week',
      label: 'Weekly km by vehicle',
      unit:  'km/week',
      dataPath: ['transport', 'km_per_week'],
      min: 0, max: 500, step: 5,
    },
    {
      id:    'sim_flights_short',
      label: 'Short-haul flights/year',
      unit:  'flights',
      dataPath: ['transport', 'flights_short'],
      min: 0, max: 20, step: 1,
    },
    {
      id:    'sim_electricity',
      label: 'Electricity per month',
      unit:  'kWh',
      dataPath: ['energy', 'electricity_kwh'],
      min: 0, max: 1000, step: 10,
    },
    {
      id:    'sim_lpg',
      label: 'LPG cylinders/month',
      unit:  'cylinders',
      dataPath: ['energy', 'lpg_cylinders'],
      min: 0, max: 10, step: 0.5,
    },
    {
      id:    'sim_clothing',
      label: 'Clothing items/month',
      unit:  'items',
      dataPath: ['shopping', 'clothing_per_month'],
      min: 0, max: 20, step: 1,
    },
  ];

  /**
   * Returns the current simulated user data by reading all slider values.
   * @returns {Object} Deep clone of base data with slider overrides
   */
  function _readSliderValues() {
    const simData = JSON.parse(JSON.stringify(_baseData));
    SLIDER_CONFIGS.forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (!el) return;
      const val = Calculator.sanitize(el.value);
      // Walk the path and set value
      let obj = simData;
      for (let i = 0; i < cfg.dataPath.length - 1; i++) {
        obj = obj[cfg.dataPath[i]];
      }
      obj[cfg.dataPath[cfg.dataPath.length - 1]] = val;
    });
    return simData;
  }

  /**
   * Recalculates emissions from current slider state and updates the UI.
   */
  function _recalculate() {
    const simData      = _readSliderValues();
    const simBreakdown = Calculator.computeBreakdown(simData);
    const currentTotal = _baseBreakdown.total;
    const simTotal     = simBreakdown.total;
    const co2Delta     = Math.round(currentTotal - simTotal);
    const moneyDelta   = _estimateTotalMoneySaved(simData, simBreakdown);

    // Update display elements safely with textContent
    _setText('sim-current',    `${(currentTotal / 1000).toFixed(2)} t/year`);
    _setText('sim-predicted',  `${(simTotal / 1000).toFixed(2)} t/year`);
    _setText('sim-co2-delta',  co2Delta >= 0 ? `−${co2Delta} kg/year` : `+${Math.abs(co2Delta)} kg/year`);
    _setText('sim-money-delta', `₹${Math.max(0, moneyDelta).toLocaleString('en-IN')}/year`);

    // Goal status
    const goalTarget = BENCHMARKS.goal_targets[AppState?.goal] || BENCHMARKS.benchmarks.paris_target;
    const targetEl   = document.getElementById('sim-target-status');
    if (targetEl) {
      if (goalTarget && simTotal <= goalTarget) {
        targetEl.textContent = `✅ Below your goal target (${(goalTarget / 1000).toFixed(1)} t)`;
        targetEl.className   = 'sim-target success';
      } else if (goalTarget) {
        const gap = Math.round(simTotal - goalTarget);
        targetEl.textContent = `${gap} kg above your goal target`;
        targetEl.className   = 'sim-target warning';
      } else {
        targetEl.textContent = `${co2Delta >= 0 ? '↓' : '↑'} ${Math.abs(co2Delta)} kg vs current`;
        targetEl.className   = 'sim-target';
      }
    }
  }

  function _estimateTotalMoneySaved(simData, simBreakdown) {
    const categories = ['transport', 'energy', 'diet', 'shopping'];
    let totalSaved = 0;
    categories.forEach(cat => {
      const baseMoney = Calculator.estimateMoneySaving(cat, _baseBreakdown[cat], _baseData);
      const simMoney  = Calculator.estimateMoneySaving(cat, simBreakdown[cat], simData);
      totalSaved += (baseMoney - simMoney);
    });
    return Math.round(totalSaved);
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Renders slider HTML into the simulator sliders container.
   * Uses textContent and attribute-only DOM manipulation (no innerHTML with user data).
   */
  function _renderSliders() {
    const container = document.getElementById('simulator-sliders');
    if (!container) return;
    container.innerHTML = ''; // safe — no user data involved

    SLIDER_CONFIGS.forEach(cfg => {
      let currentVal = _baseData;
      cfg.dataPath.forEach(key => { currentVal = currentVal?.[key]; });
      currentVal = currentVal ?? 0;

      const group = document.createElement('div');
      group.className = 'slider-group';

      const labelEl = document.createElement('label');
      labelEl.htmlFor = cfg.id;
      labelEl.className = 'slider-label';

      const labelText = document.createElement('span');
      labelText.textContent = cfg.label; // safe
      labelEl.appendChild(labelText);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'slider-value';
      valueSpan.id = `${cfg.id}_val`;
      valueSpan.textContent = `${currentVal} ${cfg.unit}`;
      labelEl.appendChild(valueSpan);

      const input = document.createElement('input');
      input.type  = 'range';
      input.id    = cfg.id;
      input.min   = cfg.min;
      input.max   = cfg.max;
      input.step  = cfg.step;
      input.value = currentVal;
      input.className = 'slider';
      input.setAttribute('aria-label', `${cfg.label}: ${currentVal} ${cfg.unit}`);
      input.setAttribute('aria-valuemin', cfg.min);
      input.setAttribute('aria-valuemax', cfg.max);
      input.setAttribute('aria-valuenow', currentVal);

      input.addEventListener('input', () => {
        valueSpan.textContent = `${input.value} ${cfg.unit}`;
        input.setAttribute('aria-valuenow', input.value);
        input.setAttribute('aria-label', `${cfg.label}: ${input.value} ${cfg.unit}`);
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(_recalculate, 150);

        if (typeof Achievements !== 'undefined') {
          Achievements.unlock('eco_starter');
        }
      });

      group.appendChild(labelEl);
      group.appendChild(input);
      container.appendChild(group);
    });
  }

  /**
   * Initialises the simulator with user data and renders sliders.
   * @param {Object} userData - Full user data from conversation
   * @param {{ transport, energy, diet, shopping, total }} breakdown
   */
  function init(userData, breakdown) {
    _baseData      = JSON.parse(JSON.stringify(userData));
    _baseBreakdown = breakdown;
    _renderSliders();
    _recalculate();

    const planBtn = document.getElementById('sim-to-plan');
    if (planBtn && !_listenersBound) {
      planBtn.addEventListener('click', () => {
        if (typeof AppState !== 'undefined') {
          AppState.navigateTo('planner');
        }
      });
      _listenersBound = true;
    }
  }

  return Object.freeze({ init });
})();
