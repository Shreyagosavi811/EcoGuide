/**
 * achievements.js — Gamified Achievement System for EcoGuide.
 * Handles unlocking, rendering, notifying, and local storage persistence of achievements.
 *
 * @module Achievements
 */

'use strict';

const Achievements = (() => {
  const STORAGE_KEY = 'ecoguide_achievements';

  const ACHIEVEMENTS_DEFINITION = [
    {
      id: 'first_assessment',
      title: '🌱 First Step',
      desc: 'Complete your first carbon footprint assessment.',
      tier: 'common',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'eco_starter',
      title: '🌿 Eco Explorer',
      desc: 'Interact with the What-If Simulator to explore changes.',
      tier: 'common',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'carbon_reducer',
      title: '🌳 Carbon Reducer',
      desc: 'Target at least 100 kg of annual CO₂ savings.',
      tier: 'rare',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'climate_champion',
      title: '🏆 Climate Champion',
      desc: 'Target over 500 kg of annual CO₂ savings.',
      tier: 'legendary',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'sustainability_master',
      title: '🎯 Action Planner',
      desc: 'Accept at least 3 sustainability recommendations.',
      tier: 'rare',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'green_diet',
      title: '🥗 Plant Power',
      desc: 'Select a vegetarian or vegan diet profile.',
      tier: 'common',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'clean_energy',
      title: '☀️ Solarian',
      desc: 'Limit monthly electricity usage below 80 kWh.',
      tier: 'rare',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'commute_hero',
      title: '🚲 Eco Commuter',
      desc: 'Commute by walking, cycling, or public transit.',
      tier: 'common',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'smart_shopper',
      title: '🛒 Conscious Buyer',
      desc: 'Limit shopping purchases to minimize consumption footprint.',
      tier: 'common',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'forest_grower',
      title: '🌲 Forest Builder',
      desc: 'Save enough carbon to grow 10 or more trees.',
      tier: 'legendary',
      unlocked: false,
      unlockedAt: null
    }
  ];

  /**
   * Initializes or loads the saved achievements list from Local Storage.
   * @returns {Array} List of achievement objects
   */
  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(ACHIEVEMENTS_DEFINITION));
    
    try {
      const parsed = JSON.parse(raw);
      // Map stored states back into our definition to ensure new achievements are compatible
      return ACHIEVEMENTS_DEFINITION.map(def => {
        const stored = parsed.find(p => p.id === def.id);
        if (stored) {
          return {
            ...def,
            unlocked: !!stored.unlocked,
            unlockedAt: stored.unlockedAt || null
          };
        }
        return def;
      });
    } catch (e) {
      console.error('Failed to parse achievements, resetting', e);
      return JSON.parse(JSON.stringify(ACHIEVEMENTS_DEFINITION));
    }
  }

  /**
   * Saves the achievement state to local storage.
   * @param {Array} list - List of achievements
   */
  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save achievements', e);
    }
  }

  /**
   * Unlocks an achievement by ID and triggers a toast notification if not already unlocked.
   * @param {string} id - The ID of the achievement to unlock
   */
  function unlock(id) {
    const list = load();
    const item = list.find(a => a.id === id);
    if (!item || item.unlocked) return;

    item.unlocked = true;
    item.unlockedAt = new Date().toISOString();
    save(list);

    // Trigger toast notification
    _showToast(item);

    // Mark history view dirty so badge gallery redraws on next visit
    if (typeof AppState !== 'undefined' && AppState.state && AppState.state.dirty) {
      AppState.state.dirty.history = true;
    }
  }

  /**
   * Renders and displays a toast notification with ARIA-live support.
   * @param {Object} item - The unlocked achievement item
   */
  function _showToast(item) {
    // Find or create toast container
    let container = document.getElementById('achievement-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'achievement-toast-container';
      container.setAttribute('aria-live', 'assertive');
      container.setAttribute('role', 'alert');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';

    const icon = document.createElement('span');
    icon.style.fontSize = '24px'; // Inline font size is fine, but let's keep it clean
    icon.textContent = item.title.split(' ')[0] || '🏆';

    const textWrap = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Achievement Unlocked!';
    title.style.display = 'block';

    const desc = document.createElement('span');
    desc.textContent = item.title;

    textWrap.appendChild(title);
    textWrap.appendChild(desc);
    toast.appendChild(icon);
    toast.appendChild(textWrap);
    container.appendChild(toast);

    // Animate in using class
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);

    // Animate out
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  return {
    load,
    unlock
  };
})();
