(function(){
  "use strict";

  var Logic=window.GameLogic;
  var PREVIEW_MS=950;
  var ROLES={1:"PG",2:"SG",3:"SF",4:"PF",5:"C"};
  var SPOTS={
    leftCorner:{x:10,y:18,label:"L CORNER"},
    rightCorner:{x:90,y:18,label:"R CORNER"},
    leftDunker:{x:35,y:20,label:"L DUNKER"},
    rightDunker:{x:65,y:20,label:"R DUNKER"},
    dunkerSpot:{x:65,y:20,label:"DUNKER"},
    paint:{x:50,y:31,label:"PAINT"},
    leftWing:{x:16,y:49,label:"L WING"},
    rightWing:{x:84,y:49,label:"R WING"},
    leftSlot:{x:33,y:72,label:"L SLOT"},
    rightSlot:{x:67,y:72,label:"R SLOT"},
    top:{x:50,y:86,label:"TOP"}
  };

  var selectedRole="random";
  var selectedMode="practice";
  var state=freshState();
  var el={};
  [
    "setupScreen","playScreen","resultsScreen","startBtn","exitBtn","resultsBackBtn","replayBtn",
    "roundLabel","roleBadge","score","streak","timer","triggerState","triggerText","court",
    "spotsLayer","playersLayer","ball","answerArrow","tapPrompt","feedbackBackdrop","feedbackSheet",
    "feedbackEyebrow","feedbackTitle","feedbackTime","feedbackText","nextBtn","resultScore",
    "resultCorrect","resultWrong","resultAccuracy","resultAvg","resultStreak","resultBest"
  ].forEach(function(id){el[id]=document.getElementById(id);});

  document.querySelectorAll("[data-role]").forEach(function(button){
    button.addEventListener("click",function(){
      selectedRole=button.getAttribute("data-role");
      document.querySelectorAll("[data-role]").forEach(function(item){item.classList.toggle("active",item===button);});
    });
  });

  document.querySelectorAll("[data-mode]").forEach(function(button){
    button.addEventListener("click",function(){
      selectedMode=button.getAttribute("data-mode");
      document.querySelectorAll("[data-mode]").forEach(function(item){item.classList.toggle("active",item===button);});
    });
  });

  el.startBtn.addEventListener("click",startGame);
  el.exitBtn.addEventListener("click",returnToSetup);
  el.resultsBackBtn.addEventListener("click",returnToSetup);
  el.replayBtn.addEventListener("click",startGame);
  el.nextBtn.addEventListener("click",nextRound);

  buildSpotTargets();

  function freshState(){
    return{
      pool:[],queue:[],scenario:null,round:0,score:0,streak:0,bestStreak:0,
      correct:0,wrong:0,times:[],accepting:false,triggerStartedAt:0,
      timerHandle:null,previewHandle:null
    };
  }

  function startGame(){
    closeFeedback();
    clearTimers();
    state=freshState();
    state.pool=window.SCENARIOS.filter(function(s){
      return selectedRole==="random"||String(s.controlledPlayer)===selectedRole;
    });
    if(!state.pool.length)return;
    state.queue=selectedMode==="challenge"?Logic.buildChallengeQueue(state.pool,20):[];
    el.setupScreen.classList.add("hidden");
    el.resultsScreen.classList.add("hidden");
    el.playScreen.classList.remove("hidden");
    nextRound();
  }

  function nextRound(){
    closeFeedback();
    clearTimers();
    if(selectedMode==="challenge"&&state.round>=20){
      finishChallenge();
      return;
    }
    state.round+=1;
    state.scenario=selectedMode==="challenge"?state.queue[state.round-1]:pickPracticeScenario();
    renderScenario(state.scenario);
    updateHud();
    el.roundLabel.textContent=selectedMode==="challenge"?"Challenge · "+state.round+"/20":"Practice · "+state.round;
    el.roleBadge.textContent=ROLES[state.scenario.controlledPlayer];
    el.triggerState.textContent="VALMISTAUDU";
    el.triggerState.classList.remove("live");
    el.triggerText.textContent="Katso lähtöasetelma.";
    el.tapPrompt.textContent="Katso ensin, sitten reagoi.";
    state.accepting=false;
    state.previewHandle=window.setTimeout(runTrigger,PREVIEW_MS);
  }

  function pickPracticeScenario(){
    if(state.pool.length===1)return state.pool[0];
    var choices=state.pool.filter(function(s){return !state.scenario||s.id!==state.scenario.id;});
    return choices[Math.floor(Math.random()*choices.length)];
  }

  function runTrigger(){
    var s=state.scenario;
    el.triggerState.textContent="REAGOI NYT";
    el.triggerState.classList.add("live");
    el.triggerText.textContent=s.triggerText;
    el.tapPrompt.textContent="Napauta oikeaa paikkaa.";
    setBall(s.ballTo);
    if(s.automaticMoves){
      Object.keys(s.automaticMoves).forEach(function(player){movePlayer(player,s.automaticMoves[player]);});
    }
    document.querySelectorAll(".spot").forEach(function(spot){spot.classList.add("active");});
    state.accepting=true;
    state.triggerStartedAt=performance.now();
    state.timerHandle=window.setInterval(updateTimer,33);
    updateTimer();
  }

  function renderScenario(s){
    el.playersLayer.innerHTML="";
    document.querySelectorAll(".spot").forEach(function(spot){spot.classList.remove("active","correct","wrong");});
    hideArrow();

    Object.keys(s.positions).forEach(function(playerNumber){
      var position=s.positions[playerNumber];
      var point=SPOTS[position];
      var player=document.createElement("button");
      player.type="button";
      player.className="player"+(Number(playerNumber)===s.controlledPlayer?" controlled":"");
      player.setAttribute("data-player",playerNumber);
      player.setAttribute("data-position",position);
      player.style.left=point.x+"%";
      player.style.top=point.y+"%";
      player.innerHTML="<span>"+playerNumber+"</span><small>"+(Number(playerNumber)===s.controlledPlayer?"SINÄ · ":"")+ROLES[playerNumber]+"</small>";
      if(Number(playerNumber)===s.controlledPlayer){
        player.setAttribute("aria-label","Sinä, "+ROLES[playerNumber]+", "+point.label);
        player.addEventListener("click",function(e){
          e.stopPropagation();
          if(state.accepting)answer(position);
        });
      }
      el.playersLayer.appendChild(player);
    });

    setBall(s.ballFrom,true);
  }

  function buildSpotTargets(){
    Object.keys(SPOTS).forEach(function(name){
      if(name==="dunkerSpot")return;
      var p=SPOTS[name];
      var spot=document.createElement("button");
      spot.type="button";
      spot.className="spot";
      spot.setAttribute("data-spot",name);
      spot.setAttribute("data-label",p.label);
      spot.setAttribute("aria-label",p.label);
      spot.style.left=p.x+"%";
      spot.style.top=p.y+"%";
      spot.addEventListener("click",function(){if(state.accepting)answer(name);});
      el.spotsLayer.appendChild(spot);
    });
  }

  function answer(chosen){
    if(!state.accepting)return;
    state.accepting=false;
    clearInterval(state.timerHandle);
    state.timerHandle=null;
    document.querySelectorAll(".spot").forEach(function(spot){spot.classList.remove("active");});

    var elapsed=(performance.now()-state.triggerStartedAt)/1000;
    var s=state.scenario;
    var correct=Logic.normalizeSpot(chosen)===Logic.normalizeSpot(s.correctPosition);
    state.times.push(elapsed);

    if(correct){
      var base=Logic.speedScore(elapsed);
      var bonus=Logic.comboBonus(state.streak);
      var gained=base+bonus;
      state.streak+=1;
      state.bestStreak=Math.max(state.bestStreak,state.streak);
      state.correct+=1;
      state.score+=gained;
      markSpot(s.correctPosition,"correct");
      vibrate(18);
      openFeedback(true,"+"+gained,elapsed,feedbackCopy(s,true));
    }else{
      state.streak=0;
      state.wrong+=1;
      state.score-=30;
      markSpot(chosen,"wrong");
      markSpot(s.correctPosition,"correct");
      showArrow(s);
      vibrate([55,45,55]);
      openFeedback(false,"−30",elapsed,feedbackCopy(s,false));
    }

    el.tapPrompt.textContent=correct?"Oikein.":"Katso oikea spacing-paikka.";
    updateHud();
  }

  function feedbackCopy(s,correct){
    var action=s.correctAction.toUpperCase()+" → "+SPOTS[s.correctPosition].label+".";
    if(selectedMode==="practice")return(correct?"": "Oikea ratkaisu: ")+action+" "+s.explanation;
    return(correct?"Oikea read: ":"Oikea ratkaisu: ")+action;
  }

  function openFeedback(correct,title,elapsed,text){
    el.feedbackSheet.classList.toggle("wrong",!correct);
    el.feedbackEyebrow.textContent=correct?"OIKEIN":"VÄÄRIN";
    el.feedbackTitle.textContent=title;
    el.feedbackTime.textContent=elapsed.toFixed(2)+" s";
    el.feedbackText.textContent=text;
    el.nextBtn.textContent=selectedMode==="challenge"&&state.round===20?"Näytä tulos":"Seuraava";
    el.feedbackBackdrop.classList.remove("hidden");
    el.feedbackSheet.classList.remove("hidden");
  }

  function closeFeedback(){
    el.feedbackBackdrop.classList.add("hidden");
    el.feedbackSheet.classList.add("hidden");
  }

  function updateHud(){
    el.score.textContent=state.score;
    el.streak.textContent=state.streak;
  }

  function updateTimer(){
    if(!state.accepting)return;
    el.timer.textContent=((performance.now()-state.triggerStartedAt)/1000).toFixed(2)+" s";
  }

  function markSpot(name,className){
    var normalized=Logic.normalizeSpot(name);
    var spot=el.spotsLayer.querySelector('[data-spot="'+normalized+'"]');
    if(spot)spot.classList.add(className);
  }

  function showArrow(s){
    var from=SPOTS[s.positions[String(s.controlledPlayer)]||s.positions[s.controlledPlayer]];
    var to=SPOTS[s.correctPosition];
    if(!from||!to)return;
    el.answerArrow.setAttribute("x1",from.x);
    el.answerArrow.setAttribute("y1",from.y);
    el.answerArrow.setAttribute("x2",to.x);
    el.answerArrow.setAttribute("y2",to.y);
    el.answerArrow.classList.add("visible");
  }

  function hideArrow(){el.answerArrow.classList.remove("visible");}

  function movePlayer(playerNumber,position){
    var player=el.playersLayer.querySelector('[data-player="'+playerNumber+'"]');
    var p=SPOTS[position];
    if(!player||!p)return;
    player.style.left=p.x+"%";
    player.style.top=p.y+"%";
    player.setAttribute("data-position",position);
  }

  function setBall(position,instant){
    var p=SPOTS[position];
    if(!p)return;
    if(instant){
      el.ball.style.transition="none";
      void el.ball.offsetHeight;
    }
    el.ball.style.left=p.x+"%";
    el.ball.style.top=p.y+"%";
    if(instant)window.requestAnimationFrame(function(){el.ball.style.transition="";});
  }

  function finishChallenge(){
    closeFeedback();
    clearTimers();
    el.playScreen.classList.add("hidden");
    el.resultsScreen.classList.remove("hidden");
    var accuracy=state.correct+state.wrong?Math.round(state.correct/(state.correct+state.wrong)*100):0;
    var avg=Logic.average(state.times);
    var best=readBest();
    if(state.score>best){best=state.score;writeBest(best);}
    el.resultScore.textContent=state.score;
    el.resultCorrect.textContent=state.correct;
    el.resultWrong.textContent=state.wrong;
    el.resultAccuracy.textContent=accuracy+"%";
    el.resultAvg.textContent=avg.toFixed(2)+" s";
    el.resultStreak.textContent=state.bestStreak;
    el.resultBest.textContent=best;
  }

  function returnToSetup(){
    closeFeedback();
    clearTimers();
    state.accepting=false;
    el.playScreen.classList.add("hidden");
    el.resultsScreen.classList.add("hidden");
    el.setupScreen.classList.remove("hidden");
  }

  function clearTimers(){
    if(state.timerHandle)window.clearInterval(state.timerHandle);
    if(state.previewHandle)window.clearTimeout(state.previewHandle);
    state.timerHandle=null;
    state.previewHandle=null;
    el.timer.textContent="—";
  }

  function vibrate(pattern){
    if(navigator.vibrate)navigator.vibrate(pattern);
  }

  function readBest(){
    try{return Number(localStorage.getItem("ppstats-decision-best")||0)||0;}catch(e){return 0;}
  }

  function writeBest(value){
    try{localStorage.setItem("ppstats-decision-best",String(value));}catch(e){}
  }
})();