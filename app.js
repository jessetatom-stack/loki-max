const STORAGE_KEY = 'loki-max-opinion-v9';
const MODE_CONFIG = {
  SAFE: { label: 'Safe', minSignal: 72, units: 2, desc: 'Waits for cleaner reads.', risk: 'Low' },
  BALANCED: { label: 'Balanced', minSignal: 66, units: 4, desc: 'Picks strong reads without forcing action.', risk: 'Medium' },
  AGGRESSIVE: { label: 'Aggressive', minSignal: 60, units: 6, desc: 'Acts earlier with more volatility.', risk: 'High' }
};

const GAMES = [
  { id:'g1', teams:'Lakers vs Suns', league:'NBA', quarter:'3rd Q', signal:88, confidence:'ELITE', recommendation:'ENTER NOW', insight:'Momentum flipped hard this quarter and the market still looks late. This is one of the cleanest live reads on the board.', edge:'High', risk:'Late volatility', window:'3-5 min', trust:'Top 6% today', sample:'7 of last 10 similar spots hit', isLive:true, trend:'rising', score:'92 trust', pts:60 },
  { id:'g2', teams:'Celtics vs Heat', league:'NBA', quarter:'Halftime', signal:81, confidence:'HIGH', recommendation:'WAIT FOR BETTER ENTRY', insight:'The edge is real, but the current price looks a little crowded. Patience likely gets a better window.', edge:'Good', risk:'Crowded price', window:'5-8 min', trust:'Top 14% today', sample:'12-game sample, stable', isLive:true, trend:'steady', score:'84 trust', pts:40 },
  { id:'g3', teams:'Warriors vs Kings', league:'NBA', quarter:'4th Q', signal:76, confidence:'HIGH', recommendation:'ENTER LIGHT', insight:'Shot quality and tempo still favor the same side, but the read is less clean than the top tier signal.', edge:'Medium', risk:'Fast swings', window:'2-4 min', trust:'Top 22% today', sample:'5 of last 8 similar spots', isLive:true, trend:'rising', score:'79 trust', pts:30 },
  { id:'g4', teams:'Knicks vs Bucks', league:'NBA', quarter:'Pre', signal:69, confidence:'MED', recommendation:'AVOID FOR NOW', insight:'There is a possible edge, but nothing here is strong enough to force action. Keep it on watch only.', edge:'Thin', risk:'Weak conviction', window:'Later', trust:'Needs more confirmation', sample:'Low sample', isLive:false, trend:'flat', score:'64 trust', pts:20 }
];

const DEFAULT_STATE = { mode:'BALANCED', bank:1000, start:1000, auto:false, logs:[] };
let state = load();
let deferredPrompt = null;
let selected = null;

function load(){ try{ return {...DEFAULT_STATE, ...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}; }catch{ return structuredClone(DEFAULT_STATE);} }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function money(v){ return `${Math.round(v)} pts`; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add('hidden'),2200); }
function plays(){ const cfg=MODE_CONFIG[state.mode]; return GAMES.filter(g=>g.signal>=cfg.minSignal).sort((a,b)=>b.signal-a.signal); }
function stats(){
  const settled=state.logs.filter(x=>x.status!=='OPEN'); const wins=settled.filter(x=>x.status==='HIT').length;
  const roi=((state.bank-state.start)/state.start)*100; const streak=calcStreak();
  return { roi, hitRate:settled.length?(wins/settled.length)*100:0, streak, open:state.logs.filter(x=>x.status==='OPEN').length, settled:settled.length, net:state.bank-state.start };
}
function calcStreak(){ const s=[...state.logs].reverse(); if(!s.length) return '—'; let type=null,c=0; for(const x of s){ if(x.status==='OPEN') continue; if(!type){type=x.status;c=1;} else if(x.status===type)c++; else break; } return c?`${type==='HIT'?'W':'L'}${c}`:'—'; }
function heroOpinion(){ const top=plays()[0]; if(!top) return 'No premium windows. Stay patient and wait for cleaner confirmation.'; if(top.recommendation.includes('ENTER')) return `Calm but decisive. ${top.teams} is the best live window right now.`; if(top.recommendation.includes('WAIT')) return `Quality is there, but price is crowded. Let the market come to you.`; return 'Board is active, but conviction is not strong enough to force action.'; }
function renderCard(game, compact=false){ const tracked=state.logs.find(x=>x.gameId===game.id&&x.status==='OPEN'); return `
  <section class="card opinion-card">
    <div class="opinion-head">
      <div>
        <div class="badge ${game.confidence==='ELITE'?'elite':''}">${game.confidence}</div>
        <div class="action-call">${game.recommendation}</div>
        <div class="opinion-title">${game.teams}</div>
      </div>
      <div class="urgency">${game.isLive?'Live edge':'Watchlist'} · ${game.window}</div>
    </div>
    <div class="bar" style="margin-top:12px"><span style="width:${game.signal}%"></span></div>
    <div class="trust-row"><div class="trust-note">${game.score} · ${game.trend}</div><div class="trust-note">${game.trust}</div></div>
    <div class="insight">${game.insight}</div>
    <div class="depth-grid">
      <div class="depth-box"><span class="label muted tiny">Edge</span><span class="value">${game.edge}</span></div>
      <div class="depth-box"><span class="label muted tiny">Risk</span><span class="value">${game.risk}</span></div>
      <div class="depth-box"><span class="label muted tiny">Window</span><span class="value">${game.window}</span></div>
    </div>
    <div class="trust-note" style="margin-top:12px">${game.sample}</div>
    <div class="play-actions">
      <button class="primary-btn track-btn" data-id="${game.id}">${tracked?'Open in Log':'Track Signal'}</button>
      <button class="secondary-btn detail-btn" data-id="${game.id}">Why</button>
    </div>
  </section>`; }
