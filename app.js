const STORAGE_KEY = 'loki_max_sprint1_v2';

const DEFAULT_STATE = {
  startingBankroll: 1000,
  bankroll: 1000,
  mode: 'BALANCED',
  autoMode: false,
  bets: []
};

const MODE_CONFIG = {
  SAFE: {
    minSignal: 84,
    units: 1,
    label: 'Safe',
    desc: 'Tightest filter. Fewer plays, cleaner spots, lower swing.',
    risk: 'Low risk',
    posture: 'Precision-first filtering'
  },
  BALANCED: {
    minSignal: 72,
    units: 2,
    label: 'Balanced',
    desc: 'Best daily setting. Strong reads with room for volume.',
    risk: 'Smart mix',
    posture: 'Controlled aggression'
  },
  AGGRESSIVE: {
    minSignal: 60,
    units: 4,
    label: 'Aggressive',
    desc: 'More shots, more pressure, more variance when you want action.',
    risk: 'High variance',
    posture: 'Attack posture'
  }
};

const GAMES = [
  { id: 'nba-lal-phx', teams: 'Lakers vs Suns', league: 'NBA', liveText: 'Live now • 3rd Q', signal: 91, confidence: 'ELITE', recommendation: 'Strong buy', reason: 'Late pace spike and shot quality edge tilted hard in this window.', odds: 1.92, isLive: true, edge: '+6.8%', tempo: 'Fast', pressure: 'High' },
  { id: 'nba-den-dal', teams: 'Nuggets vs Mavs', league: 'NBA', liveText: 'Live now • Halftime', signal: 86, confidence: 'HIGH', recommendation: 'Lean hard', reason: 'Second-half split aligns with pressure pattern and rotation value.', odds: 1.95, isLive: true, edge: '+5.1%', tempo: 'Balanced', pressure: 'Medium' },
  { id: 'mlb-nyy-hou', teams: 'Yankees vs Astros', league: 'MLB', liveText: 'Live now • 6th', signal: 78, confidence: 'HIGH', recommendation: 'Lean', reason: 'Bullpen leverage and momentum carry still favor current side.', odds: 1.89, isLive: true, edge: '+3.7%', tempo: 'Steady', pressure: 'Medium' },
  { id: 'nba-bos-mia', teams: 'Celtics vs Heat', league: 'NBA', liveText: 'Starts in 22m', signal: 74, confidence: 'HIGH', recommendation: 'Watchlist+', reason: 'Price movement favors a later entry if pressure confirms.', odds: 1.86, isLive: false, edge: '+2.9%', tempo: 'Balanced', pressure: 'Build' },
  { id: 'nhl-nyr-bos', teams: 'Rangers vs Bruins', league: 'NHL', liveText: 'Starts in 41m', signal: 67, confidence: 'MEDIUM', recommendation: 'Monitor', reason: 'Signal is real, but not premium enough unless you are in volume mode.', odds: 1.88, isLive: false, edge: '+1.6%', tempo: 'Slow', pressure: 'Low' },
  { id: 'ncaab-kansas-baylor', teams: 'Kansas vs Baylor', league: 'NCAAB', liveText: 'Starts in 55m', signal: 63, confidence: 'MEDIUM', recommendation: 'Small stab', reason: 'Cheap read with modest value if you are widening the board.', odds: 1.98, isLive: false, edge: '+1.4%', tempo: 'Fast', pressure: 'Build' }
];

let state = loadState();
let deferredPrompt = null;
let selectedBetGame = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value) {
  return `${Math.round(value * 100) / 100} USD.bit`;
}

function getFilteredGames() {
  const threshold = MODE_CONFIG[state.mode].minSignal;
  return GAMES.filter((game) => game.signal >= threshold).sort((a, b) => b.signal - a.signal);
}

function topGames() {
  return getFilteredGames().slice(0, 4);
}

function findGame(id) {
  return GAMES.find((game) => game.id === id);
}

function suggestedStake(game) {
  const base = MODE_CONFIG[state.mode].units * 10;
  const confidenceBoost = game.confidence === 'ELITE' ? 1.7 : game.confidence === 'HIGH' ? 1.2 : 0.9;
  const liveBoost = game.isLive ? 1.15 : 1;
  return Math.max(10, Math.round(base * confidenceBoost * liveBoost));
}

