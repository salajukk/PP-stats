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
function puzzle(category){
  return Generator.generatePuzzle({category,randomFn:seeded()});
}

test('rule library contains offensive movement plus explicit wing-to-slot reversal',()=>{
  assert.deepEqual(Rules.RULE_LIBRARY,[
    'PASSER_MUST_MOVE','WING_TO_SLOT_BALL_REVERSAL','SLOT_TO_WING_THRU_CUT','EMPTY_SLOT_FILL','PERIMETER_ROTATION',
    'SLOT_TO_SLOT_EXCHANGE','P5_WEAK_SIDE_POSITION','P5_SLOT_TO_WING_RELOCATION',
    'P5_BALL_SCREEN_MOVEMENT','STRONG_SIDE_SHAKE','WEAK_SIDE_EXCHANGE',
    'SCREENER_SECOND_CUT','DRIVE_SPACING'
  ]);
});

test('there are exactly 15 first-version puzzle archetypes',()=>{
  assert.equal(Templates.CATEGORIES.length,15);
  assert.equal(Templates.DEFINITIONS.length,15);
  Templates.CATEGORIES.forEach(category=>assert.ok(Templates.DEFINITIONS.some(d=>d.category===category)));
});

test('game state has five offensive players and no defense model',()=>{
  const p=puzzle('THRU_CUT');
  assert.equal(Object.keys(p.decisionState.offense).length,5);
  assert.equal('defense' in p.decisionState,false);
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  assert.doesNotMatch(html,/defenseLayer|Puolustaja|Read the Defense/i);
});

test('slot to wing creates thru-cut, two fills and P5 relocation',()=>{
  const p=puzzle('THRU_CUT');
  const all=p.allReactions;
  assert.equal(all.length,4);
  assert.equal(all[0].rule,'SLOT_TO_WING_THRU_CUT');
  assert.equal(all[0].movement,'THRU_CUT');
  assert.deepEqual(all[0].path[0],'RIM');
  assert.equal(all[1].rule,'EMPTY_SLOT_FILL');
  assert.equal(all[2].rule,'PERIMETER_ROTATION');
  assert.equal(all[3].rule,'P5_SLOT_TO_WING_RELOCATION');
});

test('full thru-cut chain restores four unique perimeter spots',()=>{
  const p=puzzle('THRU_CUT');
  let s=Generator.clone(p.decisionState);
  p.reactionQueue.forEach(r=>{s=Rules.applyReaction(s,r);});
  assert.equal(Rules.validateSpacing(s).standard4Out,true);
});

test('first fill and second fill are derived from the same rule-engine chain',()=>{
  const first=puzzle('FIRST_FILL');
  const second=puzzle('SECOND_FILL');
  assert.equal(first.reactionQueue[0].rule,'EMPTY_SLOT_FILL');
  assert.equal(second.reactionQueue[0].rule,'PERIMETER_ROTATION');
  assert.ok(first.playbackEvents.length>first.initialState.history.length);
  assert.ok(second.playbackEvents.length>first.playbackEvents.length);
});

test('completed rotation asks for spacing confirmation after applying all reactions',()=>{
  const p=puzzle('COMPLETED_ROTATION');
  assert.equal(p.reactionQueue.length,1);
  assert.equal(p.reactionQueue[0].type,'CONFIRM');
  assert.equal(Rules.validateSpacing(p.decisionState).standard4Out,true);
  assert.equal(Rules.evaluateInput(p.reactionQueue[0],{type:'CONFIRM'},p.decisionState).correct,true);
});

test('wing-to-slot pass continues with slot-to-opposite-slot ball reversal, never immediate ball screen',()=>{
  const s=Templates.sideData('LEFT');
  const state=Templates.baseState(s.wingPlayer);
  const event={type:'PASS',fromPlayer:s.wingPlayer,toPlayer:s.slotPlayer};
  const next=Rules.getBallContinuation(state,event);
  assert.ok(next);
  assert.equal(next.rule,'WING_TO_SLOT_BALL_REVERSAL');
  assert.equal(next.fromPlayer,s.slotPlayer);
  assert.equal(state.offense[next.toPlayer].location,s.oppositeSlot);
  assert.notEqual(next.type,'SCREEN');
});

