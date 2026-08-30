let tblMode='yht', selectedSeasons=new Set(), activePlayer=null, activeOpp=null;
let sKeyP='pts', sDescP=true, sKeyO='label', sDescO=false;

const PLAYER_COLS=['pts','min','fgm','fga','fgpct','t2m','t2a','t2pct','t3m','t3a','t3pct','ftm','fta','ftpct','orb','drb','rb','ast','stl','blk','to','pf'];
const OPP_COLS=['oppPts','plr',...PLAYER_COLS];

function setTblMode(m){
  tblMode=m;
  document.querySelectorAll('#btnYht,#btnPPeli').forEach(b=>b.classList.toggle('active',(b.id==='btnYht')===(m==='yht')));
  renderBothTables();
}

function aggregateRows(rows,groupKey){
  const map={};
  rows.forEach(r=>{
    const raw=r[groupKey]; if(!raw) return;
    const key=groupKey===COL.vastustaja?`${r[COL.ottelu]}__${raw}`:raw;
    if(!map[key]) map[key]={
      label:raw, gameNum:n(r[COL.ottelu]), gp:new Set(), advGames:new Set(), minGames:new Set(),
      pts:0,min:0,fgm:0,fga:0,t3m:0,t3a:0,ftm:0,fta:0,orb:0,drb:0,rb:0,ast:0,stl:0,blk:0,to:0,pf:0,
      plr:new Set(), oppPts:n(r[COL.vastPts])
    };
    const m=map[key];
    m.gp.add(r[COL.ottelu]); m.pts+=n(r[COL.pisteet]);
    const mins=parseMinutes(r['Pl. Time']);
    if(mins!=null){ m.min+=mins; m.minGames.add(r[COL.ottelu]); }
    if(hasAdvancedStats(r)) m.advGames.add(r[COL.ottelu]);
    ['fgm','fga','t3m','t3a','ftm','fta','orb','drb','rb','ast','stl','blk','to','pf'].forEach(k=>m[k]+=n(r[COL[k]]));
    if(r[COL.nimi]) m.plr.add(r[COL.nimi]);
  });

  return Object.values(map).map(m=>{
    const div=(v,d)=>tblMode==='ppeli'?+(v/Math.max(d,1)).toFixed(1):+v.toFixed(1);
    const pct=(a,b)=>b?+(a/b*100).toFixed(1):'-';
    const adv=m.advGames.size>0, t2m=m.fgm-m.t3m, t2a=m.fga-m.t3a;
    return {
      label:m.label, displayLabel:groupKey===COL.vastustaja?`O${m.gameNum} ${m.label}`:m.label,
      gameNum:m.gameNum, gp:m.gp.size, oppPts:m.oppPts, plr:m.plr.size||'-',
      pts:div(m.pts,m.gp.size), min:m.minGames.size?div(m.min,m.minGames.size):'-',
      fgm:adv?div(m.fgm,m.advGames.size):'-', fga:adv?div(m.fga,m.advGames.size):'-', fgpct:adv?pct(m.fgm,m.fga):'-',
      t2m:adv?div(t2m,m.advGames.size):'-', t2a:adv?div(t2a,m.advGames.size):'-', t2pct:adv?pct(t2m,t2a):'-',
      t3m:adv?div(m.t3m,m.advGames.size):'-', t3a:adv?div(m.t3a,m.advGames.size):'-', t3pct:adv?pct(m.t3m,m.t3a):'-',
      ftm:adv?div(m.ftm,m.advGames.size):'-', fta:adv?div(m.fta,m.advGames.size):'-', ftpct:adv?pct(m.ftm,m.fta):'-',
      orb:adv?div(m.orb,m.advGames.size):'-', drb:adv?div(m.drb,m.advGames.size):'-', rb:adv?div(m.rb,m.advGames.size):'-',
      ast:adv?div(m.ast,m.advGames.size):'-', stl:adv?div(m.stl,m.advGames.size):'-', blk:adv?div(m.blk,m.advGames.size):'-',
      to:adv?div(m.to,m.advGames.size):'-', pf:adv?div(m.pf,m.advGames.size):'-',
      _raw:{gp:m.gp.size,adv:m.advGames.size,minGames:m.minGames.size,pts:m.pts,min:m.min,fgm:m.fgm,fga:m.fga,t3m:m.t3m,t3a:m.t3a,ftm:m.ftm,fta:m.fta,orb:m.orb,drb:m.drb,rb:m.rb,ast:m.ast,stl:m.stl,blk:m.blk,to:m.to,pf:m.pf,oppPts:m.oppPts}
    };
  });
}