function computeStats() {
  const settled = state.bets.filter((bet) => bet.status !== 'OPEN');
  const open = state.bets.filter((bet) => bet.status === 'OPEN');
  const wins = settled.filter((bet) => bet.status === 'WON').length;
  const totalSettled = settled.length;
  const profit = Math.round((state.bankroll - state.startingBankroll) * 100) / 100;
  const avgStake = state.bets.length ? state.bets.reduce((sum, bet) => sum + bet.stake, 0) / state.bets.length : 0;
  const recentSettled = settled.slice(-6);
  const lastOutcome = settled.length ? settled[settled.length - 1].status : '—';

  let streak = '—';
  if (settled.length) {
    const last = settled[settled.length - 1].status;
    let count = 0;
    for (let i = settled.length - 1; i >= 0; i -= 1) {
      if (settled[i].status === last) count += 1;
      else break;
    }
    streak = `${last === 'WON' ? 'W' : 'L'}${count}`;
  }

  return {
    roi: state.startingBankroll ? (profit / state.startingBankroll) * 100 : 0,
    winRate: totalSettled ? (wins / totalSettled) * 100 : 0,
    settled: totalSettled,
    open: open.length,
    profit,
    streak,
    avgStake,
    lastOutcome,
    recentSettled
  };
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

function trendValues() {
  const filtered = getFilteredGames();
  if (!filtered.length) return [20, 35, 28, 42, 30, 24];
  return filtered.slice(0, 6).map((game, index) => Math.max(18, Math.min(96, game.signal - index * 4)));
}

function renderTrendBars() {
  const wrap = document.getElementById('trendBars');
  wrap.innerHTML = '';
  trendValues().forEach((value) => {
    const bar = document.createElement('div');
    bar.className = 'trend-bar';
    bar.style.height = `${value}%`;
    wrap.appendChild(bar);
  });
}

function confidenceClass(confidence) {
  return confidence === 'ELITE' ? 'confidence-pill elite' : confidence === 'HIGH' ? 'confidence-pill high' : 'confidence-pill medium';
}

function renderFeaturedPlay() {
  const wrap = document.getElementById('featuredPlay');
  const game = topGames()[0];
  if (!game) {
    wrap.innerHTML = '<section class="feature-card"><div class="tile-title">No premium play</div><div class="tile-copy">Switch mode to widen the scanner.</div></section>';
    return;
  }

  const stake = suggestedStake(game);
  wrap.innerHTML = `
    <section class="feature-card">
      <div class="feature-top">
        <div>
          <div class="tag-pill">${game.league}</div>
          <div class="feature-title">${game.teams}</div>
          <div class="subtle">${game.liveText}</div>
        </div>
        <div class="metric-badge">${game.recommendation}</div>
      </div>
      <div class="tile-copy">${game.reason}</div>
      <div class="metrics-row">
        <div class="metric-box">
          <div class="tile-label">Signal</div>
          <div class="metric-value">${game.signal}</div>
        </div>
        <div class="metric-box">
          <div class="tile-label">Edge</div>
          <div class="metric-value">${game.edge}</div>
        </div>
        <div class="metric-box">
          <div class="tile-label">Stake</div>
          <div class="metric-value">${formatMoney(stake)}</div>
        </div>
      </div>
      <div class="action-row">
        <button class="primary-btn" data-bet-id="${game.id}">Bet Now</button>
        <button class="secondary-btn" data-toast="${game.reason}">Why this play</button>
      </div>
    </section>
  `;

  wrap.querySelector('[data-bet-id]').addEventListener('click', () => openBetModal(game.id));
  wrap.querySelector('[data-toast]').addEventListener('click', (event) => showToast(event.currentTarget.dataset.toast));
}

function buildPlayCard(game, compact = false) {
  const stake = suggestedStake(game);
  return `
    <section class="play-card">
      <div class="play-top">
        <div>
          <div class="tag-pill">${game.league}</div>
          <div class="play-title">${game.teams}</div>
          <div class="subtle">${game.liveText}</div>
        </div>
        <div class="${confidenceClass(game.confidence)}">${game.confidence}</div>
      </div>
      <div class="play-metrics">
        <div class="metric-box">
          <div class="tile-label">Signal</div>
          <div class="metric-value">${game.signal}</div>
        </div>
        <div class="metric-box">
          <div class="tile-label">Tempo</div>
          <div class="metric-value">${game.tempo}</div>
        </div>
        <div class="metric-box">
          <div class="tile-label">Stake</div>
          <div class="metric-value">${formatMoney(stake)}</div>
        </div>
      </div>
      <div class="tile-copy" style="margin-top:14px">${game.reason}</div>
      <div class="tile-meta-row">
        <span class="signal-pill">${game.edge} edge</span>
        <span class="hero-badge">${game.pressure} pressure</span>
      </div>
      <div class="action-row">
        <button class="primary-btn place-bet-btn" data-id="${game.id}">Bet Now</button>
        <button class="secondary-btn ${compact ? 'details-btn' : 'settle-demo-btn'}" data-id="${game.id}">${compact ? 'Details' : 'Quick Win'}</button>
      </div>
    </section>
  `;
}

function renderPlays(targetId, games, compact = false) {
  const wrap = document.getElementById(targetId);
  wrap.innerHTML = '';
  if (!games.length) {
    wrap.innerHTML = '<section class="play-card"><div class="play-title">No plays in this mode</div><div class="tile-copy">Switch to a wider mode to surface more action.</div></section>';
    return;
  }

  games.forEach((game) => {
    const holder = document.createElement('div');
    holder.innerHTML = buildPlayCard(game, compact);
    wrap.appendChild(holder.firstElementChild);
  });

  wrap.querySelectorAll('.place-bet-btn').forEach((button) => button.addEventListener('click', () => openBetModal(button.dataset.id)));
  wrap.querySelectorAll('.details-btn').forEach((button) => button.addEventListener('click', () => showToast(findGame(button.dataset.id)?.reason || 'No details found')));
  wrap.querySelectorAll('.settle-demo-btn').forEach((button) => button.addEventListener('click', () => quickSettle(button.dataset.id)));
}

function renderRecentBets() {
  const wrap = document.getElementById('recentBets');
  const recent = [...state.bets].slice(-4).reverse();
  wrap.innerHTML = '';

  if (!recent.length) {
    wrap.innerHTML = '<section class="activity-card glass-soft"><div class="activity-title">No activity yet</div><div class="activity-sub">Top plays are ready. The app will start to feel alive once the ledger has movement.</div></section>';
    return;
  }

  recent.forEach((bet) => {
    const pnl = bet.status === 'WON' ? `+${formatMoney(bet.payout - bet.stake)}` : bet.status === 'LOST' ? `-${formatMoney(bet.stake)}` : 'OPEN';
    const cls = bet.status === 'WON' ? 'win' : bet.status === 'LOST' ? 'loss' : '';
    const item = document.createElement('section');
    item.className = 'activity-card glass-soft';
    item.innerHTML = `
      <div class="activity-main">
        <div>
          <div class="activity-title">${bet.teams}</div>
          <div class="activity-sub">${bet.status} • ${bet.mode} • ${formatMoney(bet.stake)}</div>
        </div>
        <div class="pnl ${cls}">${pnl}</div>
      </div>
    `;
    wrap.appendChild(item);
  });
}

function renderLedger() {
  const wrap = document.getElementById('betLedger');
  wrap.innerHTML = '';
  if (!state.bets.length) {
    wrap.innerHTML = '<section class="ledger-card"><div class="ledger-title">Empty ledger</div><div class="ledger-sub">Place your first bet from the scanner to start the feedback loop.</div></section>';
    return;
  }

  [...state.bets].reverse().forEach((bet) => {
    const pnl = bet.status === 'WON' ? `+${formatMoney(bet.payout - bet.stake)}` : bet.status === 'LOST' ? `-${formatMoney(bet.stake)}` : 'OPEN';
    const cls = bet.status === 'WON' ? 'win' : bet.status === 'LOST' ? 'loss' : '';
    const card = document.createElement('section');
    card.className = 'ledger-card';
    card.innerHTML = `
      <div class="ledger-main">
        <div>
          <div class="ledger-badge">${bet.mode}</div>
          <div class="ledger-title" style="margin-top:8px">${bet.teams}</div>
          <div class="ledger-sub">${bet.status} • ${formatMoney(bet.stake)} @ ${bet.odds.toFixed(2)}</div>
        </div>
        <div class="pnl ${cls}">${pnl}</div>
      </div>
      ${bet.status === 'OPEN' ? `
        <div class="ledger-actions">
          <button class="secondary-btn settle-win" data-id="${bet.id}">Mark Win</button>
          <button class="secondary-btn settle-loss" data-id="${bet.id}">Mark Loss</button>
        </div>
      ` : ''}
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('.settle-win').forEach((button) => button.addEventListener('click', () => settleBet(button.dataset.id, true)));
  wrap.querySelectorAll('.settle-loss').forEach((button) => button.addEventListener('click', () => settleBet(button.dataset.id, false)));
}

function renderModes() {
  const wrap = document.getElementById('modeOptions');
  wrap.innerHTML = '';

  Object.entries(MODE_CONFIG).forEach(([key, config]) => {
    const card = document.createElement('button');
    card.className = `mode-option ${state.mode === key ? 'active' : ''}`;
    card.innerHTML = `
      <div class="mode-row">
        <div class="mode-name">${config.label}</div>
        <div class="hero-badge">${state.mode === key ? 'ACTIVE' : config.risk}</div>
      </div>
      <div class="mode-meta">${config.desc}</div>
      <div class="mode-foot">
        <span class="signal-pill">Min signal ${config.minSignal}</span>
        <span class="hero-badge">Base stake ${formatMoney(config.units * 10)}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      state.mode = key;
      saveState();
      closeModeModal();
      render();
      showToast(`${config.label} mode enabled`);
    });
    wrap.appendChild(card);
  });
}