test('slot-to-slot pass creates screen, wing fill and legal exchange-or-slip choice',()=>{
  const p=puzzle('SLOT_EXCHANGE');
  assert.equal(p.allReactions.length,3);
  assert.equal(p.allReactions[0].type,'SCREEN');
  assert.equal(p.allReactions[0].rule,'SLOT_TO_SLOT_EXCHANGE');
  assert.equal(p.allReactions[1].movement,'FILL');
  assert.equal(p.allReactions[2].type,'CHOICE');
  assert.deepEqual(p.allReactions[2].options.map(o=>o.movement),['EXCHANGE','SLIP']);
});

test('both exchange and slip are accepted for the slot-to-slot screener decision',()=>{
  const p=puzzle('SLOT_EXCHANGE');
  const choice=p.allReactions[2];
  const exchange=choice.options.find(o=>o.movement==='EXCHANGE');
  const slip=choice.options.find(o=>o.movement==='SLIP');
  assert.equal(Rules.evaluateInput(choice,{type:'MOVE',player:choice.player,targetLocation:exchange.targetLocation},p.decisionState).correct,true);
  assert.equal(Rules.evaluateInput(choice,{type:'MOVE',player:choice.player,targetLocation:slip.targetLocation},p.decisionState).correct,true);
});

test('slip outcome is randomized only after player chooses slip',()=>{
  const p=puzzle('SLOT_EXCHANGE');
  const choice=p.allReactions[2];
  const slip=choice.options.find(o=>o.movement==='SLIP');
  let state=Generator.clone(p.decisionState);
  state=Rules.applyReaction(state,p.allReactions[0]);
  state=Rules.applyReaction(state,p.allReactions[1]);
  state=Rules.applyReaction(state,slip);

  const getsPass=Generator.resolveChoiceOutcome(state,choice,slip,()=>0.1);
  assert.equal(getsPass.outcome,'SLIP_PASS');
  assert.equal(getsPass.events[0].type,'PASS');
  assert.equal(getsPass.reactions.length,0);

  const noPass=Generator.resolveChoiceOutcome(state,choice,slip,()=>0.9);
  assert.equal(noPass.outcome,'SLIP_NO_PASS');
  assert.equal(noPass.events[0].type,'WAIT');
  assert.equal(noPass.reactions[0].movement,'FILL');
  assert.equal(noPass.reactions[0].targetLocation,choice.meta.fallbackWing);
});

test('exchange choice does not invoke a random follow-up event',()=>{
  const p=puzzle('SLOT_EXCHANGE');
  const choice=p.allReactions[2];
  const exchange=choice.options.find(o=>o.movement==='EXCHANGE');
  const outcome=Generator.resolveChoiceOutcome(p.decisionState,choice,exchange,()=>0.1);
  assert.equal(outcome.outcome,'EXCHANGE');
  assert.equal(outcome.events.length,0);
  assert.equal(outcome.reactions.length,0);
});

test('P5 weak-side setup contains wing-to-slot followed by slot-to-slot reversal',()=>{
  const p=puzzle('P5_WEAK_SIDE');
  assert.equal(p.reactionQueue.length,1);
  assert.equal(p.trigger.type,'BALL_TO_SLOT');
  assert.equal(p.playbackEvents[0].type,'PASS');
  assert.equal(p.playbackEvents[1].type,'PASS');
  assert.equal(p.playbackEvents[0].toPlayer,p.playbackEvents[1].fromPlayer);
  assert.equal(p.reactionQueue[0].player,'P5');
  assert.equal(p.reactionQueue[0].rule,'P5_WEAK_SIDE_POSITION');
});

test('ball-screen setup first completes wing-slot, slot-slot reversal and slot-wing exchange',()=>{
  const p=puzzle('BALL_SCREEN');
  assert.equal(p.playbackEvents[0].type,'PASS');
  assert.equal(p.playbackEvents[1].type,'PASS');
  assert.equal(p.playbackEvents[2].type,'SCREEN');
  assert.equal(p.playbackEvents[3].movement,'FILL');
  assert.equal(p.playbackEvents[4].movement,'EXCHANGE');
  assert.equal(p.playbackEvents[5].player,'P5');
  assert.equal(p.playbackEvents[5].movement,'RELOCATE');
});

test('ball-screen trigger creates screen, shake, weak-side exchange pair and roll',()=>{
  const p=puzzle('BALL_SCREEN');
  const rules=p.allReactions.map(r=>r.rule);
  assert.deepEqual(rules,[
    'P5_BALL_SCREEN_MOVEMENT',
    'STRONG_SIDE_SHAKE',
    'WEAK_SIDE_EXCHANGE',
    'WEAK_SIDE_EXCHANGE',
    'P5_BALL_SCREEN_MOVEMENT'
  ]);
  assert.equal(p.allReactions[0].type,'SCREEN');
  assert.equal(p.allReactions[4].movement,'ROLL');
});

