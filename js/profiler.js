/**
 * profiler.js — Persistent behavioral profiling engine.
 * Tracks user accept/reject patterns across sessions via localStorage.
 * Derives Eco Persona and personalises recommendation scoring over time.
 *
 * @module profiler
 */

'use strict';

const Profiler = (() => {

  const STORAGE_KEY = 'ecoguide_profile';
  const MAX_LOG_ENTRIES = 24;
  let _cachedProfile = null;

  /** @typedef {'cost_saver'|'climate_champion'|'convenience_first'|'eco_beginner'} EcoPersona */

  /**
   * Default profile structure. Never mutate — clone before saving.
   * @type {Object}
   */
  const DEFAULT_PROFILE = {
    ecoPersona: 'eco_beginner',
    acceptedByCategory: { transport: 0, energy: 0, diet: 0, shopping: 0 },
    rejectedByCategory: { transport: 0, energy: 0, diet: 0, shopping: 0 },
    rejectedDifficulty: { easy: 0, medium: 0, hard: 0 },
    costSaverScore:    0,
    climateScore:      0,
    convenienceScore:  0,
    beginnerScore:     1,
    goalHistory:       [],
    sessionsCount:     0,
    lastUpdated:       null,
    progressLog:       [],
  };

  /**
   * Safe JSON parser rejecting dangerous object prototype properties.
   */
  function safeJSONParse(str) {
    if (!str) return null;
    return JSON.parse(str, (key, value) => {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        return undefined;
      }
      return value;
    });
  }

  /**
   * Validates a loaded profile object has the expected shape.
   * Prevents injection via corrupted localStorage.
   * @param {*} obj - Parsed JSON object
   * @returns {boolean}
   */
  function isValidProfile(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    const required = ['ecoPersona', 'acceptedByCategory', 'rejectedByCategory',
                      'rejectedDifficulty', 'progressLog'];
    if (!required.every(k => Object.prototype.hasOwnProperty.call(obj, k))) return false;

    const validPersonas = ['cost_saver', 'climate_champion', 'convenience_first', 'eco_beginner'];
    if (!validPersonas.includes(obj.ecoPersona)) return false;

    const categories = ['transport', 'energy', 'diet', 'shopping'];
    for (const cat of categories) {
      if (typeof obj.acceptedByCategory[cat] !== 'number' || obj.acceptedByCategory[cat] < 0) return false;
      if (typeof obj.rejectedByCategory[cat] !== 'number' || obj.rejectedByCategory[cat] < 0) return false;
    }

    const difficulties = ['easy', 'medium', 'hard'];
    for (const diff of difficulties) {
      if (typeof obj.rejectedDifficulty[diff] !== 'number' || obj.rejectedDifficulty[diff] < 0) return false;
    }

    if (!Array.isArray(obj.progressLog)) return false;
    for (const entry of obj.progressLog) {
      if (typeof entry !== 'object' || entry === null) return false;
      if (typeof entry.month !== 'string' || typeof entry.total !== 'number' || typeof entry.ecoScore !== 'number') return false;
    }

    return true;
  }

  /**
   * Loads the behavioral profile from localStorage.
   * Falls back to default if missing or corrupted.
   * @returns {Object} Current profile
   */
  function loadProfile() {
    if (_cachedProfile) {
      return structuredClone(_cachedProfile);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        _cachedProfile = structuredClone(DEFAULT_PROFILE);
        return structuredClone(_cachedProfile);
      }
      const parsed = safeJSONParse(raw);
      if (!isValidProfile(parsed)) {
        _cachedProfile = structuredClone(DEFAULT_PROFILE);
        return structuredClone(_cachedProfile);
      }
      _cachedProfile = Object.assign({}, structuredClone(DEFAULT_PROFILE), parsed);
      return structuredClone(_cachedProfile);
    } catch {
      _cachedProfile = structuredClone(DEFAULT_PROFILE);
      return structuredClone(_cachedProfile);
    }
  }

  /**
   * Persists profile to localStorage.
   * @param {Object} profile
   */
  function saveProfile(profile) {
    _cachedProfile = structuredClone(profile);
    try {
      profile.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // localStorage quota exceeded — fail silently
    }
  }

  /**
   * Derives the dominant Eco Persona from score counters.
   * @param {Object} profile
   * @returns {EcoPersona}
   */
  function derivePersona(profile) {
    const scores = {
      cost_saver:         profile.costSaverScore,
      climate_champion:   profile.climateScore,
      convenience_first:  profile.convenienceScore,
      eco_beginner:       profile.beginnerScore,
    };
    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  /**
   * Updates profile when user accepts a recommendation.
   * @param {Object} rec - The accepted recommendation
   */
  function recordAccept(rec) {
    const profile = loadProfile();
    profile.acceptedByCategory[rec.category] = (profile.acceptedByCategory[rec.category] || 0) + 1;
    if (rec.moneySaving > 3000) profile.costSaverScore  += 2;
    if (rec.co2Saving   > 200)  profile.climateScore    += 2;
    if (rec.difficulty === 'easy') profile.beginnerScore += 1;
    profile.ecoPersona = derivePersona(profile);
    saveProfile(profile);
  }

  /**
   * Updates profile when user rejects a recommendation.
   * @param {Object} rec - The rejected recommendation
   */
  function recordReject(rec) {
    const profile = loadProfile();
    profile.rejectedByCategory[rec.category] = (profile.rejectedByCategory[rec.category] || 0) + 1;
    if (rec.difficulty === 'hard')   profile.convenienceScore += 2;
    if (rec.difficulty === 'medium') profile.convenienceScore += 1;
    profile.rejectedDifficulty[rec.difficulty] = (profile.rejectedDifficulty[rec.difficulty] || 0) + 1;
    profile.ecoPersona = derivePersona(profile);
    saveProfile(profile);
  }

  /**
   * Computes a preference score (0–1) for a recommendation based on history.
   * Used by recommender.js for the preference weight.
   * @param {Object} rec - Recommendation object
   * @param {Object} profile - Current profile
   * @returns {number} 0.0–1.0
   */
  function preferenceScore(rec, profile) {
    // Suppress if user always rejects this difficulty level
    const diffRejected = profile.rejectedDifficulty[rec.difficulty] || 0;
    if (diffRejected > 3) return 0;

    const accepted = profile.acceptedByCategory[rec.category] || 0;
    const rejected = profile.rejectedByCategory[rec.category] || 0;
    const total = accepted + rejected;
    if (total === 0) return 0.5; // neutral for new users

    return accepted / total;
  }

  /**
   * Records a new monthly progress snapshot to the profile.
   * @param {{ month: string, total: number, ecoScore: number, topCategory: string }} snapshot
   */
  function addProgressSnapshot(snapshot) {
    const profile = loadProfile();
    profile.progressLog.push({
      month: snapshot.month,
      total: snapshot.total,
      ecoScore: snapshot.ecoScore,
      topCategory: snapshot.topCategory,
      recordedAt: new Date().toISOString(),
    });
    // Keep last 24 entries
    if (profile.progressLog.length > MAX_LOG_ENTRIES) profile.progressLog.shift();
    profile.sessionsCount = (profile.sessionsCount || 0) + 1;
    saveProfile(profile);
  }

  /**
   * Returns all recorded progress snapshots.
   * @returns {Array}
   */
  function getProgressLog() {
    return loadProfile().progressLog;
  }

  /**
   * Saves the current goal to the goal history.
   * @param {string} goal
   */
  function recordGoal(goal) {
    const profile = loadProfile();
    if (!profile.goalHistory.includes(goal)) {
      profile.goalHistory.push(goal);
    }
    saveProfile(profile);
  }

  /**
   * Clears all stored profile data (for testing).
   */
  function clearProfile() {
    _cachedProfile = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* empty */ }
  }

  return Object.freeze({
    loadProfile, saveProfile, derivePersona, recordAccept, recordReject,
    preferenceScore, addProgressSnapshot, getProgressLog, recordGoal, clearProfile,
  });
})();