function openBetModal(gameId) {
  const game = findGame(gameId);
  if (!game) return;
  selectedBetGame = game;
  const stake = suggestedStake(game);

  document.getElementById('betModalContent').innerHTML = `
    <div class="bet-slip">
      <div class="bet-slip-card">
        <div class="tag-pill">${game.league}</div>
        <div class="play-title" style="margin-top:10px">${game.teams}</div>
        <div class="tile-copy">${game.reason}</div>
      </div>
      <div class="bet-slip-card">
        <div class="bet-line"><span class="bet-label">Mode</span><strong>${MODE_CONFIG[state.mode].label}</strong></div>
        <div class="bet-line"><span class="bet-label">Confidence</span><strong>${game.confidence}</strong></div>
        <div class="bet-line"><span class="bet-label">Suggested stake</span><strong>${formatMoney(stake)}</strong></div>
        <div class="bet-line"><span class="bet-label">Projected payout</span><strong>${formatMoney(stake * game.odds)}</strong></div>
      </div>
      <button id="confirmBetBtn" class="primary-btn full">Confirm Bet</button>
    </div>
  `;

  document.getElementById('betModal').classList.remove('hidden');
  document.getElementById('confirmBetBtn').addEventListener('click', confirmBet);
}

function closeBetModal() {
  document.getElementById('betModal').classList.add('hidden');
  selectedBetGame = null;
}