test('shake, weak-side exchange and roll puzzles start at their rule-derived stages',()=>{
  assert.equal(puzzle('SHAKE').reactionQueue[0].rule,'STRONG_SIDE_SHAKE');
  assert.equal(puzzle('WEAK_SIDE_EXCHANGE').reactionQueue[0].rule,'WEAK_SIDE_EXCHANGE');
  assert.equal(puzzle('ROLL').reactionQueue[0].movement,'ROLL');
});

test('cutter inside makes screener pop and cutter outside makes screener dive',()=>{
  const curl=puzzle('CUTTER_CURL');
  const pop=puzzle('CUTTER_POP');
  assert.equal(curl.reactionQueue[0].movement,'POP');
  assert.equal(pop.reactionQueue[0].movement,'DIVE');
  assert.equal(pop.reactionQueue[0].targetLocation,'RIM');
});

test('baseline drive makes opposite wing drift to opposite corner',()=>{
  const p=puzzle('BASELINE_DRIVE');
  const r=p.reactionQueue[0];
  assert.equal(r.rule,'DRIVE_SPACING');
  assert.equal(r.movement,'DRIFT');
  assert.ok(/_CORNER$/.test(r.targetLocation));
});

test('occupied-spot answers are not accepted unless they equal the required reaction',()=>{
  const p=puzzle('FIRST_FILL');
  const expected=p.reactionQueue[0];
  const wrong={type:'MOVE',player:expected.player,targetLocation:'RIGHT_WING'};
  assert.equal(Rules.evaluateInput(expected,wrong,p.decisionState).correct,false);
  const right={type:'MOVE',player:expected.player,targetLocation:expected.targetLocation};
  assert.equal(Rules.evaluateInput(expected,right,p.decisionState).correct,true);
});

test('templates contain triggers, not hard-coded correct-answer fields',()=>{
  const source=fs.readFileSync(path.join(ROOT,'game','js','templates.js'),'utf8');
  assert.doesNotMatch(source,/correctAction|rankedSolutions|bestAction/);
  assert.match(source,/SLOT_TO_WING_PASS/);
  assert.match(source,/BALL_SCREEN_START/);
  assert.match(source,/OFF_BALL_CUTTER_MOVE/);
});

test('game interaction is direct court movement without action menu or defense UI',()=>{
  const html=fs.readFileSync(path.join(ROOT,'game','index.html'),'utf8');
  const game=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.doesNotMatch(html,/intentMenu|data-intent|defensePrompt|defenseLayer/);
  assert.match(game,/submitInput\(\{type:"MOVE"/);
  assert.match(game,/submitInput\(\{type:"SCREEN"/);
  assert.match(game,/Generator\.resolveChoiceOutcome/);
  assert.match(html,/confirmSpacingBtn/);
});

test('ball-screen family has lower random weight than the core motion families',()=>{
  const defs=Templates.DEFINITIONS;
  const bs=defs.filter(d=>['BALL_SCREEN','SHAKE','WEAK_SIDE_EXCHANGE','ROLL'].includes(d.category))
    .reduce((sum,d)=>sum+d.weight,0);
  const core=defs.filter(d=>['THRU_CUT','SLOT_EXCHANGE'].includes(d.category))
    .reduce((sum,d)=>sum+d.weight,0);
  assert.ok(bs<core);
});

test('animation pacing is deliberately slow and staged',()=>{
  const game=fs.readFileSync(path.join(ROOT,'game','js','game.js'),'utf8');
  assert.match(game,/CUE_MS=650/);
  assert.match(game,/ACTION_MS=1050/);
  assert.match(game,/SETTLE_MS=650/);
  assert.match(game,/CONTINUE_MS=800/);
});

test('scoring is binary movement correctness rather than best-good-acceptable ranking',()=>{
  assert.ok(Logic.pointsForAnswer(2,true,0)>0);
  assert.equal(Logic.pointsForAnswer(2,false,0),-30);
  const rules=fs.readFileSync(path.join(ROOT,'game','js','rules.js'),'utf8');
  assert.doesNotMatch(rules,/BEST|GOOD|ACCEPTABLE|screenCoverage|denyLevel/);
});
