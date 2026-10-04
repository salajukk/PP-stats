(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GameRules=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  var PERIMETER=["LEFT_SLOT","RIGHT_SLOT","LEFT_WING","RIGHT_WING"];
  var RULE_LIBRARY=[
    "PASSER_MUST_MOVE",
    "WING_TO_SLOT_BALL_REVERSAL",
    "SLOT_TO_WING_THRU_CUT",
    "EMPTY_SLOT_FILL",
    "PERIMETER_ROTATION",
    "SLOT_TO_SLOT_EXCHANGE",
    "P5_WEAK_SIDE_POSITION",
    "P5_SLOT_TO_WING_RELOCATION",
    "P5_BALL_SCREEN_MOVEMENT",
    "STRONG_SIDE_SHAKE",
    "WEAK_SIDE_EXCHANGE",
    "SCREENER_SECOND_CUT",
    "DRIVE_SPACING"
  ];

  function clone(value){return JSON.parse(JSON.stringify(value));}

  function sideOf(location){
    if(/^LEFT_/.test(location||""))return"LEFT";
    if(/^RIGHT_/.test(location||""))return"RIGHT";
    return null;
  }

  function slot(side){return side+"_SLOT";}
  function wing(side){return side+"_WING";}
  function dunker(side){return side+"_DUNKER";}
  function block(side){return side+"_BLOCK";}
  function shake(side){return side+"_SHAKE";}
  function corner(side){return side+"_CORNER";}
  function opposite(side){return side==="LEFT"?"RIGHT":"LEFT";}

  function playerAt(state,location,exclude){
    var ids=Object.keys(state.offense||{});
    for(var i=0;i<ids.length;i++){
      var id=ids[i];
      if(id!==exclude&&state.offense[id].location===location)return id;
    }
    return null;
  }

  function move(player,targetLocation,movement,rule,path,reason){
    return{
      type:"MOVE",player:player,targetLocation:targetLocation,movement:movement,rule:rule,
      path:path&&path.length?path.slice():[targetLocation],reason:reason
    };
  }

  function screenAction(player,targetPlayer,targetLocation,rule,reason){
    return{type:"SCREEN",player:player,targetPlayer:targetPlayer,targetLocation:targetLocation,movement:"SCREEN",rule:rule,reason:reason};
  }

  function choiceAction(player,options,rule,reason,meta){
    return{
      type:"CHOICE",player:player,options:options.map(clone),rule:rule,reason:reason,
      meta:meta?clone(meta):{}
    };
  }

  function confirmAction(reason){
    return{type:"CONFIRM",rule:"SPACING_VALID",reason:reason||"Neljä perimeter-paikkaa ovat jälleen täynnä ilman päällekkäisyyksiä."};
  }

  function actionKey(action){
    if(action.type==="MOVE")return"MOVE|"+action.player+"|"+action.targetLocation;
    if(action.type==="SCREEN")return"SCREEN|"+action.player+"|"+action.targetPlayer;
    if(action.type==="CONFIRM")return"CONFIRM";
    return action.type+"|"+(action.player||"");
  }

  function getBallContinuation(state,event){
    if(!state||!event||event.type!=="PASS")return null;
    var fromPlayer=state.offense[event.fromPlayer];
    var toPlayer=state.offense[event.toPlayer];
    if(!fromPlayer||!toPlayer)return null;

    var fromLocation=fromPlayer.location;
    var toLocation=toPlayer.location;
    var fromSide=sideOf(fromLocation);
    var toSide=sideOf(toLocation);

    var isWingToSameSideSlot=/_(WING)$/.test(fromLocation||"")&&/_(SLOT)$/.test(toLocation||"")&&fromSide===toSide;
    if(!isWingToSameSideSlot)return null;

    var oppositeSlot=slot(opposite(toSide));
    var receiver=playerAt(state,oppositeSlot,event.toPlayer);
    if(!receiver)return null;

    return{
      type:"PASS",
      fromPlayer:event.toPlayer,
      toPlayer:receiver,
      rule:"WING_TO_SLOT_BALL_REVERSAL",
      label:event.toPlayer+" reversaa pallon "+toLocation+" → "+oppositeSlot,
      duration:1050
    };
  }

  function getRequiredReactions(state,trigger){
    var reactions=[];
    if(!trigger)return reactions;

    if(trigger.type==="SLOT_TO_WING_PASS"){
      var fromSide=sideOf(trigger.fromLocation);
      var other=opposite(fromSide);
      var passer=trigger.passer;
      var fillOne=playerAt(state,slot(other),passer);
      var fillTwo=playerAt(state,wing(other),passer);
      var interior=trigger.interiorPlayer||"P5";

      reactions.push(move(
        passer,wing(other),"THRU_CUT","SLOT_TO_WING_THRU_CUT",["RIM",wing(other)],
        "Slot → wing -syötön jälkeen syöttäjä leikkaa korin kautta vastakkaiselle wingille."
      ));
      if(fillOne)reactions.push(move(
        fillOne,trigger.fromLocation,"FILL","EMPTY_SLOT_FILL",[trigger.fromLocation],
        "Syöttäjän jättämä slot täytetään viereisestä slotista."
      ));
      if(fillTwo)reactions.push(move(
        fillTwo,slot(other),"FILL","PERIMETER_ROTATION",[slot(other)],
        "Wing nousee vapautuneeseen slottiin ja rotaatio palauttaa 4-out-spacingin."
      ));
      if(state.offense[interior])reactions.push(move(
        interior,block(fromSide),"RELOCATE","P5_SLOT_TO_WING_RELOCATION",[block(fromSide)],
        "Kun pallo menee wingille, P5 siirtyy weak-side dunkerista pallon puolen blockille."
      ));
      return reactions;
    }

    if(trigger.type==="SLOT_TO_SLOT_PASS"){
      var sourceSide=sideOf(trigger.fromLocation);
      var sameWing=wing(sourceSide);
      var wingPlayer=playerAt(state,sameWing,trigger.passer);

      if(wingPlayer)reactions.push(screenAction(
        trigger.passer,wingPlayer,sameWing,"SLOT_TO_SLOT_EXCHANGE",
        "Slot → opposite slot -syötön jälkeen syöttäjä screenaa saman puolen wingin."
      ));

      if(wingPlayer)reactions.push(move(
        wingPlayer,trigger.fromLocation,"FILL","SLOT_TO_SLOT_EXCHANGE",[trigger.fromLocation],
        "Screenin käyttänyt wing täyttää syöttäjän vapauttaman slotin."
      ));

      reactions.push(choiceAction(
        trigger.passer,
        [
          move(
            trigger.passer,sameWing,"EXCHANGE","SLOT_TO_SLOT_EXCHANGE",[sameWing],
            "Screener voi exchange-jatkona täyttää vapautuneen wingin."
          ),
          move(
            trigger.passer,"RIM","SLIP","SLOT_TO_SLOT_EXCHANGE",["RIM"],
            "Screener voi slipata screenistä suoraan korille."
          )
        ],
        "SLOT_TO_SLOT_EXCHANGE",
        "Screenin jälkeen screener voi joko exchange/fillata vapaan wingin tai slipata korille.",
        {fallbackWing:sameWing,ballHandler:trigger.receiver}
      ));
      return reactions;
    }

    if(trigger.type==="BALL_TO_SLOT"){
      var ballSide=sideOf(trigger.ballLocation);
      if(state.offense.P5)reactions.push(move(
        "P5",dunker(opposite(ballSide)),"RELOCATE","P5_WEAK_SIDE_POSITION",[dunker(opposite(ballSide))],
        "P5 pysyy palloon nähden weak-side dunkerissa."
      ));
      return reactions;
    }

    if(trigger.type==="BALL_SCREEN_START"){
      var handler=trigger.ballHandler;
      var handlerLocation=state.offense[handler]&&state.offense[handler].location;
      var screenSide=sideOf(handlerLocation);
      var weakSide=opposite(screenSide);
      var strongWingPlayer=playerAt(state,wing(screenSide),handler);
      var weakSlotPlayer=playerAt(state,slot(weakSide),handler);
      var weakWingPlayer=playerAt(state,wing(weakSide),handler);
      var screener=trigger.screener||"P5";

      reactions.push(screenAction(
        screener,handler,handlerLocation,"P5_BALL_SCREEN_MOVEMENT",
        "P5 sprinttaa pallollisen slotiin asettamaan palloskriinin."
      ));
      if(strongWingPlayer)reactions.push(move(
        strongWingPlayer,shake(screenSide),"SHAKE","STRONG_SIDE_SHAKE",[shake(screenSide)],
        "Ball-side wing lift/shakeaa ylöspäin, jotta palloskriinin ympärille jää tilaa."
      ));
      if(weakSlotPlayer)reactions.push(move(
        weakSlotPlayer,wing(weakSide),"EXCHANGE","WEAK_SIDE_EXCHANGE",[wing(weakSide)],
        "Weak-side slot vaihtaa paikkaa weak-side wingin kanssa."
      ));
      if(weakWingPlayer)reactions.push(move(
        weakWingPlayer,slot(weakSide),"EXCHANGE","WEAK_SIDE_EXCHANGE",[slot(weakSide)],
        "Weak-side wing täyttää slotin ja exchange valmistuu."
      ));
      reactions.push(move(
        screener,"RIM","ROLL","P5_BALL_SCREEN_MOVEMENT",["RIM"],
        "P5 ei jää screeniin, vaan rollaa kohti koria."
      ));
      return reactions;
    }

    if(trigger.type==="BALL_SCREEN_COMPLETED"){
      reactions.push(move(
        trigger.screener||"P5","RIM","ROLL","P5_BALL_SCREEN_MOVEMENT",["RIM"],
        "Palloskriinin jälkeen P5 rollaa kohti koria."
      ));
      return reactions;
    }

    if(trigger.type==="OFF_BALL_CUTTER_MOVE"){
      if(trigger.cutterMovement==="CURL"||trigger.cutterMovement==="INSIDE"){
        reactions.push(move(
          trigger.screener,trigger.vacatedSpot,"POP","SCREENER_SECOND_CUT",[trigger.vacatedSpot],
          "Cutter meni sisään, joten screener liikkuu ulos vapautuneeseen perimeter-tilaan."
        ));
      }else{
        reactions.push(move(
          trigger.screener,"RIM","DIVE","SCREENER_SECOND_CUT",["RIM"],
          "Cutter meni ulos, joten screener tekee second cutin sisään kohti koria."
        ));
      }
      return reactions;
    }

    if(trigger.type==="BASELINE_DRIVE"){
      var driveSide=trigger.side||sideOf(trigger.fromLocation);
      var oppositeWing=wing(opposite(driveSide));
      var driftPlayer=playerAt(state,oppositeWing,trigger.driver);
      if(driftPlayer)reactions.push(move(
        driftPlayer,corner(opposite(driveSide)),"DRIFT","DRIVE_SPACING",[corner(opposite(driveSide))],
        "Baseline-ajossa vastakkaisen puolen wing driftää kulmaan ja avaa syöttölinjan."
      ));
      return reactions;
    }

    if(trigger.type==="MIDDLE_DRIVE"){
      var driverSide=trigger.side||sideOf(trigger.fromLocation);
      var sameWingPlayer=playerAt(state,wing(driverSide),trigger.driver);
      var otherWingPlayer=playerAt(state,wing(opposite(driverSide)),trigger.driver);
      if(sameWingPlayer)reactions.push(move(
        sameWingPlayer,corner(driverSide),"SPACE","DRIVE_SPACING",[corner(driverSide)],
        "Middle drivessa wing siirtyy pois ajogapista kulmaan."
      ));
      if(otherWingPlayer)reactions.push(move(
        otherWingPlayer,shake(opposite(driverSide)),"LIFT","DRIVE_SPACING",[shake(opposite(driverSide))],
        "Weak-side wing liftää ja säilyttää syöttöväylän."
      ));
      return reactions;
    }

    return reactions;
  }

  function applyReaction(state,reaction){
    var next=clone(state);
    next.history=next.history||[];
    next.history.push({type:"REACTION",reaction:clone(reaction)});

    if(reaction.type==="MOVE"){
      var player=next.offense[reaction.player];
      if(player){
        player.location=reaction.targetLocation;
        delete player.screeningTarget;
        delete player.screeningLocation;
      }
      if(next.ballHandler===reaction.player)next.ballLocation=reaction.targetLocation;
    }

    if(reaction.type==="SCREEN"){
      var screener=next.offense[reaction.player];
      if(screener){
        screener.screeningTarget=reaction.targetPlayer;
        screener.screeningLocation=reaction.targetLocation;
      }
    }

    return next;
  }

  function reactionToEvent(reaction){
    if(reaction.type==="MOVE"){
      return{
        type:"MOVE",player:reaction.player,path:reaction.path||[reaction.targetLocation],
        movement:reaction.movement,label:describeReaction(reaction),duration:1050
      };
    }
    if(reaction.type==="SCREEN"){
      return{
        type:"SCREEN",player:reaction.player,targetPlayer:reaction.targetPlayer,targetLocation:reaction.targetLocation,
        label:describeReaction(reaction),duration:1050
      };
    }
    return{type:"WAIT",label:"Spacing valmis",duration:700};
  }

  function evaluateInput(expected,input,state){
    if(!expected||!input)return{correct:false};
    if(expected.type==="CONFIRM"){
      var spacing=validateSpacing(state);
      return{correct:input.type==="CONFIRM"&&spacing.standard4Out,spacing:spacing};
    }
    if(expected.type==="CHOICE"){
      if(expected.player!==input.player)return{correct:false};
      for(var i=0;i<expected.options.length;i++){
        var option=expected.options[i];
        if(option.type!==input.type)continue;
        if(option.type==="MOVE"&&option.targetLocation===input.targetLocation){
          return{correct:true,selectedOption:clone(option)};
        }
        if(option.type==="SCREEN"&&option.targetPlayer===input.targetPlayer){
          return{correct:true,selectedOption:clone(option)};
        }
      }
      return{correct:false};
    }
    if(expected.type!==input.type)return{correct:false};
    if(expected.player!==input.player)return{correct:false};
    if(expected.type==="MOVE")return{correct:expected.targetLocation===input.targetLocation};
    if(expected.type==="SCREEN")return{correct:expected.targetPlayer===input.targetPlayer};
    return{correct:false};
  }

  function validateSpacing(state){
    var locations=["P1","P2","P3","P4"].map(function(id){
      return state.offense[id]&&state.offense[id].location;
    });
    var allPerimeter=locations.every(function(loc){return PERIMETER.indexOf(loc)>=0;});
    var unique=new Set(locations).size===locations.length;
    var exact=PERIMETER.every(function(loc){return locations.indexOf(loc)>=0;});
    return{
      perimeterLocations:locations,
      allPerimeter:allPerimeter,
      unique:unique,
      standard4Out:allPerimeter&&unique&&exact
    };
  }

  function describeLocation(location){
    var labels={
      LEFT_SLOT:"left slot",RIGHT_SLOT:"right slot",LEFT_WING:"left wing",RIGHT_WING:"right wing",
      LEFT_BLOCK:"left block",RIGHT_BLOCK:"right block",LEFT_DUNKER:"left dunker",RIGHT_DUNKER:"right dunker",
      LEFT_HIGH_POST:"left high post",RIGHT_HIGH_POST:"right high post",LEFT_CORNER:"left corner",RIGHT_CORNER:"right corner",
      LEFT_SHAKE:"left shake",RIGHT_SHAKE:"right shake",RIM:"kori"
    };
    return labels[location]||location||"";
  }

  function movementLabel(movement){
    var labels={
      THRU_CUT:"Thru cut",FILL:"Fill",EXCHANGE:"Exchange",SLIP:"Slip",RELOCATE:"Relocate",
      SHAKE:"Shake / lift",ROLL:"Roll",POP:"Pop out",DIVE:"Dive",DRIFT:"Drift",SPACE:"Space",LIFT:"Lift"
    };
    return labels[movement]||movement||"Liiku";
  }

  function describeReaction(reaction){
    if(!reaction)return"";
    if(reaction.type==="CONFIRM")return"Spacing valmis";
    if(reaction.type==="CHOICE"){
      return reaction.player+": "+reaction.options.map(function(option){
        return movementLabel(option.movement)+" → "+describeLocation(option.targetLocation);
      }).join(" TAI ");
    }
    if(reaction.type==="SCREEN")return reaction.player+" → screen "+reaction.targetPlayer;
    return reaction.player+": "+movementLabel(reaction.movement)+" → "+describeLocation(reaction.targetLocation);
  }

  function describeInput(input){
    if(!input)return"—";
    if(input.type==="CONFIRM")return"Spacing valmis";
    if(input.type==="SCREEN")return input.player+" → screen "+input.targetPlayer;
    if(input.type==="MOVE")return input.player+" → "+describeLocation(input.targetLocation);
    return input.type;
  }

  return{
    PERIMETER:PERIMETER.slice(),
    RULE_LIBRARY:RULE_LIBRARY.slice(),
    clone:clone,
    sideOf:sideOf,
    opposite:opposite,
    playerAt:playerAt,
    actionKey:actionKey,
    choiceAction:choiceAction,
    getBallContinuation:getBallContinuation,
    getRequiredReactions:getRequiredReactions,
    applyReaction:applyReaction,
    reactionToEvent:reactionToEvent,
    evaluateInput:evaluateInput,
    validateSpacing:validateSpacing,
    describeReaction:describeReaction,
    describeInput:describeInput,
    describeLocation:describeLocation,
    confirmAction:confirmAction
  };
});