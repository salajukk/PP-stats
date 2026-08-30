let r1='', r2='', tlSel=new Set(), tlMode='peli', rChart, tlChart, tmChart;
const RK=['PPG','RPG','APG','SPG','BPG','FGp','AT'];
const RL=['Pisteet','Levypallot','Syötöt','Riistot','Blokit','FG%','AST/TO'];

function norm(k,v){ const mx=Math.max(0,...players.map(p=>pStats[p]?.[k]||0)); return mx?Math.round(v/mx*100):0; }

function buildRadarChips(){
  [['c1',0],['c2',1]].forEach(([id,idx])=>{
    const el=document.getElementById(id); el.innerHTML='';
    players.forEach((p,i)=>{
      const b=document.createElement('button');
      b.className='chip'+(p===(idx?r2:r1)?' on':'');
      if(b.classList.contains('on')) b.style.background=PAL[i%PAL.length];
      b.textContent=p;
      b.onclick=()=>{ if(idx) r2=p; else r1=p; buildRadarChips(); buildRadar(); };
      el.appendChild(b);
    });
  });
}

function buildRadar(){
  if(!r1||!r2) return;
  const canvas=document.getElementById('radarC');
  const note=document.getElementById('radarNote');
  const missing=[r1,r2].filter(p=>!pStats[p]?.hasAdv);
  if(missing.length){
    rChart?.destroy(); rChart=null;
    canvas.style.display='none';
    note.style.display='block';
    note.textContent=`Pelaajaprofiili vaatii lisätilastot. Ei lisätilastoja: ${missing.join(', ')}.`;
    return;
  }
  canvas.style.display='block';
  note.style.display='none';
  rChart?.destroy();
  rChart=new Chart(canvas,{
    type:'radar',
    data:{labels:RL,datasets:[
      {label:r1,data:RK.map(k=>norm(k,pStats[r1]?.[k]||0)),borderColor:'#f0a500',backgroundColor:'rgba(240,165,0,.15)',pointBackgroundColor:'#f0a500',borderWidth:2},
      {label:r2,data:RK.map(k=>norm(k,pStats[r2]?.[k]||0)),borderColor:'#5b8dee',backgroundColor:'rgba(91,141,238,.15)',pointBackgroundColor:'#5b8dee',borderWidth:2}
    ]},
    options:{responsive:true,scales:{r:{min:0,max:100,ticks:{display:false},grid:{color:'rgba(255,255,255,.08)'},pointLabels:{color:'#e8eaf0'},angleLines:{color:'rgba(255,255,255,.08)'}}},plugins:{legend:{labels:{color:'#e8eaf0'}}}}
  });
}

function setTlMode(mode){
  tlMode=mode;
  document.querySelectorAll('#btnPeli,#btnKumu').forEach(b=>b.classList.toggle('active',(b.id==='btnPeli')===(mode==='peli')));
  buildTimeline();
}

function buildTlChips(){
  const el=document.getElementById('tlChips'); el.innerHTML='';
  players.forEach((p,i)=>{
    const b=document.createElement('button');
    b.className='chip'+(tlSel.has(p)?' on':'');
    if(tlSel.has(p)) b.style.background=PAL[i%PAL.length];
    b.textContent=p;
    b.onclick=()=>{ tlSel.has(p)?tlSel.delete(p):tlSel.add(p); buildTlChips(); buildTimeline(); };
    el.appendChild(b);
  });
}

