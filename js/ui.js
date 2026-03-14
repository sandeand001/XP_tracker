// ============================================================
// ui.js — All view rendering functions
// ============================================================

import { GUILDS, getRankBadge } from './config.js';
import * as Store from './store.js';
import * as Engine from './engine.js';

// ── Toast notifications ──
export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Modal ──
export function showModal(title, bodyHTML, buttons = []) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = `btn ${b.class || 'btn-primary'}`;
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      b.action();
      if (b.close !== false) closeModal();
    });
    footer.appendChild(btn);
  });
  overlay.classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── XP Tracker view ──
export function renderTracker() {
  const students = Store.getStudents();
  const tbody = document.getElementById('tracker-body');
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#999">
      No students yet. Click <strong>+ Add Student</strong> to get started, or import from Google Sheets in Settings.
    </td></tr>`;
    return;
  }

  for (const s of students) {
    const tr = document.createElement('tr');
    const debtClass = (s.xpDebt || 0) < 0 ? 'debt-negative' : 'debt-zero';
    const guildClass = s.guild === 'Guild 1' ? 'guild-1' : s.guild === 'Guild 2' ? 'guild-2' : s.guild === 'Guild 3' ? 'guild-3' : '';
    const pct = Math.round((s.progress || 0) * 100);

    tr.innerHTML = `
      <td><strong>${esc(s.name)}</strong></td>
      <td>${esc(s.title || '')}</td>
      <td class="text-center">${Engine.getTitleBadge(s.title)} ${s.level || 1}</td>
      <td class="text-center">${s.xpInLevel || 0}</td>
      <td class="text-center">${s.xpToNext || 0}</td>
      <td>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
          <span class="progress-bar-text">${pct}%</span>
        </div>
      </td>
      <td class="text-center ${debtClass}">${s.xpDebt || 0}</td>
      <td>
        <select class="guild-select" data-student="${esc(s.name)}">
          <option value="">—</option>
          ${GUILDS.map(g => `<option value="${g.label}" ${s.guild === g.label ? 'selected' : ''}>${g.label}</option>`).join('')}
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary btn-edit-student" data-student="${esc(s.name)}" title="Edit XP / Level">✏️</button>
        <button class="btn btn-sm btn-danger btn-remove-student" data-student="${esc(s.name)}" title="Remove Student">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Guild select change handlers
  tbody.querySelectorAll('.guild-select').forEach(sel => {
    sel.addEventListener('change', () => {
      Store.updateStudent(sel.dataset.student, { guild: sel.value });
      toast(`Guild updated for ${sel.dataset.student}`, 'success');
    });
  });

  // Edit buttons
  tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.student;
      const students = Store.getStudents();
      const student = students.find(s => s.name === name);
      if (!student) return;

      const thresholds = Engine.getLevelThresholds();
      // thresholds[i] is the min XP for level i+1, so build rows as: Level (i+1) = thresholds[i] XP
      const levelRef = thresholds.map((xp, i) => {
        const lvl = i + 1;
        const isCurrent = student.level === lvl;
        return `<tr class="level-ref-row${isCurrent ? ' level-ref-current' : ''}" data-xp="${xp}" style="cursor:pointer;${isCurrent ? 'background:#e8f5e9;font-weight:600' : ''}">
          <td>Lv.${lvl}</td><td>${xp.toLocaleString()} XP</td><td>${isCurrent ? '◀ current' : ''}</td></tr>`;
      }).join('');

      showModal(`✏️ Edit — ${name}`, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
          <div>
            <label><strong>Cumulative XP:</strong></label>
            <input type="number" id="edit-cum-xp" min="0" value="${student.cumXP || 0}" style="width:100%" />
            <p class="help-text" style="margin-top:0.25rem">Total XP earned all-time. Changing this recalculates level & title.</p>

            <label style="margin-top:0.75rem"><strong>XP Debt:</strong></label>
            <input type="number" id="edit-xp-debt" max="0" value="${student.xpDebt || 0}" style="width:100%" />
            <p class="help-text" style="margin-top:0.25rem">Negative value = debt. Set to 0 to clear debt.</p>
          </div>
          <div>
            <label><strong>Level Reference:</strong> <span class="help-text">(click a level to set XP)</span></label>
            <table id="level-ref-table" style="width:100%;font-size:0.82rem;margin-top:0.3rem">
              <thead><tr><th>Level</th><th>Min XP</th><th></th></tr></thead>
              <tbody>${levelRef}</tbody>
            </table>
          </div>
        </div>
      `, [
        {
          label: '💾 Save Changes',
          class: 'btn-primary',
          action: () => {
            const newXP = Math.max(0, Number(document.getElementById('edit-cum-xp').value) || 0);
            const newDebt = Math.min(0, Number(document.getElementById('edit-xp-debt').value) || 0);
            Store.updateStudent(name, { cumXP: newXP, xpDebt: newDebt });
            Engine.recomputeAllProgress();
            renderTracker();
            toast(`${name} updated — ${newXP} XP, Debt: ${newDebt}`, 'success');
          }
        },
        { label: 'Cancel', class: 'btn-secondary', action: () => {} }
      ]);

      // Wire up clickable level rows to auto-fill XP
      setTimeout(() => {
        document.querySelectorAll('#level-ref-table .level-ref-row').forEach(row => {
          row.addEventListener('click', () => {
            const xp = Number(row.dataset.xp) || 0;
            const input = document.getElementById('edit-cum-xp');
            if (input) input.value = xp;
            // Highlight selected row
            document.querySelectorAll('#level-ref-table .level-ref-row').forEach(r => {
              r.style.background = '';
              r.style.fontWeight = '';
            });
            row.style.background = '#e3f2fd';
            row.style.fontWeight = '600';
          });
        });
      }, 50);
    });
  });

  // Remove buttons
  tbody.querySelectorAll('.btn-remove-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.student;
      if (confirm(`Remove ${name}? This won't delete their XP log history.`)) {
        Store.removeStudent(name);
        renderTracker();
        toast(`${name} removed`, 'warning');
      }
    });
  });
}

