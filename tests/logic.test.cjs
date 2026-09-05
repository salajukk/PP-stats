const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function makeContext(files=['js/utils.js','js/data.js','js/history.js']){
  const context = vm.createContext({console});
  for(const file of files){
    const code = fs.readFileSync(path.join(ROOT,file),'utf8');
    vm.runInContext(code,context,{filename:file});
  }
  return context;
}

function setRows(context,rows){
  vm.runInContext(`allRows=${JSON.stringify(rows)};`,context);
}

test('numberOrNull preserves genuine zero and rejects missing values',()=>{
  const ctx=makeContext(['js/utils.js']);
  assert.equal(vm.runInContext('numberOrNull(0)',ctx),0);
  assert.equal(vm.runInContext("numberOrNull('0')",ctx),0);
  assert.equal(vm.runInContext("numberOrNull('')",ctx),null);
  assert.equal(vm.runInContext('numberOrNull(null)',ctx),null);
  assert.equal(vm.runInContext("numberOrNull('not-a-number')",ctx),null);
});

test('escapeHtml escapes untrusted text',()=>{
  const ctx=makeContext(['js/utils.js']);
  const input='<img src=x onerror="boom">&\'';
  const escaped=vm.runInContext(`escapeHtml(${JSON.stringify(input)})`,ctx);
  assert.equal(escaped,'&lt;img src=x onerror=&quot;boom&quot;&gt;&amp;&#39;');
});

test('advanced per-game stats use only games with advanced data',()=>{
  const ctx=makeContext();
  const rows=[
    {
      'Nimi':'A','Ottelunumero':1,'Vastustaja':'X','Pisteet':10,'Kausi':'2025-26','Sarja/Harjoitus':'Sarja',
      'FGM':4,'FGA':8,'3PTM':1,'3PTA':3,'FTM':1,'FTA':2,'RB':4,'AST':2,'STL':1,'BLK':0,'TO':1
    },
    {
      'Nimi':'A','Ottelunumero':2,'Vastustaja':'Y','Pisteet':20,'Kausi':'2025-26','Sarja/Harjoitus':'Sarja'
    }
  ];
  setRows(ctx,rows);
  vm.runInContext(`processSeason('2025-26')`,ctx);
  const stats=JSON.parse(vm.runInContext(`JSON.stringify(pStats['A'])`,ctx));
  assert.equal(stats.Pelit,2);
  assert.equal(stats.AdvPelit,1);
  assert.equal(stats.PPG,15);
  assert.equal(stats.RPG,4);
  assert.equal(stats.APG,2);
  assert.equal(stats.P3a,3);
  assert.equal(stats.EFF,11);
  assert.equal(stats.hasAdv,true);
});

test('players without advanced data expose advanced metrics as null',()=>{
  const ctx=makeContext();
  const rows=[
    {'Nimi':'B','Ottelunumero':1,'Vastustaja':'X','Pisteet':0,'Kausi':'2023-24','Sarja/Harjoitus':'Sarja'}
  ];
  setRows(ctx,rows);
  vm.runInContext(`processSeason('2023-24')`,ctx);
  const stats=JSON.parse(vm.runInContext(`JSON.stringify(pStats['B'])`,ctx));
  assert.equal(stats.PPG,0);
  assert.equal(stats.RPG,null);
  assert.equal(stats.FGp,null);
  assert.equal(stats.EFF,null);
  assert.equal(stats.hasAdv,false);
});

test('team history excludes games with missing scores from scoring averages',()=>{
  const ctx=makeContext();
  const rows=[
    {
      'Nimi':'A','Ottelunumero':1,'Vastustaja':'X','Pisteet':10,'Kausi':'2023-24','Sarja/Harjoitus':'Sarja',
      'Omat pisteet':70,'Vastustajan pisteet':60,'Lopputulos':'Voitto'
    },
    {
      'Nimi':'A','Ottelunumero':2,'Vastustaja':'Y','Pisteet':5,'Kausi':'2023-24','Sarja/Harjoitus':'Sarja',
      'Omat pisteet':'','Vastustajan pisteet':'','Lopputulos':'Tappio'
    }
  ];
  setRows(ctx,rows);
  const games=JSON.parse(vm.runInContext(`JSON.stringify(teamHistoryGames())`,ctx));
  assert.equal(games.length,2);
  assert.equal(games[1].own,null);
  assert.equal(games[1].oppPts,null);
  assert.equal(games[1].margin,null);

  const seasons=JSON.parse(vm.runInContext(`JSON.stringify(teamSeasonRows(teamHistoryGames()))`,ctx));
  assert.equal(seasons[0].gp,2);
  assert.equal(seasons[0].scoreGp,1);
  assert.equal(seasons[0].w,1);
  assert.equal(seasons[0].l,1);
  assert.equal(seasons[0].pfpg,70);
  assert.equal(seasons[0].papg,60);
  assert.equal(seasons[0].diff,10);
  assert.equal(seasons[0].high,70);
});

