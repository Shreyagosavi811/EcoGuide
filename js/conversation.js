/**
 * conversation.js — Complete dialogue state machine for EcoGuide.
 * Features: typing indicator, progress bar, contextual responses,
 * message queue, input validation, restart capability.
 *
 * @module conversation
 */

'use strict';

const Conversation = (() => {

  // ── STATE ──────────────────────────────────────────────────────────────────

  let _state = {
    step:        0,
    complete:    false,
    framingMode: null,
    userData: {
      persona:   null,
      goal:      null,
      transport: { mode: 'motorcycle', km_per_week: 0, flights_short: 0, flights_long: 0 },
      energy:    { electricity_kwh: 0, lpg_cylinders: 1, gas_m3: 0, region: 'national' },
      diet:      'omnivore',
      shopping:  { clothing_per_month: 2, electronics_per_year: 1, online_orders_per_week: 2 },
      feasibility: null,
    },
  };

  let _activeTimers = [];
  let _isDemo = false;

  function _setTimer(fn, delay) {
    const id = setTimeout(() => {
      _activeTimers = _activeTimers.filter(t => t !== id);
      fn();
    }, delay);
    _activeTimers.push(id);
    return id;
  }

  function _clearAllTimers() {
    _activeTimers.forEach(id => clearTimeout(id));
    _activeTimers = [];
  }

  // Count of non-skipped steps for progress bar
  let _totalVisibleSteps = 0;
  let _visitedSteps      = 0;

  // Active key handler for shortcuts & cleanup logic
  let _activeKeyHandler  = null;

  function _cleanupKeyHandler() {
    if (_activeKeyHandler) {
      document.removeEventListener('keydown', _activeKeyHandler);
      _activeKeyHandler = null;
    }
  }

  // ── DIALOGUE STEPS ─────────────────────────────────────────────────────────

  const STEPS = [
    {
      id: 'persona',
      message: () => [
        `Hi! I'm EcoGuide 🌿`,
        `I'll help you understand and reduce your carbon footprint through a short conversation. No long forms — just a chat.`,
        `Let's start. What best describes you?`,
      ],
      type: 'choice',
      choices: [
        { label: '🎓 Student',             value: 'student' },
        { label: '💼 Working Professional', value: 'professional' },
        { label: '👨‍👩‍👧 Family',              value: 'family' },
      ],
      process: (val) => { _state.userData.persona = val; },
    },
    {
      id: 'goal',
      message: () => {
        const greet = {
          student:      'Great — students often have the most to gain from small changes! 👍',
          professional: 'Perfect — professionals can make a big impact through commute choices. 👍',
          family:       'Families have great leverage across energy and transport. 👍',
        }[_state.userData.persona] || 'Great choice!';
        return [greet, `What's your #1 priority right now?`];
      },
      type: 'choice',
      choices: [
        { label: '💰 Save Money',               value: 'save_money' },
        { label: '🌍 Reduce CO₂ Fast',          value: 'reduce_co2' },
        { label: '📊 Reach India Average',      value: 'india_average' },
        { label: '🎯 Hit Paris Target (2.1 t)', value: 'paris_target' },
      ],
      process: (val) => {
        _state.userData.goal = val;
        Profiler.recordGoal(val);
        if (val === 'save_money')                        _state.framingMode = 'financial';
        else if (val === 'reduce_co2' || val === 'paris_target') _state.framingMode = 'impact';
      },
    },
    {
      id: 'transport_mode',
      message: () => {
        const q = {
          student:      `Now let's look at how you get around. How do you usually get to college?`,
          professional: `Now let's look at your commute. How do you usually travel to work?`,
          family:       `What's your household's main way of getting around?`,
        }[_state.userData.persona];
        return [`${q}`];
      },
      type: 'choice',
      choices: [
        { label: '🚌 Bus / Metro / Train', value: 'public_transit' },
        { label: '🏍️ Bike / Scooter',     value: 'motorcycle' },
        { label: '🚗 Car (Petrol)',         value: 'petrol_car' },
        { label: '🚗 Car (Diesel)',         value: 'diesel_car' },
        { label: '🚶 Walk / Cycle',         value: 'walk_cycle' },
      ],
      process: (val) => { _state.userData.transport.mode = val; },
    },
    {
      id: 'km_per_week',
      skip: () => _state.userData.transport.mode === 'walk_cycle',
      message: () => {
        const mode = _modeLabel(_state.userData.transport.mode);
        const hint = _state.userData.transport.mode === 'public_transit'
          ? '(A typical urban commute is 20–60 km/week)'
          : '(A typical Indian commute is 40–120 km/week)';
        return [
          `How many km do you travel by ${mode} per week? ${hint}`,
        ];
      },
      type: 'number',
      placeholder: 'e.g. 80',
      unit: 'km/week',
      min: 0, max: 2000,
      process: (val) => { _state.userData.transport.km_per_week = Calculator.sanitize(val, 2000); },
    },
    {
      id: 'flights',
      message: () => [`How many times do you fly per year? Include both work and leisure trips. Enter 0 if you don't fly.`],
      type: 'number',
      placeholder: 'e.g. 2',
      unit: 'flights/year',
      min: 0, max: 50,
      process: (val) => {
        const n = Math.round(Calculator.sanitize(val, 50));
        const short = Math.round(n * 0.7);
        const long = n - short;
        _state.userData.transport.flights_short = short;
        _state.userData.transport.flights_long  = long;
      },
    },
    {
      id: 'region',
      message: () => [`Which region of India do you live in? This helps us use the exact local grid factor for your electricity emissions.`],
      type: 'choice',
      choices: [
        { label: '🏛️ North India', value: 'northern' },
        { label: '🏝️ South India', value: 'southern' },
        { label: '🌅 East India', value: 'eastern' },
        { label: '🌇 West India', value: 'western' },
        { label: '🏔️ North-East India', value: 'northeastern' },
        { label: '🇮🇳 National Average', value: 'national' },
      ],
      process: (val) => { 
        _state.userData.energy.region = val; 
      },
    },
    {
      id: 'electricity',
      message: () => {
        const hints = {
          student:      `Check your electricity bill if you can — a typical hostel room uses 40–100 kWh/month.`,
          professional: `Check your latest electricity bill. A typical Indian urban household uses 150–350 kWh/month.`,
          family:       `Check your electricity bill. A typical Indian family uses 200–500 kWh/month.`,
        }[_state.userData.persona] || '';
        return [`What's your monthly electricity usage in kWh?`, hints];
      },
      type: 'number',
      placeholder: 'e.g. 150',
      unit: 'kWh/month',
      min: 0, max: 5000,
      process: (val) => { _state.userData.energy.electricity_kwh = Calculator.sanitize(val, 5000); },
    },
    {
      id: 'lpg',
      message: () => [`How many LPG cylinders does your household use per month? A typical Indian household uses 1–2 per month. Enter 0 if you use piped gas or induction only.`],
      type: 'number',
      placeholder: 'e.g. 1',
      unit: 'cylinders/month',
      min: 0, max: 20,
      process: (val) => { _state.userData.energy.lpg_cylinders = Calculator.sanitize(val, 20); },
    },
    {
      id: 'diet',
      message: () => [`How would you describe your usual diet? This is one of the biggest factors in your footprint.`],
      type: 'choice',
      choices: [
        { label: '🥗 Vegan',                       value: 'vegan' },
        { label: '🥬 Vegetarian',                  value: 'vegetarian' },
        { label: '🐟 Pescatarian (fish, no meat)', value: 'pescatarian' },
        { label: '🍗 Omnivore (some meat)',         value: 'omnivore' },
        { label: '🥩 Meat with most meals',         value: 'meat_heavy' },
      ],
      process: (val) => { _state.userData.diet = val; },
    },
    {
      id: 'shopping',
      message: () => [`Almost done! How many new clothing items do you buy per month on average?`],
      type: 'choice',
      choices: [
        { label: '0–1 items (minimal)',  value: '0.5' },
        { label: '2–3 items',           value: '2.5' },
        { label: '4–6 items',           value: '5' },
        { label: '7+ items (frequent)', value: '8' },
      ],
      process: (val) => { _state.userData.shopping.clothing_per_month = parseFloat(val); },
    },
    {
      id: 'online_orders',
      message: () => [`How many online orders (deliveries) do you place per week?`],
      type: 'choice',
      choices: [
        { label: '0–1 orders',  value: '0.5' },
        { label: '2–3 orders',  value: '2.5' },
        { label: '4–6 orders',  value: '5' },
        { label: '7+ orders',   value: '8' },
      ],
      process: (val) => { _state.userData.shopping.online_orders_per_week = parseFloat(val); },
    },
    {
      id: 'feasibility',
      skip: () => ['public_transit', 'walk_cycle'].includes(_state.userData.transport.mode),
      message: () => [
        `Last question — transport is often the biggest lever for change.`,
        `Would you realistically consider switching to public transport at least 2 days a week?`,
      ],
      type: 'choice',
      choices: [
        { label: '✅ Yes, I can try it',           value: 'yes' },
        { label: '🤔 Maybe, if it\'s convenient', value: 'maybe' },
        { label: '❌ No, I need my vehicle',       value: 'no' },
      ],
      process: (val) => {
        _state.userData.feasibility = val;
        if (val === 'no')                               _state.framingMode = 'convenience';
        if (val === 'yes' && !_state.framingMode)       _state.framingMode = 'impact';
      },
    },
  ];

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function _modeLabel(mode) {
    return { petrol_car:'car', diesel_car:'car', motorcycle:'bike',
             public_transit:'bus/train', walk_cycle:'walking' }[mode] || mode;
  }

  function _visibleStepCount() {
    return STEPS.filter(s => !s.skip || !s.skip()).length;
  }

  // ── TYPING INDICATOR ───────────────────────────────────────────────────────

  function _showTyping() {
    const log = document.getElementById('conversation-messages');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'message message-assistant typing-indicator';
    el.id = 'typing-indicator';
    el.setAttribute('aria-label', 'EcoGuide is typing');
    el.setAttribute('role', 'status');
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      el.appendChild(dot);
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function _hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  // ── PROGRESS BAR ───────────────────────────────────────────────────────────

  function _updateProgress() {
    const bar   = document.getElementById('conv-progress-fill');
    const container = document.getElementById('conv-progress');
    const label = document.getElementById('conv-progress-label');
    if (!bar || !label) return;
    const total   = _totalVisibleSteps || 1;
    const current = Math.min(_visitedSteps, total);
    const pct     = Math.round((current / total) * 100);
    bar.style.width = `${pct}%`;
    label.textContent = `Step ${current} of ${total}`;
    if (container) {
      container.setAttribute('aria-valuenow', pct);
    }
  }

  // ── MESSAGE RENDERING ──────────────────────────────────────────────────────

  /**
   * Appends a message bubble. Uses textContent exclusively — XSS-safe.
   * @param {string[]} lines - Array of paragraph strings
   * @param {'assistant'|'user'} sender
   */
  function _appendMessage(lines, sender) {
    const log = document.getElementById('conversation-messages');
    if (!log) return;
    const bubble = document.createElement('div');
    bubble.className = `message message-${sender}`;
    bubble.setAttribute('role', 'listitem');

    (Array.isArray(lines) ? lines : [lines]).forEach((line, i) => {
      if (!line) return;
      if (i > 0) {
        const br = document.createElement('div');
        br.className = 'message-spacer';
        bubble.appendChild(br);
      }
      const p = document.createElement('p');
      p.textContent = line; // Always textContent — XSS-safe
      bubble.appendChild(p);
    });

    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  // ── INPUT RENDERING ────────────────────────────────────────────────────────

  function _renderInput(step) {
    const area = document.getElementById('conversation-input-area');
    if (!area) return;
    area.innerHTML = '';

    if (step.type === 'choice') {
      _renderChoices(step, area);
    } else if (step.type === 'number') {
      _renderNumberInput(step, area);
    }
  }

  function _renderChoices(step, area) {
    const grid = document.createElement('div');
    grid.className = 'choice-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Select an option');

    step.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.label;
      btn.dataset.value = choice.value;
      // Keyboard shortcut: 1-9 keys
      if (idx < 9) {
        btn.title = `Press ${idx + 1}`;
        btn.dataset.key = String(idx + 1);
      }
      btn.addEventListener('click', () => _handleChoice(choice, step));
      grid.appendChild(btn);
    });

    area.appendChild(grid);

    // Auto-focus first chatbot choice
    const firstBtn = grid.querySelector('.choice-btn');
    if (firstBtn) {
      _setTimer(() => firstBtn.focus(), 150);
    }

    // Clean up any stale handler before binding a new one
    _cleanupKeyHandler();

    // Number key shortcuts
    _activeKeyHandler = (e) => {
      const btn = grid.querySelector(`[data-key="${e.key}"]`);
      if (btn) {
        btn.click();
        _cleanupKeyHandler();
      }
    };
    document.addEventListener('keydown', _activeKeyHandler);
  }

  function _renderNumberInput(step, area) {
    const wrapper = document.createElement('div');
    wrapper.className = 'number-input-wrapper';

    const label = document.createElement('label');
    label.htmlFor = 'conv-number-input';
    label.className = 'visually-hidden';
    label.textContent = step.message().join(' ');
    wrapper.appendChild(label);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'input-field-wrap';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'conv-number-input';
    input.min = String(step.min ?? 0);
    input.max = String(step.max ?? 99999);
    input.placeholder = step.placeholder || '0';
    input.className = 'conv-number-input';
    input.setAttribute('aria-label', `Enter value in ${step.unit || 'units'}`);
    input.setAttribute('aria-describedby', 'conv-input-error');
    input.setAttribute('aria-invalid', 'false');

    const unitSpan = document.createElement('span');
    unitSpan.className = 'unit-label';
    unitSpan.textContent = step.unit || '';

    const errMsg = document.createElement('span');
    errMsg.className = 'input-error';
    errMsg.id = 'conv-input-error';
    errMsg.setAttribute('aria-live', 'polite');
    errMsg.setAttribute('role', 'alert');

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = 'Continue →';

    const validate = () => {
      const raw = input.value.trim();
      const val = parseFloat(raw);
      if (raw === '' || isNaN(val) || val < 0) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('input-error-state');
        errMsg.textContent = raw === '' ? 'Please enter a value.' : 'Please enter a valid positive number.';
        input.focus();
        return false;
      }
      input.setAttribute('aria-invalid', 'false');
      input.classList.remove('input-error-state');
      errMsg.textContent = '';
      return true;
    };

    btn.addEventListener('click', () => {
      if (!validate()) return;
      _handleNumber(input.value.trim(), step);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') btn.click();
      if (e.key === 'Escape') input.value = '';
    });

    input.addEventListener('input', () => {
      if (input.classList.contains('input-error-state')) validate();
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(unitSpan);
    wrapper.appendChild(inputWrap);
    wrapper.appendChild(errMsg);
    wrapper.appendChild(btn);
    area.appendChild(wrapper);

    _setTimer(() => { input.focus(); }, 120);
  }

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────────

  function _handleChoice(choice, step) {
    _cleanupKeyHandler();
    // Disable all buttons to prevent double-click
    const area = document.getElementById('conversation-input-area');
    if (area) area.querySelectorAll('button').forEach(b => { b.disabled = true; });

    _appendMessage([choice.label], 'user');
    step.process(choice.value);
    _advance();
    _setTimer(_showNextStep, 500);
  }

  function _handleNumber(val, step) {
    _cleanupKeyHandler();
    const display = `${val} ${step.unit || ''}`.trim();
    _appendMessage([display], 'user');
    step.process(val);
    _advance();
    _setTimer(_showNextStep, 500);
  }

  // ── STEP NAVIGATION ────────────────────────────────────────────────────────

  function _advance() {
    _state.step++;
    while (_state.step < STEPS.length && STEPS[_state.step].skip?.()) {
      _state.step++;
    }
    _visitedSteps++;
  }

  function _simulateUserInput(step) {
    const demoAnswers = {
      persona: 'professional',
      goal: 'reduce_co2',
      transport_mode: 'petrol_car',
      km_per_week: '120',
      flights: '4',
      region: 'western',
      electricity: '250',
      lpg: '1',
      diet: 'vegetarian',
      shopping: '2.5',
      online_orders: '2.5',
      feasibility: 'yes'
    };

    const val = demoAnswers[step.id];
    let displayVal = val;
    if (step.type === 'choice') {
      const choice = step.choices.find(c => c.value === val);
      if (choice) displayVal = choice.label;
    } else {
      displayVal = `${val} ${step.unit || ''}`.trim();
    }

    _cleanupKeyHandler();
    _appendMessage([displayVal], 'user');
    step.process(val);
    _advance();
    _setTimer(_showNextStep, _isDemo ? 150 : 500);
  }

  function _showNextStep() {
    if (_state.step >= STEPS.length) {
      _finishConversation();
      return;
    }
    const step = STEPS[_state.step];
    if (!step) { _finishConversation(); return; }

    _updateProgress();

    _showTyping();
    const typingDelay = _isDemo ? 100 : (600 + Math.min(step.message().join('').length * 2, 800));

    _setTimer(() => {
      _hideTyping();
      _appendMessage(step.message(), 'assistant');
      _setTimer(() => {
        if (_isDemo) {
          _simulateUserInput(step);
        } else {
          _renderInput(step);
        }
      }, _isDemo ? 50 : 150);
    }, typingDelay);
  }

  // ── CONVERSATION END ───────────────────────────────────────────────────────

  function _finishConversation() {
    _state.complete = true;
    _updateProgress();

    const area = document.getElementById('conversation-input-area');
    if (area) area.innerHTML = '';

    _showTyping();
    _setTimer(() => {
      _hideTyping();
      _appendMessage([
        `Thanks for sharing that! Let me analyse your lifestyle... ⏳`,
        `I'm calculating your carbon footprint across all four categories.`,
      ], 'assistant');

      _setTimer(() => {
        const wasDemo = _isDemo;
        _isDemo = false;
        if (typeof AppState !== 'undefined') {
          AppState.onConversationComplete(_state.userData);
        }
      }, _isDemo ? 300 : 1200);
    }, _isDemo ? 150 : 800);
  }

  // ── RESTART ────────────────────────────────────────────────────────────────

  /**
   * Resets and restarts the conversation from scratch.
   */
  function restart() {
    _cleanupKeyHandler();
    _clearAllTimers();
    _state = {
      step: 0, complete: false, framingMode: null,
      userData: {
        persona: null, goal: null,
        transport: { mode: 'motorcycle', km_per_week: 0, flights_short: 0, flights_long: 0 },
        energy:    { electricity_kwh: 0, lpg_cylinders: 1, gas_m3: 0, region: 'national' },
        diet:      'omnivore',
        shopping:  { clothing_per_month: 2, electronics_per_year: 1, online_orders_per_week: 2 },
        feasibility: null,
      },
    };
    _visitedSteps = 0;
    _totalVisibleSteps = _visibleStepCount();

    const log = document.getElementById('conversation-messages');
    if (log) log.innerHTML = '';
    _updateProgress();
    _showNextStep();
  }

  /**
   * Starts the conversation (called by app.js on init).
   */
  function start() {
    _cleanupKeyHandler();
    _clearAllTimers();
    _visitedSteps      = 0;
    _totalVisibleSteps = _visibleStepCount();
    _updateProgress();
    _showNextStep();
  }

  function runDemo() {
    _clearAllTimers();
    _isDemo = true;
    restart();
  }

  return Object.freeze({ start, restart, runDemo });
})();
