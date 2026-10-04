(function(root,factory){
  var Rules=typeof module==="object"&&module.exports?require("./rules.js"):root.GameRules;
  var Templates=typeof module==="object"&&module.exports?require("./templates.js"):root.PuzzleTemplates;
  var api=factory(Rules,Templates);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.PuzzleGenerator=api;
})(typeof window!=="undefined"?window:globalThis,function(Rules,Templates){
  "use strict";

  function clone(value){return JSON.parse(JSON.stringify(value));}

  function applyEvent(state,event){
    var next=clone(state);
    next.history=next.history||[];
    next.history.push(clone(event));

    if(event.type==="PASS"){
      var target=next.offense[event.toPlayer];
      if(target){
        next.ballHandler=event.toPlayer;
        next.ballLocation=target.location;
      }
    }

    if(event.type==="MOVE"||event.type==="DRIVE"){
      var player=next.offense[event.player];
      if(player){
        var path=event.path||[];
        if(event.to)player.location=event.to;
        else if(path.length)player.location=path[path.length-1];
        delete player.screeningTarget;
        delete player.screeningLocation;
        if(next.ballHandler===event.player)next.ballLocation=player.location;
      }
    }

    if(event.type==="GROUP"){
      (event.moves||[]).forEach(function(move){
        var mover=next.offense[move.player];
        if(!mover)return;
        var path=move.path||[];
        if(move.to)mover.location=move.to;
        else if(path.length)mover.location=path[path.length-1];
      });
    }

    if(event.type==="SCREEN"){
      var screener=next.offense[event.player];
      if(screener){
        screener.screeningTarget=event.targetPlayer;
        screener.screeningLocation=event.targetLocation;
      }
    }

    return next;
  }

  function weightedDefinitions(defs){
    var pool=[];
    defs.forEach(function(def){
      var weight=Math.max(1,Number(def.weight)||1);
      for(var i=0;i<weight;i++)pool.push(def);
    });
    return pool;
  }

  function chooseDefinition(defs,random,category){
    if(category){
      var exact=defs.filter(function(def){return def.category===category;});
      if(exact.length)return exact[Math.floor(random()*exact.length)];
    }
    var pool=weightedDefinitions(defs);
    return pool[Math.floor(random()*pool.length)];
  }

  function buildPuzzle(template){
    var triggerState=template.prelude.reduce(function(state,event){
      return applyEvent(state,event);
    },clone(template.initialState));

    var allReactions=Rules.getRequiredReactions(triggerState,template.trigger);
    if(!allReactions.length)throw new Error("Rule engine returned no reactions for "+template.category);

    var start=Math.max(0,Number(template.startReaction)||0);
    var playbackEvents=clone(template.prelude);
    var decisionState=clone(triggerState);

    for(var i=0;i<Math.min(start,allReactions.length);i++){
      var previous=allReactions[i];
      playbackEvents.push(Rules.reactionToEvent(previous));
      decisionState=Rules.applyReaction(decisionState,previous);
    }

    var reactionQueue;
    if(template.confirmSpacing){
      for(var j=start;j<allReactions.length;j++){
        playbackEvents.push(Rules.reactionToEvent(allReactions[j]));
        decisionState=Rules.applyReaction(decisionState,allReactions[j]);
      }
      reactionQueue=[Rules.confirmAction("Tunnista, että rotaatio on palauttanut neljä yksilöllistä perimeter-paikkaa.")];
    }else{
      reactionQueue=allReactions.slice(start);
    }

    if(!reactionQueue.length)throw new Error("Puzzle has no decision: "+template.category);

    return{
      category:template.category,
      initialState:clone(template.initialState),
      trigger:clone(template.trigger),
      playbackEvents:playbackEvents,
      decisionState:decisionState,
      reactionQueue:reactionQueue,
      allReactions:allReactions,
      finalValidation:template.confirmSpacing?"STANDARD_4_OUT":null
    };
  }

  function generatePuzzle(options){
    options=options||{};
    var random=options.randomFn||Math.random;
    var defs=Templates.list();
    var def=chooseDefinition(defs,random,options.category);
    var template=def.build(random);
    var puzzle=buildPuzzle(template);
    puzzle.id=puzzle.category+"-"+Date.now()+"-"+Math.floor(random()*100000);
    return puzzle;
  }

  function resolveChoiceOutcome(state,choice,selectedOption,randomFn){
    randomFn=randomFn||Math.random;
    if(!choice||choice.type!=="CHOICE"||!selectedOption)return{events:[],reactions:[],outcome:"NONE"};
    if(selectedOption.movement!=="SLIP")return{events:[],reactions:[],outcome:"EXCHANGE"};

    var getsPass=randomFn()<0.35;
    if(getsPass){
      return{
        outcome:"SLIP_PASS",
        events:[{
          type:"PASS",
          fromPlayer:state.ballHandler,
          toPlayer:selectedOption.player,
          label:"Slip aukeaa — pallo syötetään "+selectedOption.player+":lle",
          duration:1050
        }],
        reactions:[]
      };
    }

    return{
      outcome:"SLIP_NO_PASS",
      events:[{
        type:"WAIT",
        label:"Slip ei saa palloa — vapaa wing pitää vielä täyttää",
        duration:900
      }],
      reactions:[{
        type:"MOVE",
        player:selectedOption.player,
        targetLocation:choice.meta&&choice.meta.fallbackWing,
        movement:"FILL",
        rule:"SLOT_TO_SLOT_EXCHANGE",
        path:[choice.meta&&choice.meta.fallbackWing],
        reason:"Kun slip ei saa palloa, screener poistuu paintista ja täyttää vapaan wingin."
      }]
    };
  }

  function generateQueue(count,options){
    var result=[],previous=null;
    options=options||{};
    for(var i=0;i<count;i++){
      var puzzle=generatePuzzle(options),guard=0;
      while(puzzle.category===previous&&guard<8){
        puzzle=generatePuzzle(options);
        guard++;
      }
      result.push(puzzle);
      previous=puzzle.category;
    }
    return result;
  }

  return{
    clone:clone,
    applyEvent:applyEvent,
    weightedDefinitions:weightedDefinitions,
    buildPuzzle:buildPuzzle,
    generatePuzzle:generatePuzzle,
    resolveChoiceOutcome:resolveChoiceOutcome,
    generateQueue:generateQueue
  };
});