// ============================================================
// app.js — SPA entry point: wires UI, events, section routing
// ============================================================

import * as Store from './store.js';
import * as Engine from './engine.js';
import * as UI from './ui.js';
import { GUILDS } from './config.js';
import { initFirebase, pullFromCloud, listenForChanges, setUser, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, onAuthChange, migrateOldData } from './firebase-sync.js';

// ── Theme System ──
function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  window.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme: themeId } }));
  document.querySelectorAll('.theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.theme === themeId);
  });
}

function applyLayout(layoutId) {
  document.documentElement.setAttribute('data-layout', layoutId);
  document.querySelectorAll('.layout-card').forEach(card => {
    card.classList.toggle('active', card.dataset.layout === layoutId);
  });
}

function initThemePicker() {
  // Apply saved theme + layout immediately
  applyTheme(Store.getTheme());
  applyLayout(Store.getLayout());

  // Theme card clicks
  const picker = document.getElementById('theme-picker');
  if (picker) {
    picker.addEventListener('click', (e) => {
      const card = e.target.closest('.theme-card');
      if (!card) return;
      const themeId = card.dataset.theme;
      applyTheme(themeId);
      Store.saveTheme(themeId);
      UI.toast(`Theme: ${card.querySelector('.theme-card-name').textContent}`, 'success');
    });
  }

  // Layout card clicks
  const layoutPicker = document.getElementById('layout-picker');
  if (layoutPicker) {
    layoutPicker.addEventListener('click', (e) => {
      const card = e.target.closest('.layout-card');
      if (!card) return;
      const layoutId = card.dataset.layout;
      applyLayout(layoutId);
      Store.saveLayout(layoutId);
      UI.toast(`Layout: ${card.querySelector('.layout-card-name').textContent}`, 'success');
    });
  }
}

// ── Detect current page from active section ──
function getCurrentPage() {
  const section = document.querySelector('.page-content.active[data-page]');
  return section ? section.dataset.page : 'home';
}

