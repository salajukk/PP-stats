const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const Logic=require(path.join(ROOT,'game','js','logic.js'));

function loadScenarios(){
  const context=vm.createContext({window:{}});
  const source=fs.readFileSync(path.join(ROOT,'game','js','scenarios.js'),'utf8');
  vm.runInContext(source,context,{filename:'game/js/scenarios.js'});
  return JSON.parse(JSON.stringify(context.window.SCENARIOS));
}

test('decision game has 20 valid scenarios with even role coverage',()=>{
  const scenarios=loadScenarios();
  assert.equal(scenarios.length,20);
  assert.deepEqual(Logic.validateScenarios(scenarios),[]);
  assert.deepEqual(Logic.countByRole(scenarios),{1:4,2:4,3:4,4:4,5:4});
});

test('decision scoring keeps intended speed thresholds and combo cap',()=>{
  assert.equal(Logic.speedScore(.99),100);
  assert.equal(Logic.speedScore(1),80);
  assert.equal(Logic.speedScore(2),60);
  assert.equal(Logic.speedScore(3),40);
  assert.equal(Logic.speedScore(5),20);
  assert.equal(Logic.comboBonus(10),50);
  assert.equal(Logic.comboBonus(100),50);
});

test('challenge queue produces 20 rounds without immediate repeats',()=>{
  const pool=loadScenarios().slice(0,4);
  let n=0;
  const queue=Logic.buildChallengeQueue(pool,20,()=>((n++*.37)%1));
  assert.equal(queue.length,20);
  for(let i=1;i<queue.length;i++)assert.notEqual(queue[i].id,queue[i-1].id);
});

test('PP Stats preview navigation links to the game subpage',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(html,/href="game\/"/);
  assert.match(html,/Päätöspeli/);
});

test('game page is mobile-first and loads logic before UI engine',()=>{
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/class="role-grid"/);
  assert.match(html,/id="feedbackSheet"/);
  assert.ok(html.indexOf('js/logic.js')<html.indexOf('js/scenarios.js'));
  assert.ok(html.indexOf('js/scenarios.js')<html.indexOf('js/game.js'));
});

test('mobile controls keep touch-sized targets and safe-area support',()=>{
  const css=fs.readFileSync(path.join(ROOT,'game','css','styles.css'),'utf8');
  assert.match(css,/touch-action:manipulation/);
  assert.match(css,/min-width:44px/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/safe-area-inset-bottom/);
});

test('game engine uses shared tested logic and phone haptics when supported',()=>{
  const js=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(js,/Logic\.speedScore/);
  assert.match(js,/Logic\.buildChallengeQueue/);
  assert.match(js,/navigator\.vibrate/);
  assert.match(js,/localStorage\.setItem/);
});