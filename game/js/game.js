(function(){
  "use strict";

  var Logic=window.GameLogic;
  var Rules=window.GameRules;
  var Generator=window.PuzzleGenerator;

  var CUE_MS=650;
  var ACTION_MS=1050;
  var SETTLE_MS=650;
  var CONTINUE_MS=800;

  var SPOTS={
    LEFT_SLOT:{x:32,y:74,label:"LS"},RIGHT_SLOT:{x:68,y:74,label:"RS"},
    LEFT_WING:{x:14,y:49,label:"LW"},RIGHT_WING:{x:86,y:49,label:"RW"},
    LEFT_BLOCK:{x:40,y:24,label:"LB"},RIGHT_BLOCK:{x:60,y:24,label:"RB"},
    LEFT_DUNKER:{x:34,y:17,label:"LD"},RIGHT_DUNKER:{x:66,y:17,label:"RD"},
    LEFT_HIGH_POST:{x:42,y:39,label:"LHP"},RIGHT_HIGH_POST:{x:58,y:39,label:"RHP"},
    LEFT_CORNER:{x:8,y:20,label:"LC"},RIGHT_CORNER:{x:92,y:20,label:"RC"},
    LEFT_SHAKE:{x:23,y:58,label:"LSH"},RIGHT_SHAKE:{x:77,y:58,label:"RSH"},
    RIM:{x:50,y:11,label:"RIM"}
  };

  var CATEGORY_LABELS={
    THRU_CUT:"THRU CUT",
    FIRST_FILL:"FIRST FILL",
    SECOND_FILL:"SECOND FILL",
    COMPLETED_ROTATION:"ROTATION",
    SLOT_EXCHANGE:"SLOT EXCHANGE",
    EXCHANGE_PARTNER:"EXCHANGE PARTNER",
    P5_WEAK_SIDE:"P5 WEAK SIDE",
    P5_WING_REACTION:"P5 WING REACTION",
    BALL_SCREEN:"BALL SCREEN",
    SHAKE:"SHAKE / LIFT",
    WEAK_SIDE_EXCHANGE:"WEAK-SIDE EXCHANGE",
    ROLL:"ROLL",
    CUTTER_CURL:"READ OPPOSITE",
    CUTTER_POP:"READ OPPOSITE",
    BASELINE_DRIVE:"BASELINE DRIVE"
  };

  var selectedMode="practice";
  var state=freshState();
  var el={};
  [
    "setupScreen","playScreen","resultsScreen","startBtn","exitBtn","resultsBackBtn","replayBtn",
    "categoryLabel","roundLabel","roleBadge","score","streak","timer","triggerState","eventCounter",
    "triggerText","decisionHint","court","spotsLayer","playersLayer","ball","tapMarker","actionPrompt",
    "rulePrompt","gestureStatus","possessionStatus","confirmSpacingBtn","feedbackBackdrop","feedbackSheet",
    "feedbackEyebrow","feedbackTitle","feedbackTime","selectedActionText","feedbackText","bestReadBox",
    "nextBtn","resultScore","resultCorrect","resultWrong","resultDecisions","resultAvg","resultStreak","resultAccuracy"
  ].forEach(function(id){el[id]=document.getElementById(id);});

  document.querySelectorAll("[data-mode]").forEach(function(button){
    button.addEventListener("click",function(){
      selectedMode=button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach(function(item){item.classList.toggle("active",item===button);});
    });
  });

  el.startBtn.addEventListener("click",startGame);
  el.exitBtn.addEventListener("click",returnToSetup);
  el.resultsBackBtn.addEventListener("click",returnToSetup);
  el.replayBtn.addEventListener("click",startGame);
  el.nextBtn.addEventListener("click",handleFeedbackNext);
  el.confirmSpacingBtn.addEventListener("click",function(){
    if(state.accepting)submitInput({type:"CONFIRM"});
  });

  buildSpots();

  function freshState(){
    return{
      puzzle:null,currentState:null,reactions:[],reactionIndex:0,
      round:0,score:0,streak:0,bestStreak:0,correct:0,wrong:0,times:[],
      accepting:false,startedAt:0,timer:null,roundToken:0,feedbackNext:"next"
    };
  }

  function startGame(){
    closeFeedback();
    clearTimer();
    state=freshState();
    el.setupScreen.classList.add("hidden");
    el.resultsScreen.classList.add("hidden");
    el.playScreen.classList.remove("hidden");
    nextRound();
  }

  async function nextRound(){
    closeFeedback();
    clearTimer();
    clearTargets();

    if(selectedMode==="challenge"&&state.round>=20){
      finishChallenge();
      return;
    }

    state.round++;
    state.roundToken++;
    var token=state.roundToken;
    state.puzzle=Generator.generatePuzzle({category:dueReviewCategory()});
    state.currentState=Generator.clone(state.puzzle.initialState);
    state.reactions=state.puzzle.reactionQueue.slice();
    state.reactionIndex=0;
    state.accepting=false;

    el.categoryLabel.textContent=CATEGORY_LABELS[state.puzzle.category]||state.puzzle.category;
    el.roundLabel.textContent=selectedMode==="challenge"?"Challenge · "+state.round+"/20":"Practice · "+state.round;
    el.triggerState.textContent="TILANNE";
    el.triggerState.classList.remove("live");
    el.triggerText.textContent="Katso mitä hyökkäys tekee.";
    el.decisionHint.textContent="";
    el.actionPrompt.textContent="Seuraa tapahtumaa…";
    el.rulePrompt.textContent="";
    el.gestureStatus.textContent="Päätös tulee vasta animaation jälkeen.";
    el.possessionStatus.classList.add("hidden");
    el.confirmSpacingBtn.classList.add("hidden");
    el.timer.textContent="—";

    renderCourt(true);
    await wait(700);

    for(var i=0;i<state.puzzle.playbackEvents.length;i++){
      if(token!==state.roundToken)return;
      var event=state.puzzle.playbackEvents[i];
      await animateEvent(event,"VAIHE "+(i+1)+"/"+state.puzzle.playbackEvents.length);
      state.currentState=Generator.applyEvent(state.currentState,event);
      updateCourt();
      await wait(SETTLE_MS);
    }

    if(token!==state.roundToken)return;
    state.currentState=Generator.clone(state.puzzle.decisionState);
    updateCourt();
    await wait(400);
    beginDecision();
  }

  function beginDecision(){
    clearTargets();
    var expected=state.reactions[state.reactionIndex];
    if(!expected){
      finishPuzzle(true,0,null);
      return;
    }

    state.accepting=true;
    el.triggerState.textContent="PÄÄTÖS "+(state.reactionIndex+1)+"/"+state.reactions.length;
    el.triggerState.classList.add("live");
    el.eventCounter.textContent="";
    el.roleBadge.textContent=expected.player||"✓";
    el.triggerText.textContent=decisionQuestion(expected);
    el.decisionHint.textContent=expected.player?"Keltainen pelaaja: "+expected.player:"Tarkista koko muodostelma";
    el.actionPrompt.textContent=expected.type==="CONFIRM"?"Onko 4-out-spacing valmis?":"Mihin pelaajan pitää liikkua?";
    el.rulePrompt.textContent=expected.rule||"";
    el.possessionStatus.textContent="Possession · päätös "+(state.reactionIndex+1)+"/"+state.reactions.length;
    el.possessionStatus.classList.remove("hidden");

    if(expected.type==="CONFIRM"){
      el.gestureStatus.textContent="Tarkista neljä perimeter-paikkaa ja vahvista.";
      el.confirmSpacingBtn.classList.remove("hidden");
    }else if(expected.type==="SCREEN"){
      el.gestureStatus.textContent="Napauta pelaajaa, jolle "+expected.player+" menee screeniin.";
      markPlayerTargets(expected.player);
    }else if(expected.type==="CHOICE"){
      el.gestureStatus.textContent="Screenin jälkeen valitse oma jatko: exchange/fill tai slip korille.";
      markSpotTargets();
    }else{
      el.gestureStatus.textContent="Napauta kentältä tila, johon "+expected.player+" kuuluu seuraavaksi.";
      markSpotTargets();
    }

    updateCourt();
    state.startedAt=performance.now();
    state.timer=window.setInterval(updateTimer,33);
  }

  function decisionQuestion(expected){
    if(expected.type==="CONFIRM")return"Tunnista valmis uusi spacing.";
    if(expected.type==="SCREEN")return"Mihin "+expected.player+" liikkuu?";
    if(expected.type==="CHOICE")return"Miten "+expected.player+" jatkaa screenin jälkeen?";
    return"Mihin "+expected.player+" liikkuu seuraavaksi?";
  }

  function buildSpots(){
    Object.keys(SPOTS).forEach(function(name){
      var point=SPOTS[name];
      var spot=document.createElement("button");
      spot.type="button";
      spot.className="spot";
      spot.dataset.spot=name;
      spot.dataset.label=point.label;
      spot.style.left=point.x+"%";
      spot.style.top=point.y+"%";
      spot.tabIndex=-1;
      spot.addEventListener("click",function(e){
        e.stopPropagation();
        if(!state.accepting)return;
        var expected=state.reactions[state.reactionIndex];
        if(!expected||expected.type==="CONFIRM")return;
        showTapMarker(point.x,point.y);
        submitInput({type:"MOVE",player:expected.player,targetLocation:name});
      });
      el.spotsLayer.appendChild(spot);
    });
  }

  function renderCourt(initial){
    if(initial){
      el.playersLayer.innerHTML="";
      Object.keys(state.currentState.offense).forEach(function(id){
        var player=document.createElement("button");
        player.type="button";
        player.className="player";
        player.dataset.player=id;
        player.innerHTML="<span>"+id.replace("P","")+"</span><small>"+id+"</small>";
        player.addEventListener("click",function(e){
          e.stopPropagation();
          if(!state.accepting)return;
          var expected=state.reactions[state.reactionIndex];
          if(!expected||expected.type==="CONFIRM"||id===expected.player)return;
          submitInput({type:"SCREEN",player:expected.player,targetPlayer:id});
        });
        el.playersLayer.appendChild(player);
      });
    }
    updateCourt();
  }

  function updateCourt(){
    var expected=state.reactions[state.reactionIndex];
    Object.keys(state.currentState.offense).forEach(function(id){
      var node=playerNode(id);
      var point=displayPointForPlayer(state.currentState,id);
      if(!node||!point)return;
      setTransition(node,ACTION_MS);
      node.style.left=point.x+"%";
      node.style.top=point.y+"%";
      node.classList.toggle("decision",state.accepting&&expected&&expected.player===id);
      node.classList.toggle("ballhandler",state.currentState.ballHandler===id);
      node.querySelector("small").textContent=(state.accepting&&expected&&expected.player===id?"SINÄ · ":"")+id;
    });

    var ballPoint=SPOTS[state.currentState.ballLocation];
    if(ballPoint)moveBall(ballPoint,ACTION_MS);
  }

  function displayPointForPlayer(gameState,id){
    var player=gameState.offense[id];
    if(!player)return null;

    if(player.screeningTarget){
      var target=gameState.offense[player.screeningTarget];
      var targetPoint=target&&SPOTS[target.location];
      if(targetPoint){
        var base=SPOTS[player.location]||targetPoint;
        return{
          x:targetPoint.x+(base.x<targetPoint.x?-5:5),
          y:targetPoint.y+4
        };
      }
    }

    var point=SPOTS[player.location];
    if(!point)return null;

    var occupants=Object.keys(gameState.offense).filter(function(pid){
      return gameState.offense[pid].location===player.location&&!gameState.offense[pid].screeningTarget;
    });
    if(occupants.length>1){
      var index=occupants.indexOf(id);
      return{x:point.x+(index-(occupants.length-1)/2)*5,y:point.y+(index%2?3:-3)};
    }
    return point;
  }

  function markSpotTargets(){
    document.querySelectorAll(".spot").forEach(function(node){node.classList.add("target-mode");});
  }

  function markPlayerTargets(activePlayer){
    document.querySelectorAll(".player").forEach(function(node){
      if(node.dataset.player!==activePlayer)node.classList.add("target-player");
    });
  }

  function clearTargets(){
    el.confirmSpacingBtn.classList.add("hidden");
    document.querySelectorAll(".spot").forEach(function(node){node.classList.remove("target-mode","correct-target","wrong-target");});
    document.querySelectorAll(".player").forEach(function(node){node.classList.remove("target-player","event-focus","screening");});
  }

  async function submitInput(input){
    if(!state.accepting)return;
    state.accepting=false;
    clearTimer();
    clearTargets();

    var expected=state.reactions[state.reactionIndex];
    var elapsed=(performance.now()-state.startedAt)/1000;
    var result=Rules.evaluateInput(expected,input,state.currentState);
    var correct=result.correct;
    var resolvedReaction=result.selectedOption||expected;
    var points=Logic.pointsForAnswer(elapsed,correct,state.streak);

    state.times.push(elapsed);
    state.score+=points;
    if(correct){
      state.correct++;
      state.streak++;
      state.bestStreak=Math.max(state.bestStreak,state.streak);
    }else{
      state.wrong++;
      state.streak=0;
      scheduleReview(state.puzzle.category);
    }
    updateHud();

    if(correct){
      el.triggerState.textContent="OIKEIN";
      el.triggerText.textContent=Rules.describeReaction(resolvedReaction);
      await wait(CUE_MS);
      await animateReaction(resolvedReaction);
      state.currentState=Rules.applyReaction(state.currentState,resolvedReaction);

      var branch=expected.type==="CHOICE"
        ?Generator.resolveChoiceOutcome(state.currentState,expected,resolvedReaction,Math.random)
        :null;

      if(branch){
        for(var b=0;b<branch.events.length;b++){
          await wait(SETTLE_MS);
          await animateEvent(branch.events[b],"JATKO");
          state.currentState=Generator.applyEvent(state.currentState,branch.events[b]);
          updateCourt();
        }
        if(branch.reactions.length){
          var insertAt=state.reactionIndex+1;
          var args=[insertAt,0].concat(branch.reactions);
          Array.prototype.splice.apply(state.reactions,args);
        }
        if(branch.outcome==="SLIP_PASS"){
          el.possessionStatus.textContent="Slip sai pallon · possession jatkuu uudesta tilanteesta.";
          el.possessionStatus.classList.remove("hidden");
        }else if(branch.outcome==="SLIP_NO_PASS"){
          el.possessionStatus.textContent="Slip ei saanut palloa · täytä vapaa wing.";
          el.possessionStatus.classList.remove("hidden");
        }
      }

      state.reactionIndex++;
      updateCourt();
      await wait(CONTINUE_MS);

      if(state.reactionIndex<state.reactions.length){
        beginDecision();
      }else{
        finishPuzzle(true,elapsed,{input:input,expected:resolvedReaction,points:points});
      }
      return;
    }

    el.triggerState.textContent="VÄÄRIN";
    el.triggerText.textContent="Katsotaan valinta ja oikea liike.";
    await wait(450);
    await animateWrongAttempt(input,expected.player);
    await wait(450);

    el.triggerState.textContent="OIKEA LIIKE";
    var correction=expected.type==="CHOICE"?expected.options[0]:expected;
    el.triggerText.textContent=Rules.describeReaction(correction);
    await wait(CUE_MS);
    await animateReaction(correction);
    state.currentState=Rules.applyReaction(state.currentState,correction);
    state.reactionIndex++;
    updateCourt();
    await wait(SETTLE_MS);

    openFeedback(false,points,elapsed,input,expected);
    state.feedbackNext=state.reactionIndex<state.reactions.length?"continue":"next";
  }

  async function animateEvent(event,counter){
    el.eventCounter.textContent=counter||"";
    el.triggerText.textContent=event.label||"";
    clearEventFocus();

    if(event.type==="WAIT"){
      await wait(event.duration||850);
      return;
    }

    if(event.type==="PASS"){
      focusPlayer(event.fromPlayer);focusPlayer(event.toPlayer);
      await wait(CUE_MS);
      var target=state.currentState.offense[event.toPlayer];
      if(target&&SPOTS[target.location])moveBall(SPOTS[target.location],event.duration||ACTION_MS);
      await wait(event.duration||ACTION_MS);
      clearEventFocus();
      return;
    }

    if(event.type==="MOVE"||event.type==="DRIVE"){
      focusPlayer(event.player);
      await wait(CUE_MS);
      var path=(event.path||[]).slice();
      if(event.to)path=[event.to];
      await animatePlayerPath(event.player,path,event.duration||ACTION_MS);
      clearEventFocus();
      return;
    }

    if(event.type==="SCREEN"){
      focusPlayer(event.player);focusPlayer(event.targetPlayer);
      await wait(CUE_MS);
      await animateScreen(event.player,event.targetPlayer,event.duration||ACTION_MS);
      clearEventFocus();
      return;
    }

    if(event.type==="GROUP"){
      (event.moves||[]).forEach(function(move){focusPlayer(move.player);});
      await wait(CUE_MS);
      await Promise.all((event.moves||[]).map(function(move){
        var path=(move.path||[]).slice();
        if(move.to)path=[move.to];
        return animatePlayerPath(move.player,path,event.duration||ACTION_MS);
      }));
      clearEventFocus();
    }
  }

  async function animateReaction(reaction){
    if(reaction.type==="MOVE"){
      focusPlayer(reaction.player);
      await animatePlayerPath(reaction.player,reaction.path||[reaction.targetLocation],ACTION_MS);
      clearEventFocus();
      return;
    }
    if(reaction.type==="SCREEN"){
      focusPlayer(reaction.player);focusPlayer(reaction.targetPlayer);
      await animateScreen(reaction.player,reaction.targetPlayer,ACTION_MS);
      clearEventFocus();
    }
  }

  async function animateWrongAttempt(input,activePlayer){
    if(input.type==="MOVE"&&SPOTS[input.targetLocation]){
      var node=playerNode(activePlayer);
      if(!node)return;
      var start=displayPointForPlayer(state.currentState,activePlayer);
      var target=SPOTS[input.targetLocation];
      setTransition(node,650);
      node.style.left=target.x+"%";node.style.top=target.y+"%";
      markSpot(input.targetLocation,"wrong-target");
      await wait(650);
      setTransition(node,500);
      if(start){node.style.left=start.x+"%";node.style.top=start.y+"%";}
      await wait(500);
    }else if(input.type==="SCREEN"){
      await animateScreen(activePlayer,input.targetPlayer,650);
      updateCourt();
      await wait(400);
    }
  }

  async function animatePlayerPath(playerId,path,totalDuration){
    var node=playerNode(playerId);
    if(!node||!path||!path.length)return;
    var segment=totalDuration/path.length;
    for(var i=0;i<path.length;i++){
      var point=SPOTS[path[i]];
      if(!point)continue;
      setTransition(node,segment);
      node.style.left=point.x+"%";
      node.style.top=point.y+"%";
      await wait(segment);
    }
    setTransition(node,ACTION_MS);
  }

  async function animateScreen(playerId,targetId,duration){
    var screener=playerNode(playerId),target=playerNode(targetId);
    if(!screener||!target){await wait(duration);return;}
    var tx=parseFloat(target.style.left),ty=parseFloat(target.style.top),sx=parseFloat(screener.style.left);
    setTransition(screener,duration);
    screener.style.left=(tx+(sx<tx?-5:5))+"%";
    screener.style.top=(ty+4)+"%";
    screener.classList.add("screening");
    await wait(duration);
    screener.classList.remove("screening");
  }

  function finishPuzzle(correct,elapsed,detail){
    var spacing=Rules.validateSpacing(state.currentState);
    var finalText=state.puzzle.finalValidation==="STANDARD_4_OUT"
      ?(spacing.standard4Out?"4-out-spacing on palautettu oikein.":"Spacing ei ole vielä tasapainossa.")
      :"Liikesarja valmis.";

    openFeedback(true,detail?detail.points:0,elapsed||0,detail&&detail.input,detail&&detail.expected,finalText);
    state.feedbackNext="next";
  }

  function openFeedback(correct,points,elapsed,input,expected,overrideText){
    el.feedbackSheet.className="feedback-sheet"+(correct?"":" wrong");
    el.feedbackEyebrow.textContent=correct?"OIKEIN":"VÄÄRIN";
    el.feedbackTitle.textContent=(points>=0?"+":"")+points;
    el.feedbackTime.textContent=(elapsed||0).toFixed(2)+" s";
    el.selectedActionText.textContent=input?"Valitsit: "+Rules.describeInput(input):"Possession valmis.";
    el.feedbackText.textContent=overrideText||(expected&&expected.reason)||"";
    el.bestReadBox.textContent=expected?"Oikea reaktio: "+Rules.describeReaction(expected):"";
    el.nextBtn.textContent=state.feedbackNext==="continue"?"Jatka possessionia":"Seuraava";
    el.feedbackBackdrop.classList.remove("hidden");
    el.feedbackSheet.classList.remove("hidden");
  }

  function handleFeedbackNext(){
    closeFeedback();
    if(state.feedbackNext==="continue"){
      state.feedbackNext="next";
      wait(CONTINUE_MS).then(beginDecision);
    }else{
      nextRound();
    }
  }

  function markSpot(location,className){
    var node=el.spotsLayer.querySelector('[data-spot="'+location+'"]');
    if(node)node.classList.add(className);
  }

  function showTapMarker(x,y){
    el.tapMarker.style.left=x+"%";
    el.tapMarker.style.top=y+"%";
    el.tapMarker.classList.remove("hidden");
    window.setTimeout(function(){el.tapMarker.classList.add("hidden");},500);
  }

  function playerNode(id){return el.playersLayer.querySelector('[data-player="'+id+'"]');}
  function focusPlayer(id){var node=playerNode(id);if(node)node.classList.add("event-focus");}
  function clearEventFocus(){document.querySelectorAll(".player").forEach(function(node){node.classList.remove("event-focus");});}
  function setTransition(node,ms){if(node)node.style.transitionDuration=ms+"ms";}
  function moveBall(point,ms){setTransition(el.ball,ms||ACTION_MS);el.ball.style.left=point.x+"%";el.ball.style.top=point.y+"%";}

  function updateHud(){
    el.score.textContent=state.score;
    el.streak.textContent=state.streak;
  }

  function updateTimer(){
    if(state.accepting)el.timer.textContent=((performance.now()-state.startedAt)/1000).toFixed(2)+" s";
  }

  function clearTimer(){
    if(state.timer)window.clearInterval(state.timer);
    state.timer=null;
  }

  var reviewQueue=[];
  function scheduleReview(category){
    if(selectedMode!=="practice")return;
    var exists=reviewQueue.some(function(item){return item.category===category&&item.dueRound>state.round;});
    if(!exists)reviewQueue.push({category:category,dueRound:state.round+3});
  }

  function dueReviewCategory(){
    if(selectedMode!=="practice")return null;
    var index=reviewQueue.findIndex(function(item){return item.dueRound<=state.round+1;});
    if(index<0)return null;
    return reviewQueue.splice(index,1)[0].category;
  }

  function finishChallenge(){
    closeFeedback();
    clearTimer();
    el.playScreen.classList.add("hidden");
    el.resultsScreen.classList.remove("hidden");
    var total=state.correct+state.wrong;
    el.resultScore.textContent=state.score;
    el.resultCorrect.textContent=state.correct;
    el.resultWrong.textContent=state.wrong;
    el.resultDecisions.textContent=total;
    el.resultAvg.textContent=Logic.average(state.times).toFixed(2)+" s";
    el.resultStreak.textContent=state.bestStreak;
    el.resultAccuracy.textContent=(total?Math.round(state.correct/total*100):0)+"%";
  }

  function returnToSetup(){
    state.roundToken++;
    clearTimer();
    closeFeedback();
    state.accepting=false;
    el.playScreen.classList.add("hidden");
    el.resultsScreen.classList.add("hidden");
    el.setupScreen.classList.remove("hidden");
  }

  function closeFeedback(){
    el.feedbackBackdrop.classList.add("hidden");
    el.feedbackSheet.classList.add("hidden");
  }

  function wait(ms){return new Promise(function(resolve){window.setTimeout(resolve,ms);});}
})();