function makeTotalRow(data,cols){
  const total={gp:0,oppPts:0,plr:'-'};
  cols.forEach(k=>total[k]=0);
  const counts={}; cols.forEach(k=>counts[k]=0);
  const raw={fgm:0,fga:0,t3m:0,t3a:0,ftm:0,fta:0};
  let hasMins=false;

  data.forEach(r=>{
    total.gp+=r.gp||0;
    raw.fgm+=r._raw?.fgm||0; raw.fga+=r._raw?.fga||0; raw.t3m+=r._raw?.t3m||0; raw.t3a+=r._raw?.t3a||0; raw.ftm+=r._raw?.ftm||0; raw.fta+=r._raw?.fta||0;
    cols.forEach(k=>{
      if(['fgpct','t2pct','t3pct','ftpct','plr','oppPts'].includes(k)) return;
      if(r[k]!=='-' && r[k]!=null){ total[k]=+(total[k]+Number(r[k])).toFixed(1); counts[k]++; if(k==='min') hasMins=true; }
    });
    if(r.oppPts!=='-' && r.oppPts!=null) total.oppPts=+(total.oppPts+Number(r.oppPts)).toFixed(1);
  });

  if(!hasMins) total.min='-';
  if(tblMode==='ppeli'){
    cols.forEach(k=>{
      if(['fgpct','t2pct','t3pct','ftpct','plr','oppPts'].includes(k)) return;
      if(total[k]!=='-' && counts[k]) total[k]=+(total[k]/counts[k]).toFixed(1);
    });
    if(data.length) total.oppPts=+(total.oppPts/data.length).toFixed(1);
  }

  const pct=(a,b)=>b?+(a/b*100).toFixed(1):'-';
  total.fgpct=pct(raw.fgm,raw.fga);
  total.t2pct=pct(raw.fgm-raw.t3m,raw.fga-raw.t3a);
  total.t3pct=pct(raw.t3m,raw.t3a);
  total.ftpct=pct(raw.ftm,raw.fta);
  return total;
}

function addTableCell(row,value,className=''){
  const td=document.createElement('td');
  td.textContent=value??'-';
  if(className) td.className=className;
  row.appendChild(td);
  return td;
}

function renderTable(data,tbodyId,cols,isOpp=false){
  const key=isOpp?sKeyO:sKeyP, desc=isOpp?sDescO:sDescP;
  data.sort((a,b)=>{
    const av=key==='label'?(isOpp?a.gameNum:a.label):(a[key]==='-'?-Infinity:a[key]);
    const bv=key==='label'?(isOpp?b.gameNum:b.label):(b[key]==='-'?-Infinity:b[key]);
    return typeof av==='string'?(desc?bv.localeCompare(av):av.localeCompare(bv)):(desc?bv-av:av-bv);
  });

  const max={};
  cols.forEach(c=>{ max[c]=Math.max(0,...data.map(r=>r[c]==='-'?0:Number(r[c])||0)); });
  const total=makeTotalRow(data,cols);
  const tbody=document.getElementById(tbodyId);
  tbody.replaceChildren();

  const totalRow=document.createElement('tr');
  totalRow.className='total-row';
  addTableCell(totalRow,'TOTAL');
  if(!isOpp) addTableCell(totalRow,total.gp);
  cols.forEach(c=>addTableCell(totalRow,total[c]??'-'));
  tbody.appendChild(totalRow);

  data.forEach(r=>{
    const rowKey=isOpp?`${r.gameNum}__${r.label}`:r.label;
    const active=isOpp?activeOpp===rowKey:activePlayer===r.label;
    const tr=document.createElement('tr');
    tr.style.cursor='pointer';
    if(active){
      tr.style.background='rgba(240,165,0,.12)';
      tr.style.outline='1px solid var(--accent)';
    }
    tr.addEventListener('click',()=>isOpp?clickOpp(rowKey):clickPlayer(r.label));

    const labelCell=addTableCell(tr,r.displayLabel);
    labelCell.style.whiteSpace='nowrap';
    if(!isOpp) addTableCell(tr,r.gp);
    cols.forEach(c=>{
      const highlight=r[c]!=='-' && Number(r[c])===max[c] && max[c]>0;
      addTableCell(tr,r[c],highlight?'hl':'');
    });
    tbody.appendChild(tr);
  });

  const tableId=isOpp?'oppTable':'playerTable';
  document.querySelectorAll(`#${tableId} th`).forEach(t=>t.classList.remove('sa','sd'));
  const keys=isOpp?['label',...cols]:['label','gp',...cols];
  const idx=keys.indexOf(key), ths=document.querySelectorAll(`#${tableId} th`);
  if(idx>=0&&ths[idx]) ths[idx].classList.add(desc?'sd':'sa');
}

