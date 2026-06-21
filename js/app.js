/**
 * app.js — Main application controller.
 * Manages global state, view routing, and integrates all modules.
 *
 * @module app
 */

'use strict';

const AppState = (() => {

  /** Global application state — single source of truth. */
  const state = {
    userData:        null,
    breakdown:       null,
    recommendations: null,
    plan:            null,
    ecoScore:        null,
    goal:            null,
    currentView:     'conversation',
    // Performance: Dirty flags to prevent layout thrashing and redrawing
    dirty: {
      dashboard:       true,
      recommendations: true,
      planner:         true,
      history:         true,
      simulator:       true
    }
  };

  // ── VIEW ROUTER ─────────────────────────────────────────────────────────────

  const VIEWS = ['conversation', 'dashboard', 'recommendations', 'planner', 'simulator', 'history', 'tests'];

  /**
   * Navigates to a named view.
   * @param {string} viewName
   */
  function showOnboardingLanding() {
    _show('conversation-landing');
    const chatContainer = document.getElementById('conversation-chat-container');
    if (chatContainer) chatContainer.style.display = 'none';
  }

  function showChatContainer() {
    _hide('conversation-landing');
    const chatContainer = document.getElementById('conversation-chat-container');
    if (chatContainer) chatContainer.style.display = 'flex';
  }

  function navigateTo(viewName) {
    if (!VIEWS.includes(viewName)) return;

    VIEWS.forEach(v => {
      const el  = document.getElementById(`view-${v}`);
      const btn = document.querySelector(`[data-view="${v}"]`);
      const isActive = v === viewName;
      if (el)  { el.hidden = !isActive; el.classList.toggle('active', isActive); }
      if (btn) {
        btn.classList.toggle('active', isActive);
        if (isActive) {
          btn.setAttribute('aria-current', 'page');
        } else {
          btn.removeAttribute('aria-current');
        }
      }
    });

    state.currentView = viewName;

    if (viewName === 'conversation') {
      if (state.userData) {
        showChatContainer();
      } else {
        showOnboardingLanding();
      }
    }

    // Lazy-render views when first visited or when dirty
    if (state.breakdown) {
      if (viewName === 'dashboard')        _renderDashboard();
      if (viewName === 'recommendations')  _renderRecommendations();
      if (viewName === 'planner')          _renderPlanner();
      if (viewName === 'simulator')        _renderSimulator();
      if (viewName === 'history')          _renderHistory();
    }

    // A07 Route Announcement via live region
    const announcer = document.getElementById('route-announcer');
    if (announcer) {
      announcer.textContent = `Navigated to ${viewName.charAt(0).toUpperCase() + viewName.slice(1)} view`;
    }

    // A06 Focus management after SPA navigation
    const activeViewEl = document.getElementById(`view-${viewName}`);
    if (activeViewEl) {
      const heading = activeViewEl.querySelector('h1, h2');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    }

    window.scrollTo(0, 0);
  }

  // ── CONVERSATION COMPLETION ─────────────────────────────────────────────────

  /**
   * Called by conversation.js when the dialogue is complete.
   * Triggers full analysis pipeline and navigates to dashboard.
   * @param {Object} userData - Collected user data
   */
  function onConversationComplete(userData) {
    state.userData = userData;
    state.goal     = userData.goal;

    // Show restart button now that conversation is done
    const restartBtn = document.getElementById('conv-restart-btn');
    if (restartBtn) restartBtn.style.display = 'block';

    // Compute emissions
    state.breakdown = Calculator.computeBreakdown(userData);

    // Load behavioral profile
    const profile = Profiler.loadProfile();

    // Generate ranked recommendations
    state.recommendations = Recommender.generateRecommendations(
      userData, state.breakdown, state.goal, profile
    );

    // Generate action plan
    state.plan = Planning.generateActionPlan(state.recommendations, userData.persona, state.goal);

    // Compute EcoScore
    state.ecoScore = Analytics.computeEcoScore(state.breakdown);

    // Save progress snapshot
    const now = new Date();
    Profiler.addProgressSnapshot({
      month:       now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      total:       state.breakdown.total,
      ecoScore:    state.ecoScore.overall,
      topCategory: _dominantCategory(state.breakdown),
    });

    // Mark views as dirty
    state.dirty.dashboard       = true;
    state.dirty.recommendations = true;
    state.dirty.planner         = true;
    state.dirty.history         = true;
    state.dirty.simulator       = true;

    // Gamification: Unlock assessments achievement
    if (typeof Achievements !== 'undefined') {
      Achievements.unlock('first_assessment');
      // If plan has significant savings, unlock rewards
      const totals = Planning.planTotalSavings(state.plan || []);
      if (totals.co2 >= 500) {
        Achievements.unlock('climate_champion');
      } else if (totals.co2 >= 100) {
        Achievements.unlock('carbon_reducer');
      }

      // Unlock new micro achievements
      if (userData.diet === 'vegetarian' || userData.diet === 'vegan') {
        Achievements.unlock('green_diet');
      }
      if (userData.energy.electricity_kwh <= 80) {
        Achievements.unlock('clean_energy');
      }
      if (userData.transport.mode === 'walk_cycle' || userData.transport.mode === 'public_transit') {
        Achievements.unlock('commute_hero');
      }
      if (userData.shopping.clothing_per_month <= 1 && userData.shopping.electronics_per_year <= 1) {
        Achievements.unlock('smart_shopper');
      }
      const acceptedRecs = (state.recommendations || []).filter(r => r.accepted);
      const totalSaved = acceptedRecs.reduce((sum, r) => sum + r.co2Saving, 0);
      if (totalSaved / 22 >= 10) {
        Achievements.unlock('forest_grower');
      }
    }

    // Show result in conversation
    _appendAnalysisResult();

    // Navigate to dashboard after a short delay
    setTimeout(() => navigateTo('dashboard'), 1500);
  }

  function _dominantCategory(bd) {
    return ['transport', 'energy', 'diet', 'shopping']
      .reduce((a, b) => bd[a] >= bd[b] ? a : b);
  }

  function _appendAnalysisResult() {
    const bd    = state.breakdown;
    const score = state.ecoScore;
    const totalT = (bd.total / 1000).toFixed(2);
    const dominant = _dominantCategory(bd);
    const pct = Math.round((bd[dominant] / bd.total) * 100);

    const lines = [
      `✅ Analysis complete!`,
      ``,
      `Your annual footprint: ${totalT} t CO₂`,
      `EcoScore: ${score.overall}/100`,
      ``,
      `${dominant.charAt(0).toUpperCase() + dominant.slice(1)} is your largest source at ${pct}%.`,
      ``,
      `Opening your personalised dashboard...`,
    ];

    const log = document.getElementById('conversation-messages');
    if (!log) return;
    const bubble = document.createElement('div');
    bubble.className = 'message message-assistant result-bubble';
    bubble.setAttribute('role', 'listitem');
    lines.forEach((line, i) => {
      if (i > 0) bubble.appendChild(document.createElement('br'));
      const span = document.createElement('span');
      span.textContent = line;
      bubble.appendChild(span);
    });
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  // ── VIEW RENDERERS ──────────────────────────────────────────────────────────

  function _renderDashboard() {
    if (!state.breakdown) return;
    _show('dashboard-data');
    _hide('dashboard-no-data');

    // Display Active India grid factor badge
    const badgeEl = document.getElementById('grid-factor-badge');
    if (badgeEl) {
      const region = state.userData?.energy?.region || 'national';
      const regionNames = {
        northern: 'North India',
        southern: 'South India',
        eastern: 'East India',
        western: 'West India',
        northeastern: 'North-East India',
        national: 'National Average'
      };
      const name = regionNames[region] || 'National Average';
      badgeEl.textContent = `⚡ Using ${name} grid factor`;
    }

    if (!state.dirty.dashboard) return;

    Analytics.renderEcoScore(state.ecoScore);
    Analytics.renderBreakdownChart(state.breakdown);
    Analytics.renderComparison(state.breakdown.total, state.userData.persona);
    Analytics.renderGoalProgress(state.breakdown.total, state.goal,
      state.breakdown.total - (state.recommendations || []).reduce((s, r) => s + r.co2Saving, 0));

    // Story
    const storyEl = document.getElementById('story-content');
    if (storyEl) {
      storyEl.innerHTML = '';
      const paras = Storyteller.generateStory(state.breakdown, state.userData.persona, state.goal);
      paras.forEach(p => {
        const el = document.createElement('p');
        el.textContent = p; // textContent — XSS-safe
        storyEl.appendChild(el);
      });
    }

    // Render Virtual Forest on Dashboard
    if (typeof Forest !== 'undefined') {
      const acceptedRecs = (state.recommendations || []).filter(r => r.accepted);
      const totalSaved = acceptedRecs.reduce((sum, r) => sum + r.co2Saving, 0);
      Forest.renderForest('virtual-forest-dashboard', totalSaved);
    }

    state.dirty.dashboard = false;
  }

  function _renderRecommendations() {
    if (!state.recommendations) return;
    _show('recommendations-list');
    _hide('recs-no-data');

    // Persona badge
    const personaBadge = document.getElementById('eco-persona-badge');
    if (personaBadge) {
      const profile = Profiler.loadProfile();
      const labels  = { cost_saver: '💰 Cost Saver', climate_champion: '🌍 Climate Champion',
                        convenience_first: '🚗 Convenience First', eco_beginner: '🌱 Eco Beginner' };
      personaBadge.textContent = `Your Eco Persona: ${labels[profile.ecoPersona] || 'Eco Beginner'}`;
    }

    if (!state.dirty.recommendations) return;

    const list = document.getElementById('recommendations-list');
    if (!list) return;
    list.innerHTML = '';

    state.recommendations.forEach((rec, idx) => {
      const card = document.createElement('article');
      card.className = 'rec-card';
      card.setAttribute('aria-labelledby', `rec-title-${idx}`);

      // Header row: confidence bar + rank
      const header = document.createElement('div');
      header.className = 'rec-header';

      const rankEl = document.createElement('span');
      rankEl.className   = 'rec-rank';
      rankEl.textContent = `#${idx + 1}`;

      const confBar = document.createElement('div');
      confBar.className = 'conf-bar-wrap';
      confBar.setAttribute('aria-label', `Confidence: ${rec.confidence}%`);
      const confFill = document.createElement('div');
      confFill.className = 'conf-bar-fill';
      confFill.style.width = `${rec.confidence}%`;
      const confLabel = document.createElement('span');
      confLabel.className   = 'conf-label';
      confLabel.textContent = `${rec.confidence}% confidence`;
      confBar.appendChild(confFill);
      confBar.appendChild(confLabel);

      header.appendChild(rankEl);
      header.appendChild(confBar);
      card.appendChild(header);

      // Title
      const title = document.createElement('h3');
      title.id          = `rec-title-${idx}`;
      title.className   = 'rec-title';
      title.textContent = rec.title;
      card.appendChild(title);

      // Description
      const desc = document.createElement('p');
      desc.className   = 'rec-desc';
      desc.textContent = rec.description;
      card.appendChild(desc);

      // Metrics
      const metrics = document.createElement('div');
      metrics.className = 'rec-metrics';
      [
        { label: 'CO₂ saved',    val: `${rec.co2Saving} kg/year` },
        { label: 'Money saved',  val: `₹${rec.moneySaving.toLocaleString('en-IN')}/year` },
        { label: 'Difficulty',   val: rec.difficulty },
      ].forEach(m => {
        const span = document.createElement('span');
        span.className = `rec-metric diff-${m.label === 'Difficulty' ? rec.difficulty : ''}`;
        span.textContent = `${m.label}: ${m.val}`;
        metrics.appendChild(span);
      });
      card.appendChild(metrics);

      // Explanation
      const expSection = document.createElement('details');
      expSection.className = 'rec-explanation';
      const summary = document.createElement('summary');
      summary.textContent = 'Why this recommendation?';
      expSection.appendChild(summary);
      const ul = document.createElement('ul');
      rec.explanation.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        ul.appendChild(li);
      });
      expSection.appendChild(ul);
      card.appendChild(expSection);

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'rec-actions';

      const acceptBtn = document.createElement('button');
      acceptBtn.className   = rec.accepted ? 'btn-accepted' : 'btn-accept';
      acceptBtn.textContent = rec.accepted ? '✅ Accepted' : '✅ I\'ll do this';
      acceptBtn.setAttribute('aria-pressed', rec.accepted ? 'true' : 'false');
      
      const rejectBtn = document.createElement('button');
      rejectBtn.className   = 'btn-reject';
      rejectBtn.textContent = '❌ Not for me';
      rejectBtn.setAttribute('aria-pressed', 'false');

      if (rec.accepted) rejectBtn.disabled = true;

      acceptBtn.addEventListener('click', () => {
        rec.accepted = true;
        Profiler.recordAccept(rec);
        acceptBtn.textContent = '✅ Accepted';
        acceptBtn.className   = 'btn-accepted';
        acceptBtn.setAttribute('aria-pressed', 'true');
        rejectBtn.disabled = true;

        state.dirty.dashboard = true;
        state.dirty.planner   = true;

        // Gamification: Action Planner / Sustainability Master
        const acceptedCount = (state.recommendations || []).filter(r => r.accepted).length;
        if (acceptedCount >= 3 && typeof Achievements !== 'undefined') {
          Achievements.unlock('sustainability_master');
        }
      });

      rejectBtn.addEventListener('click', () => {
        rec.rejected = true;
        Profiler.recordReject(rec);
        card.classList.add('dismissed');
        card.setAttribute('aria-hidden', 'true');
        state.dirty.dashboard = true;
        state.dirty.planner   = true;
      });

      actions.appendChild(acceptBtn);
      actions.appendChild(rejectBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });

    state.dirty.recommendations = false;
  }

  function _renderPlanner() {
    if (!state.plan) return;
    _show('plan-data');
    _hide('plan-no-data');

    if (!state.dirty.planner) return;

    const container = document.getElementById('plan-data');
    if (!container) return;

    // Clear previous
    const existing = container.querySelectorAll('.week-card, .plan-summary, #virtual-forest-planner');
    existing.forEach(el => el.remove());

    const totals = Planning.planTotalSavings(state.plan);

    // Summary header
    const summary = document.createElement('div');
    summary.className = 'plan-summary';
    summary.textContent = `4-week total: −${Math.round(totals.co2)} kg CO₂ · Save ₹${Math.round(totals.money).toLocaleString('en-IN')}`;
    container.prepend(summary);

    state.plan.forEach(week => {
      const card = document.createElement('div');
      card.className = 'week-card';
      card.setAttribute('role', 'region');
      card.setAttribute('aria-label', week.theme);

      const weekHeader = document.createElement('div');
      weekHeader.className = 'week-header';
      const weekTitle = document.createElement('h3');
      weekTitle.className   = 'week-title';
      weekTitle.textContent = week.theme;
      const weekSavings = document.createElement('span');
      weekSavings.className   = 'week-savings';
      weekSavings.textContent = `−${Math.round(week.savingsCO2)} kg · ₹${Math.round(week.savingsMoney).toLocaleString('en-IN')}`;
      weekHeader.appendChild(weekTitle);
      weekHeader.appendChild(weekSavings);
      card.appendChild(weekHeader);

       // Filter out rejected actions dynamically
      const visibleActions = week.actions.filter(action => !action.rejected);

      if (visibleActions.length === 0) {
        const empty = document.createElement('p');
        empty.className   = 'week-empty';
        empty.textContent = 'Sustain the habits you\'ve built in previous weeks.';
        card.appendChild(empty);
      } else {
        const ul = document.createElement('ul');
        ul.className = 'action-list';
        visibleActions.forEach(action => {
          const li = document.createElement('li');
          li.className = `action-item ${action.accepted ? 'completed' : ''}`;
          
          const icon = document.createElement('span');
          icon.className   = 'action-icon';
          icon.textContent = action.accepted ? '✅' : (action.difficulty === 'easy' ? '🟢' : action.difficulty === 'medium' ? '🟡' : '🔴');
          
          const text = document.createElement('span');
          text.textContent = action.title;
          if (action.accepted) {
            text.style.textDecoration = 'line-through';
            text.style.opacity = '0.6';
          }
          
          li.appendChild(icon);
          li.appendChild(text);
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      const note = document.createElement('p');
      note.className   = 'week-note';
      note.textContent = week.motivationNote;
      card.appendChild(note);

      container.appendChild(card);
    });

    // Render Virtual Forest Visualizer in Planner View
    if (typeof Forest !== 'undefined') {
      const forestContainer = document.createElement('div');
      forestContainer.id = 'virtual-forest-planner';
      forestContainer.className = 'card';
      container.appendChild(forestContainer);
      Forest.renderForest('virtual-forest-planner', totals.co2);
    }

    state.dirty.planner = false;
  }

  function _renderSimulator() {
    if (!state.userData || !state.breakdown) return;
    _show('sim-data');
    _hide('sim-no-data');
    if (state.dirty.simulator) {
      Simulator.init(state.userData, state.breakdown);
      state.dirty.simulator = false;
    }
  }

  function _renderHistory() {
    const history = Profiler.getProgressLog();

    // Render Achievements Gallery
    if (typeof Achievements !== 'undefined') {
      const list = Achievements.load();
      const totalCount = list.length;
      const unlockedCount = list.filter(a => a.unlocked).length;

      const progressText = document.getElementById('achievements-progress-text');
      if (progressText) progressText.textContent = `${unlockedCount} / ${totalCount} unlocked`;
      const progressFill = document.getElementById('achievements-progress-bar-fill');
      if (progressFill) progressFill.style.width = `${(unlockedCount / totalCount) * 100}%`;

      const galleryEl = document.getElementById('achievements-gallery');
      if (galleryEl) {
        galleryEl.innerHTML = '';
        list.forEach(ach => {
          const card = document.createElement('div');
          const tierClass = ach.tier || 'common';
          card.className = `badge-card-item ${ach.unlocked ? 'unlocked' : 'locked'} tier-${tierClass}`;
          card.setAttribute('role', 'listitem');
          card.setAttribute('aria-label', `${ach.title} (${tierClass} tier): ${ach.desc}. ${ach.unlocked ? 'Unlocked' : 'Locked'}`);

          const icon = document.createElement('div');
          icon.className = 'badge-icon';
          icon.textContent = ach.title.split(' ')[0] || '🏆';

          const name = document.createElement('div');
          name.className = 'badge-name';
          name.textContent = ach.title.slice(ach.title.indexOf(' ') + 1);

          const tierLabel = document.createElement('span');
          tierLabel.className = `badge-tier-label tier-text-${tierClass}`;
          tierLabel.textContent = tierClass.toUpperCase();

          const desc = document.createElement('div');
          desc.className = 'badge-desc';
          desc.textContent = ach.desc;

          card.appendChild(icon);
          card.appendChild(name);
          card.appendChild(tierLabel);
          card.appendChild(desc);
          galleryEl.appendChild(card);
        });
      }
    }

    if (history.length === 0) {
      _show('history-data');
      _hide('history-no-data');
      _hide('history-cards');
      
      const trendCard = document.querySelector('#view-history .chart-card');
      if (trendCard) trendCard.hidden = true;
      const exportSec = document.querySelector('#view-history .export-section');
      if (exportSec) exportSec.hidden = true;
      return;
    }

    _show('history-data');
    _hide('history-no-data');
    _show('history-cards');
    
    const trendCard = document.querySelector('#view-history .chart-card');
    if (trendCard) trendCard.hidden = false;
    const exportSec = document.querySelector('#view-history .export-section');
    if (exportSec) exportSec.hidden = false;

    if (!state.dirty.history) return;

    Analytics.renderProgressCards(history);
    Analytics.renderTrendChart(history);

    state.dirty.history = false;
  }

  // ── CERTIFICATE PRINTER ──────────────────────────────────────────────────────

  function printCertificate() {
    const certArea = document.getElementById('certificate-print-area');
    if (!certArea) return;

    const bd = state.breakdown;
    const score = state.ecoScore;
    const totals = Planning.planTotalSavings(state.plan || []);

    const personaLabels = { student: 'Student Living in Hostel', professional: 'Working Professional', family: 'Household' };
    document.getElementById('cert-profile-type').textContent = personaLabels[state.userData.persona] || 'Individual';
    document.getElementById('cert-ecoscore').textContent = `${score.overall}/100`;
    document.getElementById('cert-annual-co2').textContent = `${(bd.total / 1000).toFixed(2)} t CO₂/year`;
    document.getElementById('cert-annual-savings').textContent = `${Math.round(totals.co2)} kg CO₂/year`;

    const treeEquivalent = Math.round(totals.co2 / 22);
    document.getElementById('cert-tree-equivalent').textContent = `${treeEquivalent} tree${treeEquivalent === 1 ? '' : 's'} absorbing carbon/year`;
    document.getElementById('cert-date-generated').textContent = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    let summaryText = 'For initiating their personal climate action plan with EcoGuide ';
    if (totals.co2 >= 500) {
      summaryText += 'and achieving the rank of Climate Champion by targeting over 500 kg of annual CO₂ reductions.';
    } else if (totals.co2 >= 100) {
      summaryText += 'and achieving the rank of Carbon Reducer by targeting over 100 kg of annual CO₂ reductions.';
    } else {
      summaryText += 'and committing to active sustainability improvements.';
    }
    document.getElementById('cert-achievement-summary').textContent = summaryText;

    certArea.style.display = 'block';
    window.print();
    certArea.style.display = 'none';
  }

  // ── QUICK PERSONA SELECTOR ─────────────────────────────────────────────────

  function loadPersonaProfile(personaKey) {
    const personas = {
      champion: {
        persona: 'professional',
        goal: 'reduce_co2',
        transport: { mode: 'walk_cycle', km_per_week: 0, flights_short: 0, flights_long: 0 },
        energy: { electricity_kwh: 50, lpg_cylinders: 0, gas_m3: 0, region: 'northeastern' },
        diet: 'vegan',
        shopping: { clothing_per_month: 0.5, electronics_per_year: 0, online_orders_per_week: 0.5 },
        feasibility: 'yes'
      },
      average_india: {
        persona: 'family',
        goal: 'india_average',
        transport: { mode: 'public_transit', km_per_week: 80, flights_short: 1, flights_long: 0 },
        energy: { electricity_kwh: 200, lpg_cylinders: 1, gas_m3: 0, region: 'national' },
        diet: 'vegetarian',
        shopping: { clothing_per_month: 2.5, electronics_per_year: 1, online_orders_per_week: 2.5 },
        feasibility: 'yes'
      },
      student: {
        persona: 'student',
        goal: 'save_money',
        transport: { mode: 'public_transit', km_per_week: 30, flights_short: 0, flights_long: 0 },
        energy: { electricity_kwh: 40, lpg_cylinders: 0, gas_m3: 0, region: 'southern' },
        diet: 'vegetarian',
        shopping: { clothing_per_month: 0.5, electronics_per_year: 0, online_orders_per_week: 0.5 },
        feasibility: 'yes'
      },
      traveler: {
        persona: 'professional',
        goal: 'reduce_co2',
        transport: { mode: 'petrol_car', km_per_week: 250, flights_short: 10, flights_long: 4 },
        energy: { electricity_kwh: 400, lpg_cylinders: 1, gas_m3: 0, region: 'western' },
        diet: 'meat_heavy',
        shopping: { clothing_per_month: 8, electronics_per_year: 3, online_orders_per_week: 8 },
        feasibility: 'no'
      },
      beginner: {
        persona: 'professional',
        goal: 'save_money',
        transport: { mode: 'diesel_car', km_per_week: 150, flights_short: 2, flights_long: 0 },
        energy: { electricity_kwh: 350, lpg_cylinders: 2, gas_m3: 0, region: 'northern' },
        diet: 'omnivore',
        shopping: { clothing_per_month: 5, electronics_per_year: 2, online_orders_per_week: 5 },
        feasibility: 'maybe'
      }
    };

    const userData = personas[personaKey] || personas.beginner;
    state.userData = userData;
    state.goal = userData.goal;

    const restartBtn = document.getElementById('conv-restart-btn');
    if (restartBtn) restartBtn.style.display = 'block';

    state.breakdown = Calculator.computeBreakdown(userData);

    const profile = Profiler.loadProfile();
    if (personaKey === 'champion') {
      profile.ecoPersona = 'climate_champion';
      profile.climateScore = 10;
    } else if (personaKey === 'average_india') {
      profile.ecoPersona = 'eco_beginner';
    } else if (personaKey === 'student') {
      profile.ecoPersona = 'cost_saver';
      profile.costSaverScore = 10;
    } else if (personaKey === 'traveler') {
      profile.ecoPersona = 'convenience_first';
      profile.convenienceScore = 10;
    } else {
      profile.ecoPersona = 'eco_beginner';
    }
    Profiler.saveProfile(profile);

    state.recommendations = Recommender.generateRecommendations(userData, state.breakdown, state.goal, profile);
    state.plan = Planning.generateActionPlan(state.recommendations, userData.persona, state.goal);
    state.ecoScore = Analytics.computeEcoScore(state.breakdown);

    // Save snapshot
    const now = new Date();
    Profiler.addProgressSnapshot({
      month: now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      total: state.breakdown.total,
      ecoScore: state.ecoScore.overall,
      topCategory: _dominantCategory(state.breakdown),
    });

    state.dirty.dashboard       = true;
    state.dirty.recommendations = true;
    state.dirty.planner         = true;
    state.dirty.history         = true;
    state.dirty.simulator       = true;

    // Gamification: Unlock achievements
    if (typeof Achievements !== 'undefined') {
      Achievements.unlock('first_assessment');
      const totals = Planning.planTotalSavings(state.plan || []);
      if (totals.co2 >= 500) {
        Achievements.unlock('climate_champion');
      } else if (totals.co2 >= 100) {
        Achievements.unlock('carbon_reducer');
      }
    }

    navigateTo('dashboard');
  }

  // ── UTILITIES ────────────────────────────────────────────────────────────────

  function _show(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  function _hide(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  function resetState() {
    state.userData        = null;
    state.breakdown       = null;
    state.recommendations = null;
    state.plan            = null;
    state.ecoScore        = null;
    state.goal            = null;

    // Reset dashboard views to no-data states
    _hide('dashboard-data');
    _show('dashboard-no-data');

    _hide('recommendations-list');
    _show('recs-no-data');
    const personaBadge = document.getElementById('eco-persona-badge');
    if (personaBadge) personaBadge.textContent = '';

    _hide('plan-data');
    _show('plan-no-data');
    const planDataContainer = document.getElementById('plan-data');
    if (planDataContainer) {
      const existing = planDataContainer.querySelectorAll('.week-card, .plan-summary, #virtual-forest-planner');
      existing.forEach(el => el.remove());
    }

    _hide('sim-data');
    _show('sim-no-data');

    showOnboardingLanding();
  }

  // ── INITIALISATION ──────────────────────────────────────────────────────────

  function init() {
    // Expose Persona Loader globally for HTML onclick hooks
    window.loadPersonaProfile = loadPersonaProfile;

    // Theme Toggle Handler (Light by default, manual Dark toggle)
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      const savedTheme = localStorage.getItem('ecoguide-theme') || 'light';
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleBtn.textContent = '🌙 Dark';
        themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
      } else {
        document.body.classList.remove('dark-theme');
        themeToggleBtn.textContent = '☀️ Light';
        themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
      }

      themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-theme');
        if (isDark) {
          localStorage.setItem('ecoguide-theme', 'dark');
          themeToggleBtn.textContent = '🌙 Dark';
          themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
        } else {
          localStorage.setItem('ecoguide-theme', 'light');
          themeToggleBtn.textContent = '☀️ Light';
          themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
        }
      });
    }

    // Register Service Worker (only on HTTP/HTTPS secure origins)
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.error('Service worker registration failed:', err);
      });
    }

    // Handle beforeinstallprompt flow
    let deferredPrompt = null;
    const installBtn = document.getElementById('install-app-btn');
    const heroInstallBtn = document.getElementById('hero-install-btn');

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) {
        installBtn.removeAttribute('hidden');
        installBtn.style.display = 'inline-block';
      }
      if (heroInstallBtn) {
        heroInstallBtn.style.display = 'inline-block';
      }
    });

    function triggerInstall() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
          deferredPrompt = null;
          if (installBtn) {
            installBtn.setAttribute('hidden', '');
            installBtn.style.display = 'none';
          }
          if (heroInstallBtn) {
            heroInstallBtn.style.display = 'none';
          }
        });
      }
    }

    if (installBtn) {
      installBtn.addEventListener('click', triggerInstall);
    }
    if (heroInstallBtn) {
      heroInstallBtn.addEventListener('click', triggerInstall);
    }

    window.addEventListener('appinstalled', () => {
      if (installBtn) {
        installBtn.setAttribute('hidden', '');
        installBtn.style.display = 'none';
      }
      if (heroInstallBtn) {
        heroInstallBtn.style.display = 'none';
      }
    });

    // Nav button bindings
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    // Data-nav buttons (in "no data" prompts)
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
    });

    // Restart button
    const restartBtn = document.getElementById('conv-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        restartBtn.style.display = 'none';
        resetState();
        Conversation.restart();
      });
    }

    // Demo button binding
    const demoBtn = document.getElementById('run-demo-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        showChatContainer();
        Conversation.runDemo();
      });
    }

    // Hero Section buttons
    const heroStartBtn = document.getElementById('hero-start-btn');
    if (heroStartBtn) {
      heroStartBtn.addEventListener('click', () => {
        showChatContainer();
        Conversation.start();
      });
    }

    const heroDemoBtn = document.getElementById('hero-demo-btn');
    if (heroDemoBtn) {
      heroDemoBtn.addEventListener('click', () => {
        showChatContainer();
        Conversation.runDemo();
      });
    }

    const landingRunDemoBtn = document.getElementById('landing-run-demo-btn');
    if (landingRunDemoBtn) {
      landingRunDemoBtn.addEventListener('click', () => {
        showChatContainer();
        Conversation.runDemo();
      });
    }

    const forestPromoCta = document.getElementById('forest-promo-cta');
    if (forestPromoCta) {
      forestPromoCta.addEventListener('click', () => {
        navigateTo('dashboard');
        // Scroll to forest section
        const forestDashboard = document.getElementById('virtual-forest-dashboard');
        if (forestDashboard) {
          forestDashboard.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    // Certificate button binding
    const certBtn = document.getElementById('print-cert-btn');
    if (certBtn) {
      certBtn.addEventListener('click', () => {
        printCertificate();
      });
    }

    // Export buttons
    const csvBtn = document.getElementById('export-csv-btn');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        if (!state.breakdown) return;
        Report.downloadCSV({
          userData:        state.userData,
          breakdown:       state.breakdown,
          recommendations: state.recommendations,
          plan:            state.plan,
          ecoScore:        state.ecoScore,
        });
      });
    }

    const pdfBtn = document.getElementById('export-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => Report.printPDF());
    }

    // Tests init
    Tests.init();

    // Start with conversation
    navigateTo('conversation');
    Conversation.start();

    // Mobile nav toggle
    const toggle   = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (toggle && navLinks) {
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        navLinks.classList.toggle('open');
      });
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return Object.freeze({ navigateTo, onConversationComplete, state, loadPersonaProfile });
})();
