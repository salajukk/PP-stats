(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GameRules=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  var PERIMETER=["LEFT_SLOT","RIGHT_SLOT","LEFT_WING","RIGHT_WING"];
  var SCORE_CLASS=[
    {min:90,name:"BEST"},
    {min:75,name:"GOOD"},
    {min:50,name:"ACCEPTABLE"},
    {min:20,name:"POOR"},
    {min:-Infinity,name:"WRONG"}
  ];

  function clone(value){return JSON.parse(JSON.stringify(value));}

  function actionKey(action){
    if(action.type==="PASS")return "PASS|"+action.player+"|"+action.targetPlayer;
    if(action.type==="CUT")return "CUT|"+action.player+"|"+(action.cutType||"") +"|"+(action.targetLocation||"");
    if(action.type==="FILL")return "FILL|"+action.player+"|"+action.targetLocation;
    if(action.type==="SCREEN")return "SCREEN|"+action.player+"|"+action.targetPlayer+"|"+(action.screenType||"");
    if(action.type==="DRIVE")return "DRIVE|"+action.player+"|"+(action.driveType||"");
    if(action.type==="SHOOT")return "SHOOT|"+action.player;
    if(action.type==="HOLD")return "HOLD|"+action.player;
    if(action.type==="SEQUENCE")return "SEQUENCE|"+action.player+"|"+action.sequenceId;
    return action.type+"|"+action.player;
  }

  function makeAction(type,player,props){
    var action=Object.assign({type:type,player:player},props||{});
    action.id=actionKey(action);
    return action;
  }

  function addAction(map,action){map[action.id]=action;}

  function getDefender(state,player){
    var found=null;
    Object.keys(state.defense||{}).some(function(id){
      var defender=state.defense[id];
      if(defender.guarding===player){found=defender;return true;}
      return false;
    });
    return found||{};
  }

  function nearestOtherPerimeter(state,player){
    var own=state.offense[player]&&state.offense[player].location;
    var candidates=Object.keys(state.offense||{}).filter(function(id){
      return id!==player&&PERIMETER.indexOf(state.offense[id].location)>=0;
    });
    if(!candidates.length)return null;
    var order={
      LEFT_SLOT:["LEFT_WING","RIGHT_SLOT","RIGHT_WING"],
      RIGHT_SLOT:["RIGHT_WING","LEFT_SLOT","LEFT_WING"],
      LEFT_WING:["LEFT_SLOT","RIGHT_WING","RIGHT_SLOT"],
      RIGHT_WING:["RIGHT_SLOT","LEFT_WING","LEFT_SLOT"]
    };
    var preferred=order[own]||PERIMETER;
    candidates.sort(function(a,b){
      return preferred.indexOf(state.offense[a].location)-preferred.indexOf(state.offense[b].location);
    });
    return candidates[0];
  }

  function getValidActions(state){
    var map={};
    var player=state.decisionPlayer;
    var ctx=state.context||{};

    addAction(map,makeAction("HOLD",player));

    if(ctx.trigger&&ctx.trigger.type==="SLOT_TO_WING_PASS"&&ctx.trigger.passer===player){
      addAction(map,makeAction("CUT",player,{
        cutType:"THRU",
        targetLocation:ctx.trigger.oppositeWing,
        path:["RIM",ctx.trigger.oppositeWing]
      }));
      var screenTarget=ctx.trigger.screenTarget||nearestOtherPerimeter(state,player);
      if(screenTarget)addAction(map,makeAction("SCREEN",player,{targetPlayer:screenTarget,screenType:"OFF_BALL"}));
    }

    if(ctx.vacantSpot&&ctx.fillPlayer===player){
      addAction(map,makeAction("FILL",player,{targetLocation:ctx.vacantSpot}));
      addAction(map,makeAction("CUT",player,{cutType:"BASKET",targetLocation:"RIM",path:["RIM"]}));
    }

    if(ctx.offBallScreen&&ctx.offBallScreen.cutter===player){
      addAction(map,makeAction("CUT",player,{cutType:"CURL",targetLocation:ctx.offBallScreen.curlTarget||"RIM",path:[ctx.offBallScreen.curlTarget||"RIM"]}));
      addAction(map,makeAction("CUT",player,{cutType:"STRAIGHT",targetLocation:ctx.offBallScreen.popTarget||state.offense[player].location,path:[ctx.offBallScreen.popTarget||state.offense[player].location]}));
      addAction(map,makeAction("CUT",player,{cutType:"BACKDOOR",targetLocation:"RIM",path:["RIM"]}));
      addAction(map,makeAction("CUT",player,{cutType:"FADE",targetLocation:ctx.offBallScreen.fadeTarget||state.offense[player].location,path:[ctx.offBallScreen.fadeTarget||state.offense[player].location]}));
    }

    if(ctx.secondCut&&ctx.secondCut.screener===player){
      addAction(map,makeAction("CUT",player,{cutType:"ROLL",targetLocation:ctx.secondCut.rollLocation||"RIM",path:[ctx.secondCut.rollLocation||"RIM"]}));
      addAction(map,makeAction("CUT",player,{cutType:"POP",targetLocation:ctx.secondCut.popLocation,path:[ctx.secondCut.popLocation]}));
    }

    if(ctx.postEntry&&ctx.postEntry.ballHandler===player){
      addAction(map,makeAction("PASS",player,{targetPlayer:ctx.postEntry.postPlayer}));
      if(ctx.postEntry.reversalPlayer)addAction(map,makeAction("PASS",player,{targetPlayer:ctx.postEntry.reversalPlayer}));
      addAction(map,makeAction("DRIVE",player,{driveType:"ADVANTAGE"}));
    }

    if(ctx.ballScreenRead&&ctx.ballScreenRead.ballHandler===player){
      addAction(map,makeAction("PASS",player,{targetPlayer:ctx.ballScreenRead.roller}));
      if(ctx.ballScreenRead.shakePlayer)addAction(map,makeAction("PASS",player,{targetPlayer:ctx.ballScreenRead.shakePlayer}));
      if(ctx.ballScreenRead.skipPlayer)addAction(map,makeAction("PASS",player,{targetPlayer:ctx.ballScreenRead.skipPlayer}));
      addAction(map,makeAction("DRIVE",player,{driveType:"TURN_CORNER"}));
      addAction(map,makeAction("DRIVE",player,{driveType:"REJECT"}));
    }

    if(ctx.splitScreen&&ctx.splitScreen.passer===player){
      addAction(map,makeAction("SCREEN",player,{targetPlayer:ctx.splitScreen.screenTarget,screenType:"SPLIT"}));
      addAction(map,makeAction("CUT",player,{cutType:"BASKET",targetLocation:"RIM",path:["RIM"]}));
    }

    if(ctx.postSplit&&ctx.postSplit.passer===player){
      addAction(map,makeAction("SEQUENCE",player,{
        sequenceId:"POST_SPLIT_SLIP",
        steps:[
          makeAction("PASS",player,{targetPlayer:ctx.postSplit.postPlayer}),
          makeAction("SCREEN",player,{targetPlayer:ctx.postSplit.screenTarget,screenType:"SPLIT"}),
          makeAction("CUT",player,{cutType:"SLIP",targetLocation:ctx.postSplit.slipLocation,path:[ctx.postSplit.slipLocation]})
        ]
      }));
      addAction(map,makeAction("PASS",player,{targetPlayer:ctx.postSplit.postPlayer}));
      if(ctx.postSplit.reversalPlayer)addAction(map,makeAction("PASS",player,{targetPlayer:ctx.postSplit.reversalPlayer}));
    }

    if(ctx.catch&&ctx.catch.player===player){
      addAction(map,makeAction("SHOOT",player));
      addAction(map,makeAction("DRIVE",player,{driveType:"CLOSEOUT_ATTACK"}));
      if(ctx.catch.postPlayer)addAction(map,makeAction("PASS",player,{targetPlayer:ctx.catch.postPlayer}));
    }

    return Object.keys(map).map(function(id){return map[id];});
  }

  function occupiedByOther(state,action){
    if(!action.targetLocation)return false;
    if(action.type!=="CUT"&&action.type!=="FILL")return false;
    return Object.keys(state.offense||{}).some(function(id){
      return id!==action.player&&state.offense[id].location===action.targetLocation;
    });
  }

  function scoreAction(state,action){
    var ctx=state.context||{};
    var score=action.type==="HOLD"?5:40;

    if(action.type==="PASS")score=50;
    if(action.type==="CUT")score=45;
    if(action.type==="FILL")score=55;
    if(action.type==="SCREEN")score=50;
    if(action.type==="DRIVE")score=55;
    if(action.type==="SHOOT")score=45;
    if(action.type==="SEQUENCE")score=60;

    if(occupiedByOther(state,action))score=-100;

    if(ctx.justPassedBy===action.player&&action.type==="HOLD")score=-100;

    if(ctx.trigger&&ctx.trigger.type==="SLOT_TO_WING_PASS"&&ctx.trigger.passer===action.player){
      if(action.type==="CUT"&&action.cutType==="THRU")score=96;
      if(action.type==="SCREEN")score=Math.max(score,58);
      if(action.type==="HOLD")score=-100;
    }

    if(ctx.vacantSpot&&ctx.fillPlayer===action.player){
      if(action.type==="FILL"&&action.targetLocation===ctx.vacantSpot)score=94;
      if(action.type==="CUT")score=Math.max(score,42);
      if(action.type==="HOLD")score=5;
    }

    if(ctx.offBallScreen&&ctx.offBallScreen.cutter===action.player){
      var cutterDef=getDefender(state,action.player);
      var coverage=cutterDef.screenCoverage||"TRAIL";
      var hardDeny=cutterDef.denyLevel==="HARD"||cutterDef.overplay==="TOP_LOCK";
      var cheatsInside=cutterDef.helpPosition==="GAP"&&cutterDef.overplay==="INSIDE";

      if(hardDeny){
        if(action.type==="CUT"&&action.cutType==="BACKDOOR")score=98;
        else if(action.type==="CUT"&&action.cutType==="CURL")score=10;
        else if(action.type==="CUT"&&action.cutType==="STRAIGHT")score=55;
        else if(action.type==="CUT"&&action.cutType==="FADE")score=62;
      }else if(cheatsInside){
        if(action.type==="CUT"&&action.cutType==="FADE")score=92;
        else if(action.type==="CUT"&&action.cutType==="CURL")score=48;
        else if(action.type==="CUT"&&action.cutType==="BACKDOOR")score=60;
      }else if(coverage==="UNDER"){
        if(action.type==="CUT"&&action.cutType==="STRAIGHT")score=94;
        else if(action.type==="CUT"&&action.cutType==="CURL")score=46;
        else if(action.type==="CUT"&&action.cutType==="BACKDOOR")score=58;
      }else{
        if(action.type==="CUT"&&action.cutType==="CURL")score=96;
        else if(action.type==="CUT"&&action.cutType==="STRAIGHT")score=58;
        else if(action.type==="CUT"&&action.cutType==="BACKDOOR")score=64;
        else if(action.type==="CUT"&&action.cutType==="FADE")score=44;
      }
    }

    if(ctx.secondCut&&ctx.secondCut.screener===action.player){
      if(ctx.secondCut.cutterAction==="CURL"){
        if(action.type==="CUT"&&action.cutType==="POP")score=94;
        if(action.type==="CUT"&&action.cutType==="ROLL")score=45;
      }else if(ctx.secondCut.cutterAction==="POP"){
        if(action.type==="CUT"&&action.cutType==="ROLL")score=94;
        if(action.type==="CUT"&&action.cutType==="POP")score=38;
      }else if(ctx.secondCut.cutterAction==="BACKDOOR"){
        if(action.type==="CUT"&&action.cutType==="POP")score=82;
        if(action.type==="CUT"&&action.cutType==="ROLL")score=68;
      }
      if(action.type==="HOLD")score=-80;
    }

    if(ctx.postEntry&&ctx.postEntry.ballHandler===action.player){
      var postDef=getDefender(state,ctx.postEntry.postPlayer);
      if(action.type==="PASS"&&action.targetPlayer===ctx.postEntry.postPlayer){
        if(ctx.postEntry.sealed&&postDef.postDefense==="BEHIND")score=92;
        else if(ctx.postEntry.sealed&&postDef.postDefense==="THREE_QUARTER")score=82;
        else if(postDef.postDefense==="FRONT")score=28;
        else score=70;
      }
      if(action.type==="PASS"&&action.targetPlayer===ctx.postEntry.reversalPlayer)score=56;
      if(action.type==="DRIVE")score=ctx.postEntry.laneOpen?80:44;
    }

    if(ctx.ballScreenRead&&ctx.ballScreenRead.ballHandler===action.player){
      var screenDef=getDefender(state,ctx.ballScreenRead.roller);
      var help=screenDef.screenCoverage||screenDef.helpPosition||"DROP";
      var rollerPass=action.type==="PASS"&&action.targetPlayer===ctx.ballScreenRead.roller;
      var shakePass=action.type==="PASS"&&action.targetPlayer===ctx.ballScreenRead.shakePlayer;
      var skipPass=action.type==="PASS"&&action.targetPlayer===ctx.ballScreenRead.skipPlayer;

      if(rollerPass){
        if(ctx.ballScreenRead.rollerOpen&&(help==="HEDGE"||help==="SHOW"||help==="SWITCH"))score=95;
        else if(ctx.ballScreenRead.rollerTagged)score=52;
        else score=80;
      }
      if(shakePass){
        score=ctx.ballScreenRead.shakeDefenderTagging?93:62;
      }
      if(skipPass)score=ctx.ballScreenRead.weakSideCollapsed?86:54;
      if(action.type==="DRIVE"&&action.driveType==="TURN_CORNER"){
        score=help==="DROP"?86:62;
      }
      if(action.type==="DRIVE"&&action.driveType==="REJECT"){
        score=ctx.ballScreenRead.onBallIce?88:42;
      }
    }

    if(ctx.splitScreen&&ctx.splitScreen.passer===action.player){
      if(action.type==="SCREEN"&&action.targetPlayer===ctx.splitScreen.screenTarget)score=96;
      if(action.type==="CUT")score=48;
      if(action.type==="HOLD")score=-100;
    }

    if(ctx.postSplit&&ctx.postSplit.passer===action.player){
      var targetDef=getDefender(state,ctx.postSplit.screenTarget);
      var deny=targetDef.denyLevel==="HARD"||targetDef.overplay==="TOP_LOCK";
      if(action.type==="SEQUENCE"&&action.sequenceId==="POST_SPLIT_SLIP")score=deny?97:88;
      if(action.type==="PASS"&&action.targetPlayer===ctx.postSplit.postPlayer)score=76;
      if(action.type==="PASS"&&action.targetPlayer===ctx.postSplit.reversalPlayer)score=52;
      if(action.type==="HOLD")score=-100;
    }

    if(ctx.catch&&ctx.catch.player===action.player){
      var onBall=getDefender(state,action.player);
      if(action.type==="SHOOT")score=ctx.catch.openShot?95:42;
      if(action.type==="DRIVE"&&action.driveType==="CLOSEOUT_ATTACK"){
        score=(onBall.closeout==="HARD"&&ctx.catch.laneOpen)?92:58;
      }
      if(action.type==="PASS"&&action.targetPlayer===ctx.catch.postPlayer&&ctx.catch.postSeal)score=86;
    }

    return score;
  }

  function classify(score){
    for(var i=0;i<SCORE_CLASS.length;i++){
      if(score>=SCORE_CLASS[i].min)return SCORE_CLASS[i].name;
    }
    return "WRONG";
  }

  function rankActions(state){
    return getValidActions(state).map(function(action){
      var score=scoreAction(state,action);
      return{action:action,score:score,classification:classify(score)};
    }).sort(function(a,b){return b.score-a.score;});
  }

  function evaluateAction(state,actionId){
    var ranked=rankActions(state);
    var selected=ranked.find(function(item){return item.action.id===actionId;});
    return{
      selected:selected||{action:null,score:-100,classification:"WRONG"},
      best:ranked[0]||null,
      ranked:ranked
    };
  }

  function locLabel(location){
    var labels={
      LEFT_SLOT:"left slot",RIGHT_SLOT:"right slot",LEFT_WING:"left wing",RIGHT_WING:"right wing",
      LEFT_BLOCK:"left block",RIGHT_BLOCK:"right block",LEFT_DUNKER:"left dunker",RIGHT_DUNKER:"right dunker",
      LEFT_HIGH_POST:"left high post",RIGHT_HIGH_POST:"right high post",RIM:"kori",
      LEFT_CORNER:"left corner",RIGHT_CORNER:"right corner",LEFT_SHAKE:"left shake",RIGHT_SHAKE:"right shake"
    };
    return labels[location]||location||"";
  }

  function describeAction(action){
    if(!action)return"Ei toimintoa";
    if(action.type==="PASS")return"Syötä "+action.targetPlayer;
    if(action.type==="FILL")return"Fill → "+locLabel(action.targetLocation);
    if(action.type==="SCREEN")return"Screen "+action.targetPlayer;
    if(action.type==="DRIVE"&&action.driveType==="TURN_CORNER")return"Käännä kulma";
    if(action.type==="DRIVE"&&action.driveType==="REJECT")return"Reject screen";
    if(action.type==="DRIVE")return"Aja korille";
    if(action.type==="SHOOT")return"Heitä";
    if(action.type==="HOLD")return"Jää paikalle";
    if(action.type==="SEQUENCE")return"Post entry → screen → slip";
    if(action.type==="CUT"){
      var cutLabels={THRU:"Thru cut",BASKET:"Basket cut",CURL:"Curl",STRAIGHT:"Pop / straight",BACKDOOR:"Backdoor",FADE:"Fade / flare",ROLL:"Roll",POP:"Pop",SLIP:"Slip"};
      return(cutLabels[action.cutType]||action.cutType)+" → "+locLabel(action.targetLocation);
    }
    return action.type;
  }

  function explainAction(state,action){
    var ctx=state.context||{};
    if(!action)return"Valinta ei vastannut tässä tilanteessa mahdollista toimintoa.";

    if(ctx.trigger&&ctx.trigger.type==="SLOT_TO_WING_PASS"){
      if(action.type==="CUT"&&action.cutType==="THRU")return"Slot → wing -syötön jälkeen syöttäjä ei jää seisomaan, vaan leikkaa korin kautta vastakkaiselle wingille.";
      if(action.type==="HOLD")return"Never pass and stand: syötön jälkeen pitää cutata, screenata tai vaihtaa paikkaa.";
    }

    if(ctx.vacantSpot){
      if(action.type==="FILL")return"Vapautunut perimeter-spotti täytetään lähimmällä soveltuvalla pelaajalla ilman spacingin rikkomista.";
    }

    if(ctx.offBallScreen){
      var d=getDefender(state,ctx.offBallScreen.cutter);
      if(d.denyLevel==="HARD"||d.overplay==="TOP_LOCK")return"Puolustaja top-lockaa/denyää. Take the lane: screenin pakottamisen sijaan leikkaa backdoor.";
      if(d.screenCoverage==="UNDER")return"Puolustaja menee screenin alta, joten pop/straight säilyttää heittouhan ja spacingin.";
      if(d.screenCoverage==="TRAIL")return"Puolustaja seuraa cutteria screenin takana, joten curl hyökkää syntyneeseen etuun.";
    }

    if(ctx.secondCut){
      if(ctx.secondCut.cutterAction==="CURL")return"Cutter meni sisään, joten screener read opposite -periaatteella poppaa ulos.";
      if(ctx.secondCut.cutterAction==="POP")return"Cutter meni ulos, joten screener tekee second cutin sisään.";
    }

    if(ctx.postEntry){
      return"Post-pelaajalla on seal ja puolustaja on takana. Post entry on korkean prioriteetin scoring-read.";
    }

    if(ctx.ballScreenRead){
      if(action.type==="PASS"&&action.targetPlayer===ctx.ballScreenRead.roller)return"Screenerin puolustaja auttaa pallolliseen ja roller on vapaa. Syötä rollerille ennen low-manin rotaatiota.";
      if(action.type==="PASS"&&action.targetPlayer===ctx.ballScreenRead.shakePlayer)return"Low-man/tagger auttaa rollerille, joten shake/lift-pelaaja vapautuu kick-outiin.";
    }

    if(ctx.splitScreen){
      return"Post entryn jälkeen syöttäjä ei jää seisomaan. Ensimmäinen split-actionin read on screen lähimmälle slot/perimeter-pelaajalle.";
    }

    if(ctx.postSplit){
      return"Post entryn jälkeen syöttäjä jatkaa motionia: screen lähimmälle perimeter-pelaajalle ja top-lockia vastaan slipataan syntyvään tilaan.";
    }

    return"Valitse ratkaisu, joka säilyttää spacingin ja rankaisee puolustuksen antamasta tilasta.";
  }

  function mistakeType(state,selected,best){
    if(!selected||selected.classification==="BEST")return null;
    var ctx=state.context||{};
    if(ctx.trigger&&ctx.trigger.type==="SLOT_TO_WING_PASS"&&selected.action&&selected.action.type==="HOLD")return"PASS_AND_STAND";
    if(ctx.vacantSpot)return"SPACING_FILL";
    if(ctx.offBallScreen){
      var d=getDefender(state,ctx.offBallScreen.cutter);
      if(d.denyLevel==="HARD"||d.overplay==="TOP_LOCK")return"MISSED_BACKDOOR";
      if(d.screenCoverage==="TRAIL")return"MISSED_CURL";
      if(d.screenCoverage==="UNDER")return"MISSED_POP";
    }
    if(ctx.secondCut)return"SCREENER_SECOND_CUT";
    if(ctx.postEntry)return"MISSED_POST_ENTRY";
    if(ctx.ballScreenRead)return"MISSED_PNR_READ";
    if(ctx.splitScreen)return"MISSED_SPLIT_SCREEN";
    if(ctx.postSplit)return"MISSED_SPLIT_SEQUENCE";
    return best?"LOWER_VALUE_READ":"UNKNOWN";
  }



  function nextDecisionState(state,action){
    var ctx=state.context||{};
    if(ctx.postEntry&&action&&action.type==="PASS"&&action.targetPlayer===ctx.postEntry.postPlayer){
      var next=clone(state);
      var passer=state.decisionPlayer;
      var post=ctx.postEntry.postPlayer;
      next.ballHandler=post;
      next.ballLocation=next.offense[post].location;
      next.decisionPlayer=passer;
      next.context={
        splitScreen:{
          passer:passer,
          postPlayer:post,
          screenTarget:ctx.postEntry.splitScreenTarget||nearestOtherPerimeter(next,passer)
        }
      };
      next.history=(next.history||[]).concat([{type:"PASS",fromPlayer:passer,toPlayer:post,label:"Post entry"}]);
      return{
        state:next,
        decisionLabel:"Pallo on postissa. Mitä syöttäjä tekee nyt?",
        teachingPoint:"Post entryn jälkeen syöttäjä jatkaa: screen lähimmälle perimeter-pelaajalle."
      };
    }
    return null;
  }

  function actionMatches(actual,expected){
    if(!actual||!expected||actual.type!==expected.type)return false;
    if(actual.player&&expected.player&&actual.player!==expected.player)return false;
    if(actual.type==="PASS"||actual.type==="SCREEN")return actual.targetPlayer===expected.targetPlayer;
    if(actual.type==="CUT"||actual.type==="FILL")return actual.targetLocation===expected.targetLocation;
    if(actual.type==="DRIVE")return !actual.driveType||!expected.driveType||actual.driveType===expected.driveType;
    if(actual.type==="SHOOT"||actual.type==="HOLD")return true;
    if(actual.type==="SEQUENCE"){
      if(!actual.steps||!expected.steps||actual.steps.length!==expected.steps.length)return false;
      return actual.steps.every(function(step,index){return actionMatches(step,expected.steps[index]);});
    }
    return actionKey(actual)===actionKey(expected);
  }

  function sequencePrefixMatches(sequenceAction,prefix){
    if(!sequenceAction||sequenceAction.type!=="SEQUENCE"||!sequenceAction.steps)return false;
    if(!prefix||prefix.length>sequenceAction.steps.length)return false;
    return prefix.every(function(step,index){return actionMatches(step,sequenceAction.steps[index]);});
  }

  function inferGestureAction(state,intent,prefix){
    prefix=prefix||[];
    var valid=getValidActions(state);
    var expectedNext=[];
    valid.forEach(function(action){
      if(action.type==="SEQUENCE"&&sequencePrefixMatches(action,prefix)&&action.steps[prefix.length]){
        expectedNext.push(action.steps[prefix.length]);
      }
    });
    var direct=valid.filter(function(action){return action.type!=="SEQUENCE";});
    var pool=expectedNext.concat(direct);
    var player=state.decisionPlayer;

    function firstMatch(predicate){
      for(var i=0;i<pool.length;i++)if(predicate(pool[i]))return clone(pool[i]);
      return null;
    }

    if(intent.type==="PASS"){
      return firstMatch(function(action){return action.type==="PASS"&&action.targetPlayer===intent.targetPlayer;})||
        makeAction("PASS",player,{targetPlayer:intent.targetPlayer});
    }
    if(intent.type==="SCREEN"){
      return firstMatch(function(action){return action.type==="SCREEN"&&action.targetPlayer===intent.targetPlayer;})||
        makeAction("SCREEN",player,{targetPlayer:intent.targetPlayer,screenType:"OFF_BALL"});
    }
    if(intent.type==="MOVE"){
      return firstMatch(function(action){
        return(action.type==="CUT"||action.type==="FILL")&&action.targetLocation===intent.targetLocation;
      })||makeAction("CUT",player,{cutType:"MOVE",targetLocation:intent.targetLocation,path:[intent.targetLocation]});
    }
    if(intent.type==="DRIVE"){
      return firstMatch(function(action){return action.type==="DRIVE";})||makeAction("DRIVE",player,{driveType:"ADVANTAGE"});
    }
    if(intent.type==="SHOOT"){
      return firstMatch(function(action){return action.type==="SHOOT";})||makeAction("SHOOT",player);
    }
    return makeAction("HOLD",player);
  }

  function evaluateActionObject(state,actual){
    var ranked=rankActions(state);
    var selected=ranked.find(function(item){return actionMatches(actual,item.action);});
    if(selected)return{selected:{action:actual,score:selected.score,classification:selected.classification},best:ranked[0]||null,ranked:ranked};
    return{selected:{action:actual,score:-100,classification:"WRONG"},best:ranked[0]||null,ranked:ranked};
  }

  function clone(value){return JSON.parse(JSON.stringify(value));}

  return{
    PERIMETER:PERIMETER.slice(),
    makeAction:makeAction,
    actionKey:actionKey,
    getValidActions:getValidActions,
    scoreAction:scoreAction,
    classify:classify,
    rankActions:rankActions,
    evaluateAction:evaluateAction,
    describeAction:describeAction,
    explainAction:explainAction,
    mistakeType:mistakeType,
    actionMatches:actionMatches,
    sequencePrefixMatches:sequencePrefixMatches,
    inferGestureAction:inferGestureAction,
    evaluateActionObject:evaluateActionObject,
    nextDecisionState:nextDecisionState,
    clone:clone,
    getDefender:getDefender
  };
});