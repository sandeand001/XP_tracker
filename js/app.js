// ============================================================
// app.js — Main entry point: wires UI, events, page-based nav
// ============================================================

import * as Store from './store.js';
import * as Engine from './engine.js';
import * as UI from './ui.js';
import { GUILDS } from './config.js';
import { initFirebase, pullFromCloud, listenForChanges } from './firebase-sync.js';

// ── Detect current page from data-page attribute ──
function getCurrentPage() {
  const section = document.querySelector('.page-content[data-page]');
  return section ? section.dataset.page : 'tracker';
}

// ── Add Student ──
function initAddStudent() {
  document.getElementById('btn-add-student').addEventListener('click', () => {
    const guildOptions = GUILDS.map(g => `<option value="${g.label}">${g.label}</option>`).join('');
    UI.showModal('Add Student', `
      <label>Student Name:</label>
      <input type="text" id="new-student-name" placeholder="e.g., Alex Rivera" autofocus />
      <label>Guild (optional):</label>
      <select id="new-student-guild">
        <option value="">— None —</option>
        ${guildOptions}
      </select>
    `, [
      {
        label: 'Add Student',
        class: 'btn-primary',
        action: () => {
          const name = document.getElementById('new-student-name').value.trim();
          const guild = document.getElementById('new-student-guild').value;
          if (!name) { UI.toast('Please enter a name', 'error'); return; }
          const added = Store.addStudent(name, guild);
          if (!added) { UI.toast('Student already exists', 'error'); return; }
          // Recompute so new student has correct level data
          Engine.recomputeAllProgress();
          UI.renderTracker();
          UI.toast(`${name} added!`, 'success');
        }
      },
      { label: 'Cancel', class: 'btn-secondary', action: () => {} }
    ]);

    // Allow Enter key to submit
    setTimeout(() => {
      const input = document.getElementById('new-student-name');
      if (input) input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          document.querySelector('#modal-footer .btn-primary')?.click();
        }
      });
    }, 100);
  });
}

// ── Process Daily XP ──
function initProcessXP() {
  document.getElementById('btn-process-xp').addEventListener('click', () => {
    const students = Store.getStudents();
    if (students.length === 0) {
      UI.toast('No students to process', 'error');
      return;
    }

    UI.showModal('⚡ Process Daily XP', `
      <p>This will:</p>
      <ul style="margin:0.5rem 0 0.5rem 1.5rem">
        <li>Calculate XP from today's Daily Checklist</li>
        <li>Apply behavior debt changes</li>
        <li>Update levels, titles, and coins</li>
        <li>Log everything and clear inputs</li>
      </ul>
      <p style="margin-top:0.75rem"><strong>Ready to process for ${students.length} student(s)?</strong></p>
    `, [
      {
        label: '⚡ Process Now',
        class: 'btn-success',
        action: () => {
          const result = Engine.processDailyXP();
          if (result.levelUps.length) {
            const names = result.levelUps.map(l => `${l.name} → Lv.${l.newLevel} (${l.title})`).join(', ');
            UI.toast(`🎉 Level up! ${names}`, 'success');
          }
          if (result.processedCount > 0) {
            UI.toast(`Processed ${result.processedCount} student(s)`, 'success');
          } else {
            UI.toast('No changes to process (all inputs empty)', 'info');
          }
          UI.renderTracker();
        }
      },
      { label: 'Cancel', class: 'btn-secondary', action: () => {} }
    ]);
  });
}

// ── Recompute ──
function initRecompute() {
  document.getElementById('btn-recompute').addEventListener('click', () => {
    const count = Engine.recomputeAllProgress();
    UI.renderTracker();
    UI.toast(`Recalculated levels & progress for ${count} student(s). Use this after changing XP config.`, 'success');
  });
}

// ── Daily checklist buttons ──
function initDailyButtons() {
  document.getElementById('btn-check-all-daily').addEventListener('click', () => {
    document.querySelectorAll('#daily-body input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
    // Trigger save
    document.querySelector('#daily-body .daily-input')?.dispatchEvent(new Event('change'));
  });

  document.getElementById('btn-uncheck-all-daily').addEventListener('click', () => {
    document.querySelectorAll('#daily-body input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    document.querySelector('#daily-body .daily-input')?.dispatchEvent(new Event('change'));
  });

  // Bonus input changes
  ['bonusA', 'bonusB', 'bonusC', 'bonusD'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      // Trigger re-save of daily state
      document.querySelector('#daily-body .daily-input')?.dispatchEvent(new Event('change'));
    });
  });
}

// ── Behavior buttons ──
function initBehaviorButtons() {
  document.getElementById('btn-uncheck-all-behavior').addEventListener('click', () => {
    document.querySelectorAll('#behavior-body input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    document.querySelector('#behavior-body .behavior-input')?.dispatchEvent(new Event('change'));
  });

  ['extraPenaltyA', 'extraPenaltyB', 'extraPenaltyC'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      document.querySelector('#behavior-body .behavior-input')?.dispatchEvent(new Event('change'));
    });
  });
}

