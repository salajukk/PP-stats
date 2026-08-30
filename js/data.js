const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyDbxGfzz3nuDHoqRB6rTy9tYj1vDWbPW159O2OQzsmEfRFCnN92h_bp6qfAMwFo4vMA/exec';
const PAL = ['#f0a500','#5b8dee','#3ecf8e','#e05a2b','#c084fc','#f472b6','#34d399','#fb923c','#60a5fa','#a78bfa','#fbbf24','#4ade80'];
const COL = {
  nimi:'Nimi', ottelu:'Ottelunumero', vastustaja:'Vastustaja', pisteet:'Pisteet',
  kotiv:'Koti/Vieras', tulos:'Lopputulos', kausi:'Kausi', sarja:'Sarja/Harjoitus',
  omaPts:'Omat pisteet', vastPts:'Vastustajan pisteet', fgm:'FGM', fga:'FGA',
  t3m:'3PTM', t3a:'3PTA', ftm:'FTM', fta:'FTA', orb:'ORB', drb:'DRB', rb:'RB',
  ast:'AST', stl:'STL', blk:'BLK', to:'TO', pf:'PF'
};

let allRows=[], seasons=[], curSeason='', pStats={}, gData={}, tGames=[], players=[];

function n(v){ return (v==null || v==='' || isNaN(v)) ? 0 : +v; }

function hasAdvancedStats(r){
  return [COL.fgm,COL.fga,COL.t3m,COL.t3a,COL.ftm,COL.fta,COL.orb,COL.drb,COL.rb,COL.ast,COL.stl,COL.blk,COL.to,COL.pf]
    .some(k => r[k] !== null && r[k] !== undefined && r[k] !== '');
}

function parseMinutes(v){
  if(v==null || v==='' || v===0) return null;
  if(typeof v==='number') return +(v*24*60).toFixed(1);
  const s=String(v).trim();
  if(!s) return null;

  // The current Apps Script serializes a Sheets duration as a date around 1899
  // and shifts local Helsinki midnight to 22:00Z. Convert back to local clock
  // time and wrap at 24h, so e.g. 22:43:29Z becomes 43.5 minutes.
  const iso=s.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if(iso){
    const h=+iso[1], m=+iso[2], sec=+iso[3];
    const total=(h*60+m+sec/60+120)%1440;
    return +total.toFixed(1);
  }

  const p=s.split(':').map(Number);
  if(p.length===3 && p.every(Number.isFinite)) return +(p[0]*60+p[1]+p[2]/60).toFixed(1);
  if(p.length===2 && p.every(Number.isFinite)) return +(p[0]*60+p[1]).toFixed(1);
  return null;
}

async function loadData(){
  const res=await fetch(APPS_SCRIPT_URL);
  if(!res.ok) throw new Error('HTTP '+res.status);
  allRows=await res.json();
  if(!Array.isArray(allRows)) throw new Error('Rajapinta ei palauttanut taulukkomuotoista dataa.');
  seasons=[...new Set(allRows.map(r=>r[COL.kausi]).filter(Boolean))].sort().reverse();
  curSeason=seasons[0]||'';
  processSeason(curSeason);
}

function seasonRows(season=curSeason){
  return allRows.filter(r=>r[COL.kausi]===season && r[COL.sarja]==='Sarja');
}

function processSeason(s){
  const rows=seasonRows(s), games={};
  rows.forEach(r=>{ if(!games[r[COL.ottelu]]) games[r[COL.ottelu]]=r; });
  tGames=Object.values(games).sort((a,b)=>n(a[COL.ottelu])-n(b[COL.ottelu]));

  const pm={};
  rows.forEach(r=>{
    const nm=r[COL.nimi]; if(!nm) return;
    if(!pm[nm]) pm[nm]={
      games:new Set(), pts:0,
      advGames:new Set(), advPts:0, fgm:0,fga:0,t3m:0,t3a:0,ftm:0,fta:0,
      rb:0,ast:0,stl:0,blk:0,to:0
    };
    const p=pm[nm];
    p.games.add(r[COL.ottelu]);
    p.pts+=n(r[COL.pisteet]);

    if(hasAdvancedStats(r)){
      p.advGames.add(r[COL.ottelu]);
      p.advPts+=n(r[COL.pisteet]);
      p.fgm+=n(r[COL.fgm]); p.fga+=n(r[COL.fga]); p.t3m+=n(r[COL.t3m]); p.t3a+=n(r[COL.t3a]);
      p.ftm+=n(r[COL.ftm]); p.fta+=n(r[COL.fta]); p.rb+=n(r[COL.rb]); p.ast+=n(r[COL.ast]);
      p.stl+=n(r[COL.stl]); p.blk+=n(r[COL.blk]); p.to+=n(r[COL.to]);
    }
  });

  pStats={};
  for(const [nm,p] of Object.entries(pm)){
    const gamesAll=p.games.size||1;
    const advGames=p.advGames.size;
    const eff=advGames
      ? p.advPts+p.rb+p.ast+p.stl+p.blk-p.to-(p.fga-p.fgm)-(p.fta-p.ftm)
      : 0;
    pStats[nm]={
      Pelit:p.games.size,
      AdvPelit:advGames,
      PPG:+(p.pts/gamesAll).toFixed(1),
      RPG:advGames?+(p.rb/advGames).toFixed(1):null,
      APG:advGames?+(p.ast/advGames).toFixed(1):null,
      SPG:advGames?+(p.stl/advGames).toFixed(1):null,
      BPG:advGames?+(p.blk/advGames).toFixed(1):null,
      FGp:advGames?(p.fga?+(p.fgm/p.fga*100).toFixed(1):0):null,
      P3p:advGames?(p.t3a?+(p.t3m/p.t3a*100).toFixed(1):0):null,
      P3a:advGames?+(p.t3a/advGames).toFixed(1):null,
      AT:advGames?(p.to?+(p.ast/p.to).toFixed(2):0):null,
      EFF:advGames?+(eff/advGames).toFixed(1):null,
      hasAdv:advGames>0
    };
  }

  gData={};
  rows.forEach(r=>{
    const nm=r[COL.nimi]; if(!nm) return;
    (gData[nm]??=[]).push({g:n(r[COL.ottelu]),pts:n(r[COL.pisteet]),opp:r[COL.vastustaja]});
  });
  Object.values(gData).forEach(a=>a.sort((a,b)=>a.g-b.g));
  players=Object.keys(pStats).sort();
}

function rowsForSelectedSeasons(selected){
  const ss=selected?.size?[...selected]:[curSeason];
  return allRows.filter(r=>ss.includes(r[COL.kausi]) && r[COL.sarja]==='Sarja');
}