function confirmBet() {
  if (!selectedBetGame) return;
  const stake = suggestedStake(selectedBetGame);
  if (state.bankroll < stake) {
    showToast('Not enough bankroll for that stake');
    return;
  }

  state.bankroll = Math.round((state.bankroll - stake) * 100) / 100;
  state.bets.push({
    id: String(Date.now()),
    gameId: selectedBetGame.id,
    teams: selectedBetGame.teams,
    stake,
    payout: Math.round(stake * selectedBetGame.odds * 100) / 100,
    odds: selectedBetGame.odds,
    mode: state.mode,
    status: 'OPEN'
  });

  saveState();
  closeBetModal();
  render();
  showToast(`Bet placed on ${selectedBetGame.teams}`);
}

function settleBet(id, won) {
  const bet = state.bets.find((item) => item.id === id);
  if (!bet || bet.status !== 'OPEN') return;

  bet.status = won ? 'WON' : 'LOST';
  if (won) state.bankroll = Math.round((state.bankroll + bet.payout) * 100) / 100;

  saveState();
  render();
  showToast(won ? 'Bet marked as win' : 'Bet marked as loss');
}

function quickSettle(gameId) {
  const openBet = state.bets.find((bet) => bet.gameId === gameId && bet.status === 'OPEN');
  if (!openBet) {
    showToast('Place the bet first, then grade it here');
    return;
  }
  settleBet(openBet.id, true);
}

function resetBets() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
  render();
  showToast('Ledger reset');
}

function openModeModal() {
  document.getElementById('modeModal').classList.remove('hidden');
}

