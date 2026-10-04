const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const Logic=require(path.join(ROOT,'game','js','logic.js'));
const Rules=require(path.join(ROOT,'game','js','rules.js'));
const Templates=require(path.join(ROOT,'game','js','templates.js'));
const Generator=require(path.join(ROOT,'game','js','generator.js'));

function seeded(){
  let n=0;
  return()=>((n++*0.271828)%1);
}

function puzzle(category,role='random',level=3){
  return Generator.generatePuzzle({category,maxDifficulty:level,role,randomFn:seeded()});
}

test('rule engine ranks thru cut over pass-and-stand',()=>{
  const p=puzzle('PASS_AND_CUT','1',1);
  const ranked=Rules.rankActions(p.decisionState);
  assert.equal(ranked[0].action.cutType,'THRU');
  const hold=ranked.find(x=>x.action.type==='HOLD');
  assert.equal(hold.classification,'WRONG');
});

test('off-ball screen reads change with defender behavior',()=>{
  const curl=puzzle('CURL_READ','3',1);
  assert.equal(curl.rankedSolutions[0].action.cutType,'CURL');

  const pop=puzzle('POP_READ','3',1);
  assert.equal(pop.rankedSolutions[0].action.cutType,'STRAIGHT');

  const backdoor=puzzle('BACKDOOR_READ','3',2);
  assert.equal(backdoor.rankedSolutions[0].action.cutType,'BACKDOOR');
});

test('screener second cut uses read-opposite principle',()=>{
  const p=puzzle('SCREENER_SECOND_CUT','5',2);
  const cutterAction=p.decisionState.context.secondCut.cutterAction;
  const best=p.rankedSolutions[0].action.cutType;
  assert.equal(best,cutterAction==='CURL'?'POP':'ROLL');
});

test('good post seal makes post entry the best read',()=>{
  const p=puzzle('POST_ENTRY','3',2);
  const best=p.rankedSolutions[0].action;
  assert.equal(best.type,'PASS');
  assert.equal(best.targetPlayer,'P5');
});

test('hedge/show ball screen creates roller pass priority',()=>{
  const p=puzzle('BALL_SCREEN_ROLLER_READ','1',3);
  const best=p.rankedSolutions[0].action;
  assert.equal(best.type,'PASS');
  assert.equal(best.targetPlayer,'P5');
});

test('legacy all-at-once post split puzzle is no longer generated',()=>{
  assert.ok(!Templates.CATEGORIES.includes('POST_SPLIT_SEQUENCE'));
  assert.ok(!Templates.DEFINITIONS.some(d=>d.category==='POST_SPLIT_SEQUENCE'));
});

test('templates do not encode correctAction or rankedSolutions',()=>{
  const source=fs.readFileSync(path.join(ROOT,'game','js','templates.js'),'utf8');
  assert.doesNotMatch(source,/correctAction/);
  assert.doesNotMatch(source,/rankedSolutions/);
  assert.match(source,/SLOT_TO_WING_PASS/);
});

test('generated puzzles contain five-on-five state, prelude and computed ranking',()=>{
  Templates.CATEGORIES.forEach(category=>{
    const defs=Templates.DEFINITIONS.filter(d=>d.category===category);
    if(!defs.length)return;
    const p=Generator.generatePuzzle({category,maxDifficulty:3,role:'random',randomFn:seeded()});
    assert.equal(Object.keys(p.decisionState.offense).length,5);
    assert.equal(Object.keys(p.decisionState.defense).length,5);
    assert.ok(p.prelude.length>=1);
    assert.ok(p.rankedSolutions.length>=2);
    assert.ok(p.rankedSolutions[0].score>=75);
  });
});

test('advanced puzzles can contain multi-event setup before decision',()=>{
  const p=puzzle('BALL_SCREEN_ROLLER_READ','1',3);
  assert.ok(p.prelude.length>=4);
  assert.deepEqual(p.prelude.slice(-2).map(e=>e.type),['SCREEN','CUT']);
});

