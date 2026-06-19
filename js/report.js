/**
 * report.js — Data export module.
 * Provides CSV download and PDF print (via browser print API).
 * Zero third-party dependencies.
 *
 * @module report
 */

'use strict';

const Report = (() => {

  function _csvField(value) {
    let str = String(value ?? '');
    // Metadata Sanitization: Remove tabs, newlines, carriage returns
    str = str.replace(/[\t\r\n]/g, ' ');
    // CSV Formula Injection Protection: escape =, +, -, @ with leading apostrophe
    if (/^[=\+\-@]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes(' ')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Converts an array of row arrays to a CSV string.
   * @param {Array<Array>} rows
   * @returns {string}
   */
  function _toCSV(rows) {
    return rows.map(row => row.map(_csvField).join(',')).join('\n');
  }

  /**
   * Triggers a browser download of a text file.
   * @param {string} content - File content
   * @param {string} filename
   * @param {string} mimeType
   */
  function _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates and downloads a CSV sustainability report.
   * @param {Object} reportData
   * @param {Object} reportData.userData - User profile data
   * @param {{ transport, energy, diet, shopping, total }} reportData.breakdown
   * @param {Object[]} reportData.recommendations - Ranked recommendations
   * @param {Object[]} reportData.plan - 4-week plan
   * @param {{ overall }} reportData.ecoScore
   */
  function downloadCSV(reportData) {
    const { userData, breakdown, recommendations, plan, ecoScore } = reportData;
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const rows = [
      ['EcoGuide — Carbon Footprint Report'],
      ['Generated', dateStr],
      ['Persona', userData.persona],
      ['Goal', userData.goal],
      [],
      ['EMISSIONS BREAKDOWN'],
      ['Category', 'kg CO₂/year', '% of total'],
      ['Transport', Math.round(breakdown.transport), `${Math.round(breakdown.transport / breakdown.total * 100)}%`],
      ['Energy',    Math.round(breakdown.energy),    `${Math.round(breakdown.energy / breakdown.total * 100)}%`],
      ['Diet',      Math.round(breakdown.diet),      `${Math.round(breakdown.diet / breakdown.total * 100)}%`],
      ['Shopping',  Math.round(breakdown.shopping),  `${Math.round(breakdown.shopping / breakdown.total * 100)}%`],
      ['Total',     Math.round(breakdown.total),     '100%'],
      [],
      ['BENCHMARKS'],
      ['India Average',  '1900 kg/year'],
      ['Global Average', '4700 kg/year'],
      ['Paris Target',   '2100 kg/year'],
      ['Your EcoScore',  `${ecoScore.overall}/100`],
      [],
      ['TOP RECOMMENDATIONS'],
      ['Rank', 'Action', 'CO₂ Saving (kg/year)', 'Money Saving (₹/year)', 'Difficulty', 'Confidence'],
      ...(recommendations || []).slice(0, 5).map((r, i) => [
        i + 1, r.title, Math.round(r.co2Saving), Math.round(r.moneySaving), r.difficulty, `${r.confidence}%`,
      ]),
      [],
      ['4-WEEK ACTION PLAN'],
      ['Week', 'Theme', 'Actions', 'CO₂ Saving (kg)', 'Money Saving (₹)'],
      ...(plan || []).map(week => [
        week.week,
        week.theme,
        week.actions.map(a => a.title).join('; '),
        Math.round(week.savingsCO2),
        Math.round(week.savingsMoney),
      ]),
    ];

    const csv      = _toCSV(rows);
    const filename = `ecoguide-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`;
    _download(csv, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Opens the browser print dialog for PDF export.
   * The @media print stylesheet (in style.css) handles formatting.
   */
  function printPDF() {
    window.print();
  }

  return Object.freeze({ downloadCSV, printPDF });
})();