// ── Daily Checklist view ──
export function renderDaily() {
  const students = Store.getStudents();
  const state = Store.getDailyState();
  const cfg = Store.getConfig();
  const tbody = document.getElementById('daily-body');
  tbody.innerHTML = '';

  // Restore bonus values
  document.getElementById('bonusA').value = state._bonusA || 0;
  document.getElementById('bonusB').value = state._bonusB || 0;
  document.getElementById('bonusC').value = state._bonusC || 0;
  document.getElementById('bonusD').value = state._bonusD || 0;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="19" style="text-align:center;padding:2rem;color:#999">No students. Add them on XP Tracker first.</td></tr>`;
    return;
  }

  const checkboxCols = ['quiz','faculty','exitTicket','writing','kindness','expectations','part1','part2','part3','part4','part5','bonusA','bonusB','bonusC','bonusD'];

  for (const s of students) {
    const ds = state[s.name] || {};
    ds.bonusAVal = state._bonusA || 0;
    ds.bonusBVal = state._bonusB || 0;
    ds.bonusCVal = state._bonusC || 0;
    ds.bonusDVal = state._bonusD || 0;
    const total = Engine.computeDailyTotal(ds, cfg);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(s.name)}</strong></td>
      <td><select class="daily-input" data-student="${esc(s.name)}" data-field="test">
        ${[0,1,2,3,4].map(v => `<option value="${v}" ${(ds.test||0)==v?'selected':''}>${v}</option>`).join('')}
      </select></td>
      ${checkboxCols.map(col => `
        <td class="check-cell">
          <input type="checkbox" class="daily-input" data-student="${esc(s.name)}" data-field="${col}" ${ds[col] ? 'checked' : ''} />
        </td>
      `).join('')}
      <td class="daily-total">${total}</td>
      <td><input type="text" class="comment-input daily-input" data-student="${esc(s.name)}" data-field="comment" value="${esc(ds.comment || '')}" placeholder="note..." /></td>
    `;
    tbody.appendChild(tr);
  }

  // Attach event listeners for auto-save
  tbody.querySelectorAll('.daily-input').forEach(el => {
    const evt = el.type === 'checkbox' ? 'change' : (el.tagName === 'SELECT' ? 'change' : 'input');
    el.addEventListener(evt, () => saveDailyFromDOM());
  });
}

function saveDailyFromDOM() {
  const state = {};
  state._bonusA = Number(document.getElementById('bonusA').value) || 0;
  state._bonusB = Number(document.getElementById('bonusB').value) || 0;
  state._bonusC = Number(document.getElementById('bonusC').value) || 0;
  state._bonusD = Number(document.getElementById('bonusD').value) || 0;

  document.querySelectorAll('#daily-body .daily-input').forEach(el => {
    const student = el.dataset.student;
    const field = el.dataset.field;
    if (!state[student]) state[student] = {};
    if (el.type === 'checkbox') state[student][field] = el.checked;
    else if (el.tagName === 'SELECT') state[student][field] = Number(el.value) || 0;
    else state[student][field] = el.value;
  });

  Store.saveDailyState(state);

  // Update daily totals
  const cfg = Store.getConfig();
  const rows = document.querySelectorAll('#daily-body tr');
  rows.forEach(tr => {
    const nameCell = tr.querySelector('td:first-child strong');
    if (!nameCell) return;
    const name = nameCell.textContent;
    const ds = state[name] || {};
    ds.bonusAVal = state._bonusA || 0;
    ds.bonusBVal = state._bonusB || 0;
    ds.bonusCVal = state._bonusC || 0;
    ds.bonusDVal = state._bonusD || 0;
    const total = Engine.computeDailyTotal(ds, cfg);
    const totalCell = tr.querySelector('.daily-total');
    if (totalCell) totalCell.textContent = total;
  });
}