function render(){
  const s=stats(), top=plays()[0];
  document.getElementById('bankrollValue').textContent = money(state.bank);
  document.getElementById('roiValue').textContent = `${s.roi.toFixed(1)}%`;
  document.getElementById('winRateValue').textContent = `${Math.round(s.hitRate)}%`;
  document.getElementById('streakValue').textContent = s.streak;
  document.getElementById('modeBadge').textContent = state.mode;
  document.getElementById('modeButton').textContent = `${MODE_CONFIG[state.mode].label} ▾`;
  document.getElementById('heroOpinion').textContent = heroOpinion();
  document.getElementById('systemStance').textContent = top ? top.recommendation : 'Stay patient';
  document.getElementById('systemUrgency').textContent = top ? (top.window==='Later'?'Low':'Active') : 'Low';
  document.getElementById('systemTrust').textContent = top ? top.score : 'Building';
  document.getElementById('signalTrendValue').textContent = top ? (top.trend==='rising'?'Heating up':'Mixed') : 'Quiet';
  document.getElementById('autoModeValue').textContent = state.auto ? 'Auto-ready' : 'Manual';
  document.getElementById('liveGamesValue').textContent = String(GAMES.filter(g=>g.isLive).length);
  document.getElementById('openBetsValue').textContent = s.open;
  document.getElementById('settledBetsValue').textContent = s.settled;
  document.getElementById('profitValue').textContent = money(s.net);
  document.getElementById('bankrollInput').value = state.start;
  document.getElementById('autoToggle').checked = state.auto;
  document.getElementById('topPlays').innerHTML = plays().slice(0,2).map(g=>renderCard(g,true)).join('');
  document.getElementById('allPlays').innerHTML = plays().map(g=>renderCard(g)).join('');
  renderActivity(); renderLog(); bindCardButtons(); renderModes();
}
function renderActivity(){ const wrap=document.getElementById('recentBets'); if(!state.logs.length){ wrap.innerHTML='<div class="recent-item"><div><strong>No activity yet</strong><div class="muted">Track a signal to build momentum.</div></div></div>'; return; } wrap.innerHTML=[...state.logs].slice(-3).reverse().map(x=>`<div class="recent-item"><div><strong>${x.teams}</strong><div class="muted">${x.status} · ${x.mode}</div></div><div class="pnl ${x.status==='HIT'?'win':x.status==='MISS'?'loss':''}">${x.status==='OPEN'?'LIVE':x.status}</div></div>`).join(''); }
function renderLog(){ const wrap=document.getElementById('betLedger'); if(!state.logs.length){ wrap.innerHTML='<div class="ledger-item"><div><strong>Empty log</strong><div class="muted">Track your first signal from Home.</div></div></div>'; return; } wrap.innerHTML=[...state.logs].reverse().map(x=>`<section class="card"><div class="ledger-item" style="padding:0;border:none;background:none"><div><strong>${x.teams}</strong><div class="muted">${x.status} · ${x.mode} · ${money(x.points)}</div></div><div class="pnl ${x.status==='HIT'?'win':x.status==='MISS'?'loss':''}">${x.status}</div></div>${x.status==='OPEN'?`<div class="play-actions" style="margin-top:10px"><button class="secondary-btn hit-btn" data-id="${x.id}">Mark Hit</button><button class="secondary-btn miss-btn" data-id="${x.id}">Mark Miss</button></div>`:''}</section>`).join(''); document.querySelectorAll('.hit-btn').forEach(b=>b.onclick=()=>settle(b.dataset.id,true)); document.querySelectorAll('.miss-btn').forEach(b=>b.onclick=()=>settle(b.dataset.id,false)); }
function bindCardButtons(){ document.querySelectorAll('.track-btn').forEach(b=>b.onclick=()=>openModal(b.dataset.id)); document.querySelectorAll('.detail-btn').forEach(b=>b.onclick=()=>showWhy(b.dataset.id)); }
function renderModes(){ const wrap=document.getElementById('modeOptions'); wrap.innerHTML = Object.entries(MODE_CONFIG).map(([k,v])=>`<button class="mode-option ${state.mode===k?'active':''}" data-mode="${k}"><div class="mode-title"><span>${v.label}</span><span>${state.mode===k?'ACTIVE':v.risk}</span></div><div class="muted">${v.desc}</div><div class="muted" style="margin-top:8px">Min signal ${v.minSignal}</div></button>`).join(''); wrap.querySelectorAll('.mode-option').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode; save(); closeMode(); render(); toast(`${MODE_CONFIG[state.mode].label} mode enabled`)}); }
function openModal(id){ const g=GAMES.find(x=>x.id===id); if(!g) return; selected=g; document.getElementById('betModalContent').innerHTML=`<div class="bet-modal-card"><div><strong>${g.teams}</strong><div class="muted">${g.score} · ${g.trust}</div></div><div class="bet-inline"><span>Primary action</span><strong>${g.recommendation}</strong></div><div class="bet-inline"><span>Reason</span><strong>${g.edge}</strong></div><div class="bet-inline"><span>Risk</span><strong>${g.risk}</strong></div><div class="bet-inline"><span>Sample</span><strong>${g.sample}</strong></div><button id="confirmTrackBtn" class="primary-btn full">Track This Signal</button></div>`; document.getElementById('betModal').classList.remove('hidden'); document.getElementById('confirmTrackBtn').onclick=trackSelected; }
function showWhy(id){ const g=GAMES.find(x=>x.id===id); if(g) toast(g.insight); }
function trackSelected(){ if(!selected) return; const already=state.logs.find(x=>x.gameId===selected.id&&x.status==='OPEN'); if(already){ switchTab('bets'); closeBet(); return; } state.logs.push({ id:String(Date.now()), gameId:selected.id, teams:selected.teams, points:selected.pts, mode:state.mode, status:'OPEN' }); state.bank -= selected.pts; save(); closeBet(); render(); toast('Signal added to tracking log'); }
function settle(id, hit){ const x=state.logs.find(i=>i.id===id); if(!x||x.status!=='OPEN') return; x.status = hit?'HIT':'MISS'; if(hit) state.bank += Math.round(x.points*1.9); save(); render(); toast(hit?'Marked as hit':'Marked as miss'); }
function closeBet(){ document.getElementById('betModal').classList.add('hidden'); selected=null; }
function closeMode(){ document.getElementById('modeModal').classList.add('hidden'); }
function switchTab(tab){ document.querySelectorAll('.tab-view').forEach(v=>v.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(v=>v.classList.remove('active')); document.getElementById(`tab-${tab}`).classList.add('active'); document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active'); }
function saveSettings(){ const val=Number(document.getElementById('bankrollInput').value||state.start); const current=state.bank-state.start; state.start=val; state.bank=val+current; state.auto=document.getElementById('autoToggle').checked; save(); render(); toast('Settings saved'); }
function reset(){ state=structuredClone(DEFAULT_STATE); save(); render(); toast('Tracking log reset'); }
function initPWA(){ if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js')); } window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; document.getElementById('installBtn').classList.remove('hidden'); }); document.getElementById('installBtn').onclick=async()=>{ if(!deferredPrompt) return toast('Use browser menu to install'); deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; document.getElementById('installBtn').classList.add('hidden'); }; }
function wire(){ document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab)); document.querySelectorAll('[data-tab-jump]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tabJump)); document.getElementById('modeButton').onclick=()=>document.getElementById('modeModal').classList.remove('hidden'); document.querySelector('.close-modal').onclick=closeMode; document.querySelector('.close-bet-modal').onclick=closeBet; document.querySelector('#modeModal .backdrop').onclick=closeMode; document.querySelector('#betModal .backdrop').onclick=closeBet; document.getElementById('refreshBtn').onclick=()=>{ render(); toast('Board refreshed'); }; document.getElementById('saveSettingsBtn').onclick=saveSettings; document.getElementById('resetBetsBtn').onclick=reset; }
initPWA(); wire(); render();
