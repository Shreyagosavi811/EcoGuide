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
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'eco_starter',
      title: '🌿 Eco Explorer',
      desc: 'Interact with the What-If Simulator to explore changes.',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'carbon_reducer',
      title: '🌳 Carbon Reducer',
      desc: 'Target at least 100 kg of annual CO₂ savings.',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'climate_champion',
      title: '🏆 Climate Champion',
      desc: 'Target over 500 kg of annual CO₂ savings.',
      unlocked: false,
      unlockedAt: null
    },
    {
      id: 'sustainability_master',
      title: '🎯 Action Planner',
      desc: 'Accept at least 3 sustainability recommendations.',
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
      container.style.position = 'fixed';
      container.style.bottom = '24px';
      container.style.right = '24px';
      container.style.zIndex = '9999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.style.background = '#2EA043';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '16px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    const icon = document.createElement('span');
    icon.style.fontSize = '24px';
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

    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 50);

    // Animate out
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  return {
    load,
    unlock
  };
})();