test('team history preserves a genuine 0 score',()=>{
  const ctx=makeContext();
  const rows=[{
    'Nimi':'A','Ottelunumero':1,'Vastustaja':'X','Pisteet':0,'Kausi':'2020-21','Sarja/Harjoitus':'Sarja',
    'Omat pisteet':0,'Vastustajan pisteet':10,'Lopputulos':'Tappio'
  }];
  setRows(ctx,rows);
  const game=JSON.parse(vm.runInContext(`JSON.stringify(teamHistoryGames()[0])`,ctx));
  assert.equal(game.own,0);
  assert.equal(game.oppPts,10);
  assert.equal(game.margin,-10);
});

test('history dates classify spring and autumn across sheet and ISO formats',()=>{
  const ctx=makeContext();
  assert.equal(vm.runInContext(`historyHalfFromDate('15/02/2024')`,ctx),'spring');
  assert.equal(vm.runInContext(`historyHalfFromDate('09/10/2016')`,ctx),'autumn');
  assert.equal(vm.runInContext(`historyHalfFromDate('2025-03-12T00:00:00.000Z')`,ctx),'spring');
  assert.equal(vm.runInContext(`historyHalfFromDate('2025-09-12T00:00:00.000Z')`,ctx),'autumn');
  assert.equal(vm.runInContext(`historyHalfFromDate('')`,ctx),'');
});

test('history filters combine season half and result',()=>{
  const ctx=makeContext();
  const games=[
    {half:'spring',result:'W'},
    {half:'spring',result:'L'},
    {half:'autumn',result:'W'}
  ];
  const count=vm.runInContext(`filterHistoryGames(${JSON.stringify(games)},{half:'spring',result:'W'}).length`,ctx);
  assert.equal(count,1);
  const autumn=vm.runInContext(`filterHistoryGames(${JSON.stringify(games)},{half:'autumn',result:'all'}).length`,ctx);
  assert.equal(autumn,1);
});

test('team history calculates unique players per game and players per game by season',()=>{
  const ctx=makeContext();
  const rows=[
    {'Nimi':'A','Ottelunumero':1,'Vastustaja':'X','Pisteet':5,'Kausi':'2024-25','Sarja/Harjoitus':'Sarja','Pvm':'10/10/2024','Lopputulos':'Voitto'},
    {'Nimi':'B','Ottelunumero':1,'Vastustaja':'X','Pisteet':7,'Kausi':'2024-25','Sarja/Harjoitus':'Sarja','Pvm':'10/10/2024','Lopputulos':'Voitto'},
    {'Nimi':'A','Ottelunumero':2,'Vastustaja':'Y','Pisteet':6,'Kausi':'2024-25','Sarja/Harjoitus':'Sarja','Pvm':'15/02/2025','Lopputulos':'Tappio'},
    {'Nimi':'B','Ottelunumero':2,'Vastustaja':'Y','Pisteet':8,'Kausi':'2024-25','Sarja/Harjoitus':'Sarja','Pvm':'15/02/2025','Lopputulos':'Tappio'},
    {'Nimi':'C','Ottelunumero':2,'Vastustaja':'Y','Pisteet':3,'Kausi':'2024-25','Sarja/Harjoitus':'Sarja','Pvm':'15/02/2025','Lopputulos':'Tappio'}
  ];
  setRows(ctx,rows);
  const games=JSON.parse(vm.runInContext(`JSON.stringify(teamHistoryGames())`,ctx));
  assert.equal(games[0].playerCount,2);
  assert.equal(games[1].playerCount,3);
  assert.equal(games[0].half,'autumn');
  assert.equal(games[1].half,'spring');
  const seasons=JSON.parse(vm.runInContext(`JSON.stringify(teamSeasonRows(teamHistoryGames()))`,ctx));
  assert.equal(seasons[0].playersPerGame,2.5);
});

test('HTML loads shared utilities before application modules',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.ok(html.indexOf('js/utils.js') < html.indexOf('js/data.js'));
});

test('history filter controls and PLR/G column are present',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(html,/playerHistoryHalfSel/);
  assert.match(html,/playerHistoryResultSel/);
  assert.match(html,/teamHistoryHalfSel/);
  assert.match(html,/teamHistoryResultSel/);
  assert.match(html,/PLR\/G/);
});

test('dynamic table rows use DOM event listeners instead of inline onclick HTML',()=>{
  const source=fs.readFileSync(path.join(ROOT,'js/tables.js'),'utf8');
  assert.match(source,/addEventListener\('click'/);
  assert.doesNotMatch(source,/onclick=\\"\$\{/);
});

test('escapeHtml has a single shared definition',()=>{
  const files=['js/utils.js','js/data.js','js/charts.js','js/tables.js','js/history.js','js/app.js'];
  const count=files.reduce((sum,file)=>{
    const source=fs.readFileSync(path.join(ROOT,file),'utf8');
    return sum+(source.match(/function escapeHtml\s*\(/g)||[]).length;
  },0);
  assert.equal(count,1);
});
