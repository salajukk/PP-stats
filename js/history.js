let historyPlayer='';
let playerSeasonChart=null, playerCareerChart=null, teamSeasonHistoryChart=null;

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
  const own=numberOrNull(r[COL.omaPts]), opp=numberOrNull(r[COL.vastPts]);
  if(own!=null && opp!=null){
    if(own>opp) return 'W';
    if(own<opp) return 'L';
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
  return `<div class="history-metric"><div class="history-value">${escapeHtml(value)}</div><div class="history-label">${escapeHtml(label)}</div>${detail?`<div class="history-detail">${escapeHtml(detail)}</div>`:''}</div>`;
}

function renderPlayerHistory(){
  const sel=document.getElementById('historyPlayerSel');
  if(!sel) return;
  const names=allHistoryPlayers();
  if(!names.length){ document.getElementById('playerHistoryContent').innerHTML='<div class="history-empty">Ei historiadataa.</div>'; return; }
  if(!historyPlayer || !names.includes(historyPlayer)) historyPlayer=names[0];
  sel.innerHTML=names.map(p=>`<option value="${escapeHtml(p)}"${p===historyPlayer?' selected':''}>${escapeHtml(p)}</option>`).join('');
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

  document.getElementById('playerSeasonBody').innerHTML=seasonRows.slice().reverse().map(s=>`<tr><td>${escapeHtml(s.season)}</td><td>${s.gp}</td><td>${s.pts}</td><td>${one(s.ppg)}</td><td>${s.high}</td><td>${s.w}–${s.l}</td></tr>`).join('');

  const top=[...games].sort((a,b)=>b.pts-a.pts||seasonCmp(b.season,a.season)||b.game-a.game).slice(0,10);
  document.getElementById('playerTopGamesBody').innerHTML=top.map((g,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(g.season)}</td><td>#${g.game}</td><td>${escapeHtml(g.opp)}</td><td>${escapeHtml(g.homeAway||'–')}</td><td>${escapeHtml(g.result||'–')}</td><td class="hl">${g.pts}</td></tr>`).join('');

  const leaders=playerLeaderboard();
  document.getElementById('historyLeaderboard').innerHTML=leaders.map((p,i)=>`<tr data-player="${encodeURIComponent(p.name)}"><td>${i+1}. ${escapeHtml(p.name)}</td><td>${p.seasons}</td><td>${p.gp}</td><td class="hl">${p.pts}</td><td>${one(p.ppg)}</td><td>${p.high}</td></tr>`).join('');
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
    const own=numberOrNull(r[COL.omaPts]), oppPts=numberOrNull(r[COL.vastPts]);
    if(!map.has(key)) map.set(key,{season,game,opp:r[COL.vastustaja]||'–',homeAway:r[COL.kotiv]||'',own,oppPts,result:resultCode(r)});
    const g=map.get(key);
    if(g.opp==='–' && r[COL.vastustaja]) g.opp=r[COL.vastustaja];
    if(!g.homeAway && r[COL.kotiv]) g.homeAway=r[COL.kotiv];
    if(!g.result) g.result=resultCode(r);
    if(g.own==null && own!=null) g.own=own;
    if(g.oppPts==null && oppPts!=null) g.oppPts=oppPts;
  });
  return [...map.values()]
    .map(g=>({...g,margin:g.own!=null&&g.oppPts!=null?g.own-g.oppPts:null}))
    .sort((a,b)=>seasonCmp(a.season,b.season)||a.game-b.game);
}

function teamSeasonRows(games){
  const map=new Map();
  games.forEach(g=>{
    if(!map.has(g.season)) map.set(g.season,{season:g.season,gp:0,scoreGp:0,w:0,l:0,pf:0,pa:0,high:null});
    const s=map.get(g.season);
    s.gp++;
    if(g.result==='W') s.w++; else if(g.result==='L') s.l++;
    if(g.own!=null && g.oppPts!=null){
      s.scoreGp++;
      s.pf+=g.own;
      s.pa+=g.oppPts;
      s.high=s.high==null?g.own:Math.max(s.high,g.own);
    }
  });
  return [...map.values()].sort((a,b)=>seasonCmp(a.season,b.season)).map(s=>({
    ...s,
    winPct:pct(s.w,s.w+s.l),
    pfpg:s.scoreGp?s.pf/s.scoreGp:null,
    papg:s.scoreGp?s.pa/s.scoreGp:null,
    diff:s.scoreGp?(s.pf-s.pa)/s.scoreGp:null
  }));
}

function longestStreak(games,type){
  let best=0,cur=0;
  games.forEach(g=>{if(g.result===type){cur++;best=Math.max(best,cur);}else cur=0;});
  return best;
}

function diffText(v){
  if(!Number.isFinite(v)) return '–';
  return `${v>=0?'+':''}${one(v)}`;
}

