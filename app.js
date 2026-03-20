
const STORAGE_KEY='loki_max_real_pwa_v1';
const DEFAULT_STATE={startingBankroll:1000,bankroll:1000,mode:'BALANCED',autoMode:false,bets:[]};
const MODE_CONFIG={
 SAFE:{minSignal:84,units:1,label:'Safe',desc:'Fewer, tighter plays',risk:'Low risk'},
 BALANCED:{minSignal:72,units:2,label:'Balanced',desc:'Best daily setting',risk:'Smart mix'},
 AGGRESSIVE:{minSignal:60,units:4,label:'Aggressive',desc:'More volume, more swings',risk:'High variance'}
};
const GAMES=[
 {id:'nba-lal-phx',teams:'Lakers vs Suns',liveText:'Live now • 3rd Q',signal:88,confidence:'ELITE',recommendation:'Strong Buy',reason:'Pressure spike + late pace edge',odds:1.90,isLive:true},
 {id:'nba-bos-mia',teams:'Celtics vs Heat',liveText:'Starts in 22m',signal:79,confidence:'HIGH',recommendation:'Lean',reason:'Sharp movement + edge carry',odds:1.86,isLive:false},
 {id:'nba-den-dal',teams:'Nuggets vs Mavs',liveText:'Live now • Halftime',signal:83,confidence:'HIGH',recommendation:'Strong Buy',reason:'Second-half pressure split',odds:1.95,isLive:true},
 {id:'nhl-nyr-bos',teams:'Rangers vs Bruins',liveText:'Starts in 41m',signal:68,confidence:'MEDIUM',recommendation:'Watch',reason:'Signal close but not elite',odds:1.88,isLive:false},
 {id:'mlb-nyy-hou',teams:'Yankees vs Astros',liveText:'Live now • 6th',signal:75,confidence:'HIGH',recommendation:'Lean',reason:'Momentum carry with bullpen edge',odds:1.91,isLive:true}
];
let state=loadState(),deferredPrompt=null,selectedBetGame=null;
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?{...structuredClone(DEFAULT_STATE),...JSON.parse(raw)}:structuredClone(DEFAULT_STATE)}catch{return structuredClone(DEFAULT_STATE)}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function formatMoney(n){return `${Math.round(n*100)/100} USD.bit`}
function computeStats(){
 const settled=state.bets.filter(b=>b.status!=='OPEN');
 const wins=settled.filter(b=>b.status==='WON').length;
 const totalSettled=settled.length;
 const profit=Math.round((state.bankroll-state.startingBankroll)*100)/100;
 let streak='—';
 if(settled.length){let count=0;const last=settled[settled.length-1].status;for(let i=settled.length-1;i>=0;i--){if(settled[i].status===last){count++}else{break}}streak=`${last==='WON'?'W':'L'}${count}`;}
 return {roi:state.startingBankroll?((profit/state.startingBankroll)*100):0,winRate:totalSettled?(wins/totalSettled)*100:0,settled:totalSettled,open:state.bets.filter(b=>b.status==='OPEN').length,profit,streak};
}
function getFilteredGames(){const cfg=MODE_CONFIG[state.mode];return GAMES.filter(g=>g.signal>=cfg.minSignal).sort((a,b)=>b.signal-a.signal)}
function topGames(){return getFilteredGames().slice(0,3)}
function suggestedStake(game){const base=MODE_CONFIG[state.mode].units;const mult=game.confidence==='ELITE'?1.5:game.confidence==='HIGH'?1:0.75;return Math.max(10,Math.round(base*mult*10))}
function findGame(id){return GAMES.find(g=>g.id===id)}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.add('hidden'),1800)}
function renderPlays(targetId,games,compact){
 const wrap=document.getElementById(targetId);wrap.innerHTML='';
 if(!games.length){wrap.innerHTML='<section class="card"><div class="section-title">No plays in this mode</div><div class="muted">Switch mode for more volume.</div></section>';return;}
 games.forEach(game=>{
   const stake=suggestedStake(game);
   const el=document.createElement('section');el.className='card play-card';
   el.innerHTML=`<div class="play-top"><div class="conf-badge conf-${game.confidence}">${game.confidence}</div><div class="muted">${game.liveText}</div></div>
   <div class="teams">${game.teams}</div>
   <div class="progress"><span style="width:${game.signal}%"></span></div>
   <div class="meta-grid">
     <div><div class="label">Signal</div><div class="value">${game.signal}</div></div>
     <div><div class="label">Call</div><div class="value">${game.recommendation}</div></div>
     <div><div class="label">Stake</div><div class="value">${formatMoney(stake)}</div></div>
   </div>
   <div class="muted" style="margin-top:12px">${game.reason}</div>
   <div class="play-actions">
     <button class="primary-btn place-bet-btn" data-id="${game.id}">Bet Now</button>
     ${compact?`<button class="secondary-btn details-btn" data-id="${game.id}">Details</button>`:`<button class="secondary-btn settle-demo-btn" data-id="${game.id}">Quick Win</button>`}
   </div>`;
   wrap.appendChild(el);
 });
 wrap.querySelectorAll('.place-bet-btn').forEach(btn=>btn.addEventListener('click',()=>openBetModal(btn.dataset.id)));
 wrap.querySelectorAll('.details-btn').forEach(btn=>btn.addEventListener('click',()=>showToast(findGame(btn.dataset.id).reason)));
 wrap.querySelectorAll('.settle-demo-btn').forEach(btn=>btn.addEventListener('click',()=>quickSettle(btn.dataset.id)));
}
function renderRecentBets(){
 const wrap=document.getElementById('recentBets');wrap.innerHTML='';
 const recent=[...state.bets].slice(-3).reverse();
 if(!recent.length){wrap.innerHTML='<div class="recent-item"><div><strong>No bets yet</strong><div class="muted">Top plays are ready when you are.</div></div></div>';return;}
 recent.forEach(bet=>{
  const pnl=bet.status==='WON'?`+${formatMoney(bet.payout-bet.stake)}`:bet.status==='LOST'?`-${formatMoney(bet.stake)}`:'OPEN';
  const cls=bet.status==='WON'?'win':bet.status==='LOST'?'loss':'';
  const el=document.createElement('div');el.className='recent-item';
  el.innerHTML=`<div><strong>${bet.teams}</strong><div class="muted">${bet.status} • ${bet.mode}</div></div><div class="pnl ${cls}">${pnl}</div>`;
  wrap.appendChild(el);
 });
}
function renderLedger(){
 const wrap=document.getElementById('betLedger');wrap.innerHTML='';
 if(!state.bets.length){wrap.innerHTML='<div class="ledger-item"><div><strong>Empty ledger</strong><div class="muted">Place your first bet from Top Plays.</div></div></div>';return;}
 [...state.bets].reverse().forEach(bet=>{
  const controls=bet.status==='OPEN'?`<div class="play-actions" style="margin-top:10px"><button class="secondary-btn settle-win" data-id="${bet.id}">Mark Win</button><button class="secondary-btn settle-loss" data-id="${bet.id}">Mark Loss</button></div>`:'';
  const pnl=bet.status==='WON'?`+${formatMoney(bet.payout-bet.stake)}`:bet.status==='LOST'?`-${formatMoney(bet.stake)}`:'OPEN';
  const cls=bet.status==='WON'?'win':bet.status==='LOST'?'loss':'';
  const el=document.createElement('section');el.className='card';
  el.innerHTML=`<div class="ledger-item" style="padding:0;border:none;background:none"><div><strong>${bet.teams}</strong><div class="muted">${bet.status} • ${bet.mode} • ${formatMoney(bet.stake)}</div></div><div class="pnl ${cls}">${pnl}</div></div>${controls}`;
  wrap.appendChild(el);
 });
 wrap.querySelectorAll('.settle-win').forEach(btn=>btn.addEventListener('click',()=>settleBet(btn.dataset.id,true)));
 wrap.querySelectorAll('.settle-loss').forEach(btn=>btn.addEventListener('click',()=>settleBet(btn.dataset.id,false)));
}
function renderModes(){
 const wrap=document.getElementById('modeOptions');wrap.innerHTML='';
 Object.entries(MODE_CONFIG).forEach(([key,cfg])=>{
  const el=document.createElement('button');el.className=`mode-option ${state.mode===key?'active':''}`;
  el.innerHTML=`<div class="mode-title"><span>${cfg.label}</span><span>${key===state.mode?'ACTIVE':cfg.risk}</span></div><div class="muted">${cfg.desc}</div><div class="muted" style="margin-top:8px">Min signal ${cfg.minSignal} • Base stake ${formatMoney(cfg.units*10)}</div>`;
  el.addEventListener('click',()=>{state.mode=key;saveState();closeModeModal();render();showToast(`${cfg.label} mode enabled`)});
  wrap.appendChild(el);
 });
}
function render(){
 const stats=computeStats();
 document.getElementById('bankrollValue').textContent=formatMoney(state.bankroll);
 document.getElementById('roiValue').textContent=`${stats.roi.toFixed(1)}%`;
 document.getElementById('winRateValue').textContent=`${Math.round(stats.winRate)}%`;
 document.getElementById('streakValue').textContent=stats.streak;
 document.getElementById('modeBadge').textContent=state.mode;
 document.getElementById('modeButton').textContent=`${MODE_CONFIG[state.mode].label} ▾`;
 document.getElementById('signalTrendValue').textContent=topGames()[0]?.signal>=84?'Heating up':'Balanced';
 document.getElementById('autoModeValue').textContent=state.autoMode?'Auto-ready':'Manual';
 document.getElementById('liveGamesValue').textContent=String(GAMES.filter(g=>g.isLive).length);
 document.getElementById('openBetsValue').textContent=String(stats.open);
 document.getElementById('settledBetsValue').textContent=String(stats.settled);
 document.getElementById('profitValue').textContent=formatMoney(stats.profit);
 document.getElementById('bankrollInput').value=state.startingBankroll;
 document.getElementById('autoToggle').checked=state.autoMode;
 renderPlays('topPlays',topGames(),true); renderPlays('allPlays',getFilteredGames(),false); renderRecentBets(); renderLedger(); renderModes();
}
function openBetModal(id){
 const game=findGame(id); if(!game) return; selectedBetGame=game; const stake=suggestedStake(game);
 document.getElementById('betModalContent').innerHTML=`<div class="bet-modal-card">
 <div><strong>${game.teams}</strong><div class="muted">${game.reason}</div></div>
 <div class="bet-inline"><span>Mode</span><strong>${state.mode}</strong></div>
 <div class="bet-inline"><span>Confidence</span><strong>${game.confidence}</strong></div>
 <div class="bet-inline"><span>Suggested stake</span><strong>${formatMoney(stake)}</strong></div>
 <div class="bet-inline"><span>Projected payout</span><strong>${formatMoney(stake*game.odds)}</strong></div>
 <button id="confirmBetBtn" class="primary-btn full">Confirm Bet</button></div>`;
 document.getElementById('betModal').classList.remove('hidden');
 document.getElementById('confirmBetBtn').addEventListener('click',confirmBet);
}
function closeBetModal(){document.getElementById('betModal').classList.add('hidden');selectedBetGame=null}
function confirmBet(){
 if(!selectedBetGame)return;
 const stake=suggestedStake(selectedBetGame);
 if(state.bankroll<stake)return showToast('Not enough bankroll for this stake');
 state.bankroll=Math.round((state.bankroll-stake)*100)/100;
 state.bets.push({id:String(Date.now()),gameId:selectedBetGame.id,teams:selectedBetGame.teams,stake,payout:Math.round(stake*selectedBetGame.odds*100)/100,odds:selectedBetGame.odds,mode:state.mode,status:'OPEN'});
 saveState(); closeBetModal(); render(); showToast(`Bet placed on ${selectedBetGame.teams}`);
}
function settleBet(id,won){
 const bet=state.bets.find(b=>b.id===id); if(!bet||bet.status!=='OPEN') return;
 bet.status=won?'WON':'LOST'; if(won) state.bankroll=Math.round((state.bankroll+bet.payout)*100)/100;
 saveState(); render(); showToast(won?'Bet marked as win':'Bet marked as loss');
}
function quickSettle(gameId){
 const open=state.bets.find(b=>b.gameId===gameId&&b.status==='OPEN');
 if(open){settleBet(open.id,true)}else{showToast('Place the bet first, then settle it here')}
}
function resetBets(){state=structuredClone(DEFAULT_STATE);saveState();render();showToast('Ledger reset')}
function openModeModal(){document.getElementById('modeModal').classList.remove('hidden')}
function closeModeModal(){document.getElementById('modeModal').classList.add('hidden')}
function switchTab(tab){
 document.querySelectorAll('.tab-view').forEach(v=>v.classList.remove('active'));
 document.querySelectorAll('.nav-btn').forEach(v=>v.classList.remove('active'));
 document.getElementById(`tab-${tab}`).classList.add('active');
 document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
}
function saveSettings(){
 const val=Number(document.getElementById('bankrollInput').value||state.startingBankroll);
 if(val<100)return showToast('Starting bankroll must be at least 100');
 const currentProfit=state.bankroll-state.startingBankroll;
 state.startingBankroll=val; state.bankroll=Math.round((val+currentProfit)*100)/100; state.autoMode=document.getElementById('autoToggle').checked;
 saveState(); render(); showToast('Settings saved');
}
function initPWA(){
 if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'))}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden')});
 document.getElementById('installBtn').addEventListener('click',async()=>{
  if(!deferredPrompt)return showToast('Use Chrome → Add to Home screen');
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; document.getElementById('installBtn').classList.add('hidden');
 });
}
function wireEvents(){
 document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
 document.querySelectorAll('[data-tab-jump]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tabJump)));
 document.getElementById('modeButton').addEventListener('click',openModeModal);
 document.querySelector('.close-modal').addEventListener('click',closeModeModal);
 document.querySelector('.close-bet-modal').addEventListener('click',closeBetModal);
 document.querySelector('#modeModal .backdrop').addEventListener('click',closeModeModal);
 document.querySelector('#betModal .backdrop').addEventListener('click',closeBetModal);
 document.getElementById('refreshBtn').addEventListener('click',()=>{render();showToast('Signals refreshed')});
 document.getElementById('saveSettingsBtn').addEventListener('click',saveSettings);
 document.getElementById('resetBetsBtn').addEventListener('click',resetBets);
}
initPWA(); wireEvents(); render();
