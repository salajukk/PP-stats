(function(){
  "use strict";

  var Logic=window.GameLogic;
  var Rules=window.GameRules;
  var Generator=window.PuzzleGenerator;
  var LONG_PRESS_MS=430;
  var CUE_MS=450;
  var ACTION_MS=900;
  var STEP_PAUSE_MS=550;
  var CONTINUE_PAUSE_MS=750;
  var ROLES={P1:"PG",P2:"SG",P3:"SF",P4:"PF",P5:"C"};
  var CATEGORY_LABELS={
    PASS_AND_CUT:"PASS & CUT",FILL:"FILL",CURL_READ:"SCREEN · CURL",POP_READ:"SCREEN · POP",
    BACKDOOR_READ:"BACKDOOR",SCREENER_SECOND_CUT:"SECOND CUT",POST_ENTRY:"POST ENTRY",BALL_SCREEN_ROLLER_READ:"PNR · ROLLER"
  };
  var SPOTS={
    LEFT_SLOT:{x:32,y:74},RIGHT_SLOT:{x:68,y:74},LEFT_WING:{x:14,y:49},RIGHT_WING:{x:86,y:49},
    LEFT_BLOCK:{x:40,y:24},RIGHT_BLOCK:{x:60,y:24},LEFT_DUNKER:{x:34,y:17},RIGHT_DUNKER:{x:66,y:17},
    LEFT_HIGH_POST:{x:42,y:39},RIGHT_HIGH_POST:{x:58,y:39},RIM:{x:50,y:11},
    LEFT_CORNER:{x:8,y:20},RIGHT_CORNER:{x:92,y:20},LEFT_SHAKE:{x:23,y:58},RIGHT_SHAKE:{x:77,y:58}
  };

  var selectedRole="random",selectedMode="practice";
  var state=freshState();
  var el={};
  [
    "setupScreen","playScreen","resultsScreen","startBtn","exitBtn","resultsBackBtn","replayBtn","categoryLabel","roundLabel",
    "roleBadge","score","streak","timer","triggerState","eventCounter","triggerText","decisionHint","court","spotsLayer","defenseLayer",
    "playersLayer","ball","tapMarker","intentMenu","actionPrompt","defensePrompt","gestureStatus","cancelIntentBtn","chainStatus",
    "possessionStatus","feedbackBackdrop","feedbackSheet","feedbackEyebrow","feedbackTitle","feedbackTime","selectedActionText",
    "feedbackText","bestReadBox","nextBtn","resultScore","resultBestReads","resultGood","resultAcceptable","resultMisses","resultAvg","resultStreak"
  ].forEach(function(id){el[id]=document.getElementById(id);});

  document.querySelectorAll("[data-role]").forEach(function(button){
    button.addEventListener("click",function(){selectedRole=button.dataset.role;activateGroup("[data-role]",button);});
  });
  document.querySelectorAll("[data-mode]").forEach(function(button){
    button.addEventListener("click",function(){selectedMode=button.dataset.mode;activateGroup("[data-mode]",button);});
  });
  document.querySelectorAll("[data-intent]").forEach(function(button){
    button.addEventListener("pointerdown",function(e){e.stopPropagation();});
    button.addEventListener("click",function(e){e.stopPropagation();selectIntent(button.dataset.intent);});
  });

  el.startBtn.addEventListener("click",startGame);
  el.exitBtn.addEventListener("click",returnToSetup);
  el.resultsBackBtn.addEventListener("click",returnToSetup);
  el.replayBtn.addEventListener("click",startGame);
  el.nextBtn.addEventListener("click",nextRound);
  el.cancelIntentBtn.addEventListener("click",cancelIntent);
  el.court.addEventListener("pointerup",handleCourtPointerUp);
  buildSpots();

  function freshState(){
    return{
      puzzle:null,displayState:null,decisionState:null,decisionLabel:"",teachingPoint:"",
      round:0,decisionNumber:0,score:0,streak:0,bestStreak:0,times:[],
      counts:{BEST:0,GOOD:0,ACCEPTABLE:0,POOR:0,WRONG:0},
      accepting:false,startedAt:0,timer:null,pressTimer:null,gestureMode:null,reviewQueue:[],roundToken:0
    };
  }

  function activateGroup(selector,active){
    document.querySelectorAll(selector).forEach(function(item){item.classList.toggle("active",item===active);});
  }

  function startGame(){
    clearTimers();closeFeedback();state=freshState();
    el.setupScreen.classList.add("hidden");el.resultsScreen.classList.add("hidden");el.playScreen.classList.remove("hidden");
    nextRound();
  }

  async function nextRound(){
    clearTimers();closeFeedback();clearInteraction();
    if(selectedMode==="challenge"&&state.round>=20){finishChallenge();return;}
    state.round+=1;state.decisionNumber=0;state.roundToken+=1;
    var token=state.roundToken;
    var review=dueReview();
    state.puzzle=Generator.generatePuzzle({role:selectedRole,category:review?review.category:null});
    state.displayState=Generator.clone(state.puzzle.initialState);
    state.decisionState=Generator.clone(state.puzzle.decisionState);
    state.decisionLabel=state.puzzle.decisionLabel;
    state.teachingPoint=state.puzzle.teachingPoint;
    state.accepting=false;

    el.categoryLabel.textContent=CATEGORY_LABELS[state.puzzle.category]||state.puzzle.category;
    el.roundLabel.textContent=selectedMode==="challenge"?"Challenge · "+state.round+"/20":"Practice · "+state.round;
    el.triggerState.textContent="TILANNE";el.triggerState.classList.remove("live");
    el.triggerText.textContent="Katso rauhassa koko possession.";el.decisionHint.textContent="";
    el.actionPrompt.textContent="Seuraa tapahtumia yksi kerrallaan…";el.defensePrompt.textContent="";
    el.gestureStatus.textContent="Päätös tulee vasta animaation jälkeen.";
    el.chainStatus.classList.add("hidden");el.possessionStatus.classList.add("hidden");el.timer.textContent="—";

    renderCourt(true);
    await wait(700);
    for(var i=0;i<state.puzzle.prelude.length;i++){
      if(token!==state.roundToken)return;
      await animateEvent(state.puzzle.prelude[i],"VAIHE "+(i+1)+"/"+state.puzzle.prelude.length);
      state.displayState=Generator.applyEvent(state.displayState,state.puzzle.prelude[i]);
      updateCourt();
      await wait(STEP_PAUSE_MS);
    }
    if(token!==state.roundToken)return;
    await wait(350);
    beginDecision();
  }

  async function animateEvent(event,counterText){
    var duration=event.duration||ACTION_MS;
    el.eventCounter.textContent=counterText||"";
    el.triggerText.textContent=event.label;
    clearEventFocus();

    if(event.type==="PASS"){
      focusPlayer(event.fromPlayer);focusPlayer(event.toPlayer);
      await wait(CUE_MS);
      var target=state.displayState.offense[event.toPlayer];
      if(target&&SPOTS[target.location])moveBallToPoint(SPOTS[target.location],duration);
      await wait(duration);
      clearEventFocus();return;
    }

    if(event.type==="GROUP"){
      var moves=event.moves||[];
      moves.forEach(function(move){focusPlayer(move.player);});
      await wait(CUE_MS);
      await animateGroupMoves(moves,duration);
      clearEventFocus();return;
    }

    if(event.type==="MOVE"||event.type==="CUT"){
      focusPlayer(event.player);
      await wait(CUE_MS);
      var path=(event.path||[]).slice();if(event.to)path=[event.to];
      await animatePlayerPath(event.player,path,duration);
      clearEventFocus();return;
    }

    if(event.type==="SCREEN"){
      focusPlayer(event.player);focusPlayer(event.targetPlayer);
      await wait(CUE_MS);
      await animateScreen(event.player,event.targetPlayer,duration);
      clearEventFocus();return;
    }

    await wait(CUE_MS+duration);
  }

  async function animateGroupMoves(moves,duration){
    await Promise.all(moves.map(function(move){
      var path=(move.path||[]).slice();if(move.to)path=[move.to];
      return animatePlayerPath(move.player,path,duration);
    }));
  }

  async function animatePlayerPath(playerId,path,totalDuration){
    var node=playerNode(playerId);if(!node||!path.length)return;
    var segment=totalDuration/path.length;
    for(var i=0;i<path.length;i++){
      var loc=path[i];if(!SPOTS[loc])continue;
      setTransition(node,segment);
      node.style.left=SPOTS[loc].x+"%";node.style.top=SPOTS[loc].y+"%";
      await wait(segment);
    }
    setTransition(node,ACTION_MS);
  }

  async function animatePop(playerId,location,duration){
    var node=playerNode(playerId),base=SPOTS[location];
    if(!node||!base){await wait(duration);return;}
    var rim=SPOTS.RIM,dx=base.x-rim.x,dy=base.y-rim.y;
    var length=Math.sqrt(dx*dx+dy*dy)||1;
    var offset=8;
    var popPoint={
      x:Math.max(6,Math.min(94,base.x+dx/length*offset)),
      y:Math.max(14,Math.min(90,base.y+dy/length*offset))
    };
    var outMs=Math.round(duration*.62),backMs=duration-outMs;
    setTransition(node,outMs);
    node.style.left=popPoint.x+"%";node.style.top=popPoint.y+"%";
    await wait(outMs);
    setTransition(node,backMs);
    node.style.left=base.x+"%";node.style.top=base.y+"%";
    await wait(backMs);
    setTransition(node,ACTION_MS);
  }

  async function animateScreen(playerId,targetId,duration){
    var screener=playerNode(playerId),target=playerNode(targetId);
    if(!screener||!target){await wait(duration);return;}
    var tx=parseFloat(target.style.left),ty=parseFloat(target.style.top),sx=parseFloat(screener.style.left);
    setTransition(screener,duration);
    screener.style.left=(tx+(sx<tx?-5:5))+"%";screener.style.top=(ty+4)+"%";
    screener.classList.add("screening");target.classList.add("screen-link");
    await wait(duration);
    screener.classList.remove("screening");target.classList.remove("screen-link");
  }

  function beginDecision(){
    state.decisionNumber+=1;
    state.displayState=Generator.clone(state.decisionState);
    state.accepting=true;clearInteraction();updateCourt();

    el.roleBadge.textContent=ROLES[state.decisionState.decisionPlayer]||state.decisionState.decisionPlayer;
    el.triggerState.textContent="PÄÄTÖS "+state.decisionNumber;el.triggerState.classList.add("live");
    el.eventCounter.textContent="";
    el.triggerText.textContent=state.decisionLabel;
    el.decisionHint.textContent="Päätöksentekijä: "+state.decisionState.decisionPlayer+" · "+ROLES[state.decisionState.decisionPlayer];
    el.actionPrompt.textContent="Tee ratkaisu kentällä";
    el.defensePrompt.textContent=defenseReadText(state.decisionState);
    el.gestureStatus.textContent="Pidä keltaista SINÄ-pelaajaa pohjassa.";
    el.possessionStatus.classList.toggle("hidden",state.decisionNumber===1);
    if(state.decisionNumber>1)el.possessionStatus.textContent="Sama possession jatkuu · päätös "+state.decisionNumber;
    state.startedAt=performance.now();
    state.timer=window.setInterval(updateTimer,33);
  }

  function renderCourt(initial){
    if(initial){
      el.playersLayer.innerHTML="";el.defenseLayer.innerHTML="";
      Object.keys(state.displayState.offense).forEach(function(id){
        var p=document.createElement("button");p.type="button";p.className="player";p.dataset.player=id;
        p.innerHTML="<span>"+id.replace("P","")+"</span><small>"+ROLES[id]+"</small>";
        bindPlayerEvents(p,id);el.playersLayer.appendChild(p);
      });
      Object.keys(state.displayState.defense).forEach(function(id){
        var d=document.createElement("div");d.className="defender";d.dataset.defender=id;
        d.innerHTML="<span>"+id+"</span><small></small>";el.defenseLayer.appendChild(d);
      });
    }
    updateCourt();
  }

  function bindPlayerEvents(node,id){
    node.addEventListener("pointerdown",function(e){
      if(!state.accepting||id!==state.decisionState.decisionPlayer||state.gestureMode)return;
      e.preventDefault();e.stopPropagation();clearPressTimer();node.classList.add("holding");
      state.pressTimer=window.setTimeout(function(){node.classList.remove("holding");openIntentMenu(node);vibrate(8);},LONG_PRESS_MS);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(function(type){
      node.addEventListener(type,function(){node.classList.remove("holding");clearPressTimer();});
    });
    node.addEventListener("click",function(e){
      e.stopPropagation();
      if(!state.accepting||!state.gestureMode)return;
      if(id===state.decisionState.decisionPlayer){
        if(state.gestureMode==="MOVE"){
          var ownLocation=state.decisionState.offense[id]&&state.decisionState.offense[id].location;
          if(ownLocation)commitIntent({type:"MOVE",targetLocation:ownLocation});
        }
        return;
      }
      if(state.gestureMode==="PASS")commitIntent({type:"PASS",targetPlayer:id});
      else if(state.gestureMode==="MOVE")commitIntent({type:"SCREEN",targetPlayer:id});
    });
  }

  function openIntentMenu(node){
    if(!state.accepting)return;
    cancelIntent();
    var left=Math.max(23,Math.min(77,parseFloat(node.style.left)));
    var top=Math.max(23,Math.min(77,parseFloat(node.style.top)));
    el.intentMenu.style.left=left+"%";el.intentMenu.style.top=top+"%";
    var hasBall=state.displayState.ballHandler===state.decisionState.decisionPlayer;
    el.intentMenu.querySelector('[data-intent="PASS"]').disabled=!hasBall;
    el.intentMenu.querySelector('[data-intent="DRIVE"]').disabled=!hasBall;
    el.intentMenu.querySelector('[data-intent="SHOOT"]').disabled=!hasBall;
    el.intentMenu.classList.remove("hidden");
    el.gestureStatus.textContent=hasBall?"Valitse syötä, aja, liiku tai heitä.":"Valitse Liiku. Pelaajaan liikkuminen = screen.";
  }

  function selectIntent(mode){
    el.intentMenu.classList.add("hidden");
    if(mode==="DRIVE"||mode==="SHOOT"){
      commitAction(Rules.inferGestureAction(state.decisionState,{type:mode},[]));return;
    }
    state.gestureMode=mode;el.cancelIntentBtn.classList.remove("hidden");
    if(mode==="PASS"){el.gestureStatus.textContent="SYÖTTÖ · Napauta joukkuetoveria.";markPlayerTargets();}
    else{el.gestureStatus.textContent="LIIKE · Tyhjä tila = liike · joukkuetoveri = screen · oma pelaaja = pop/straight.";markMoveTargets();}
  }

  function handleCourtPointerUp(e){
    if(!state.accepting||state.gestureMode!=="MOVE")return;
    if(e.target.closest(".player,.intent-menu,.intent,.cancel-intent"))return;
    var rect=el.court.getBoundingClientRect();
    var x=(e.clientX-rect.left)/rect.width*100,y=(e.clientY-rect.top)/rect.height*100;
    showTapMarker(x,y);
    commitIntent({type:"MOVE",targetLocation:nearestSpot(x,y)});
  }

  function commitIntent(intent){
    cancelIntent();
    commitAction(Rules.inferGestureAction(state.decisionState,intent,[]));
  }

  async function commitAction(action){
    if(!state.accepting)return;
    state.accepting=false;
    if(state.timer)window.clearInterval(state.timer);state.timer=null;
    var elapsed=(performance.now()-state.startedAt)/1000;
    var evaluation=Rules.evaluateActionObject(state.decisionState,action);
    var selected=evaluation.selected,best=evaluation.best,classification=selected.classification;
    var points=Logic.pointsForOutcome(elapsed,classification,state.streak);

    el.triggerState.textContent="VALINTA";
    el.triggerText.textContent=Rules.describeAction(action);
    await wait(CUE_MS);
    await animateAction(action);
    applyActionToDisplay(action);
    await wait(STEP_PAUSE_MS);

    state.times.push(elapsed);state.counts[classification]+=1;state.score+=points;
    if(classification==="BEST"||classification==="GOOD"){
      state.streak+=1;state.bestStreak=Math.max(state.bestStreak,state.streak);
    }else state.streak=0;
    updateHud();

    saveAttempt({
      category:state.puzzle.category,classification:classification,responseTime:elapsed,
      selectedAction:action.id||action.type,bestAction:best?best.action.id:null,
      mistakeType:Rules.mistakeType(state.decisionState,selected,best),at:Date.now()
    });

    var continuation=(classification==="BEST"||classification==="GOOD")
      ?Rules.nextDecisionState(state.decisionState,action)
      :null;

    if(continuation){
      el.triggerState.textContent="OIKEIN";
      el.triggerText.textContent="Hyvä read. Possession jatkuu.";
      el.possessionStatus.textContent="✓ "+Rules.describeAction(action)+" · seuraava tilanne rakentuu";
      el.possessionStatus.classList.remove("hidden");

      var transitions=continuation.transitionEvents||[];
      for(var i=0;i<transitions.length;i++){
        await wait(STEP_PAUSE_MS);
        await animateEvent(transitions[i],"JATKO "+(i+1)+"/"+transitions.length);
        state.displayState=Generator.applyEvent(state.displayState,transitions[i]);
        updateCourt();
      }

      state.decisionState=continuation.state;
      state.decisionLabel=continuation.decisionLabel;
      state.teachingPoint=continuation.teachingPoint;
      await wait(CONTINUE_PAUSE_MS);
      beginDecision();
      return;
    }

    if(selectedMode==="practice"&&(classification==="ACCEPTABLE"||classification==="POOR"||classification==="WRONG")){
      scheduleReview(state.puzzle.category);
    }

    if(classification!=="BEST"&&best){
      el.triggerState.textContent="PARAS READ";el.triggerText.textContent=Rules.describeAction(best.action);
      await wait(CONTINUE_PAUSE_MS);
      state.displayState=Generator.clone(state.decisionState);updateCourt();
      await wait(CUE_MS);
      await animateAction(best.action);
      await wait(STEP_PAUSE_MS);
    }
    openFeedback(classification,points,elapsed,{action:action},best);
  }

  async function animateAction(action){
    if(action.type==="SEQUENCE"){
      for(var i=0;i<action.steps.length;i++){await animateAction(action.steps[i]);await wait(STEP_PAUSE_MS);}return;
    }
    if(action.type==="PASS"){
      focusPlayer(action.player);focusPlayer(action.targetPlayer);
      var target=state.displayState.offense[action.targetPlayer];
      if(target&&SPOTS[target.location])moveBallToPoint(SPOTS[target.location],ACTION_MS);
      await wait(ACTION_MS);clearEventFocus();return;
    }
    if(action.type==="CUT"||action.type==="FILL"){
      focusPlayer(action.player);
      var currentLocation=state.displayState.offense[action.player]&&state.displayState.offense[action.player].location;
      var sameSpotCut=action.type==="CUT"&&(action.cutType==="STRAIGHT"||action.cutType==="POP")&&currentLocation===action.targetLocation;
      if(sameSpotCut)await animatePop(action.player,action.targetLocation,ACTION_MS);
      else await animatePlayerPath(action.player,(action.path&&action.path.length?action.path:[action.targetLocation]),ACTION_MS);
      clearEventFocus();return;
    }
    if(action.type==="SCREEN"){
      focusPlayer(action.player);focusPlayer(action.targetPlayer);
      await animateScreen(action.player,action.targetPlayer,ACTION_MS);
      clearEventFocus();return;
    }
    if(action.type==="DRIVE"){
      focusPlayer(action.player);
      var node=playerNode(action.player);
      if(node){setTransition(node,ACTION_MS);node.style.left=SPOTS.RIM.x+"%";node.style.top=(SPOTS.RIM.y+7)+"%";}
      moveBallToPoint({x:SPOTS.RIM.x,y:SPOTS.RIM.y+7},ACTION_MS);
      await wait(ACTION_MS);clearEventFocus();return;
    }
    if(action.type==="SHOOT"){
      focusPlayer(action.player);moveBallToPoint(SPOTS.RIM,ACTION_MS);
      await wait(ACTION_MS);clearEventFocus();
    }
  }

  function applyActionToDisplay(action){
    if(action.type==="PASS"){
      var target=state.displayState.offense[action.targetPlayer];
      state.displayState.ballHandler=action.targetPlayer;
      if(target)state.displayState.ballLocation=target.location;
    }else if(action.type==="CUT"||action.type==="FILL"){
      if(state.displayState.offense[action.player])state.displayState.offense[action.player].location=action.targetLocation;
      if(state.displayState.ballHandler===action.player)state.displayState.ballLocation=action.targetLocation;
    }else if(action.type==="SCREEN"){
      var screened=state.displayState.offense[action.targetPlayer];
      if(screened&&state.displayState.offense[action.player])state.displayState.offense[action.player].location=screened.location;
    }else if(action.type==="DRIVE"){
      if(state.displayState.offense[action.player])state.displayState.offense[action.player].location="RIM";
      state.displayState.ballHandler=action.player;state.displayState.ballLocation="RIM";
    }
  }

  function updateCourt(){
    var s=state.displayState;
    Object.keys(s.offense).forEach(function(id){
      var node=playerNode(id),point=displayPointForPlayer(s,id);
      if(!node||!point)return;
      setTransition(node,ACTION_MS);
      node.style.left=point.x+"%";node.style.top=point.y+"%";
      node.classList.toggle("decision",state.accepting&&id===state.decisionState.decisionPlayer);
      node.classList.toggle("ballhandler",id===s.ballHandler);
      node.querySelector("small").textContent=(state.accepting&&id===state.decisionState.decisionPlayer?"SINÄ · ":"")+ROLES[id];
    });

    Object.keys(s.defense).forEach(function(id){
      var node=el.defenseLayer.querySelector('[data-defender="'+id+'"]'),pos=defenderPosition(s,id);
      if(!node||!pos)return;
      setTransition(node,ACTION_MS);
      node.style.left=pos.x+"%";node.style.top=pos.y+"%";
      var label=defenderLabel(s.defense[id],s);
      node.querySelector("small").textContent=label;node.classList.toggle("read",label!=="");
    });

    var ballPoint=SPOTS[s.ballLocation];
    if(ballPoint)moveBallToPoint(ballPoint,ACTION_MS);
  }

  function displayPointForPlayer(s,id){
    var player=s.offense[id],base=player&&SPOTS[player.location];
    if(!base)return null;
    var point={x:base.x,y:base.y},ctx=s.context||{},screenContext=ctx.offBallScreen||null;
    if(screenContext&&id===screenContext.screener){
      var cutter=s.offense[screenContext.cutter];
      if(cutter&&cutter.location===player.location){
        point.x+=point.x<50?5:-5;point.y+=4;
      }
    }
    if(ctx.secondCut&&id===ctx.secondCut.screener){
      var secondCutter=s.offense[ctx.secondCut.cutter];
      if(secondCutter&&secondCutter.location===player.location){
        point.x+=point.x<50?5:-5;point.y+=4;
      }
    }
    return point;
  }

  function defenderPosition(s,id){
    var d=s.defense[id],guarded=s.offense[d.guarding];
    if(!guarded||!SPOTS[guarded.location])return null;
    var p=SPOTS[guarded.location],towardX=(50-p.x)*.12,towardY=(11-p.y)*.08;
    if(d.denyLevel==="HARD"){towardX*=.3;towardY*=1.7;}
    if(d.helpPosition==="GAP"||d.helpPosition==="NAIL"){towardX*=2.3;towardY*=1.4;}
    return{x:p.x+towardX,y:p.y+towardY};
  }

  function defenderLabel(d,s){
    if(d.overplay==="TOP_LOCK"||d.denyLevel==="HARD")return"DENY";
    if(d.screenCoverage==="UNDER")return"UNDER";
    if(d.screenCoverage==="HEDGE"||d.screenCoverage==="SHOW")return d.screenCoverage;
    if(d.screenCoverage==="TRAIL"&&s.context&&s.context.offBallScreen)return"TRAIL";
    if(d.helpPosition==="TAGGING_ROLLER")return"TAG";
    return"";
  }

  function defenseReadText(s){
    var d=Rules.getDefender(s,s.decisionPlayer);
    if(d.overplay==="TOP_LOCK"||d.denyLevel==="HARD")return"Puolustaja: TOP-LOCK / HARD DENY";
    if(d.screenCoverage==="UNDER")return"Puolustaja: UNDER";
    if(d.screenCoverage==="TRAIL"&&s.context.offBallScreen)return"Puolustaja: TRAIL";
    if(s.context.ballScreenRead){var rd=Rules.getDefender(s,s.context.ballScreenRead.roller);return"Big: "+(rd.screenCoverage||"NORMAL");}
    if(s.context.postEntry){var pd=Rules.getDefender(s,s.context.postEntry.postPlayer);return"Post defense: "+(pd.postDefense||"NORMAL");}
    if(s.context.splitScreen)return"Pallo postissa · split action";
    if(s.context.secondCut)return"Read opposite · second cut";
    return"";
  }

  function setTransition(node,ms){if(node)node.style.transitionDuration=ms+"ms";}
  function moveBallToPoint(p,ms){setTransition(el.ball,ms||ACTION_MS);el.ball.style.left=p.x+"%";el.ball.style.top=p.y+"%";}
  function playerNode(id){return el.playersLayer.querySelector('[data-player="'+id+'"]');}
  function focusPlayer(id){var n=playerNode(id);if(n)n.classList.add("event-focus","step-pulse");}
  function clearEventFocus(){document.querySelectorAll(".player").forEach(function(n){n.classList.remove("event-focus","step-pulse");});}

  function markPlayerTargets(){
    document.querySelectorAll(".player").forEach(function(n){
      if(n.dataset.player!==state.decisionState.decisionPlayer)n.classList.add("gesture-target");
    });
  }
  function markMoveTargets(){
    document.querySelectorAll(".spot").forEach(function(n){n.classList.add("target-mode");});
    markPlayerTargets();
    var playerId=state.decisionState.decisionPlayer;
    var ownLocation=state.decisionState.offense[playerId]&&state.decisionState.offense[playerId].location;
    var selfMove=Rules.getValidActions(state.decisionState).some(function(action){
      return(action.type==="CUT"||action.type==="FILL")&&action.targetLocation===ownLocation;
    });
    var ownNode=playerNode(playerId);
    if(selfMove&&ownNode)ownNode.classList.add("gesture-target");
  }

  function clearInteraction(){
    state.gestureMode=null;clearPressTimer();el.intentMenu.classList.add("hidden");el.cancelIntentBtn.classList.add("hidden");
    document.querySelectorAll(".player").forEach(function(n){n.classList.remove("gesture-target","holding","screen-link");});
    document.querySelectorAll(".spot").forEach(function(n){n.classList.remove("target-mode","best-target","selected-target");});
    el.tapMarker.classList.add("hidden");
  }

  function cancelIntent(){
    state.gestureMode=null;el.intentMenu.classList.add("hidden");el.cancelIntentBtn.classList.add("hidden");
    document.querySelectorAll(".player").forEach(function(n){n.classList.remove("gesture-target");});
    document.querySelectorAll(".spot").forEach(function(n){n.classList.remove("target-mode");});
    if(state.accepting)el.gestureStatus.textContent="Pidä keltaista SINÄ-pelaajaa pohjassa.";
  }

  function nearestSpot(x,y){
    var best=null,bestDistance=Infinity;
    Object.keys(SPOTS).forEach(function(name){
      var p=SPOTS[name],dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
      if(d<bestDistance){bestDistance=d;best=name;}
    });
    return best;
  }

  function showTapMarker(x,y){
    el.tapMarker.style.left=x+"%";el.tapMarker.style.top=y+"%";el.tapMarker.classList.remove("hidden");
    window.setTimeout(function(){el.tapMarker.classList.add("hidden");},500);
  }

  function buildSpots(){
    Object.keys(SPOTS).forEach(function(name){
      var p=SPOTS[name],spot=document.createElement("button");
      spot.type="button";spot.className="spot";spot.dataset.spot=name;
      spot.style.left=p.x+"%";spot.style.top=p.y+"%";spot.tabIndex=-1;el.spotsLayer.appendChild(spot);
    });
  }

  function openFeedback(classification,points,elapsed,selected,best){
    el.feedbackSheet.className="feedback-sheet "+classification.toLowerCase();
    el.feedbackEyebrow.textContent=classification;el.feedbackTitle.textContent=(points>=0?"+":"")+points;el.feedbackTime.textContent=elapsed.toFixed(2)+" s";
    el.selectedActionText.textContent="Valitsit: "+Rules.describeAction(selected.action);
    el.feedbackText.textContent=Rules.explainAction(state.decisionState,best?best.action:selected.action);
    el.bestReadBox.textContent="Paras read: "+(best?Rules.describeAction(best.action):"—")+" · "+state.teachingPoint;
    el.nextBtn.textContent=selectedMode==="challenge"&&state.round===20?"Näytä tulos":"Seuraava";
    el.feedbackBackdrop.classList.remove("hidden");el.feedbackSheet.classList.remove("hidden");
  }

  function updateHud(){el.score.textContent=state.score;el.streak.textContent=state.streak;}
  function updateTimer(){if(state.accepting)el.timer.textContent=((performance.now()-state.startedAt)/1000).toFixed(2)+" s";}
  function clearPressTimer(){if(state.pressTimer)window.clearTimeout(state.pressTimer);state.pressTimer=null;}
  function clearTimers(){if(state.timer)window.clearInterval(state.timer);state.timer=null;clearPressTimer();}

  function scheduleReview(category){
    var exists=state.reviewQueue.some(function(item){return item.category===category&&item.dueRound>state.round;});
    if(!exists)state.reviewQueue.push({category:category,dueRound:state.round+3});
  }

  function dueReview(){
    if(selectedMode!=="practice")return null;
    var index=state.reviewQueue.findIndex(function(item){return item.dueRound<=state.round+1;});
    if(index<0)return null;
    return state.reviewQueue.splice(index,1)[0];
  }

  function saveAttempt(attempt){
    try{
      var key="ppstats-motion-attempts-v2",items=JSON.parse(localStorage.getItem(key)||"[]");
      items.push(attempt);if(items.length>200)items=items.slice(items.length-200);
      localStorage.setItem(key,JSON.stringify(items));
    }catch(e){}
  }

  function finishChallenge(){
    closeFeedback();clearTimers();clearInteraction();
    el.playScreen.classList.add("hidden");el.resultsScreen.classList.remove("hidden");
    el.resultScore.textContent=state.score;el.resultBestReads.textContent=state.counts.BEST;el.resultGood.textContent=state.counts.GOOD;
    el.resultAcceptable.textContent=state.counts.ACCEPTABLE;el.resultMisses.textContent=state.counts.POOR+state.counts.WRONG;
    el.resultAvg.textContent=Logic.average(state.times).toFixed(2)+" s";el.resultStreak.textContent=state.bestStreak;
  }

  function returnToSetup(){
    state.roundToken+=1;closeFeedback();clearTimers();clearInteraction();state.accepting=false;
    el.playScreen.classList.add("hidden");el.resultsScreen.classList.add("hidden");el.setupScreen.classList.remove("hidden");
  }

  function closeFeedback(){el.feedbackBackdrop.classList.add("hidden");el.feedbackSheet.classList.add("hidden");}
  function vibrate(pattern){if(navigator.vibrate)navigator.vibrate(pattern);}
  function wait(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
})();