// ── Log buttons ──
function initLogButtons() {
  document.getElementById('btn-export-log').addEventListener('click', () => {
    const csv = Store.exportXPLogAsCSV();
    downloadFile(csv, `xp-log-${Store.todayStr()}.csv`, 'text/csv');
    UI.toast('XP Log exported', 'success');
  });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    if (confirm('Clear ALL log entries? This cannot be undone.')) {
      Store.clearXPLog();
      UI.renderLog();
      UI.toast('XP Log cleared', 'warning');
    }
  });
}

// ── Settings buttons ──
function initSettingsButtons() {
  document.getElementById('btn-save-config').addEventListener('click', () => {
    UI.saveSettingsFromDOM();
    UI.toast('Configuration saved!', 'success');
  });

  // Import tracker CSV
  document.getElementById('btn-import-tracker').addEventListener('click', () => {
    const file = document.getElementById('import-tracker').files[0];
    if (!file) { UI.toast('Select a CSV file first', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const count = Store.importStudentsFromCSV(e.target.result);
        Engine.recomputeAllProgress();
        UI.toast(`Imported ${count} student(s) from CSV. Go to XP Tracker to view.`, 'success');
      } catch (err) {
        UI.toast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Import XP Log CSV
  document.getElementById('btn-import-log').addEventListener('click', () => {
    const file = document.getElementById('import-log').files[0];
    if (!file) { UI.toast('Select a CSV file first', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const count = Store.importXPLogFromCSV(e.target.result);
        UI.toast(`Imported ${count} log entries from CSV. Go to XP Log to view.`, 'success');
      } catch (err) {
        UI.toast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Export all JSON
  document.getElementById('btn-export-all').addEventListener('click', () => {
    const json = Store.exportAllData();
    downloadFile(json, `xp-tracker-backup-${Store.todayStr()}.json`, 'application/json');
    UI.toast('Full backup exported', 'success');
  });

  // Import all JSON
  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('import-json-file').click();
  });
  document.getElementById('import-json-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        Store.importAllData(ev.target.result);
        Engine.recomputeAllProgress();
        UI.toast('Data imported successfully! Refreshing...', 'success');
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        UI.toast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Reset all data
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    UI.showModal('🗑️ Reset All Data', `
      <p style="color:#B71C1C;font-weight:700">⚠️ This will permanently delete ALL data:</p>
      <ul style="margin:0.5rem 0 0.5rem 1.5rem">
        <li>All students, levels, and XP</li>
        <li>All XP log history</li>
        <li>All currency transactions</li>
        <li>Configuration (reset to defaults)</li>
      </ul>
      <p style="margin-top:0.75rem">This <strong>cannot be undone</strong>. Export a backup first if needed.</p>
      <label style="display:flex;align-items:flex-start;gap:0.5rem;margin-top:1rem;cursor:pointer">
        <input type="checkbox" id="reset-confirm-check" />
        <span>I understand this will delete everything</span>
      </label>
    `, [
      {
        label: 'Reset Everything',
        class: 'btn-danger',
        close: false,
        action: () => {
          if (!document.getElementById('reset-confirm-check')?.checked) {
            UI.toast('Please check the confirmation box', 'error');
            return;
          }
          Store.resetAllData();
          UI.toast('All data has been reset', 'warning');
          UI.closeModal();
          setTimeout(() => location.reload(), 600);
        }
      },
      { label: 'Cancel', class: 'btn-secondary', action: () => {} }
    ]);
  });
}

// ── Modal close ──
function initModal() {
  const closeBtn = document.getElementById('modal-close');
  const overlay = document.getElementById('modal-overlay');
  if (closeBtn) closeBtn.addEventListener('click', UI.closeModal);
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) UI.closeModal();
  });
}

// ── File download helper ──
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Initialize ──
async function init() {
  // Ensure config exists
  const cfg = Store.getConfig();
  if (!cfg.DAILY_WEIGHTS) Store.saveConfig(Store.getConfig());

  initModal();

  // Initialize Firebase and sync cloud data
  const firebaseOk = await initFirebase();
  if (firebaseOk) {
    const updated = await pullFromCloud();
    if (updated) {
      // Cloud data was newer — recompute progress from synced data
      Engine.recomputeAllProgress();
    }
  }

  const page = getCurrentPage();

  // Render page content
  switch (page) {
    case 'home':
      // Landing page — no interactive init needed
      break;
    case 'tracker':
      initAddStudent();
      initProcessXP();
      initRecompute();
      UI.renderTracker();
      break;
    case 'daily':
      initDailyButtons();
      UI.renderDaily();
      break;
    case 'behavior':
      initBehaviorButtons();
      UI.renderBehavior();
      break;
    case 'leaderboard':
      UI.renderLeaderboard();
      break;
    case 'currency':
      UI.renderCurrency();
      break;
    case 'log':
      initLogButtons();
      UI.renderLog();
      break;
    case 'settings':
      initSettingsButtons();
      UI.renderSettings();
      break;
  }

  // Listen for real-time changes from other devices
  if (firebaseOk) {
    listenForChanges((changedKey) => {
      // Re-render current page when data changes from another device
      switch (page) {
        case 'tracker': UI.renderTracker(); break;
        case 'daily': UI.renderDaily(); break;
        case 'behavior': UI.renderBehavior(); break;
        case 'leaderboard': UI.renderLeaderboard(); break;
        case 'currency': UI.renderCurrency(); break;
        case 'log': UI.renderLog(); break;
        case 'settings': UI.renderSettings(); break;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