// ── Behavior Tracker view ──
export function renderBehavior() {
  const students = Store.getStudents();
  const state = Store.getBehaviorState();
  const cfg = Store.getConfig();
  const tbody = document.getElementById('behavior-body');
  tbody.innerHTML = '';

  // Restore extra penalty values
  document.getElementById('extraPenaltyA').value = state._extraA || 0;
  document.getElementById('extraPenaltyB').value = state._extraB || 0;
  document.getElementById('extraPenaltyC').value = state._extraC || 0;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;padding:2rem;color:#999">No students.</td></tr>`;
    return;
  }

  const checkboxCols = ['minor','warning','disrupt','repeat','serious','severe','extraA','extraB','extraC'];

  for (const s of students) {
    const bs = state[s.name] || {};
    bs.extraAVal = state._extraA || 0;
    bs.extraBVal = state._extraB || 0;
    bs.extraCVal = state._extraC || 0;
    const debt = Engine.computeBehaviorDebt(bs, cfg);
    const debtClass = debt < 0 ? 'negative' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(s.name)}</strong></td>
      ${checkboxCols.map(col => `
        <td class="check-cell">
          <input type="checkbox" class="behavior-input" data-student="${esc(s.name)}" data-field="${col}" ${bs[col] ? 'checked' : ''} />
        </td>
      `).join('')}
      <td class="behavior-debt-delta ${debtClass}">${debt}</td>
      <td><input type="text" class="comment-input behavior-input" data-student="${esc(s.name)}" data-field="comment" value="${esc(bs.comment || '')}" placeholder="note..." /></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.behavior-input').forEach(el => {
    const evt = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => saveBehaviorFromDOM());
  });
}

function saveBehaviorFromDOM() {
  const state = {};
  state._extraA = Number(document.getElementById('extraPenaltyA').value) || 0;
  state._extraB = Number(document.getElementById('extraPenaltyB').value) || 0;
  state._extraC = Number(document.getElementById('extraPenaltyC').value) || 0;

  document.querySelectorAll('#behavior-body .behavior-input').forEach(el => {
    const student = el.dataset.student;
    const field = el.dataset.field;
    if (!state[student]) state[student] = {};
    if (el.type === 'checkbox') state[student][field] = el.checked;
    else state[student][field] = el.value;
  });

  Store.saveBehaviorState(state);

  // Update debt deltas
  const cfg = Store.getConfig();
  const rows = document.querySelectorAll('#behavior-body tr');
  rows.forEach(tr => {
    const nameCell = tr.querySelector('td:first-child strong');
    if (!nameCell) return;
    const name = nameCell.textContent;
    const bs = state[name] || {};
    bs.extraAVal = state._extraA || 0;
    bs.extraBVal = state._extraB || 0;
    bs.extraCVal = state._extraC || 0;
    const debt = Engine.computeBehaviorDebt(bs, cfg);
    const debtCell = tr.querySelector('.behavior-debt-delta');
    if (debtCell) {
      debtCell.textContent = debt;
      debtCell.className = `behavior-debt-delta ${debt < 0 ? 'negative' : ''}`;
    }
  });
}