function setTableHeading(id,label,detail='',showClear=false){
  const el=document.getElementById(id);
  el.replaceChildren(document.createTextNode(label));
  if(detail){
    el.appendChild(document.createTextNode(' '));
    const small=document.createElement('small');
    small.style.color='var(--accent)';
    small.textContent=`— ${detail}`;
    el.appendChild(small);
  }
  if(showClear){
    const badge=document.createElement('span');
    badge.className='filter-badge';
    badge.textContent='✕ Tyhjennä suodatin';
    badge.addEventListener('click',clearFilter);
    el.appendChild(badge);
  }
}

function renderBothTables(){
  const base=rowsForSelectedSeasons(selectedSeasons);
  const oppName=activeOpp?activeOpp.split('__').slice(1).join('__'):null;
  const oppGame=activeOpp?+activeOpp.split('__')[0]:null;
  const pRows=activeOpp?base.filter(r=>r[COL.vastustaja]===oppName && n(r[COL.ottelu])===oppGame):base;
  const oRows=activePlayer?base.filter(r=>r[COL.nimi]===activePlayer):base;
  renderTable(aggregateRows(pRows,COL.nimi),'tbP',PLAYER_COLS,false);
  renderTable(aggregateRows(oRows,COL.vastustaja),'tbO',OPP_COLS,true);

  setTableHeading('p1label','Pelaajat',oppName||'',Boolean(activePlayer||activeOpp));
  setTableHeading('p2label','Vastustajat',activePlayer||'',false);
}

function clickPlayer(name){ activePlayer=activePlayer===name?null:name; activeOpp=null; renderBothTables(); }
function clickOpp(key){ activeOpp=activeOpp===key?null:key; activePlayer=null; renderBothTables(); }
function clearFilter(event){ event?.stopPropagation(); activePlayer=null; activeOpp=null; renderBothTables(); }
function srtP(k){ if(sKeyP===k) sDescP=!sDescP; else{sKeyP=k;sDescP=true;} renderBothTables(); }
function srtO(k){ if(sKeyO===k) sDescO=!sDescO; else{sKeyO=k;sDescO=false;} renderBothTables(); }

function csvValue(v){
  const s=String(v??'');
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}

function downloadCSV(){
  const seas=[...selectedSeasons].sort();
  const rows=rowsForSelectedSeasons(selectedSeasons);
  const dateStr=new Date().toLocaleDateString('fi-FI');
  const meta=[
    '# PP Stats - Game-by-Game Player Statistics Export',
    '# Team: PP',
    `# Season(s): ${(seas.length?seas:[curSeason]).join(', ')}`,
    `# Exported: ${dateStr}`,
    '# Each row = one player\'s stats in one game. Regular season only.',
    '# Advanced_Stats: 1 = advanced stats recorded, 0 = not recorded.',
    ''
  ].join('\n');
  const headers=['Player','Game','Opponent','Home_Away','Result','Season','Team_Score','Opp_Score','Date','Minutes','Advanced_Stats','PTS','FGM','FGA','FG_pct','2PM','2PA','2P_pct','3PM','3PA','3P_pct','FTM','FTA','FT_pct','ORB','DRB','REB','AST','STL','BLK','TOV','PF'];
  const pct=(a,b)=>b?+(a/b*100).toFixed(1):'';
  const body=rows.map(r=>{
    const adv=hasAdvancedStats(r), fgm=n(r[COL.fgm]), fga=n(r[COL.fga]), t3m=n(r[COL.t3m]), t3a=n(r[COL.t3a]), ftm=n(r[COL.ftm]), fta=n(r[COL.fta]);
    const t2m=fgm-t3m, t2a=fga-t3a;
    return [
      r[COL.nimi]??'', r[COL.ottelu]??'', r[COL.vastustaja]??'', r[COL.kotiv]??'', r[COL.tulos]??'', r[COL.kausi]??'',
      r[COL.omaPts]??'', r[COL.vastPts]??'', r['Pvm']??'', parseMinutes(r['Pl. Time'])??'', adv?1:0, r[COL.pisteet]??0,
      adv?fgm:'', adv?fga:'', adv?pct(fgm,fga):'', adv?t2m:'', adv?t2a:'', adv?pct(t2m,t2a):'',
      adv?t3m:'', adv?t3a:'', adv?pct(t3m,t3a):'', adv?ftm:'', adv?fta:'', adv?pct(ftm,fta):'',
      adv?n(r[COL.orb]):'', adv?n(r[COL.drb]):'', adv?n(r[COL.rb]):'', adv?n(r[COL.ast]):'', adv?n(r[COL.stl]):'', adv?n(r[COL.blk]):'', adv?n(r[COL.to]):'', adv?n(r[COL.pf]):''
    ].map(csvValue).join(',');
  });
  const blob=new Blob([meta+[headers.join(','),...body].join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`PP_Stats_${(seas.length?seas:[curSeason]).join('_')}_${dateStr.replace(/\./g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