function closeModeModal() {
  document.getElementById('modeModal').classList.add('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-view').forEach((view) => view.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((button) => button.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
}

function saveSettings() {
  const bankrollInput = Number(document.getElementById('bankrollInput').value || state.startingBankroll);
  if (bankrollInput < 100) {
    showToast('Starting bankroll must be at least 100');
    return;
  }

  const currentProfit = state.bankroll - state.startingBankroll;
  state.startingBankroll = bankrollInput;
  state.bankroll = Math.round((bankrollInput + currentProfit) * 100) / 100;
  state.autoMode = document.getElementById('autoToggle').checked;
  saveState();
  render();
  showToast('Settings saved');
}

function renderHeaderStats(stats) {
  const modeConfig = MODE_CONFIG[state.mode];
  const top = topGames()[0];

  document.getElementById('bankrollValue').textContent = formatMoney(state.bankroll);
  document.getElementById('roiValue').textContent = `${stats.roi.toFixed(1)}%`;
  document.getElementById('streakValue').textContent = stats.streak;
  document.getElementById('winRateValue').textContent = `${Math.round(stats.winRate)}%`;
  document.getElementById('profitValue').textContent = formatMoney(stats.profit);
  document.getElementById('modeBadge').textContent = state.mode;
  document.getElementById('modeButton').textContent = `${modeConfig.label} ▾`;
  document.getElementById('heroPulseText').textContent = modeConfig.posture;
  document.getElementById('modeThresholdValue').textContent = `${modeConfig.minSignal}+`;

  document.getElementById('topSignalTeams').textContent = top ? top.teams : 'No play loaded';
  document.getElementById('topSignalReason').textContent = top ? top.reason : 'Refresh signals to surface the strongest spot.';
  document.getElementById('topSignalScore').textContent = top ? `Signal ${top.signal}` : 'Signal --';
  document.getElementById('topSignalConfidence').textContent = top ? `${top.confidence}` : 'Confidence --';
}

function renderIntel(stats) {
  const plays = getFilteredGames();
  const topSignal = topGames()[0]?.signal || 0;
  const trend = topSignal >= 88 ? 'Hot' : topSignal >= 76 ? 'Rising' : topSignal >= 68 ? 'Stable' : 'Cold';

  document.getElementById('liveGamesValue').textContent = String(GAMES.filter((game) => game.isLive).length);
  document.getElementById('signalTrendValue').textContent = trend;
  document.getElementById('openBetsValue').textContent = String(stats.open);
  document.getElementById('autoModeValue').textContent = state.autoMode ? 'Auto-ready' : 'Manual';
  document.getElementById('settledBetsValue').textContent = String(stats.settled);
  document.getElementById('avgStakeValue').textContent = stats.avgStake ? formatMoney(stats.avgStake) : '0';
  document.getElementById('lastOutcomeValue').textContent = stats.lastOutcome === '—' ? '—' : stats.lastOutcome;
  document.getElementById('bankrollInput').value = state.startingBankroll;
  document.getElementById('autoToggle').checked = state.autoMode;

}

function render() {
  const stats = computeStats();
  renderHeaderStats(stats);
  renderIntel(stats);
  renderTrendBars();
  renderFeaturedPlay();
  renderPlays('topPlays', topGames().slice(1), true);
  renderPlays('allPlays', getFilteredGames(), false);
  renderRecentBets();
  renderLedger();
  renderModes();
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('installBtn').classList.remove('hidden');
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) {
      showToast('Use Chrome and Add to Home screen');
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('installBtn').classList.add('hidden');
  });
}

function wireEvents() {
  document.querySelectorAll('.nav-btn').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
  document.querySelectorAll('[data-tab-jump]').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tabJump)));
  document.getElementById('modeButton').addEventListener('click', openModeModal);
  document.querySelector('.close-modal').addEventListener('click', closeModeModal);
  document.querySelector('.close-bet-modal').addEventListener('click', closeBetModal);
  document.querySelector('#modeModal .backdrop').addEventListener('click', closeModeModal);
  document.querySelector('#betModal .backdrop').addEventListener('click', closeBetModal);
  document.getElementById('refreshBtn').addEventListener('click', () => {
    render();
    showToast('Signals refreshed');
  });
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetBetsBtn').addEventListener('click', resetBets);
}

initPWA();
wireEvents();
render();