// ── Leaderboard view ──
export function renderLeaderboard() {
  const entries = Engine.buildLeaderboardData();
  const container = document.getElementById('leaderboard-container');
  const guildEl = document.getElementById('guild-summary');
  container.innerHTML = '';
  guildEl.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#999;padding:2rem">No students to display.</p>`;
    guildEl.style.display = 'none';
    return;
  }

  // Guild summary
  const guildTotals = {};
  for (const e of entries) {
    if (e.guild) {
      if (!guildTotals[e.guild]) guildTotals[e.guild] = { xp: 0, members: 0 };
      guildTotals[e.guild].xp += e.cumXP || 0;
      guildTotals[e.guild].members++;
    }
  }
  const guildColorMap = {};
  GUILDS.forEach(g => { guildColorMap[g.label] = g.bg; });

  if (Object.keys(guildTotals).length) {
    guildEl.style.display = '';
    for (const [label, data] of Object.entries(guildTotals)) {
      const stat = document.createElement('div');
      stat.className = 'guild-stat';
      stat.innerHTML = `<span class="guild-dot" style="background:${guildColorMap[label] || '#999'}"></span>
        <strong>${esc(label)}</strong>: ${data.xp.toLocaleString()} XP (${data.members} members)`;
      guildEl.appendChild(stat);
    }
  } else {
    guildEl.style.display = 'none';
  }

  // Entries
  for (const e of entries) {
    const pct = Math.round((e.progress || 0) * 100);
    const rankEmoji = getRankBadge(e.rank);
    const guildColor = guildColorMap[e.guild] || '';
    const nameStyle = guildColor ? `color:${guildColor}` : '';
    const guildDot = guildColor ? `<span class="guild-dot" style="background:${guildColor};width:10px;height:10px;vertical-align:middle;display:inline-block;margin-right:4px"></span>` : '';

    const div = document.createElement('div');
    div.className = 'lb-entry';
    div.innerHTML = `
      <div class="lb-rank ${e.rank <= 3 ? 'lb-rank-' + e.rank : ''}">${rankEmoji} ${e.rank}</div>
      <div class="lb-name" style="${nameStyle}">${guildDot}${esc(e.name)}${e.streak.badge ? `<span class="lb-streak-badge" title="${e.streak.count} day streak">${e.streak.badge}</span>` : ''}</div>
      <div class="lb-title">✧ ${esc(e.title || '')} ✧</div>
      <div class="lb-level">${e.badge || ''} Lv.${e.level}</div>
      <div class="lb-bar">
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
          <span class="progress-bar-text">${pct}%</span>
        </div>
      </div>
      <div class="lb-xp-next">${e.xpToNext || 0} to next</div>
      <div class="lb-total-xp">${(e.cumXP || 0).toLocaleString()} XP</div>
    `;
    container.appendChild(div);
  }
}

