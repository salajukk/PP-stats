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
function puzzle(category,role='random'){
  return Generator.generatePuzzle({category,role,randomFn:seeded()});
}

test('left and right semantic side mappings match actual player locations',()=>{
  ['LEFT','RIGHT'].forEach(side=>{
    const s=Templates.sideData(side);
    const state=Templates.baseState(side);
    assert.equal(state.offense[s.slotPlayer].location,s.slot);
    assert.equal(state.offense[s.oppositeSlotPlayer].location,s.oppositeSlot);
    assert.equal(state.offense[s.wingPlayer].location,s.wing);
    assert.equal(state.offense[s.oppositeWingPlayer].location,s.oppositeWing);
  });
});

test('levels are not used and all eight core categories are available',()=>{
  const defs=Templates.list({role:'random'});
  assert.equal(defs.length,8);
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  const game=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.doesNotMatch(html,/data-level=/);
  assert.doesNotMatch(game,/selectedLevel|maxDifficulty/);
});

test('every generated archetype has at least three visible actions before first decision',()=>{
  Templates.CATEGORIES.forEach(category=>{
    const p=puzzle(category);
    assert.ok(p.prelude.length>=3,category+' prelude too short');
    assert.ok(p.prelude.every(e=>e.duration>=900),category+' contains a fast event');
  });
});

test('weighted random pool strongly favors possession chains',()=>{
  const defs=Templates.list({role:'random'});
  const pool=Generator.weightedDefinitions(defs);
  const continuation=pool.filter(d=>d.continuationPotential).length;
  assert.ok(continuation/pool.length>=0.75);
});

test('rule engine ranks thru cut over pass-and-stand',()=>{
  const p=puzzle('PASS_AND_CUT','1');
  const ranked=Rules.rankActions(p.decisionState);
  assert.equal(ranked[0].action.cutType,'THRU');
  assert.equal(ranked.find(x=>x.action.type==='HOLD').classification,'WRONG');
});

test('a correct pass-and-cut continues to a screen read in the same possession',()=>{
  const p=puzzle('PASS_AND_CUT','1');
  const best=p.rankedSolutions[0].action;
  const next=Rules.nextDecisionState(p.decisionState,best);
  assert.ok(next);
  assert.equal(next.transitionEvents.length,2);
  assert.ok(next.state.context.offBallScreen);
  assert.equal(next.state.decisionPlayer,p.decisionState.decisionPlayer);
});

test('off-ball screen reads change with defender behavior',()=>{
  assert.equal(puzzle('CURL_READ','3').rankedSolutions[0].action.cutType,'CURL');
  assert.equal(puzzle('POP_READ','3').rankedSolutions[0].action.cutType,'STRAIGHT');
  assert.equal(puzzle('BACKDOOR_READ','3').rankedSolutions[0].action.cutType,'BACKDOOR');
});

test('pop/straight can be selected by moving to the player current semantic spot',()=>{
  const p=puzzle('POP_READ','4');
  const player=p.decisionState.decisionPlayer;
  const ownLocation=p.decisionState.offense[player].location;
  const action=Rules.inferGestureAction(p.decisionState,{type:'MOVE',targetLocation:ownLocation},[]);
  assert.equal(action.type,'CUT');
  assert.equal(action.cutType,'STRAIGHT');
  assert.equal(action.targetLocation,ownLocation);
  assert.equal(Rules.evaluateActionObject(p.decisionState,action).selected.classification,'BEST');
});

test('correct screen read creates a second-cut decision',()=>{
  const p=puzzle('CURL_READ','3');
  const best=p.rankedSolutions[0].action;
  const next=Rules.nextDecisionState(p.decisionState,best);
  assert.ok(next);
  assert.ok(next.state.context.secondCut);
  assert.equal(next.state.decisionPlayer,p.decisionState.context.offBallScreen.screener);
  assert.equal(Rules.rankActions(next.state)[0].action.cutType,'POP');
});

test('post entry can produce four consecutive rule-engine decisions',()=>{
  const p=puzzle('POST_ENTRY','3');
  const postPass=p.rankedSolutions[0].action;
  assert.equal(postPass.type,'PASS');
  assert.equal(postPass.targetPlayer,'P5');

  const split=Rules.nextDecisionState(p.decisionState,postPass);
  assert.ok(split&&split.state.context.splitScreen);
  const splitScreen=Rules.rankActions(split.state)[0].action;
  assert.equal(splitScreen.type,'SCREEN');

  const cutterRead=Rules.nextDecisionState(split.state,splitScreen);
  assert.ok(cutterRead&&cutterRead.state.context.offBallScreen);
  const cutterAction=Rules.rankActions(cutterRead.state)[0].action;
  assert.equal(cutterAction.type,'CUT');

  const secondCut=Rules.nextDecisionState(cutterRead.state,cutterAction);
  assert.ok(secondCut&&secondCut.state.context.secondCut);
  assert.ok(Rules.rankActions(secondCut.state)[0].score>=75);
});

test('good post seal makes post entry the best first read',()=>{
  const p=puzzle('POST_ENTRY','3');
  assert.equal(p.rankedSolutions[0].action.type,'PASS');
  assert.equal(p.rankedSolutions[0].action.targetPlayer,'P5');
});

test('hedge/show ball screen creates roller pass priority',()=>{
  const p=puzzle('BALL_SCREEN_ROLLER_READ','1');
  assert.equal(p.rankedSolutions[0].action.type,'PASS');
  assert.equal(p.rankedSolutions[0].action.targetPlayer,'P5');
});

test('generated puzzles contain five-on-five state and computed ranking',()=>{
  Templates.CATEGORIES.forEach(category=>{
    const p=puzzle(category);
    assert.equal(Object.keys(p.decisionState.offense).length,5);
    assert.equal(Object.keys(p.decisionState.defense).length,5);
    assert.ok(p.rankedSolutions.length>=2);
    assert.ok(p.rankedSolutions[0].score>=75);
  });
});

test('classification scoring rewards best more than acceptable and wrong is negative',()=>{
  assert.ok(Logic.pointsForOutcome(1.5,'BEST',0)>Logic.pointsForOutcome(1.5,'ACCEPTABLE',0));
  assert.equal(Logic.pointsForOutcome(1.5,'WRONG',0),-30);
});

test('animation runtime has explicit cue, motion and settle beats',()=>{
  const source=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(source,/CUE_MS=450/);
  assert.match(source,/ACTION_MS=900/);
  assert.match(source,/STEP_PAUSE_MS=550/);
  assert.match(source,/var duration=event\.duration\|\|ACTION_MS/);
  assert.match(source,/transitionEvents/);
});

test('gesture UI stays field-driven and arrow-free',()=>{
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  const js=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(html,/data-intent="PASS"/);
  assert.match(html,/data-intent="MOVE"/);
  assert.doesNotMatch(html,/actionChoices|answerArrow|eventPath|choicePath/);
  assert.match(js,/LONG_PRESS_MS/);
  assert.match(js,/handleCourtPointerUp/);
  assert.match(js,/nearestSpot/);
  assert.match(js,/ownLocation.*commitIntent/s);
  assert.match(js,/animatePop/);
  assert.match(js,/oma pelaaja = pop\/straight/);
});

test('runtime stores attempts and schedules spaced repetition',()=>{
  const source=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(source,/mistakeType/);
  assert.match(source,/ppstats-motion-attempts-v2/);
  assert.match(source,/scheduleReview/);
  assert.match(source,/dueReview/);
});