function renderTeamHistory(){
  const target=document.getElementById('teamHistoryMetrics');
  if(!target) return;
  const games=teamHistoryGames(), seasonRows=teamSeasonRows(games);
  if(!games.length){target.innerHTML='<div class="history-empty">Ei historiadataa.</div>';return;}
  const w=games.filter(g=>g.result==='W').length,l=games.filter(g=>g.result==='L').length;
  const scored=games.filter(g=>g.own!=null&&g.oppPts!=null);
  const pf=scored.reduce((a,g)=>a+g.own,0), pa=scored.reduce((a,g)=>a+g.oppPts,0);
  const pfpg=scored.length?pf/scored.length:null, papg=scored.length?pa/scored.length:null;
  const diff=scored.length?(pf-pa)/scored.length:null;
  target.innerHTML=[
    metricCard(seasonRows.length,'Kausia'),metricCard(games.length,'Otteluita'),metricCard(`${w}–${l}`,'W–L'),
    metricCard(`${pct(w,w+l)} %`,'Voittoprosentti'),metricCard(one(pfpg),'Pisteet / peli'),
    metricCard(one(papg),'Vast. / peli'),metricCard(diffText(diff),'Piste-ero / peli')
  ].join('');

  document.getElementById('teamSeasonHistoryBody').innerHTML=seasonRows.slice().reverse().map(s=>{
    const cls=Number.isFinite(s.diff)?(s.diff>0?'history-positive':s.diff<0?'history-negative':''):'';
    return `<tr><td>${escapeHtml(s.season)}</td><td>${s.w}–${s.l}</td><td>${one(s.winPct)} %</td><td>${one(s.pfpg)}</td><td>${one(s.papg)}</td><td class="${cls}">${diffText(s.diff)}</td><td>${s.high??'–'}</td></tr>`;
  }).join('');

  const oppMap=new Map();
  games.forEach(g=>{
    if(!oppMap.has(g.opp)) oppMap.set(g.opp,{opp:g.opp,gp:0,scoreGp:0,w:0,l:0,pf:0,pa:0});
    const o=oppMap.get(g.opp);
    o.gp++;
    if(g.result==='W')o.w++;else if(g.result==='L')o.l++;
    if(g.own!=null && g.oppPts!=null){o.scoreGp++;o.pf+=g.own;o.pa+=g.oppPts;}
  });
  const oppRows=[...oppMap.values()].map(o=>({
    ...o,
    winPct:pct(o.w,o.w+o.l),
    pfpg:o.scoreGp?o.pf/o.scoreGp:null,
    papg:o.scoreGp?o.pa/o.scoreGp:null,
    diff:o.scoreGp?(o.pf-o.pa)/o.scoreGp:null
  })).sort((a,b)=>b.gp-a.gp||b.winPct-a.winPct||a.opp.localeCompare(b.opp,'fi'));
  document.getElementById('opponentHistoryBody').innerHTML=oppRows.map(o=>{
    const cls=Number.isFinite(o.diff)?(o.diff>0?'history-positive':o.diff<0?'history-negative':''):'';
    return `<tr><td>${escapeHtml(o.opp)}</td><td>${o.gp}</td><td>${o.w}–${o.l}</td><td>${one(o.winPct)} %</td><td>${one(o.pfpg)}</td><td>${one(o.papg)}</td><td class="${cls}">${diffText(o.diff)}</td></tr>`;
  }).join('');

  const biggestWin=[...games].filter(g=>g.margin!=null&&g.margin>0).sort((a,b)=>b.margin-a.margin)[0];
  const biggestLoss=[...games].filter(g=>g.margin!=null&&g.margin<0).sort((a,b)=>a.margin-b.margin)[0];
  const highScore=[...games].filter(g=>g.own!=null).sort((a,b)=>b.own-a.own)[0];
  const lowAllowed=[...games].filter(g=>g.oppPts!=null).sort((a,b)=>a.oppPts-b.oppPts)[0];
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
      {label:'Piste-ero / peli',data:seasonRows.map(s=>Number.isFinite(s.diff)?+s.diff.toFixed(1):null),borderColor:'#f0a500',backgroundColor:'#f0a500',tension:.25,pointRadius:4,yAxisID:'y1'}
    ]},
    options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#e8eaf0'}}},scales:{x:{ticks:{color:'#7a8090'},grid:{color:'#2a2f3e'}},y:{min:0,max:100,ticks:{color:'#7a8090',callback:v=>v+' %'},grid:{color:'#2a2f3e'},title:{display:true,text:'Voitto-%',color:'#7a8090'}},y1:{position:'right',ticks:{color:'#7a8090'},grid:{drawOnChartArea:false},title:{display:true,text:'Piste-ero / peli',color:'#7a8090'}}}}
  });
}