// ── SPA Navigation — swap visible sections ──
function navigateTo(page) {
  const allSections = document.querySelectorAll('.page-content[data-page]');
  const allNavBtns = document.querySelectorAll('#main-nav .nav-btn[data-page]');

  // Hide all sections, show target
  allSections.forEach(s => {
    if (s.dataset.page === page) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });

  // Update nav active state
  allNavBtns.forEach(btn => {
    if (btn.dataset.page === page) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle home-header class for transparent header on home page
  const header = document.getElementById('app-header');
  if (header) header.classList.toggle('home-header', page === 'home');

  // Dispatch page change event (starfield stays running on all pages)
  window.dispatchEvent(new CustomEvent('spa:pageChanged', { detail: { page } }));

  // Update URL hash (without triggering hashchange navigation)
  history.replaceState(null, '', '#' + page);

  // Update document title
  const titles = {
    home: '✨ Classroom XP Tracker',
    tracker: '📊 XP Tracker',
    daily: '📝 Daily Checklist',
    behavior: '⚖️ Behavior Tracker',
    leaderboard: '🏆 Leaderboard',
    currency: '🪙 Currency & Shop',
    log: '📜 XP Log',
    settings: '⚙️ Settings'
  };
  document.title = titles[page] || '✨ Classroom XP Tracker';

  // Render the page content
  renderPage(page);
}

// ── Render the correct page content ──
function renderPage(page) {
  switch (page) {
    case 'tracker': UI.renderTracker(); break;
    case 'daily': UI.renderDaily(); break;
    case 'behavior': UI.renderBehavior(); break;
    case 'leaderboard': UI.renderLeaderboard(); break;
    case 'currency': UI.renderCurrency(); break;
    case 'log': UI.renderLog(); break;
    case 'settings': UI.renderSettings(); break;
    // home doesn't need a render call
  }
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
          Engine.recomputeAllProgress();
          UI.renderTracker();
          UI.toast(`${name} added!`, 'success');
        }
      },
      { label: 'Cancel', class: 'btn-secondary', action: () => {} }
    ]);

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
    document.querySelector('#daily-body .daily-input')?.dispatchEvent(new Event('change'));
  });

  document.getElementById('btn-uncheck-all-daily').addEventListener('click', () => {
    document.querySelectorAll('#daily-body input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    document.querySelector('#daily-body .daily-input')?.dispatchEvent(new Event('change'));
  });

  ['bonusA', 'bonusB', 'bonusC', 'bonusD'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
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

  document.getElementById('btn-export-all').addEventListener('click', () => {
    const json = Store.exportAllData();
    downloadFile(json, `xp-tracker-backup-${Store.todayStr()}.json`, 'application/json');
    UI.toast('Full backup exported', 'success');
  });

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

// ── Show / hide login overlay ──
function showLogin() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('app-main').style.display = 'none';
}

function hideLogin() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app-header').style.display = '';
  document.getElementById('app-main').style.display = '';
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Initialize (post-auth) ──
async function initApp() {
  // Ensure config exists
  const cfg = Store.getConfig();
  if (!cfg.DAILY_WEIGHTS) Store.saveConfig(Store.getConfig());

  initModal();

  // Apply theme ASAP
  initThemePicker();

  // Initialize ALL page event handlers upfront (they all exist in the DOM)
  initAddStudent();
  initProcessXP();
  initRecompute();
  initDailyButtons();
  initBehaviorButtons();
  initLogButtons();
  UI.initLogColumnSelector();
  UI.initLogDateFilter();
  initSettingsButtons();

  // Migrate old flat appData/ to per-user path if needed
  await migrateOldData();

  // Sync cloud data
  const updated = await pullFromCloud();
  if (updated) {
    Engine.recomputeAllProgress();
  }

  // ── Nav link clicks ──
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-page], button[data-page]');
    if (!link) return;
    e.preventDefault();
    const page = link.dataset.page;
    if (page && page !== getCurrentPage()) {
      navigateTo(page);
    }
  });

  // ── Browser back/forward ──
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '') || 'home';
    if (hash !== getCurrentPage()) {
      navigateTo(hash);
    }
  });

  // Determine initial page from URL hash
  const initialPage = location.hash.replace('#', '') || 'home';
  navigateTo(initialPage);

  // Listen for real-time changes from other devices
  listenForChanges((changedKey) => {
    renderPage(getCurrentPage());
  });
}

// ── Bootstrap — auth gate ──
async function init() {
  const firebaseOk = await initFirebase();
  if (!firebaseOk) {
    // No Firebase SDK, run offline without auth
    await initApp();
    hideLogin();
    return;
  }

  // Login form — email/password (sign in or sign up)
  let isSignUp = false;

  document.getElementById('login-toggle-link').addEventListener('click', (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    document.getElementById('login-submit-btn').textContent = isSignUp ? 'Sign Up' : 'Sign In';
    document.getElementById('login-toggle-text').textContent = isSignUp ? 'Already have an account?' : "Don't have an account?";
    document.getElementById('login-toggle-link').textContent = isSignUp ? 'Sign In' : 'Sign Up';
    document.getElementById('login-error').classList.add('hidden');
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      showLoginError(err.message.replace('Firebase: ', ''));
    }
  });

  // Google sign-in
  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showLoginError(err.message.replace('Firebase: ', ''));
      }
    }
  });

  // Sign-out button
  document.getElementById('btn-sign-out').addEventListener('click', async () => {
    await signOut();
  });

  // Auth state listener — drives everything
  let appInitialized = false;
  onAuthChange(async (user) => {
    if (user) {
      setUser(user);
      hideLogin();
      if (!appInitialized) {
        appInitialized = true;
        await initApp();
      }
    } else {
      setUser(null);
      showLogin();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