test('classification scoring rewards best more than acceptable and wrong is negative',()=>{
  assert.ok(Logic.pointsForOutcome(1.5,'BEST',0)>Logic.pointsForOutcome(1.5,'ACCEPTABLE',0));
  assert.equal(Logic.pointsForOutcome(1.5,'WRONG',0),-30);
});

test('game page loads rule engine, templates and generator before UI',()=>{
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  const rules=html.indexOf('js/rules.js');
  const templates=html.indexOf('js/templates.js');
  const generator=html.indexOf('js/generator.js');
  const game=html.indexOf('js/game.js');
  assert.ok(rules>0&&rules<templates&&templates<generator&&generator<game);
  assert.match(html,/id="defenseLayer"/);
  assert.match(html,/id="intentMenu"/);
  assert.doesNotMatch(html,/id="eventPath"/);
  assert.doesNotMatch(html,/id="choicePath"/);
  assert.doesNotMatch(html,/id="answerArrow"/);
});

test('mobile UI keeps touch targets and defender styling',()=>{
  const css=fs.readFileSync(path.join(ROOT,'game','css','styles.css'),'utf8');
  assert.match(css,/min-width:44px/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/\.defender/);
  assert.match(css,/safe-area-inset-bottom/);
});

test('post-entry setup is a readable three-step possession before the wing decision',()=>{
  const p=puzzle('POST_ENTRY','3',2);
  assert.deepEqual(p.prelude.map(e=>e.type),['PASS','GROUP','MOVE']);
  assert.ok(p.prelude.every(e=>e.duration>=600));
  const group=p.prelude[1];
  assert.equal(group.moves.length,3);
  assert.ok(group.moves.some(m=>Array.isArray(m.path)&&m.path.includes('RIM')));
  assert.equal(p.decisionState.ballHandler,p.decisionPlayer);
  assert.equal(p.decisionState.offense.P5.location,'LEFT_BLOCK');
});

test('best post entry creates a new split-screen decision in the same possession',()=>{
  const p=puzzle('POST_ENTRY','3',2);
  const best=p.rankedSolutions[0].action;
  assert.equal(best.type,'PASS');
  assert.equal(best.targetPlayer,'P5');
  const next=Rules.nextDecisionState(p.decisionState,best);
  assert.ok(next);
  assert.equal(next.state.ballHandler,'P5');
  assert.equal(next.state.decisionPlayer,p.decisionPlayer);
  assert.ok(next.state.context.splitScreen);
  const ranked=Rules.rankActions(next.state);
  assert.equal(ranked[0].action.type,'SCREEN');
  assert.equal(ranked[0].action.targetPlayer,next.state.context.splitScreen.screenTarget);
});

test('invalid free-space movement remains a wrong action instead of becoming a hidden menu choice',()=>{
  const p=puzzle('CURL_READ','3',1);
  const action=Rules.inferGestureAction(p.decisionState,{type:'MOVE',targetLocation:'LEFT_DUNKER'},[]);
  assert.equal(Rules.evaluateActionObject(p.decisionState,action).selected.classification,'WRONG');
});

test('gesture UI uses long press menu instead of candidate action list',()=>{
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  const js=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(html,/data-intent="PASS"/);
  assert.match(html,/data-intent="MOVE"/);
  assert.doesNotMatch(html,/id="actionChoices"/);
  assert.match(js,/LONG_PRESS_MS/);
  assert.match(js,/handleCourtPointerUp/);
  assert.match(js,/nearestSpot/);
  assert.match(js,/ACTION_MS=620/);
  assert.match(js,/Rules\.nextDecisionState/);
  assert.doesNotMatch(js,/showPath|eventPath|choicePath/);
});

test('runtime stores detailed attempts and schedules spaced repetition',()=>{
  const source=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(source,/mistakeType/);
  assert.match(source,/ppstats-motion-attempts-v2/);
  assert.match(source,/scheduleReview/);
  assert.match(source,/dueReview/);
});