function buildTimeline(){
  const gns=tGames.map(g=>n(g[COL.ottelu]));
  const labels=tGames.map(g=>`O${g[COL.ottelu]} ${(g[COL.vastustaja]||'').split(' ')[0]}`);
  const datasets=[...tlSel].map(p=>{
    const col=PAL[players.indexOf(p)%PAL.length];
    const vals=gns.map(gn=>(gData[p]||[]).find(d=>d.g===gn)?.pts??null);
    let sum=0;
    return {label:p,data:tlMode==='kumu'?vals.map(v=>v==null?null:(sum+=v)):vals,borderColor:col,backgroundColor:col+'33',pointBackgroundColor:col,tension:.3,spanGaps:true,borderWidth:2,pointRadius:5,pointHoverRadius:7};
  });

  let avgData;
  if(tlMode==='peli'){
    avgData=gns.map(gn=>{
      const pts=players.map(p=>(gData[p]||[]).find(d=>d.g===gn)?.pts??null).filter(v=>v!==null);
      return pts.length?+(pts.reduce((a,b)=>a+b,0)/pts.length).toFixed(1):null;
    });
  } else {
    let cum=0;
    avgData=gns.map(gn=>{
      const pts=players.map(p=>(gData[p]||[]).find(d=>d.g===gn)?.pts??null).filter(v=>v!==null);
      if(!pts.length) return null;
      cum+=pts.reduce((a,b)=>a+b,0)/pts.length;
      return +cum.toFixed(1);
    });
  }
  datasets.push({label:'Joukkueen ka.',data:avgData,borderColor:'rgba(255,255,255,0.4)',backgroundColor:'transparent',borderDash:[6,4],borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.3,spanGaps:true});

  tlChart?.destroy();
  tlChart=new Chart(document.getElementById('tlC'),{
    type:'line',data:{labels,datasets},
    options:{responsive:true,plugins:{legend:{labels:{color:'#e8eaf0'}},tooltip:{mode:'index',intersect:false}},scales:{x:{ticks:{color:'#7a8090',maxRotation:45,minRotation:30}},y:{ticks:{color:'#7a8090'},title:{display:true,text:tlMode==='kumu'?'Pisteet yhteensä':'Pisteet per peli',color:'#7a8090'}}}}
  });
}

function buildTeamChart(){
  const labels=tGames.map(g=>`O${g[COL.ottelu]} ${(g[COL.vastustaja]||'').split(' ')[0]}`);
  const ppC=tGames.map(g=>g[COL.tulos]==='Voitto'?'#3ecf8e':'#e05a2b');
  const opC=tGames.map(g=>g[COL.tulos]==='Voitto'?'rgba(62,207,142,.3)':'rgba(224,90,43,.4)');
  tmChart?.destroy();
  tmChart=new Chart(document.getElementById('teamC'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'PP Pisteet',data:tGames.map(g=>n(g[COL.omaPts])),backgroundColor:ppC,borderRadius:4},
      {label:'Vastustaja',data:tGames.map(g=>n(g[COL.vastPts])),backgroundColor:opC,borderRadius:4}
    ]},
    options:{responsive:true,plugins:{legend:{labels:{color:'#e8eaf0'}},tooltip:{callbacks:{title:ctx=>{const g=tGames[ctx[0].dataIndex];return `${g[COL.vastustaja]} (${g[COL.tulos]})`;}}}},scales:{x:{ticks:{color:'#7a8090'}},y:{ticks:{color:'#7a8090'},beginAtZero:true}}}
  });
}

function buildShooting(){
  const el=document.getElementById('sg'); el.innerHTML='';
  const adv=players.filter(p=>pStats[p].hasAdv);
  if(!adv.length){ el.innerHTML='<p style="color:var(--muted);padding:20px">Ei edistyneitä tilastoja tällä kaudella.</p>'; return; }
  adv.sort((a,b)=>pStats[b].FGp-pStats[a].FGp).forEach(p=>{
    const d=pStats[p];
    el.insertAdjacentHTML('beforeend',`<div class="sc"><div class="sc-name">${escapeHtml(p)}</div><div style="display:flex;gap:12px;margin-bottom:14px"><div><div class="big">${d.PPG}</div><div class="biglbl">PPG</div></div><div style="margin-left:auto;text-align:right"><div class="biglbl">${d.AdvPelit} lisätilastopeliä / ${d.Pelit} peliä</div><div class="biglbl">EFF ${d.EFF}</div></div></div><div class="bl"><span>FG%</span><span>${d.FGp}%</span></div><div class="bt"><div class="bf bfg" style="width:${d.FGp}%"></div></div><div class="bl"><span>3PT%</span><span>${d.P3p}%</span></div><div class="bt"><div class="bf b3p" style="width:${d.P3p}%"></div></div><div class="bl"><span>3PA/peli</span><span>${d.P3a}</span></div></div>`);
  });
}
