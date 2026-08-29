let historyPlayer='';
let playerSeasonChart=null, playerCareerChart=null, teamSeasonHistoryChart=null;

function esc(v){
  return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}

function historyRows(){
  return allRows.filter(r=>r[COL.sarja]==='Sarja');
}

function seasonCmp(a,b){
  return String(a).localeCompare(String(b),'fi',{numeric:true,sensitivity:'base'});
}

function resultCode(r){
  const raw=String(r[COL.tulos]??'').trim().toLowerCase();
  if(raw.includes('voitto')) return 'W';
  if(raw.includes('tappio')) return 'L';
  const own=r[COL.omaPts], opp=r[COL.vastPts];
  if(own!=='' && own!=null && opp!=='' && opp!=null){
    if(n(own)>n(opp)) return 'W';
    if(n(own)<n(opp)) return 'L';
  }
  return '';
}

function pct(w,total){ return total?+(w/total*100).toFixed(1):0; }
function one(v){ return Number.isFinite(v)?(+v).toFixed(1):'–'; }

function allHistoryPlayers(){
  return [...new Set(historyRows().map(r=>r[COL.nimi]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fi'));
}

function playerHistoryGames(name){
  const map=new Map();
  historyRows().forEach(r=>{
    if(r[COL.nimi]!==name) return;
    const season=r[COL.kausi]||'–', game=n(r[COL.ottelu]);
    const key=`${season}__${game}`;
    if(!map.has(key)) map.set(key,{season,game,opp:r[COL.vastustaja]||'–',homeAway:r[COL.kotiv]||'',result:resultCode(r),pts:0});
    const g=map.get(key);
    g.pts+=n(r[COL.pisteet]);
    if(g.opp==='–' && r[COL.vastustaja]) g.opp=r[COL.vastustaja];
    if(!g.homeAway && r[COL.kotiv]) g.homeAway=r[COL.kotiv];
    if(!g.result) g.result=resultCode(r);
  });
  return [...map.values()].sort((a,b)=>seasonCmp(a.season,b.season)||a.game-b.game);
}

function playerSeasonRows(games){
  const map=new Map();
  games.forEach(g=>{
    if(!map.has(g.season)) map.set(g.season,{season:g.season,gp:0,pts:0,high:0,w:0,l:0});
    const s=map.get(g.season);
    s.gp++; s.pts+=g.pts; s.high=Math.max(s.high,g.pts);
    if(g.result==='W') s.w++; else if(g.result==='L') s.l++;
  });
  return [...map.values()].sort((a,b)=>seasonCmp(a.season,b.season)).map(s=>({...s,ppg:s.gp?s.pts/s.gp:0}));
}

function playerLeaderboard(){
  return allHistoryPlayers().map(name=>{
    const games=playerHistoryGames(name), ss=new Set(games.map(g=>g.season));
    const pts=games.reduce((a,g)=>a+g.pts,0), high=games.reduce((a,g)=>Math.max(a,g.pts),0);
    return {name,seasons:ss.size,gp:games.length,pts,ppg:games.length?pts/games.length:0,high};
  }).sort((a,b)=>b.pts-a.pts||b.ppg-a.ppg||a.name.localeCompare(b.name,'fi'));
}

function metricCard(value,label,detail=''){
  return `<div class="history-metric"><div class="history-value">${esc(value)}</div><div class="history-label">${esc(label)}</div>${detail?`<div class="history-detail">${esc(detail)}</div>`:''}</div>`;
}

function renderPlayerHistory(){
  const sel=document.getElementById('historyPlayerSel');
  if(!sel) return;
  const names=allHistoryPlayers();
  if(!names.length){ document.getElementById('playerHistoryContent').innerHTML='<div class="history-empty">Ei historiadataa.</div>'; return; }
  if(!historyPlayer || !names.includes(historyPlayer)) historyPlayer=names[0];
  sel.innerHTML=names.map(p=>`<option value="${esc(p)}"${p===historyPlayer?' selected':''}>${esc(p)}</option>`).join('');
  sel.onchange=()=>{historyPlayer=sel.value;renderPlayerHistory();};

  const games=playerHistoryGames(historyPlayer), seasonRows=playerSeasonRows(games);
  const pts=games.reduce((a,g)=>a+g.pts,0), ppg=games.length?pts/games.length:0;
  const high=games.reduce((a,g)=>Math.max(a,g.pts),0);
  const best=[...seasonRows].sort((a,b)=>b.ppg-a.ppg||b.gp-a.gp)[0];
  const wins=games.filter(g=>g.result==='W').length, losses=games.filter(g=>g.result==='L').length;

  document.getElementById('playerHistoryMetrics').innerHTML=[
    metricCard(seasonRows.length,'Kausia'), metricCard(games.length,'Otteluita'), metricCard(pts,'Pisteitä'),
    metricCard(one(ppg),'PPG'), metricCard(high,'Piste-ennätys'),
    metricCard(best?best.season:'–','Paras kausi',best?`${one(best.ppg)} PPG`:''), metricCard(`${wins}–${losses}`,'W–L')
  ].join('');

  document.getElementById('playerSeasonBody').innerHTML=seasonRows.slice().reverse().map(s=>`<tr><td>${esc(s.season)}</td><td>${s.gp}</td><td>${s.pts}</td><td>${one(s.ppg)}</td><td>${s.high}</td><td>${s.w}–${s.l}</td></tr>`).join('');

  const top=[...games].sort((a,b)=>b.pts-a.pts||seasonCmp(b.season,a.season)||b.game-a.game).slice(0,10);
  document.getElementById('playerTopGamesBody').innerHTML=top.map((g,i)=>`<tr><td>${i+1}</td><td>${esc(g.season)}</td><td>#${g.game}</td><td>${esc(g.opp)}</td><td>${esc(g.homeAway||'–')}</td><td>${esc(g.result||'–')}</td><td class="hl">${g.pts}</td></tr>`).join('');

  const leaders=playerLeaderboard();
  document.getElementById('historyLeaderboard').innerHTML=leaders.map((p,i)=>`<tr data-player="${encodeURIComponent(p.name)}"><td>${i+1}. ${esc(p.name)}</td><td>${p.seasons}</td><td>${p.gp}</td><td class="hl">${p.pts}</td><td>${one(p.ppg)}</td><td>${p.high}</td></tr>`).join('');
  document.querySelectorAll('#historyLeaderboard tr[data-player]').forEach(tr=>tr.addEventListener('click',()=>{historyPlayer=decodeURIComponent(tr.dataset.player);renderPlayerHistory();sel.scrollIntoView({behavior:'smooth',block:'center'});}));

  if(playerSeasonChart) playerSeasonChart.destroy();
  playerSeasonChart=new Chart(document.getElementById('playerSeasonHistoryC'),{
    type:'bar',
    data:{labels:seasonRows.map(s=>s.season),datasets:[
      {type:'bar',label:'Pisteet',data:seasonRows.map(s=>s.pts),backgroundColor:'rgba(240,165,0,.32)',borderColor:'#f0a500',borderWidth:1,yAxisID:'y'},
      {type:'line',label:'PPG',data:seasonRows.map(s=>+s.ppg.toFixed(1)),borderColor:'#5b8dee',backgroundColor:'#5b8dee',tension:.25,pointRadius:4,yAxisID:'y1'}
    ]},
    options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#e8eaf0'}}},scales:{x:{ticks:{color:'#7a8090'},grid:{color:'#2a2f3e'}},y:{beginAtZero:true,ticks:{color:'#7a8090'},grid:{color:'#2a2f3e'},title:{display:true,text:'Pisteet',color:'#7a8090'}},y1:{beginAtZero:true,position:'right',ticks:{color:'#7a8090'},grid:{drawOnChartArea:false},title:{display:true,text:'PPG',color:'#7a8090'}}}}
  });

  if(playerCareerChart) playerCareerChart.destroy();
  playerCareerChart=new Chart(document.getElementById('playerCareerHistoryC'),{
    type:'line',
    data:{labels:games.map(g=>`${g.season} #${g.game}`),datasets:[{label:'Pisteet',data:games.map(g=>g.pts),borderColor:'#f0a500',backgroundColor:'rgba(240,165,0,.18)',fill:true,tension:.2,pointRadius:games.length>50?2:3}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:ctx=>{const g=games[ctx.dataIndex];return `${g.opp} · ${g.result||'–'}`;}}}},scales:{x:{ticks:{color:'#7a8090',maxRotation:0,autoSkip:true,maxTicksLimit:14},grid:{display:false}},y:{beginAtZero:true,ticks:{color:'#7a8090',precision:0},grid:{color:'#2a2f3e'}}}}
  });
}

function teamHistoryGames(){
  const map=new Map();
  historyRows().forEach(r=>{
    const season=r[COL.kausi]||'–', game=n(r[COL.ottelu]), key=`${season}__${game}`;
    if(!map.has(key)) map.set(key,{season,game,opp:r[COL.vastustaja]||'–',homeAway:r[COL.kotiv]||'',own:n(r[COL.omaPts]),oppPts:n(r[COL.vastPts]),result:resultCode(r)});
    const g=map.get(key);
    if(g.opp==='–' && r[COL.vastustaja]) g.opp=r[COL.vastustaja];
    if(!g.homeAway && r[COL.kotiv]) g.homeAway=r[COL.kotiv];
    if(!g.result) g.result=resultCode(r);
    if(!g.own && r[COL.omaPts]!=='' && r[COL.omaPts]!=null) g.own=n(r[COL.omaPts]);
    if(!g.oppPts && r[COL.vastPts]!=='' && r[COL.vastPts]!=null) g.oppPts=n(r[COL.vastPts]);
  });
  return [...map.values()].map(g=>({...g,margin:g.own-g.oppPts})).sort((a,b)=>seasonCmp(a.season,b.season)||a.game-b.game);
}

function teamSeasonRows(games){
  const map=new Map();
  games.forEach(g=>{
    if(!map.has(g.season)) map.set(g.season,{season:g.season,gp:0,w:0,l:0,pf:0,pa:0,high:0});
    const s=map.get(g.season); s.gp++; s.pf+=g.own; s.pa+=g.oppPts; s.high=Math.max(s.high,g.own);
    if(g.result==='W') s.w++; else if(g.result==='L') s.l++;
  });
  return [...map.values()].sort((a,b)=>seasonCmp(a.season,b.season)).map(s=>({...s,winPct:pct(s.w,s.w+s.l),pfpg:s.gp?s.pf/s.gp:0,papg:s.gp?s.pa/s.gp:0,diff:s.gp?(s.pf-s.pa)/s.gp:0}));
}

function longestStreak(games,type){
  let best=0,cur=0;
  games.forEach(g=>{if(g.result===type){cur++;best=Math.max(best,cur);}else cur=0;});
  return best;
}

function renderTeamHistory(){
  const target=document.getElementById('teamHistoryMetrics');
  if(!target) return;
  const games=teamHistoryGames(), seasonRows=teamSeasonRows(games);
  if(!games.length){target.innerHTML='<div class="history-empty">Ei historiadataa.</div>';return;}
  const w=games.filter(g=>g.result==='W').length,l=games.filter(g=>g.result==='L').length;
  const pf=games.reduce((a,g)=>a+g.own,0), pa=games.reduce((a,g)=>a+g.oppPts,0);
  target.innerHTML=[metricCard(seasonRows.length,'Kausia'),metricCard(games.length,'Otteluita'),metricCard(`${w}–${l}`,'W–L'),metricCard(`${pct(w,w+l)} %`,'Voittoprosentti'),metricCard(one(pf/games.length),'Pisteet / peli'),metricCard(one(pa/games.length),'Vast. / peli'),metricCard(`${(pf-pa)/games.length>=0?'+':''}${one((pf-pa)/games.length)}`,'Piste-ero / peli')].join('');

  document.getElementById('teamSeasonHistoryBody').innerHTML=seasonRows.slice().reverse().map(s=>`<tr><td>${esc(s.season)}</td><td>${s.w}–${s.l}</td><td>${one(s.winPct)} %</td><td>${one(s.pfpg)}</td><td>${one(s.papg)}</td><td class="${s.diff>0?'history-positive':s.diff<0?'history-negative':''}">${s.diff>=0?'+':''}${one(s.diff)}</td><td>${s.high}</td></tr>`).join('');

  const oppMap=new Map();
  games.forEach(g=>{
    if(!oppMap.has(g.opp)) oppMap.set(g.opp,{opp:g.opp,gp:0,w:0,l:0,pf:0,pa:0});
    const o=oppMap.get(g.opp);o.gp++;o.pf+=g.own;o.pa+=g.oppPts;if(g.result==='W')o.w++;else if(g.result==='L')o.l++;
  });
  const oppRows=[...oppMap.values()].map(o=>({...o,winPct:pct(o.w,o.w+o.l),diff:o.gp?(o.pf-o.pa)/o.gp:0})).sort((a,b)=>b.gp-a.gp||b.winPct-a.winPct||a.opp.localeCompare(b.opp,'fi'));
  document.getElementById('opponentHistoryBody').innerHTML=oppRows.map(o=>`<tr><td>${esc(o.opp)}</td><td>${o.gp}</td><td>${o.w}–${o.l}</td><td>${one(o.winPct)} %</td><td>${one(o.pf/o.gp)}</td><td>${one(o.pa/o.gp)}</td><td class="${o.diff>0?'history-positive':o.diff<0?'history-negative':''}">${o.diff>=0?'+':''}${one(o.diff)}</td></tr>`).join('');

  const biggestWin=[...games].filter(g=>g.margin>0).sort((a,b)=>b.margin-a.margin)[0];
  const biggestLoss=[...games].filter(g=>g.margin<0).sort((a,b)=>a.margin-b.margin)[0];
  const highScore=[...games].sort((a,b)=>b.own-a.own)[0];
  const lowAllowed=[...games].sort((a,b)=>a.oppPts-b.oppPts)[0];
  const recs=[
    {label:'Suurin voitto',value:biggestWin?`+${biggestWin.margin}`:'–',detail:biggestWin?`${biggestWin.season} #${biggestWin.game} vs ${biggestWin.opp} (${biggestWin.own}–${biggestWin.oppPts})`:''},
    {label:'Suurin tappio',value:biggestLoss?`${biggestLoss.margin}`:'–',detail:biggestLoss?`${biggestLoss.season} #${biggestLoss.game} vs ${biggestLoss.opp} (${biggestLoss.own}–${biggestLoss.oppPts})`:''},
    {label:'Eniten pisteitä',value:highScore?highScore.own:'–',detail:highScore?`${highScore.season} #${highScore.game} vs ${highScore.opp}`:''},
    {label:'Vähiten päästetty',value:lowAllowed?lowAllowed.oppPts:'–',detail:lowAllowed?`${lowAllowed.season} #${lowAllowed.game} vs ${lowAllowed.opp}`:''},
    {label:'Pisin voittoputki',value:longestStreak(games,'W'),detail:'ottelua'},
    {label:'Pisin tappioputki',value:longestStreak(games,'L'),detail:'ottelua'}
  ];
  document.getElementById('teamHistoryRecords').innerHTML=recs.map(r=>metricCard(r.value,r.label,r.detail)).join('');

  if(teamSeasonHistoryChart) teamSeasonHistoryChart.destroy();
  teamSeasonHistoryChart=new Chart(document.getElementById('teamSeasonHistoryC'),{
    type:'line',
    data:{labels:seasonRows.map(s=>s.season),datasets:[
      {label:'Voitto-%',data:seasonRows.map(s=>s.winPct),borderColor:'#3ecf8e',backgroundColor:'#3ecf8e',tension:.25,pointRadius:4,yAxisID:'y'},
      {label:'Piste-ero / peli',data:seasonRows.map(s=>+s.diff.toFixed(1)),borderColor:'#f0a500',backgroundColor:'#f0a500',tension:.25,pointRadius:4,yAxisID:'y1'}
    ]},
    options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#e8eaf0'}}},scales:{x:{ticks:{color:'#7a8090'},grid:{color:'#2a2f3e'}},y:{min:0,max:100,ticks:{color:'#7a8090',callback:v=>v+' %'},grid:{color:'#2a2f3e'},title:{display:true,text:'Voitto-%',color:'#7a8090'}},y1:{position:'right',ticks:{color:'#7a8090'},grid:{drawOnChartArea:false},title:{display:true,text:'Piste-ero / peli',color:'#7a8090'}}}}
  });
}
