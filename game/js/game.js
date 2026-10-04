(function(){
  "use strict";

  var Logic=window.GameLogic;
  var Rules=window.GameRules;
  var Generator=window.PuzzleGenerator;
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
    "playersLayer","ball","answerArrow","actionPrompt","defensePrompt","actionChoices","feedbackBackdrop","feedbackSheet","feedbackEyebrow",
    "feedbackTitle","feedbackTime","selectedActionText","feedbackText","bestReadBox","nextBtn","resultScore","resultBestReads","resultGood",
    "resultAcceptable","resultMisses","resultAvg","resultStreak"
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

  el.startBtn.addEventListener("click",startGame);
  el.exitBtn.addEventListener("click",returnToSetup);
  el.resultsBackBtn.addEventListener("click",returnToSetup);
  el.replayBtn.addEventListener("click",startGame);
  el.nextBtn.addEventListener("click",nextRound);
  buildSpots();

  function freshState(){
    return{
      puzzle:null,displayState:null,round:0,score:0,streak:0,bestStreak:0,times:[],
      counts:{BEST:0,GOOD:0,ACCEPTABLE:0,POOR:0,WRONG:0},
      accepting:false,startedAt:0,timer:null,eventTimer:null,candidates:[],reviewQueue:[]
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
    clearTimers();closeFeedback();clearResultMarks();
    if(selectedMode==="challenge"&&state.round>=20){finishChallenge();return;}
    state.round+=1;

    var review=dueReview();
    state.puzzle=Generator.generatePuzzle({
      maxDifficulty:selectedLevel,
      role:selectedRole,
      category:review?review.category:null
    });
    state.displayState=Generator.clone(state.puzzle.initialState);
    state.accepting=false;
    state.candidates=[];

    el.categoryLabel.textContent=CATEGORY_LABELS[state.puzzle.category]||state.puzzle.category;
    el.roundLabel.textContent=selectedMode==="challenge"?"Challenge · "+state.round+"/20":"Practice · "+state.round;
    el.roleBadge.textContent=ROLES[state.puzzle.decisionPlayer]||state.puzzle.decisionPlayer;
    el.triggerState.textContent="TILANNE";el.triggerState.classList.remove("live");
    el.triggerText.textContent="Katso mitä tapahtuu.";
    el.decisionHint.textContent="";
    el.actionPrompt.textContent="Seuraa tapahtumia…";el.defensePrompt.textContent="";el.actionChoices.innerHTML="";
    el.timer.textContent="—";

    renderCourt(true);
    playPrelude(0);
  }

  function playPrelude(index){
    if(index>=state.puzzle.prelude.length){
      state.eventTimer=window.setTimeout(startDecision,220);
      return;
    }
    var event=state.puzzle.prelude[index];
    el.eventCounter.textContent=(index+1)+"/"+state.puzzle.prelude.length;
    el.triggerText.textContent=event.label;
    animateEvent(event);
    state.eventTimer=window.setTimeout(function(){
      state.displayState=Generator.applyEvent(state.displayState,event);
      updateCourt();
      playPrelude(index+1);
    },event.duration||620);
  }

  function startDecision(){
    state.displayState=Generator.clone(state.puzzle.decisionState);
    state.candidates=state.puzzle.rankedSolutions;
    state.accepting=true;
    updateCourt();

    el.triggerState.textContent="PÄÄTÖS";el.triggerState.classList.add("live");
    el.eventCounter.textContent="";el.triggerText.textContent=state.puzzle.decisionLabel;
    el.decisionHint.textContent="Päätöksentekijä: "+state.puzzle.decisionPlayer+" · "+ROLES[state.puzzle.decisionPlayer];
    el.actionPrompt.textContent="Valitse paras read";
    el.defensePrompt.textContent=defenseReadText(state.puzzle.decisionState);
    renderActionChoices();
    markDirectTargets();
    state.startedAt=performance.now();
    state.timer=window.setInterval(updateTimer,33);
  }

  function renderCourt(initial){
    if(initial){
      el.playersLayer.innerHTML="";el.defenseLayer.innerHTML="";
      Object.keys(state.displayState.offense).forEach(function(id){
        var p=document.createElement("button");p.type="button";p.className="player";p.dataset.player=id;
        p.innerHTML="<span>"+id.replace("P","")+"</span><small>"+ROLES[id]+"</small>";
        p.addEventListener("click",function(e){e.stopPropagation();chooseByTarget("player",id);});
        el.playersLayer.appendChild(p);
      });
      Object.keys(state.displayState.defense).forEach(function(id){
        var d=document.createElement("div");d.className="defender";d.dataset.defender=id;
        d.innerHTML="<span>"+id.replace("D","D")+"</span><small></small>";
        el.defenseLayer.appendChild(d);
      });
    }
    updateCourt();
  }

  function updateCourt(){
    var s=state.displayState;
    Object.keys(s.offense).forEach(function(id){
      var node=el.playersLayer.querySelector('[data-player="'+id+'"]'),point=SPOTS[s.offense[id].location];
      if(!node||!point)return;
      node.style.left=point.x+"%";node.style.top=point.y+"%";
      node.classList.toggle("decision",state.accepting&&id===s.decisionPlayer);
      node.classList.toggle("ballhandler",id===s.ballHandler);
      node.querySelector("small").textContent=(state.accepting&&id===s.decisionPlayer?"SINÄ · ":"")+ROLES[id];
    });

    Object.keys(s.defense).forEach(function(id){
      var node=el.defenseLayer.querySelector('[data-defender="'+id+'"]'),pos=defenderPosition(s,id);
      if(!node||!pos)return;
      node.style.left=pos.x+"%";node.style.top=pos.y+"%";
      var label=defenderLabel(s.defense[id]);
      node.querySelector("small").textContent=label;
      node.classList.toggle("read",label!=="");
    });

    var ballPoint=SPOTS[s.ballLocation];
    if(ballPoint){el.ball.style.left=ballPoint.x+"%";el.ball.style.top=ballPoint.y+"%";}
  }

  function defenderPosition(s,id){
    var d=s.defense[id],guarded=s.offense[d.guarding];
    if(!guarded||!SPOTS[guarded.location])return null;
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
    if(s.context.ballScreenRead){
      var rd=Rules.getDefender(s,s.context.ballScreenRead.roller);
      return"Big: "+(rd.screenCoverage||"NORMAL");
    }
    if(s.context.postEntry){
      var pd=Rules.getDefender(s,s.context.postEntry.postPlayer);
      return"Post defense: "+(pd.postDefense||"NORMAL");
    }
    return"";
  }

  function animateEvent(event){
    if(event.type==="SCREEN"){
      var screener=el.playersLayer.querySelector('[data-player="'+event.player+'"]');
      if(screener){screener.classList.add("screening");window.setTimeout(function(){screener.classList.remove("screening");},430);}
    }
    if(event.type==="PASS"){
      var target=state.displayState.offense[event.toPlayer];
      if(target&&SPOTS[target.location]){
        var p=SPOTS[target.location];el.ball.style.left=p.x+"%";el.ball.style.top=p.y+"%";
      }
    }
    if(event.type==="MOVE"||event.type==="CUT"){
      var player=el.playersLayer.querySelector('[data-player="'+event.player+'"]');
      var path=event.path||[],destination=event.to||(path.length?path[path.length-1]:null);
      if(player&&destination&&SPOTS[destination]){
        player.style.left=SPOTS[destination].x+"%";player.style.top=SPOTS[destination].y+"%";
      }
    }
  }

  function renderActionChoices(){
    el.actionChoices.innerHTML="";
    state.candidates.forEach(function(item){
      var button=document.createElement("button");
      button.type="button";button.className="action-card";button.dataset.actionId=item.action.id;
      button.innerHTML="<strong>"+Rules.describeAction(item.action)+"</strong><small>"+actionHint(item.action)+"</small>";
      button.addEventListener("click",function(){selectAction(item.action.id);});
      el.actionChoices.appendChild(button);
    });
  }

  function actionHint(action){
    if(action.type==="SEQUENCE")return"3 toimintoa";
    if(action.type==="PASS")return"syöttö";
    if(action.type==="CUT"||action.type==="FILL")return"liike";
    if(action.type==="SCREEN")return"screen";
    return"päätös";
  }

  function markDirectTargets(){
    document.querySelectorAll(".spot,.player").forEach(function(n){n.classList.remove("active-target");});
    state.candidates.forEach(function(item){
      var a=item.action;
      if(a.type==="PASS"||a.type==="SCREEN"){
        var p=el.playersLayer.querySelector('[data-player="'+a.targetPlayer+'"]');if(p)p.classList.add("active-target");
      }else if((a.type==="CUT"||a.type==="FILL")&&a.targetLocation){
        var s=el.spotsLayer.querySelector('[data-spot="'+a.targetLocation+'"]');if(s)s.classList.add("active-target");
      }
    });
  }

  function chooseByTarget(kind,value){
    if(!state.accepting)return;
    var matches=state.candidates.filter(function(item){
      var a=item.action;
      if(kind==="player")return(a.type==="PASS"||a.type==="SCREEN")&&a.targetPlayer===value;
      return(a.type==="CUT"||a.type==="FILL")&&a.targetLocation===value;
    });
    if(matches.length===1){selectAction(matches[0].action.id);return;}
    document.querySelectorAll(".action-card").forEach(function(card){card.classList.remove("suggested");});
    matches.forEach(function(item){
      var card=el.actionChoices.querySelector('[data-action-id="'+cssEscape(item.action.id)+'"]');
      if(card)card.classList.add("suggested");
    });
  }

  function cssEscape(value){return value.replace(/"/g,'\\"');}

  function selectAction(actionId){
    if(!state.accepting)return;
    state.accepting=false;clearInterval(state.timer);state.timer=null;
    var elapsed=(performance.now()-state.startedAt)/1000;
    var evaluation=Rules.evaluateAction(state.puzzle.decisionState,actionId);
    var selected=evaluation.selected,best=evaluation.best;
    var classification=selected.classification;
    var points=Logic.pointsForOutcome(elapsed,classification,state.streak);

    state.times.push(elapsed);state.counts[classification]+=1;state.score+=points;
    if(classification==="BEST"||classification==="GOOD"){
      state.streak+=1;state.bestStreak=Math.max(state.bestStreak,state.streak);
    }else state.streak=0;

    if(selectedMode==="practice"&&(classification==="ACCEPTABLE"||classification==="POOR"||classification==="WRONG")){
      scheduleReview(state.puzzle.category);
    }

    saveAttempt({
      category:state.puzzle.category,
      classification:classification,
      responseTime:elapsed,
      selectedAction:selected.action?selected.action.id:null,
      bestAction:best?best.action.id:null,
      mistakeType:Rules.mistakeType(state.puzzle.decisionState,selected,best),
      at:Date.now()
    });

    updateHud();
    showResultTargets(selected.action,best&&best.action);
    animateResolvedAction((classification==="BEST"||classification==="GOOD")?selected.action:best.action);
    openFeedback(classification,points,elapsed,selected,best);
    vibrate(classification==="WRONG"?[55,45,55]:classification==="BEST"?18:10);
  }

  function openFeedback(classification,points,elapsed,selected,best){
    el.feedbackSheet.className="feedback-sheet "+classification.toLowerCase();
    el.feedbackEyebrow.textContent=classification;
    el.feedbackTitle.textContent=(points>=0?"+":"")+points;
    el.feedbackTime.textContent=elapsed.toFixed(2)+" s";
    el.selectedActionText.textContent="Valitsit: "+(selected.action?Rules.describeAction(selected.action):"—");
    el.feedbackText.textContent=Rules.explainAction(state.puzzle.decisionState,best?best.action:selected.action);
    el.bestReadBox.textContent="Paras read: "+(best?Rules.describeAction(best.action):"—")+" · "+state.puzzle.teachingPoint;
    el.nextBtn.textContent=selectedMode==="challenge"&&state.round===20?"Näytä tulos":"Seuraava";
    el.feedbackBackdrop.classList.remove("hidden");el.feedbackSheet.classList.remove("hidden");
  }

  function showResultTargets(selected,best){
    clearResultMarks();
    markActionTarget(selected,"selected-target");
    markActionTarget(best,"best-target");
    drawBestArrow(best);
  }

  function markActionTarget(action,className){
    if(!action)return;
    if(action.targetLocation){
      var spot=el.spotsLayer.querySelector('[data-spot="'+action.targetLocation+'"]');if(spot)spot.classList.add(className);
    }else if(action.targetPlayer){
      var p=el.playersLayer.querySelector('[data-player="'+action.targetPlayer+'"]');if(p)p.classList.add(className);
    }
  }

  function drawBestArrow(action){
    if(!action)return;
    var fromLoc=state.puzzle.decisionState.offense[action.player]&&state.puzzle.decisionState.offense[action.player].location;
    var toLoc=action.targetLocation;
    if(!toLoc&&action.targetPlayer&&state.puzzle.decisionState.offense[action.targetPlayer])toLoc=state.puzzle.decisionState.offense[action.targetPlayer].location;
    if(action.type==="SEQUENCE"&&action.steps&&action.steps[0]&&action.steps[0].targetPlayer)toLoc=state.puzzle.decisionState.offense[action.steps[0].targetPlayer].location;
    if(!SPOTS[fromLoc]||!SPOTS[toLoc])return;
    el.answerArrow.setAttribute("x1",SPOTS[fromLoc].x);el.answerArrow.setAttribute("y1",SPOTS[fromLoc].y);
    el.answerArrow.setAttribute("x2",SPOTS[toLoc].x);el.answerArrow.setAttribute("y2",SPOTS[toLoc].y);
    el.answerArrow.classList.add("visible");
  }

  function animateResolvedAction(action){
    if(!action)return;
    var steps=action.type==="SEQUENCE"?action.steps:[action];
    var delay=0;
    steps.forEach(function(step){
      window.setTimeout(function(){animateSingleAction(step);},delay);
      delay+=330;
    });
  }

  function animateSingleAction(action){
    if(action.type==="PASS"){
      var target=state.puzzle.decisionState.offense[action.targetPlayer];
      if(target&&SPOTS[target.location]){el.ball.style.left=SPOTS[target.location].x+"%";el.ball.style.top=SPOTS[target.location].y+"%";}
    }else if(action.type==="CUT"||action.type==="FILL"){
      var node=el.playersLayer.querySelector('[data-player="'+action.player+'"]');
      if(node&&SPOTS[action.targetLocation]){node.style.left=SPOTS[action.targetLocation].x+"%";node.style.top=SPOTS[action.targetLocation].y+"%";}
    }else if(action.type==="SCREEN"){
      var screener=el.playersLayer.querySelector('[data-player="'+action.player+'"]');
      if(screener){screener.classList.add("screening");window.setTimeout(function(){screener.classList.remove("screening");},260);}
    }
  }

  function updateHud(){el.score.textContent=state.score;el.streak.textContent=state.streak;}
  function updateTimer(){if(state.accepting)el.timer.textContent=((performance.now()-state.startedAt)/1000).toFixed(2)+" s";}

  function buildSpots(){
    Object.keys(SPOTS).forEach(function(name){
      var p=SPOTS[name],spot=document.createElement("button");spot.type="button";spot.className="spot";spot.dataset.spot=name;
      spot.style.left=p.x+"%";spot.style.top=p.y+"%";spot.setAttribute("aria-label",name);
      spot.addEventListener("click",function(){chooseByTarget("spot",name);});el.spotsLayer.appendChild(spot);
    });
  }

  function clearResultMarks(){
    document.querySelectorAll(".spot,.player").forEach(function(n){n.classList.remove("best-target","selected-target","active-target");});
    el.answerArrow.classList.remove("visible");
  }

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
    closeFeedback();clearTimers();el.playScreen.classList.add("hidden");el.resultsScreen.classList.remove("hidden");
    el.resultScore.textContent=state.score;el.resultBestReads.textContent=state.counts.BEST;el.resultGood.textContent=state.counts.GOOD;
    el.resultAcceptable.textContent=state.counts.ACCEPTABLE;el.resultMisses.textContent=state.counts.POOR+state.counts.WRONG;
    el.resultAvg.textContent=Logic.average(state.times).toFixed(2)+" s";el.resultStreak.textContent=state.bestStreak;
  }

  function returnToSetup(){
    closeFeedback();clearTimers();state.accepting=false;el.playScreen.classList.add("hidden");el.resultsScreen.classList.add("hidden");el.setupScreen.classList.remove("hidden");
  }

  function closeFeedback(){el.feedbackBackdrop.classList.add("hidden");el.feedbackSheet.classList.add("hidden");}
  function clearTimers(){
    if(state.timer)window.clearInterval(state.timer);if(state.eventTimer)window.clearTimeout(state.eventTimer);
    state.timer=null;state.eventTimer=null;
  }
  function vibrate(pattern){if(navigator.vibrate)navigator.vibrate(pattern);}
})();