(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PuzzleTemplates=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  var EVENT_MS=1050;
  var CATEGORIES=[
    "THRU_CUT","FIRST_FILL","SECOND_FILL","COMPLETED_ROTATION",
    "SLOT_EXCHANGE","EXCHANGE_PARTNER","P5_WEAK_SIDE","P5_WING_REACTION",
    "BALL_SCREEN","SHAKE","WEAK_SIDE_EXCHANGE","ROLL",
    "CUTTER_CURL","CUTTER_POP","BASELINE_DRIVE"
  ];

  function choose(random,items){return items[Math.floor(random()*items.length)];}
  function opposite(side){return side==="LEFT"?"RIGHT":"LEFT";}

  function sideData(side){
    return{
      side:side,
      other:opposite(side),
      slot:side+"_SLOT",
      oppositeSlot:opposite(side)+"_SLOT",
      wing:side+"_WING",
      oppositeWing:opposite(side)+"_WING",
      block:side+"_BLOCK",
      oppositeBlock:opposite(side)+"_BLOCK",
      dunker:side+"_DUNKER",
      oppositeDunker:opposite(side)+"_DUNKER",
      corner:side+"_CORNER",
      oppositeCorner:opposite(side)+"_CORNER",
      shake:side+"_SHAKE",
      oppositeShake:opposite(side)+"_SHAKE",
      slotPlayer:side==="LEFT"?"P1":"P2",
      oppositeSlotPlayer:side==="LEFT"?"P2":"P1",
      wingPlayer:side==="LEFT"?"P3":"P4",
      oppositeWingPlayer:side==="LEFT"?"P4":"P3"
    };
  }

  function baseState(ballHandler){
    var offense={
      P1:{role:"perimeter",location:"LEFT_SLOT"},
      P2:{role:"perimeter",location:"RIGHT_SLOT"},
      P3:{role:"perimeter",location:"LEFT_WING"},
      P4:{role:"perimeter",location:"RIGHT_WING"},
      P5:{role:"interior",location:"RIGHT_DUNKER"}
    };
    var ballLocation=offense[ballHandler].location;
    var ballSide=/^RIGHT_/.test(ballLocation)?"RIGHT":"LEFT";
    offense.P5.location=opposite(ballSide)+"_DUNKER";
    return{
      ballHandler:ballHandler,
      ballLocation:ballLocation,
      offense:offense,
      history:[]
    };
  }

  function event(type,props,label,duration){
    return Object.assign({type:type,label:label||type,duration:duration||EVENT_MS},props||{});
  }

  function slotWingTemplate(random,category,startReaction,confirmSpacing){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side);
    var state=baseState(s.slotPlayer);
    return{
      category:category,
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},
          s.slotPlayer+" syöttää "+s.slot+" → "+s.wing)
      ],
      trigger:{
        type:"SLOT_TO_WING_PASS",
        passer:s.slotPlayer,
        receiver:s.wingPlayer,
        fromLocation:s.slot,
        toLocation:s.wing,
        interiorPlayer:"P5"
      },
      startReaction:startReaction,
      confirmSpacing:!!confirmSpacing
    };
  }

  function slotExchangeTemplate(random,category,startReaction){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side);
    var state=baseState(s.slotPlayer);
    return{
      category:category,
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},
          s.slotPlayer+" syöttää "+s.slot+" → "+s.oppositeSlot)
      ],
      trigger:{
        type:"SLOT_TO_SLOT_PASS",
        passer:s.slotPlayer,
        receiver:s.oppositeSlotPlayer,
        fromLocation:s.slot,
        toLocation:s.oppositeSlot
      },
      startReaction:startReaction
    };
  }

  function p5WeakSideTemplate(random){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side);
    var state=baseState(s.wingPlayer);
    return{
      category:"P5_WEAK_SIDE",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.wingPlayer,toPlayer:s.slotPlayer},
          s.wingPlayer+" syöttää wingiltä "+s.slot+"iin"),
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},
          s.slotPlayer+" reversaa pallon "+s.slot+" → "+s.oppositeSlot)
      ],
      trigger:{
        type:"BALL_TO_SLOT",
        ballLocation:s.oppositeSlot
      },
      startReaction:0
    };
  }

  function ballScreenTemplate(random,category,startReaction){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side);
    var state=baseState(s.wingPlayer);

    return{
      category:category,
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.wingPlayer,toPlayer:s.slotPlayer},
          s.wingPlayer+" syöttää wingiltä "+s.slot+"iin"),
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},
          s.slotPlayer+" reversaa pallon "+s.slot+" → "+s.oppositeSlot),
        event("SCREEN",{player:s.slotPlayer,targetPlayer:s.wingPlayer,targetLocation:s.wing},
          s.slotPlayer+" screenaa saman puolen wingin"),
        event("MOVE",{player:s.wingPlayer,to:s.slot,movement:"FILL"},
          s.wingPlayer+" fillaa vapautuneen "+s.slot+"in"),
        event("MOVE",{player:s.slotPlayer,to:s.wing,movement:"EXCHANGE"},
          s.slotPlayer+" jatkaa exchangeen ja täyttää "+s.wing+"in"),
        event("MOVE",{player:"P5",to:s.dunker,movement:"RELOCATE"},
          "P5 siirtyy uuden pallopuolen weak-side dunkeriin"),
        event("WAIT",{},"Ball reversal + exchange valmis — nyt P5 voi tulla palloskriiniin",900)
      ],
      trigger:{
        type:"BALL_SCREEN_START",
        ballHandler:s.oppositeSlotPlayer,
        screener:"P5"
      },
      startReaction:startReaction
    };
  }

  function buildCutterCurl(random){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(s.oppositeSlotPlayer);
    state.offense.P5.location=side+"_HIGH_POST";
    return{
      category:"CUTTER_CURL",
      initialState:state,
      prelude:[
        event("SCREEN",{player:"P5",targetPlayer:s.wingPlayer,targetLocation:s.wing},
          "P5 asettaa off-ball screenin "+s.wingPlayer+":lle"),
        event("MOVE",{player:s.wingPlayer,path:["RIM"],movement:"CURL"},
          s.wingPlayer+" curl-leikkaa kohti koria")
      ],
      trigger:{
        type:"OFF_BALL_CUTTER_MOVE",
        cutter:s.wingPlayer,
        screener:"P5",
        cutterMovement:"CURL",
        vacatedSpot:s.wing
      },
      startReaction:0
    };
  }

  function buildCutterPop(random){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(s.oppositeSlotPlayer);
    state.offense.P5.location=side+"_HIGH_POST";
    return{
      category:"CUTTER_POP",
      initialState:state,
      prelude:[
        event("SCREEN",{player:"P5",targetPlayer:s.wingPlayer,targetLocation:s.wing},
          "P5 asettaa off-ball screenin "+s.wingPlayer+":lle"),
        event("MOVE",{player:s.wingPlayer,path:[s.corner],movement:"POP"},
          s.wingPlayer+" liikkuu screenistä ulospäin")
      ],
      trigger:{
        type:"OFF_BALL_CUTTER_MOVE",
        cutter:s.wingPlayer,
        screener:"P5",
        cutterMovement:"POP",
        vacatedSpot:s.wing
      },
      startReaction:0
    };
  }

  function buildBaselineDrive(random){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(s.wingPlayer);
    return{
      category:"BASELINE_DRIVE",
      initialState:state,
      prelude:[
        event("DRIVE",{player:s.wingPlayer,to:s.block,side:side},
          s.wingPlayer+" ajaa "+side.toLowerCase()+" baselinea")
      ],
      trigger:{
        type:"BASELINE_DRIVE",
        driver:s.wingPlayer,
        side:side,
        fromLocation:s.wing
      },
      startReaction:0
    };
  }

  var DEFINITIONS=[
    {category:"THRU_CUT",weight:5,build:function(r){return slotWingTemplate(r,"THRU_CUT",0,false);}},
    {category:"FIRST_FILL",weight:2,build:function(r){return slotWingTemplate(r,"FIRST_FILL",1,false);}},
    {category:"SECOND_FILL",weight:2,build:function(r){return slotWingTemplate(r,"SECOND_FILL",2,false);}},
    {category:"COMPLETED_ROTATION",weight:1,build:function(r){return slotWingTemplate(r,"COMPLETED_ROTATION",4,true);}},
    {category:"SLOT_EXCHANGE",weight:4,build:function(r){return slotExchangeTemplate(r,"SLOT_EXCHANGE",0);}},
    {category:"EXCHANGE_PARTNER",weight:2,build:function(r){return slotExchangeTemplate(r,"EXCHANGE_PARTNER",1);}},
    {category:"P5_WEAK_SIDE",weight:2,build:p5WeakSideTemplate},
    {category:"P5_WING_REACTION",weight:3,build:function(r){return slotWingTemplate(r,"P5_WING_REACTION",3,false);}},
    {category:"BALL_SCREEN",weight:2,build:function(r){return ballScreenTemplate(r,"BALL_SCREEN",0);}},
    {category:"SHAKE",weight:1,build:function(r){return ballScreenTemplate(r,"SHAKE",1);}},
    {category:"WEAK_SIDE_EXCHANGE",weight:1,build:function(r){return ballScreenTemplate(r,"WEAK_SIDE_EXCHANGE",2);}},
    {category:"ROLL",weight:1,build:function(r){return ballScreenTemplate(r,"ROLL",4);}},
    {category:"CUTTER_CURL",weight:2,build:buildCutterCurl},
    {category:"CUTTER_POP",weight:2,build:buildCutterPop},
    {category:"BASELINE_DRIVE",weight:2,build:buildBaselineDrive}
  ];

  function list(){return DEFINITIONS.slice();}

  return{
    EVENT_MS:EVENT_MS,
    CATEGORIES:CATEGORIES.slice(),
    DEFINITIONS:DEFINITIONS.slice(),
    list:list,
    sideData:sideData,
    baseState:baseState
  };
});