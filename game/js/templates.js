(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PuzzleTemplates=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  var EVENT_MS=900;
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
      slotPlayer:left?"P1":"P2",
      oppositeSlotPlayer:left?"P2":"P1",
      wingPlayer:left?"P3":"P4",
      oppositeWingPlayer:left?"P4":"P3"
    };
  }

  function baseState(side){
    var s=sideData(side);
    var offense={
      P1:{role:"guard",location:"LEFT_SLOT"},
      P2:{role:"guard",location:"RIGHT_SLOT"},
      P3:{role:"wing",location:"LEFT_WING"},
      P4:{role:"wing",location:"RIGHT_WING"},
      P5:{role:"center",location:s.oppositeDunker}
    };
    var defense={};
    ["1","2","3","4","5"].forEach(function(n){
      defense["D"+n]={
        guarding:"P"+n,onBallPosition:"NORMAL",denyLevel:"NONE",screenCoverage:"TRAIL",
        helpPosition:"HOME",postDefense:"BEHIND",closeout:"NORMAL"
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
    return Object.assign({type:type,label:label||type,duration:duration||EVENT_MS},props||{});
  }

  function supportsGuard(role){return role==="random"||role==="1"||role==="2";}
  function supportsWing(role){return role==="random"||role==="3"||role==="4";}
  function supportsCenter(role){return role==="random"||role==="5";}

  function setScreenDefense(state,player,coverage){
    var d=state.defense["D"+player.slice(1)];
    d.screenCoverage=coverage==="TOP_LOCK"?"TRAIL":coverage;
    d.denyLevel=coverage==="TOP_LOCK"?"HARD":"NONE";
    if(coverage==="TOP_LOCK")d.overplay="TOP_LOCK";
  }

  function guardSide(role,random){
    if(role==="1")return"LEFT";
    if(role==="2")return"RIGHT";
    return choose(random,["LEFT","RIGHT"]);
  }

  function fillSide(role,random){
    if(role==="1")return"RIGHT";
    if(role==="2")return"LEFT";
    return choose(random,["LEFT","RIGHT"]);
  }

  function wingSide(role,random){
    if(role==="3")return"LEFT";
    if(role==="4")return"RIGHT";
    return choose(random,["LEFT","RIGHT"]);
  }

  function buildPassAndCut(random,role){
    var side=guardSide(role,random),s=sideData(side),state=baseState(side);
    var coverage=choose(random,["TRAIL","UNDER","TOP_LOCK"]);
    state.ballHandler=s.oppositeWingPlayer;
    state.ballLocation=s.oppositeWing;
    state.decisionPlayer=s.slotPlayer;
    state.context={
      justPassedBy:s.slotPlayer,
      trigger:{
        type:"SLOT_TO_WING_PASS",
        passer:s.slotPlayer,receiver:s.wingPlayer,from:s.slot,to:s.wing,
        oppositeWing:s.oppositeWing,
        nextScreenScreener:"P5",
        nextScreenApproach:s.oppositeHighPost,
        nextScreenCoverage:coverage,
        nextScreenFade:s.oppositeCorner
      }
    };
    return{
      category:"PASS_AND_CUT",
      decisionLabel:"Slot syötti wingille. Mitä syöttäjä tekee nyt?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.oppositeWingPlayer,toPlayer:s.oppositeSlotPlayer},"Wing → slot: aloitetaan pallon reversal"),
        event("PASS",{fromPlayer:s.oppositeSlotPlayer,toPlayer:s.slotPlayer},"Slot → slot: pallo vaihtaa puolta"),
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing: nyt lue pass-and-move")
      ],
      teachingPoint:"Never pass and stand. Slot → wing -syötön jälkeen syöttäjä leikkaa korin kautta vastakkaiselle wingille.",
      continuationPotential:true
    };
  }

  function buildFill(random,role){
    var side=fillSide(role,random),s=sideData(side),state=baseState(side);
    state.ballHandler=s.oppositeWingPlayer;
    state.ballLocation=s.oppositeWing;
    state.decisionPlayer=s.oppositeSlotPlayer;
    state.context={vacantSpot:s.slot,fillPlayer:s.oppositeSlotPlayer,cutter:s.slotPlayer};
    return{
      category:"FILL",
      decisionLabel:"Slot on vapaa ja cutter on korilla. Kuka palauttaa spacingin?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.oppositeWingPlayer,toPlayer:s.oppositeSlotPlayer},"Wing → slot"),
        event("PASS",{fromPlayer:s.oppositeSlotPlayer,toPlayer:s.slotPlayer},"Slot → slot reversal"),
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing"),
        event("CUT",{player:s.slotPlayer,path:["RIM"],cutType:"THRU"},"Syöttäjä leikkaa korille — slot jää tyhjäksi")
      ],
      teachingPoint:"Kun perimeter-spotti vapautuu, lähin soveltuva pelaaja fillaa sen ilman kasaantumista.",
      continuationPotential:false
    };
  }

  function buildScreenRead(random,category,coverage,role){
    var side=wingSide(role,random),s=sideData(side),state=baseState(side);
    var cutter=s.wingPlayer;
    state.decisionPlayer=cutter;
    setScreenDefense(state,cutter,coverage);
    state.context={
      offBallScreen:{
        cutter:cutter,screener:"P5",
        curlTarget:"RIM",
        popTarget:s.wing,
        fadeTarget:s.corner
      }
    };
    return{
      category:category,
      decisionLabel:"Screen on asetettu. Lue oma puolustaja.",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},"Slot → slot reversal"),
        event("MOVE",{player:"P5",to:s.highPost},"5 nousee weak-side screeniin"),
        event("SCREEN",{player:"P5",targetPlayer:cutter,screenType:"OFF_BALL",moveTo:s.wing},"5 asettaa off-ball screenin "+cutter+":lle")
      ],
      teachingPoint:category==="CURL_READ"
        ?"Defender trails → curl."
        :category==="POP_READ"
          ?"Defender under → pop/straight."
          :"Top-lock / hard deny → take the lane backdoorilla.",
      continuationPotential:true
    };
  }

  function buildSecondCut(random,role){
    var side=choose(random,["LEFT","RIGHT"]),s=sideData(side),state=baseState(side);
    var cutterAction=choose(random,["CURL","POP"]);
    state.decisionPlayer="P5";
    state.context={
      secondCut:{
        screener:"P5",cutter:s.wingPlayer,cutterAction:cutterAction,
        rollLocation:"RIM",popLocation:s.wing
      }
    };
    var cutPath=cutterAction==="CURL"?["RIM"]:[s.corner];
    return{
      category:"SCREENER_SECOND_CUT",
      decisionLabel:"Cutter teki readin. Mitä screener tekee second cutina?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.oppositeSlotPlayer},"Ball reversal"),
        event("MOVE",{player:"P5",to:s.highPost},"5 siirtyy screeniin"),
        event("SCREEN",{player:"P5",targetPlayer:s.wingPlayer,screenType:"OFF_BALL",moveTo:s.wing},"5 asettaa screenin"),
        event("CUT",{player:s.wingPlayer,path:cutPath,cutType:cutterAction},"Cutter lukee puolustuksen: "+cutterAction)
      ],
      teachingPoint:"Read opposite: cutter sisään → screener ulos. Cutter ulos → screener sisään.",
      continuationPotential:false
    };
  }

  function buildPostEntry(random,role){
    var side=wingSide(role,random),s=sideData(side),state=baseState(side);
    var splitCoverage=choose(random,["TRAIL","UNDER","TOP_LOCK"]);
    state.decisionPlayer=s.wingPlayer;
    state.offense.P5.location=s.oppositeDunker;
    state.defense.D5.postDefense=choose(random,["BEHIND","BEHIND","THREE_QUARTER"]);
    state.context={
      postEntry:{
        ballHandler:s.wingPlayer,
        postPlayer:"P5",
        reversalPlayer:s.oppositeSlotPlayer,
        splitScreenTarget:s.oppositeSlotPlayer,
        splitCoverage:splitCoverage,
        sealed:true,
        laneOpen:false
      }
    };
    return{
      category:"POST_ENTRY",
      decisionLabel:"Wingillä pallo ja 5:llä seal. Mikä on paras read?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.slotPlayer,toPlayer:s.wingPlayer},"Slot → wing: pallo wingille"),
        event("GROUP",{moves:[
          {player:s.slotPlayer,path:["RIM",s.oppositeWing]},
          {player:s.oppositeSlotPlayer,to:s.slot},
          {player:s.oppositeWingPlayer,to:s.oppositeSlot}
        ]},"Thru cut + fillit: perimeter liikkuu yhtä aikaa"),
        event("MOVE",{player:"P5",to:s.block},"5 duck-in → vahvan puolen block")
      ],
      teachingPoint:"Hyvä seal tekee post entrystä korkean prioriteetin readin. Sen jälkeen syöttäjä jatkaa split-actioniin.",
      continuationPotential:true
    };
  }

  function buildBallScreenRoller(random,role){
    var side=guardSide(role,random),s=sideData(side),state=baseState(side);
    state.decisionPlayer=s.slotPlayer;
    state.ballHandler=s.wingPlayer;
    state.ballLocation=s.wing;
    state.defense.D5.screenCoverage=choose(random,["HEDGE","SHOW"]);
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
      category:"BALL_SCREEN_ROLLER_READ",
      decisionLabel:"5 rollaa ja bigin puolustaja auttaa. Missä etu?",
      initialState:state,
      prelude:[
        event("PASS",{fromPlayer:s.wingPlayer,toPlayer:s.oppositeSlotPlayer},"Wing → slot"),
        event("PASS",{fromPlayer:s.oppositeSlotPlayer,toPlayer:s.slotPlayer},"Slot → opposite slot"),
        event("MOVE",{player:"P5",to:s.highPost},"5 sprinttaa ball screeniin"),
        event("SCREEN",{player:"P5",targetPlayer:s.slotPlayer,screenType:"BALL_SCREEN",moveTo:s.slot},"5 asettaa ball screenin"),
        event("CUT",{player:"P5",path:["RIM"],cutType:"ROLL"},"5 rollaa korille, big auttaa pallolliseen")
      ],
      teachingPoint:"Kun screenerin puolustaja auttaa pallolliseen eikä low-man tagaa, roller on korkean prioriteetin syöttö.",
      continuationPotential:false
    };
  }

  var DEFINITIONS=[
    {category:"PASS_AND_CUT",weight:3,continuationPotential:true,supports:supportsGuard,build:buildPassAndCut},
    {category:"FILL",weight:1,continuationPotential:false,supports:supportsGuard,build:buildFill},
    {category:"CURL_READ",weight:3,continuationPotential:true,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"CURL_READ","TRAIL",role);}},
    {category:"POP_READ",weight:3,continuationPotential:true,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"POP_READ","UNDER",role);}},
    {category:"BACKDOOR_READ",weight:3,continuationPotential:true,supports:supportsWing,build:function(r,role){return buildScreenRead(r,"BACKDOOR_READ","TOP_LOCK",role);}},
    {category:"SCREENER_SECOND_CUT",weight:1,continuationPotential:false,supports:supportsCenter,build:buildSecondCut},
    {category:"POST_ENTRY",weight:4,continuationPotential:true,supports:supportsWing,build:buildPostEntry},
    {category:"BALL_SCREEN_ROLLER_READ",weight:2,continuationPotential:false,supports:supportsGuard,build:buildBallScreenRoller}
  ];

  function list(options){
    options=options||{};
    var role=String(options.role||"random");
    return DEFINITIONS.filter(function(def){return def.supports(role);});
  }

  return{
    EVENT_MS:EVENT_MS,
    CATEGORIES:CATEGORIES.slice(),
    DEFINITIONS:DEFINITIONS.slice(),
    list:list,
    sideData:sideData,
    baseState:baseState
  };
});