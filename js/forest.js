/**
 * forest.js — Virtual Forest Visualizer component.
 * Renders trees (🌳) corresponding to CO₂ savings in kg.
 *
 * @module Forest
 */

'use strict';

const Forest = (() => {
  const CO2_PER_TREE_KG = 22;

  /**
   * Renders the Virtual Forest in the given element container.
   * @param {string} containerId - DOM ID of the container
   * @param {number} co2SavedKg - Total CO₂ saved in kg
   */
  function renderForest(containerId, co2SavedKg) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const treesCount = Math.max(0, Math.round(co2SavedKg / CO2_PER_TREE_KG));

    // Card Header / Title
    const header = document.createElement('h3');
    header.className = 'card-title';
    header.textContent = '🌳 Your Virtual Forest';
    container.appendChild(header);

    // Description text (accessible)
    const desc = document.createElement('p');
    desc.className = 'forest-desc';
    desc.textContent = `Your actions have saved ${Math.round(co2SavedKg)} kg of CO₂. This impact equals approximately ${treesCount} tree${treesCount === 1 ? '' : 's'} absorbing carbon for one year.`;
    container.appendChild(desc);

    // Visual grid
    const grid = document.createElement('div');
    grid.className = 'forest-grid';
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', `Visual grid showing ${treesCount} trees representing your environmental impact.`);

    if (treesCount === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'forest-empty';
      emptyState.textContent = 'Begin accepting and acting on recommendations to grow your forest!';
      grid.appendChild(emptyState);
    } else {
      // Limit displayed trees if it's very large, but keep the count accurate in text
      const maxDisplayTrees = Math.min(treesCount, 100);
      for (let i = 0; i < maxDisplayTrees; i++) {
        const tree = document.createElement('span');
        tree.className = 'forest-tree';
        tree.textContent = '🌳';
        tree.style.animationDelay = `${i * 50}ms`; // Staggered appearance
        grid.appendChild(tree);
      }

      if (treesCount > 100) {
        const extraText = document.createElement('span');
        extraText.className = 'forest-extra-text';
        extraText.textContent = `+ ${treesCount - 100} more trees`;
        grid.appendChild(extraText);
      }
    }

    container.appendChild(grid);
  }

  return { renderForest };
})();
