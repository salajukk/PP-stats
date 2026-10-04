(function(){
  "use strict";

  var Logic=window.GameLogic;
  var Rules=window.GameRules;
  var Generator=window.PuzzleGenerator;
  var LONG_PRESS_MS=430;
  var ROLES={P1:"PG",P2:"SG",P3:"SF",P4:"PF",P5:"C"};
  var CATEGORY_LABELS={
    PASS_AND_CUT:"PASS & CUT",FILL:"FILL",CURL_READ:"SCREEN · CURL",POP_READ:"SCREEN · POP",
    BACKDOOR_READ:"BACKDOOR",SCREENER_SECOND_CUT:"SECOND CUT",POST_ENTRY:"POST ENTRY",
    BALL_SCREEN_ROLLER_READ:"PNR · ROLLER",POST_SPLIT_SEQUENCE:"POST SPLIT"
  };
  var SPOTS={
    LEFT_SLOT:{x:32,y:74},RIGHT_SLOT:{x:68,y:74},LEFT_WING:{x:14,y:49},RIGHT_WING:{x:86,y:49},
    LEFT_BLOCK:{x:40,y:24},RIGHT_BLOCK:{x:60,y:24},LEFT_DUNKER:{x:34,y:17},RIGHT_DUNKER:{x:66,y:17},
    LEFT_HIGH_POST:{x:42,y:39},RIGHT_HIGH_POST:{x:58,y:39},RIM:{x:50,y:11},
    LEFT_CORNER:{x:8,y:20},RIGHT_CORNER:{x:92,y:20},LEFT_SHAKE:{x:23,y:58},RIGHT_SHAKE:{x:77,y:58}
  };

  var selectedRole="random",selectedMode="practice",selectedLevel=2;
  var state=freshState();
  var el={};
  [
    "setupScreen","playScreen","resultsScreen","startBtn","exitBtn","resultsBackBtn","replayBtn","categoryLabel","roundLabel",
    "roleBadge","score","streak","timer","triggerState","eventCounter","triggerText","decisionHint","court","spotsLayer","defenseLayer",
    "playersLayer","ball","eventPath","choicePath","answerArrow","tapMarker","intentMenu","actionPrompt","defensePrompt","gestureStatus",
    "cancelIntentBtn","chainStatus","feedbackBackdrop","feedbackSheet","feedbackEyebrow","feedbackTitle","feedbackTime","selectedActionText",
    "feedbackText","bestReadBox","nextBtn","resultScore","resultBestReads","resultGood","resultAcceptable","resultMisses","resultAvg","resultStreak"
  ].forEach(function(id){el[id]=document.getElementById(id);});

  document.querySelectorAll("[data-role]").forEach(function(button){
    button.addEventListener("click",function(){selectedRole=button.dataset.role;activateGroup("[data-role]",button);});
  });
  document.querySelectorAll("[data-level]").forEach(function(button){
    button.addEventListener("click",function(){selectedLevel=Number(button.dataset.level);activateGroup("[data-level]",button);});
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
      puzzle:null,displayState:null,round:0,score:0,streak:0,bestStreak:0,times:[],
      counts:{BEST:0,GOOD:0,ACCEPTABLE:0,POOR:0,WRONG:0},
      accepting:false,startedAt:0,timer:null,eventTimers:[],pressTimer:null,
      gestureMode:null,sequenceSteps:[],reviewQueue:[],roundToken:0
    };
  }

  function activateGroup(selector,active){
    document.querySelectorAll(selector).forEach(function(item){item.classList.toggle("active",item===active);});
  }

  function startGame(){
    clearTimers();closeFeedback();
    state=freshState();
    el.setupScreen.classList.add("hidden");el.resultsScreen.classList.add("hidden");el.playScreen.classList.remove("hidden");
    nextRound();
  }

  function nextRound(){
    clearTimers();closeFeedback();clearInteraction();clearPaths();
    if(selectedMode==="challenge"&&state.round>=20){finishChallenge();return;}
    state.round+=1;state.roundToken+=1;
    var token=state.roundToken;
    var review=dueReview();
    state.puzzle=Generator.generatePuzzle({maxDifficulty:selectedLevel,role:selectedRole,category:review?review.category:null});
    state.displayState=Generator.clone(state.puzzle.initialState);
    state.accepting=false;state.sequenceSteps=[];

    el.categoryLabel.textContent=CATEGORY_LABELS[state.puzzle.category]||state.puzzle.category;
    el.roundLabel.textContent=selectedMode==="challenge"?"Challenge · "+state.round+"/20":"Practice · "+state.round;
    el.roleBadge.textContent=ROLES[state.puzzle.decisionPlayer]||state.puzzle.decisionPlayer;
    el.triggerState.textContent="TILANNE";el.triggerState.classList.remove("live");
    el.triggerText.textContent="Katso mitä tapahtuu.";el.decisionHint.textContent="";
    el.actionPrompt.textContent="Seuraa tapahtumia…";el.defensePrompt.textContent="";
    el.gestureStatus.textContent="Animaatio rakentaa päätöstilanteen.";el.chainStatus.classList.add("hidden");
    el.timer.textContent="—";

    renderCourt(true);
    schedule(function(){playPrelude(0,token);},280);
  }

  function playPrelude(index,token){
    if(token!==state.roundToken)return;
    if(index>=state.puzzle.prelude.length){
      schedule(function(){startDecision(token);},360);
      return;
    }
    var event=state.puzzle.prelude[index];
    el.eventCounter.textContent=(index+1)+"/"+state.puzzle.prelude.length;
    el.triggerText.textContent=event.label;
    animatePreludeEvent(event,function(){
      if(token!==state.roundToken)return;
      state.displayState=Generator.applyEvent(state.displayState,event);
      updateCourt();
      schedule(function(){playPrelude(index+1,token);},180);
    });
  }

  function animatePreludeEvent(event,done){
    clearEventFocus();clearPath(el.eventPath);
    var duration=Math.max(event.duration||620,620);

    if(event.type==="PASS"){
      var from=state.displayState.offense[event.fromPlayer],to=state.displayState.offense[event.toPlayer];
      focusPlayer(event.fromPlayer);focusPlayer(event.toPlayer);
      if(from&&to)showPath(el.eventPath,[from.location,to.location]);
      schedule(function(){
        if(to&&SPOTS[to.location])moveBallToPoint(SPOTS[to.location]);
      },150);
      schedule(function(){clearEventFocus();done();},duration);
      return;
    }

    if(event.type==="MOVE"||event.type==="CUT"){
      focusPlayer(event.player);
      var player=state.displayState.offense[event.player];
      var locations=[];
      if(player)locations.push(player.location);
      (event.path||[]).forEach(function(loc){locations.push(loc);});
      if(event.to)locations.push(event.to);
      showPath(el.eventPath,locations);
      animatePlayerPath(event.player,locations.slice(1),duration,function(){
        clearEventFocus();done();
      });
      return;
    }

    if(event.type==="SCREEN"){
      focusPlayer(event.player);focusPlayer(event.targetPlayer);
      showPlayerToPlayerPath(el.eventPath,event.player,event.targetPlayer);
      var screener=playerNode(event.player),target=playerNode(event.targetPlayer);
      if(screener)screener.classList.add("screening");
      if(target)target.classList.add("screen-link");
      schedule(function(){
        if(screener)screener.classList.remove("screening");
        if(target)target.classList.remove("screen-link");
        clearEventFocus();done();
      },duration);
      return;
    }

    schedule(done,duration);
  }

  function startDecision(token){
    if(token!==state.roundToken)return;
    state.displayState=Generator.clone(state.puzzle.decisionState);
    state.accepting=true;state.sequenceSteps=[];updateCourt();clearPaths();

    el.triggerState.textContent="PÄÄTÖS";el.triggerState.classList.add("live");
    el.eventCounter.textContent="";el.triggerText.textContent=state.puzzle.decisionLabel;
    el.decisionHint.textContent="Päätöksentekijä: "+state.puzzle.decisionPlayer+" · "+ROLES[state.puzzle.decisionPlayer];
    el.actionPrompt.textContent="Tee ratkaisu kentällä";el.defensePrompt.textContent=defenseReadText(state.puzzle.decisionState);
    el.gestureStatus.textContent="Pidä keltaista SINÄ-pelaajaa pohjassa.";
    state.startedAt=performance.now();state.timer=window.setInterval(updateTimer,33);
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
      if(!state.accepting||id!==state.puzzle.decisionPlayer||state.gestureMode)return;
      e.preventDefault();e.stopPropagation();clearPressTimer();node.classList.add("holding");
      state.pressTimer=window.setTimeout(function(){
        node.classList.remove("holding");openIntentMenu(node);vibrate(8);
      },LONG_PRESS_MS);
    });
    ["pointerup","pointercancel","pointerleave"].forEach(function(type){
      node.addEventListener(type,function(){node.classList.remove("holding");clearPressTimer();});
    });
    node.addEventListener("click",function(e){
      e.stopPropagation();
      if(!state.accepting||!state.gestureMode)return;
      if(id===state.puzzle.decisionPlayer)return;
      if(state.gestureMode==="PASS")commitIntent({type:"PASS",targetPlayer:id});
      else if(state.gestureMode==="MOVE")commitIntent({type:"SCREEN",targetPlayer:id});
    });
  }

  function openIntentMenu(node){
    if(!state.accepting)return;
    cancelIntent();
    var left=parseFloat(node.style.left),top=parseFloat(node.style.top);
    left=Math.max(23,Math.min(77,left));top=Math.max(23,Math.min(77,top));
    el.intentMenu.style.left=left+"%";el.intentMenu.style.top=top+"%";
    var hasBall=state.displayState.ballHandler===state.puzzle.decisionPlayer;
    el.intentMenu.querySelector('[data-intent="PASS"]').disabled=!hasBall;
    el.intentMenu.querySelector('[data-intent="DRIVE"]').disabled=!hasBall;
    el.intentMenu.querySelector('[data-intent="SHOOT"]').disabled=!hasBall;
    el.intentMenu.classList.remove("hidden");
    el.gestureStatus.textContent=hasBall?"Valitse: syötä, aja, liiku tai heitä.":"Valitse Liiku. Pelaajaan liikuttaminen = screen.";
  }

  function selectIntent(mode){
    el.intentMenu.classList.add("hidden");
    if(mode==="DRIVE"||mode==="SHOOT"){
      var action=Rules.inferGestureAction(state.puzzle.decisionState,{type:mode},state.sequenceSteps);
      handleAtomicAction(action);
      return;
    }
    state.gestureMode=mode;
    el.cancelIntentBtn.classList.remove("hidden");
    if(mode==="PASS"){
      el.gestureStatus.textContent="SYÖTTÖ · Napauta joukkuetoveria.";
      markAllPlayerTargets();
    }else{
      el.gestureStatus.textContent="LIIKE · Napauta tyhjää tilaa. Napauta pelaajaa = screen.";
      markMoveTargets();
    }
  }

  function handleCourtPointerUp(e){
    if(!state.accepting||state.gestureMode!=="MOVE")return;
    if(e.target.closest(".player,.intent-menu,.intent,.icon-btn,.cancel-intent"))return;
    var rect=el.court.getBoundingClientRect();
    var x=(e.clientX-rect.left)/rect.width*100;
    var y=(e.clientY-rect.top)/rect.height*100;
    var nearest=nearestSpot(x,y);
    showTapMarker(x,y);
    commitIntent({type:"MOVE",targetLocation:nearest});
  }

  function nearestSpot(x,y){
    var best=null,bestDistance=Infinity;
    Object.keys(SPOTS).forEach(function(name){
      var p=SPOTS[name],dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
      if(d<bestDistance){bestDistance=d;best=name;}
    });
    return best;
  }

  function commitIntent(intent){
    cancelIntent();
    var action=Rules.inferGestureAction(state.puzzle.decisionState,intent,state.sequenceSteps);
    handleAtomicAction(action);
  }

  async function handleAtomicAction(action){
    if(!state.accepting)return;
    var proposed=state.sequenceSteps.concat([action]);
    var sequenceCandidates=state.puzzle.rankedSolutions.filter(function(item){
      return item.action.type==="SEQUENCE"&&Rules.sequencePrefixMatches(item.action,proposed);
    });

    if(sequenceCandidates.length&&proposed.length<sequenceCandidates[0].action.steps.length){
      state.sequenceSteps=proposed;
      await animateUserAction(action,false);
      if(!state.accepting)return;
      el.chainStatus.textContent=proposed.length+"/"+sequenceCandidates[0].action.steps.length+" tehty · jatka samalla pelaajalla.";
      el.chainStatus.classList.remove("hidden");
      el.gestureStatus.textContent="Pidä SINÄ-pelaajaa uudelleen pohjassa ja jatka toimintoketjua.";
      updateCourt();
      return;
    }

    var finalAction;
    if(sequenceCandidates.length&&proposed.length===sequenceCandidates[0].action.steps.length){
      finalAction=Rules.makeAction("SEQUENCE",state.puzzle.decisionPlayer,{sequenceId:"USER_GESTURE",steps:proposed});
    }else if(state.sequenceSteps.length){
      finalAction=Rules.makeAction("SEQUENCE",state.puzzle.decisionPlayer,{sequenceId:"USER_GESTURE",steps:proposed});
    }else{
      finalAction=action;
    }

    state.accepting=false;
    var elapsed=(performance.now()-state.startedAt)/1000;
    if(state.timer)window.clearInterval(state.timer);state.timer=null;
    await animateUserAction(action,false);
    await resolveDecision(finalAction,elapsed);
  }

  async function resolveDecision(actual,elapsed){
    var evaluation=Rules.evaluateActionObject(state.puzzle.decisionState,actual);
    var selected=evaluation.selected,best=evaluation.best;
    var classification=selected.classification;
    var points=Logic.pointsForOutcome(elapsed,classification,state.streak);

    state.times.push(elapsed);state.counts[classification]+=1;state.score+=points;
    if(classification==="BEST"||classification==="GOOD"){
      state.streak+=1;state.bestStreak=Math.max(state.bestStreak,state.streak);
    }else state.streak=0;

    if(selectedMode==="practice"&&(classification==="ACCEPTABLE"||classification==="POOR"||classification==="WRONG"))scheduleReview(state.puzzle.category);
    saveAttempt({
      category:state.puzzle.category,classification:classification,responseTime:elapsed,
      selectedAction:actual.id||actual.type,bestAction:best?best.action.id:null,
      mistakeType:Rules.mistakeType(state.puzzle.decisionState,selected,best),at:Date.now()
    });
    updateHud();

    if(classification!=="BEST"&&best){
      el.triggerState.textContent="PARAS READ";el.triggerText.textContent=Rules.describeAction(best.action);
      await sleep(420);
      state.displayState=Generator.clone(state.puzzle.decisionState);updateCourt();clearPath(el.choicePath);
      await animateResolvedAction(best.action,true);
    }

    openFeedback(classification,points,elapsed,{action:actual},best);
  }

  async function animateUserAction(action,isBest){
    clearPath(el.choicePath);
    if(action.type==="SEQUENCE"){
      for(var i=0;i<action.steps.length;i++)await animateSingleAction(action.steps[i],isBest);
    }else{
      await animateSingleAction(action,isBest);
    }
  }

  async function animateResolvedAction(action,isBest){
    if(action.type==="SEQUENCE"){
      for(var i=0;i<action.steps.length;i++)await animateSingleAction(action.steps[i],isBest);
    }else await animateSingleAction(action,isBest);
  }

  async function animateSingleAction(action,isBest){
    var pathEl=el.choicePath;
    pathEl.classList.toggle("best-path",!!isBest);

    if(action.type==="PASS"){
      var from=state.displayState.offense[action.player],to=state.displayState.offense[action.targetPlayer];
      if(from&&to)showPath(pathEl,[from.location,to.location]);
      focusPlayer(action.player);focusPlayer(action.targetPlayer);
      await sleep(120);
      if(to&&SPOTS[to.location])moveBallToPoint(SPOTS[to.location]);
      state.displayState.ballHandler=action.targetPlayer;
      if(to)state.displayState.ballLocation=to.location;
      await sleep(430);clearEventFocus();return;
    }

    if(action.type==="CUT"||action.type==="FILL"){
      var own=state.displayState.offense[action.player];
      var path=(action.path&&action.path.length?action.path:[action.targetLocation]).slice();
      var locations=own?[own.location].concat(path):path;
      showPath(pathEl,locations);focusPlayer(action.player);
      await animatePlayerPathAsync(action.player,path,Math.max(520,path.length*360));
      if(own){own.location=action.targetLocation;if(state.displayState.ballHandler===action.player)state.displayState.ballLocation=action.targetLocation;}
      clearEventFocus();return;
    }

    if(action.type==="SCREEN"){
      var screener=playerNode(action.player),target=playerNode(action.targetPlayer);
      showPlayerToPlayerPath(pathEl,action.player,action.targetPlayer);
      focusPlayer(action.player);focusPlayer(action.targetPlayer);
      if(screener&&target){
        var tx=parseFloat(target.style.left),ty=parseFloat(target.style.top);
        var sx=parseFloat(screener.style.left);
        screener.style.left=(tx+(sx<tx?-5:5))+"%";screener.style.top=(ty+4)+"%";
        screener.classList.add("screening");target.classList.add("screen-link");
      }
      await sleep(520);
      if(screener)screener.classList.remove("screening");
      if(target)target.classList.remove("screen-link");
      clearEventFocus();return;
    }

    if(action.type==="DRIVE"){
      var drivePlayer=playerNode(action.player),start=state.displayState.offense[action.player];
      if(start)showPath(pathEl,[start.location,"RIM"]);
      focusPlayer(action.player);
      if(drivePlayer){drivePlayer.style.left=SPOTS.RIM.x+"%";drivePlayer.style.top=(SPOTS.RIM.y+7)+"%";}
      state.displayState.ballHandler=action.player;state.displayState.ballLocation="RIM";moveBallToPoint({x:SPOTS.RIM.x,y:SPOTS.RIM.y+7});
      await sleep(560);clearEventFocus();return;
    }

    if(action.type==="SHOOT"){
      focusPlayer(action.player);
      var shooter=state.displayState.offense[action.player];
      if(shooter)showPath(pathEl,[shooter.location,"RIM"]);
      await sleep(120);moveBallToPoint(SPOTS.RIM);await sleep(480);clearEventFocus();return;
    }
  }

  function animatePlayerPath(playerId,locations,totalDuration,done){
    var node=playerNode(playerId);
    if(!node||!locations.length){schedule(done,totalDuration);return;}
    var segment=Math.max(240,totalDuration/locations.length);
    locations.forEach(function(loc,index){
      schedule(function(){if(SPOTS[loc]){node.style.left=SPOTS[loc].x+"%";node.style.top=SPOTS[loc].y+"%";}},index*segment);
    });
    schedule(done,locations.length*segment+80);
  }

  async function animatePlayerPathAsync(playerId,locations,totalDuration){
    var node=playerNode(playerId);if(!node||!locations.length)return;
    var segment=Math.max(260,totalDuration/locations.length);
    for(var i=0;i<locations.length;i++){
      if(SPOTS[locations[i]]){node.style.left=SPOTS[locations[i]].x+"%";node.style.top=SPOTS[locations[i]].y+"%";}
      await sleep(segment);
    }
  }

  function showPath(node,locations){
    var points=locations.map(function(loc){return SPOTS[loc];}).filter(Boolean);
    showPointPath(node,points);
  }

  function showPlayerToPlayerPath(node,fromId,toId){
    var from=playerPoint(fromId),to=playerPoint(toId);
    if(from&&to)showPointPath(node,[from,to]);
  }

  function showPointPath(node,points){
    if(!node||points.length<2)return;
    node.setAttribute("points",points.map(function(p){return p.x+","+p.y;}).join(" "));
    node.classList.remove("visible");void node.getBoundingClientRect();node.classList.add("visible");
  }

  function clearPath(node){if(node){node.classList.remove("visible");node.setAttribute("points","");}}
  function clearPaths(){clearPath(el.eventPath);clearPath(el.choicePath);el.answerArrow.classList.remove("visible");}

  function playerPoint(id){
    var node=playerNode(id);if(!node)return null;
    return{x:parseFloat(node.style.left),y:parseFloat(node.style.top)};
  }
  function playerNode(id){return el.playersLayer.querySelector('[data-player="'+id+'"]');}
  function focusPlayer(id){var n=playerNode(id);if(n)n.classList.add("event-focus");}
  function clearEventFocus(){document.querySelectorAll(".player").forEach(function(n){n.classList.remove("event-focus");});}

  function updateCourt(){
    var s=state.displayState;
    Object.keys(s.offense).forEach(function(id){
      var node=playerNode(id),point=SPOTS[s.offense[id].location];if(!node||!point)return;
      node.style.left=point.x+"%";node.style.top=point.y+"%";
      node.classList.toggle("decision",state.accepting&&id===state.puzzle.decisionPlayer);
      node.classList.toggle("ballhandler",id===s.ballHandler);
      node.querySelector("small").textContent=(state.accepting&&id===state.puzzle.decisionPlayer?"SINÄ · ":"")+ROLES[id];
    });
    Object.keys(s.defense).forEach(function(id){
      var node=el.defenseLayer.querySelector('[data-defender="'+id+'"]'),pos=defenderPosition(s,id);if(!node||!pos)return;
      node.style.left=pos.x+"%";node.style.top=pos.y+"%";
      var label=defenderLabel(s.defense[id]);node.querySelector("small").textContent=label;node.classList.toggle("read",label!=="");
    });
    var ballPoint=SPOTS[s.ballLocation];if(ballPoint)moveBallToPoint(ballPoint);
  }

  function defenderPosition(s,id){
    var d=s.defense[id],guarded=s.offense[d.guarding];if(!guarded||!SPOTS[guarded.location])return null;
    var p=SPOTS[guarded.location],towardX=(50-p.x)*.12,towardY=(11-p.y)*.08;
    if(d.denyLevel==="HARD"){towardX*=.3;towardY*=1.7;}
    if(d.helpPosition==="GAP"||d.helpPosition==="NAIL"){towardX*=2.3;towardY*=1.4;}
    return{x:p.x+towardX,y:p.y+towardY};
  }

  function defenderLabel(d){
    if(d.overplay==="TOP_LOCK"||d.denyLevel==="HARD")return"DENY";
    if(d.screenCoverage==="UNDER")return"UNDER";
    if(d.screenCoverage==="HEDGE"||d.screenCoverage==="SHOW")return d.screenCoverage;
    if(d.screenCoverage==="TRAIL"&&state.puzzle&&state.puzzle.category.indexOf("READ")>=0)return"TRAIL";
    if(d.helpPosition==="TAGGING_ROLLER")return"TAG";
    return"";
  }

  function defenseReadText(s){
    var p=s.decisionPlayer,d=Rules.getDefender(s,p);
    if(d.overplay==="TOP_LOCK"||d.denyLevel==="HARD")return"Puolustaja: TOP-LOCK / HARD DENY";
    if(d.screenCoverage==="UNDER")return"Puolustaja: UNDER";
    if(d.screenCoverage==="TRAIL"&&s.context.offBallScreen)return"Puolustaja: TRAIL";
    if(s.context.ballScreenRead){var rd=Rules.getDefender(s,s.context.ballScreenRead.roller);return"Big: "+(rd.screenCoverage||"NORMAL");}
    if(s.context.postEntry){var pd=Rules.getDefender(s,s.context.postEntry.postPlayer);return"Post defense: "+(pd.postDefense||"NORMAL");}
    return"";
  }

  function markAllPlayerTargets(){
    document.querySelectorAll(".player").forEach(function(n){
      if(n.dataset.player!==state.puzzle.decisionPlayer)n.classList.add("gesture-target");
    });
  }
  function markMoveTargets(){
    document.querySelectorAll(".spot").forEach(function(n){n.classList.add("target-mode");});
    markAllPlayerTargets();
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
    if(state.accepting)el.gestureStatus.textContent=state.sequenceSteps.length?"Pidä SINÄ-pelaajaa pohjassa ja jatka ketjua.":"Pidä keltaista SINÄ-pelaajaa pohjassa.";
  }

  function showTapMarker(x,y){
    el.tapMarker.style.left=x+"%";el.tapMarker.style.top=y+"%";el.tapMarker.classList.remove("hidden");
    schedule(function(){el.tapMarker.classList.add("hidden");},500);
  }

  function moveBallToPoint(p){el.ball.style.left=p.x+"%";el.ball.style.top=p.y+"%";}

  function openFeedback(classification,points,elapsed,selected,best){
    el.feedbackSheet.className="feedback-sheet "+classification.toLowerCase();
    el.feedbackEyebrow.textContent=classification;el.feedbackTitle.textContent=(points>=0?"+":"")+points;el.feedbackTime.textContent=elapsed.toFixed(2)+" s";
    el.selectedActionText.textContent="Valitsit: "+Rules.describeAction(selected.action);
    el.feedbackText.textContent=Rules.explainAction(state.puzzle.decisionState,best?best.action:selected.action);
    el.bestReadBox.textContent="Paras read: "+(best?Rules.describeAction(best.action):"—")+" · "+state.puzzle.teachingPoint;
    el.nextBtn.textContent=selectedMode==="challenge"&&state.round===20?"Näytä tulos":"Seuraava";
    el.feedbackBackdrop.classList.remove("hidden");el.feedbackSheet.classList.remove("hidden");
  }

  function updateHud(){el.score.textContent=state.score;el.streak.textContent=state.streak;}
  function updateTimer(){if(state.accepting)el.timer.textContent=((performance.now()-state.startedAt)/1000).toFixed(2)+" s";}

  function buildSpots(){
    Object.keys(SPOTS).forEach(function(name){
      var p=SPOTS[name],spot=document.createElement("button");spot.type="button";spot.className="spot";spot.dataset.spot=name;
      spot.style.left=p.x+"%";spot.style.top=p.y+"%";spot.tabIndex=-1;el.spotsLayer.appendChild(spot);
    });
  }

  function schedule(fn,ms){var id=window.setTimeout(fn,ms);state.eventTimers.push(id);return id;}
  function sleep(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
  function clearPressTimer(){if(state.pressTimer)window.clearTimeout(state.pressTimer);state.pressTimer=null;}
  function clearTimers(){
    if(state.timer)window.clearInterval(state.timer);state.timer=null;clearPressTimer();
    state.eventTimers.forEach(function(id){window.clearTimeout(id);});state.eventTimers=[];
  }

  function scheduleReview(category){
    var exists=state.reviewQueue.some(function(item){return item.category===category&&item.dueRound>state.round;});
    if(!exists)state.reviewQueue.push({category:category,dueRound:state.round+3});
  }
  function dueReview(){
    if(selectedMode!=="practice")return null;
    var index=state.reviewQueue.findIndex(function(item){return item.dueRound<=state.round+1;});
    if(index<0)return null;return state.reviewQueue.splice(index,1)[0];
  }

  function saveAttempt(attempt){
    try{
      var key="ppstats-motion-attempts-v2",items=JSON.parse(localStorage.getItem(key)||"[]");
      items.push(attempt);if(items.length>200)items=items.slice(items.length-200);localStorage.setItem(key,JSON.stringify(items));
    }catch(e){}
  }

  function finishChallenge(){
    closeFeedback();clearTimers();clearInteraction();el.playScreen.classList.add("hidden");el.resultsScreen.classList.remove("hidden");
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
})();