// ── Currency view ──
export function renderCurrency() {
  const students = Store.getStudents();
  const balances = Store.getCurrencyBalances();
  const tbody = document.getElementById('currency-body');
  tbody.innerHTML = '';

  for (const s of students) {
    const bal = balances[s.name] || { earned: 0, spent: 0 };
    const available = bal.earned - bal.spent;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(s.name)}</strong></td>
      <td class="text-center">${bal.earned}</td>
      <td class="text-center currency-spent">${bal.spent}</td>
      <td class="text-center currency-balance">${available}</td>
      <td>
        <div class="spend-input-group">
          <input type="number" min="1" value="1" class="spend-amount" data-student="${esc(s.name)}" />
          <input type="text" placeholder="item" class="spend-note" data-student="${esc(s.name)}" />
          <button class="btn btn-sm btn-primary btn-spend" data-student="${esc(s.name)}">Spend</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Spend buttons
  tbody.querySelectorAll('.btn-spend').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.student;
      const row = btn.closest('tr');
      const amount = Number(row.querySelector('.spend-amount').value) || 0;
      const note = row.querySelector('.spend-note').value || 'Shop spend';
      if (amount <= 0) { toast('Enter a positive amount', 'error'); return; }
      try {
        const newBal = Store.spendCoins(name, amount, note);
        toast(`${name} spent ${amount} coin(s). New balance: ${newBal}`, 'success');
        renderCurrency();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  });

  // Transaction log
  const transactions = Store.getSpendTransactions();
  const logBody = document.getElementById('spend-log-body');
  logBody.innerHTML = '';
  transactions.reverse().slice(0, 50).forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(t.date)}</td><td>${esc(t.student)}</td><td class="currency-spent">${t.amount}</td><td>${esc(t.note)}</td>`;
    logBody.appendChild(tr);
  });
}

// ── XP Log view ──
export function renderLog() {
  const log = Store.getXPLog();
  const tbody = document.getElementById('log-body');
  tbody.innerHTML = '';

  // Show most recent first, cap at 200 for performance
  const recent = [...log].reverse().slice(0, 200);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem;color:#999">No log entries yet. Process Daily XP to create entries.</td></tr>`;
    return;
  }

  for (const e of recent) {
    const tr = document.createElement('tr');
    const coinClass = (e.currencyGain || 0) < 0 ? 'currency-spent' : '';
    tr.innerHTML = `
      <td class="font-mono">${esc(e.date)}</td>
      <td>${esc(e.student)}</td>
      <td class="text-center">${e.dailyTotalRaw || 0}</td>
      <td class="text-center">${e.debtApplied || 0}</td>
      <td class="text-center">${e.xpToLevel || 0}</td>
      <td class="text-center">${e.overflowXP || 0}</td>
      <td class="text-center ${coinClass}">${e.currencyGain || 0}</td>
      <td class="text-center ${(e.debtAfter||0) < 0 ? 'debt-negative' : ''}">${e.debtAfter || 0}</td>
      <td class="text-center">${e.cumXPAfter || 0}</td>
      <td class="text-center">${e.levelAfter || 0}</td>
      <td>${esc(e.titleAfter || '')}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ── Settings view ──
export function renderSettings() {
  const cfg = Store.getConfig();
  document.getElementById('cfg-xp-cap').value = cfg.XP_CAP || 50;
  document.getElementById('cfg-exchange-rate').value = cfg.EXCHANGE_RATE || 20;
  document.getElementById('cfg-quiz').value = cfg.DAILY_WEIGHTS?.quiz ?? 10;
  document.getElementById('cfg-faculty').value = cfg.DAILY_WEIGHTS?.faculty ?? 5;
  document.getElementById('cfg-exit').value = cfg.DAILY_WEIGHTS?.exitTicket ?? 5;
  document.getElementById('cfg-writing').value = cfg.DAILY_WEIGHTS?.writing ?? 5;
  document.getElementById('cfg-kindness').value = cfg.DAILY_WEIGHTS?.kindness ?? 5;
  document.getElementById('cfg-expectations').value = cfg.DAILY_WEIGHTS?.expectations ?? 10;
  document.getElementById('cfg-part-each').value = cfg.DAILY_WEIGHTS?.participationEach ?? 2;
  document.getElementById('cfg-test1').value = cfg.TEST_SCORE_XP?.[1] ?? 10;
  document.getElementById('cfg-test2').value = cfg.TEST_SCORE_XP?.[2] ?? 15;
  document.getElementById('cfg-test3').value = cfg.TEST_SCORE_XP?.[3] ?? 20;
  document.getElementById('cfg-test4').value = cfg.TEST_SCORE_XP?.[4] ?? 25;
  document.getElementById('cfg-minor').value = cfg.BEHAVIOR_PENALTIES?.minor ?? -5;
  document.getElementById('cfg-warning').value = cfg.BEHAVIOR_PENALTIES?.warning ?? -10;
  document.getElementById('cfg-disrupt').value = cfg.BEHAVIOR_PENALTIES?.disrupt ?? -15;
  document.getElementById('cfg-repeat').value = cfg.BEHAVIOR_PENALTIES?.repeat ?? -20;
  document.getElementById('cfg-serious').value = cfg.BEHAVIOR_PENALTIES?.serious ?? -25;
  document.getElementById('cfg-severe').value = cfg.BEHAVIOR_PENALTIES?.severe ?? -30;
}

export function saveSettingsFromDOM() {
  const cfg = {
    XP_CAP: Number(document.getElementById('cfg-xp-cap').value) || 50,
    EXCHANGE_RATE: Number(document.getElementById('cfg-exchange-rate').value) || 20,
    DAILY_WEIGHTS: {
      quiz: Number(document.getElementById('cfg-quiz').value) || 0,
      faculty: Number(document.getElementById('cfg-faculty').value) || 0,
      exitTicket: Number(document.getElementById('cfg-exit').value) || 0,
      writing: Number(document.getElementById('cfg-writing').value) || 0,
      kindness: Number(document.getElementById('cfg-kindness').value) || 0,
      expectations: Number(document.getElementById('cfg-expectations').value) || 0,
      participationEach: Number(document.getElementById('cfg-part-each').value) || 0,
    },
    BEHAVIOR_PENALTIES: {
      minor: Number(document.getElementById('cfg-minor').value) || 0,
      warning: Number(document.getElementById('cfg-warning').value) || 0,
      disrupt: Number(document.getElementById('cfg-disrupt').value) || 0,
      repeat: Number(document.getElementById('cfg-repeat').value) || 0,
      serious: Number(document.getElementById('cfg-serious').value) || 0,
      severe: Number(document.getElementById('cfg-severe').value) || 0,
    },
    TEST_SCORE_XP: {
      0: 0,
      1: Number(document.getElementById('cfg-test1').value) || 0,
      2: Number(document.getElementById('cfg-test2').value) || 0,
      3: Number(document.getElementById('cfg-test3').value) || 0,
      4: Number(document.getElementById('cfg-test4').value) || 0,
    }
  };
  Store.saveConfig(cfg);
  return cfg;
}

// ── Utility ──
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
