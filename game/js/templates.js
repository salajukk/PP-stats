(function(root,factory){
  var Rules=typeof module==="object"&&module.exports?require("./rules.js"):root.GameRules;
  var api=factory(Rules);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PuzzleTemplates=api;
})(typeof window!=="undefined"?window:globalThis,function(Rules){
  "use strict";

  var CATEGORIES=[
    "PASS_AND_CUT","FILL","CURL_READ","POP_READ","BACKDOOR_READ",
    "SCREENER_SECOND_CUT","POST_ENTRY","BALL_SCREEN_ROLLER_READ"
  ];

  function choose(random,items){return items[Math.floor(random()*items.length)];}
  function sideData(side){
    var left=side==="LEFT";
    return{
      side:side,
      slot:left?"LEFT_SLOT":"RIGHT_SLOT",
      oppositeSlot:left?"RIGHT_SLOT":"LEFT_SLOT",
      wing:left?"LEFT_WING":"RIGHT_WING",
      oppositeWing:left?"RIGHT_WING":"LEFT_WING",
      block:left?"LEFT_BLOCK":"RIGHT_BLOCK",
      oppositeBlock:left?"RIGHT_BLOCK":"LEFT_BLOCK",
      dunker:left?"LEFT_DUNKER":"RIGHT_DUNKER",
      oppositeDunker:left?"RIGHT_DUNKER":"LEFT_DUNKER",
      highPost:left?"LEFT_HIGH_POST":"RIGHT_HIGH_POST",
      oppositeHighPost:left?"RIGHT_HIGH_POST":"LEFT_HIGH_POST",
      corner:left?"LEFT_CORNER":"RIGHT_CORNER",
      oppositeCorner:left?"RIGHT_CORNER":"LEFT_CORNER",
      shake:left?"LEFT_SHAKE":"RIGHT_SHAKE",
      oppositeShake:left?"RIGHT_SHAKE":"LEFT_SHAKE",
      slotPlayer:left?"P1":"P2",
      oppositeSlotPlayer:left?"P2":"P1",
      wingPlayer:left?"P3":"P4",
      oppositeWingPlayer:left?"P4":"P3"
    };
  }

  function baseState(side){
    var s=sideData(side);
    var offense={};
    offense.P1={role:"guard",location:side==="LEFT"?"LEFT_SLOT":"RIGHT_SLOT"};
    offense.P2={role:"guard",location:side==="LEFT"?"RIGHT_SLOT":"LEFT_SLOT"};
    offense.P3={role:"wing",location:side==="LEFT"?"LEFT_WING":"RIGHT_WING"};
    offense.P4={role:"wing",location:side==="LEFT"?"RIGHT_WING":"LEFT_WING"};
    offense.P5={role:"center",location:s.oppositeDunker};

    var defense={};
    ["1","2","3","4","5"].forEach(function(n){
      defense["D"+n]={
        guarding:"P"+n,
        onBallPosition:"NORMAL",
        denyLevel:"NONE",
        screenCoverage:"TRAIL",
        helpPosition:"HOME",
        postDefense:"BEHIND",
        closeout:"NORMAL"
      };
    });

    return{
      ballHandler:s.slotPlayer,
      ballLocation:s.slot,
      offense:offense,
      defense:defense,
      decisionPlayer:s.slotPlayer,
      context:{},
      history:[]
    };
  }

  function event(type,props,label,duration){
    return Object.assign({type:type,label:label||type,duration:duration||620},props||{});
  }

  function supportsPerimeter(role){
    return role==="random"||["1","2","3","4"].indexOf(String(role))>=0;
  }

  function supportsWing(role){
    return role==="random"||role==="3"||role==="4";
  }

  function supportsGuard(role){
    return role==="random"||role==="1"||role==="2";
  }

  function supportsCenter(role){
    return role==="random"||role==="5";
  }

  function buildPassAndCut(random,role){
    var side=role==="1"?"LEFT":role==="2"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.slotPlayer;
    state.context={
      justPassedBy:s.slotPlayer,
      trigger:{type:"SLOT_TO_WING_PASS",passer:s.slotPlayer,receiver:s.wingPlayer,from:s.slot,to:s.wing,oppositeWing:s.oppositeWing,screenTarget:s.oppositeSlotPlayer}
    };
    return{
      category:"PASS_AND_CUT",difficulty:1,decisionLabel:"Mitä syöttäjä tekee seuraavaksi?",
      initialState:state,
      prelude:[event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Syöttö "+s.slot+" → "+s.wing,680)],
      teachingPoint:"Never pass and stand. Slot → wing käynnistää thru cutin korin kautta vastakkaiselle wingille."
    };
  }

  function buildFill(random,role){
    var side=role==="2"?"LEFT":role==="1"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.oppositeSlotPlayer;
    state.context={vacantSpot:s.slot,fillPlayer:s.oppositeSlotPlayer};
    return{
      category:"FILL",difficulty:1,decisionLabel:"Kuka palauttaa 4-out spacingin?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing",560),
        event("CUT",{player:s.slotPlayer,path:["RIM",s.oppositeWing]},"Syöttäjä thru-cuttaa korin kautta",780)
      ],
      teachingPoint:"Kun perimeter-spotti vapautuu, lähin soveltuva pelaaja fillaa sen ilman kasaantumista."
    };
  }

  function buildScreenRead(random,category,coverage,role){
    var side=role==="3"?"LEFT":role==="4"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    var cutter=s.wingPlayer;
    state.ballHandler=s.oppositeSlotPlayer;
    state.ballLocation=s.oppositeSlot;
    state.decisionPlayer=cutter;
    state.offense.P5.location=s.highPost;
    var d=state.defense["D"+cutter.slice(1)];
    d.screenCoverage=coverage;
    if(category==="BACKDOOR_READ"){d.denyLevel="HARD";d.overplay="TOP_LOCK";}
    state.context={
      offBallScreen:{
        cutter:cutter,screener:"P5",
        curlTarget:"RIM",
        popTarget:s.wing,
        fadeTarget:s.corner
      }
    };
    return{
      category:category,difficulty:category==="BACKDOOR_READ"?2:1,
      decisionLabel:"Lue oma puolustaja screenissä.",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},"Pallo vaihtaa slotilta slotille",520),
        event("MOVE",{player:"P5",to:s.highPost},"5 nousee off-ball screeniin",560),
        event("SCREEN",{player:"P5",targetPlayer:cutter,screenType:"OFF_BALL"},"5 screenaa "+cutter+":lle",650)
      ],
      teachingPoint:category==="CURL_READ"?"Defender trails → curl.":category==="POP_READ"?"Defender under → pop/straight.":"Top-lock / hard deny → take the lane backdoorilla."
    };
  }

  function buildSecondCut(random,role){
    var side=choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    var cutterAction=choose(random,["CURL","POP"]);
    state.decisionPlayer="P5";
    state.ballHandler=s.oppositeSlotPlayer;
    state.ballLocation=s.oppositeSlot;
    state.offense.P5.location=s.highPost;
    state.context={
      secondCut:{
        screener:"P5",
        cutter:s.wingPlayer,
        cutterAction:cutterAction,
        rollLocation:"RIM",
        popLocation:s.wing
      }
    };
    var cutPath=cutterAction==="CURL"?["RIM"]:[s.corner];
    return{
      category:"SCREENER_SECOND_CUT",difficulty:2,
      decisionLabel:"Mitä screener tekee cutterin readin jälkeen?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},"Ball reversal",500),
        event("MOVE",{player:"P5",to:s.highPost},"5 asettaa off-ball screenin",520),
        event("SCREEN",{player:"P5",targetPlayer:s.wingPlayer,screenType:"OFF_BALL"},"Screen "+s.wingPlayer+":lle",560),
        event("CUT",{player:s.wingPlayer,path:cutPath,cutType:cutterAction},"Cutter: "+cutterAction,720)
      ],
      teachingPoint:"Read opposite: cutter sisään → screener ulos. Cutter ulos → screener sisään."
    };
  }

  function buildPostEntry(random,role){
    var side=role==="3"?"LEFT":role==="4"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.wingPlayer;
    state.ballHandler=s.slotPlayer;
    state.ballLocation=s.slot;
    state.offense.P5.location=s.oppositeDunker;
    state.defense.D5.postDefense=choose(random,["BEHIND","BEHIND","THREE_QUARTER"]);
    state.context={
      postEntry:{
        ballHandler:s.wingPlayer,
        postPlayer:"P5",
        reversalPlayer:s.oppositeSlotPlayer,
        splitScreenTarget:s.oppositeSlotPlayer,
        sealed:true,
        laneOpen:false
      }
    };
    return{
      category:"POST_ENTRY",difficulty:2,
      decisionLabel:"Wingillä pallo ja 5:llä seal. Mikä on paras read?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing: pallo liikkuu wingille",620),
        event("GROUP",{moves:[
          {player:s.slotPlayer,path:["RIM",s.oppositeWing]},
          {player:s.oppositeSlotPlayer,to:s.slot},
          {player:s.oppositeWingPlayer,to:s.oppositeSlot}
        ]},"Syöttäjä thru-cuttaa, muut täyttävät perimeterin",620),
        event("MOVE",{player:"P5",to:s.block},"5 duck-in → vahvan puolen block",620)
      ],
      teachingPoint:"Kun postilla on hyvä seal ja puolustaja jää taakse, post entry on korkean prioriteetin read. Sen jälkeen syöttäjä jatkaa split-actioniin."
    };
  }

  function buildBallScreenRoller(random,role){
    var side=role==="1"?"LEFT":role==="2"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.slotPlayer;
    state.ballHandler=s.wingPlayer;
    state.ballLocation=s.wing;
    state.offense.P5.location=s.oppositeDunker;
    state.defense.D5.screenCoverage=choose(random,["HEDGE","SHOW"]);
    state.defense["D"+s.oppositeWingPlayer.slice(1)].helpPosition="HOME";
    state.context={
      ballScreenRead:{
        ballHandler:s.slotPlayer,
        roller:"P5",
        rollerOpen:true,
        rollerTagged:false,
        shakePlayer:s.wingPlayer,
        shakeDefenderTagging:false,
        skipPlayer:s.oppositeWingPlayer,
        weakSideCollapsed:false,
        onBallIce:false
      }
    };
    return{
      category:"BALL_SCREEN_ROLLER_READ",difficulty:3,
      decisionLabel:"5 rollaa ja bigin puolustaja auttaa. Missä etu?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.wingPlayer,toPlayer:s.oppositeSlotPlayer},"Wing → slot",480),
        event("PASS",{fromPlayer:s.oppositeSlotPlayer,toPlayer:s.slotPlayer},"Slot → opposite slot",480),
        event("MOVE",{player:"P5",to:s.highPost},"5 sprinttaa ball screeniin",560),
        event("SCREEN",{player:"P5",targetPlayer:s.slotPlayer,screenType:"BALL_SCREEN"},"Ball screen",560),
        event("CUT",{player:"P5",path:["RIM"],cutType:"ROLL"},"5 rollaa korille",650)
      ],
      teachingPoint:"Kun screenerin puolustaja auttaa pallolliseen eikä low-man tagaa, roller on korkean prioriteetin syöttö."
    };
  }

  function buildPostSplitSequence(random,role){
    var side=role==="3"?"LEFT":role==="4"?"RIGHT":choose(random,["LEFT","RIGHT"]);
    var s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.wingPlayer;
    state.ballHandler=s.slotPlayer;
    state.ballLocation=s.slot;
    state.offense.P5.location=s.oppositeDunker;
    var target=s.oppositeSlotPlayer;
    var targetDef=state.defense["D"+target.slice(1)];
    targetDef.denyLevel="HARD";
    targetDef.overplay="TOP_LOCK";
    state.context={
      postSplit:{
        passer:s.wingPlayer,
        postPlayer:"P5",
        screenTarget:target,
        slipLocation:s.oppositeBlock,
        reversalPlayer:s.oppositeSlotPlayer
      }
    };
    return{
      category:"POST_SPLIT_SEQUENCE",difficulty:3,
      decisionLabel:"Valitse koko jatkumo, ei vain ensimmäistä syöttöä.",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing",500),
        event("MOVE",{player:"P5",to:s.block},"5 duck-in ja seal blockille",600)
      ],
      teachingPoint:"Post entry ei päätä motionia: syöttäjä screenaa lähimmän perimeterin ja top-lockia vastaan screener voi slipata vastakkaiseen post-tilaan."
    };
  }

  var DEFINITIONS=[
    {category:"PASS_AND_CUT",difficulty:1,supports:supportsPerimeter,build:buildPassAndCut},
    {category:"FILL",difficulty:1,supports:function(role){return role==="random"||role==="1"||role==="2";},build:buildFill},
    {category:"CURL_READ",difficulty:1,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"CURL_READ","TRAIL",role);}},
    {category:"POP_READ",difficulty:1,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"POP_READ","UNDER",role);}},
    {category:"BACKDOOR_READ",difficulty:2,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"BACKDOOR_READ","TRAIL",role);}},
    {category:"SCREENER_SECOND_CUT",difficulty:2,supports:supportsCenter,build:buildSecondCut},
    {category:"POST_ENTRY",difficulty:2,supports:supportsWing,build:buildPostEntry},
    {category:"BALL_SCREEN_ROLLER_READ",difficulty:3,supports:supportsGuard,build:buildBallScreenRoller}
  ];

  function list(options){
    options=options||{};
    var level=Number(options.maxDifficulty||3);
    var role=String(options.role||"random");
    return DEFINITIONS.filter(function(def){return def.difficulty<=level&&def.supports(role);});
  }

  return{
    CATEGORIES:CATEGORIES.slice(),
    DEFINITIONS:DEFINITIONS.slice(),
    list:list,
    sideData:sideData,
    baseState:baseState
  };
});