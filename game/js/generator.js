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

    if(event.type==="MOVE"||event.type==="CUT"){
      var player=next.offense[event.player];
      if(player){
        var path=event.path||[];
        if(event.to)player.location=event.to;
        else if(path.length)player.location=path[path.length-1];
        if(next.ballHandler===event.player)next.ballLocation=player.location;
      }
    }

    if(event.type==="SCREEN"&&event.moveTo&&next.offense[event.player]){
      next.offense[event.player].location=event.moveTo;
    }

    if(event.type==="DEFENSE"&&event.defender&&next.defense[event.defender]){
      Object.assign(next.defense[event.defender],event.changes||{});
    }

    return next;
  }

  function deriveDecisionState(template){
    return template.prelude.reduce(function(state,event){return applyEvent(state,event);},clone(template.initialState));
  }

  function validateState(state){
    var issues=[];
    var offenseIds=Object.keys(state.offense||{});
    var defenseIds=Object.keys(state.defense||{});
    if(offenseIds.length!==5)issues.push("offense must contain five players");
    if(defenseIds.length!==5)issues.push("defense must contain five defenders");
    if(!state.offense[state.decisionPlayer])issues.push("decisionPlayer must exist");
    if(!state.offense[state.ballHandler])issues.push("ballHandler must exist");
    offenseIds.forEach(function(id){
      if(!state.offense[id].location)issues.push(id+" missing location");
    });
    defenseIds.forEach(function(id){
      if(!state.defense[id].guarding)issues.push(id+" missing guarding");
    });
    return issues;
  }

  function meaningful(ranked){
    if(!ranked||ranked.length<2)return false;
    if(ranked[0].score<75)return false;
    return true;
  }

  function chooseDefinition(defs,random,category){
    if(category){
      var exact=defs.filter(function(def){return def.category===category;});
      if(exact.length)return exact[Math.floor(random()*exact.length)];
    }
    return defs[Math.floor(random()*defs.length)];
  }

  function generatePuzzle(options){
    options=options||{};
    var random=options.randomFn||Math.random;
    var defs=Templates.list({maxDifficulty:options.maxDifficulty||3,role:options.role||"random"});
    if(!defs.length)defs=Templates.list({maxDifficulty:options.maxDifficulty||3,role:"random"});
    if(!defs.length)throw new Error("No puzzle templates available.");

    for(var attempt=0;attempt<30;attempt+=1){
      var def=chooseDefinition(defs,random,options.category);
      var template=def.build(random,String(options.role||"random"));
      var decisionState=deriveDecisionState(template);
      var issues=validateState(decisionState);
      var ranked=Rules.rankActions(decisionState);

      if(!issues.length&&meaningful(ranked)){
        return{
          id:template.category+"-"+Date.now()+"-"+Math.floor(random()*100000),
          category:template.category,
          difficulty:template.difficulty,
          decisionLabel:template.decisionLabel,
          initialState:clone(template.initialState),
          prelude:clone(template.prelude),
          decisionPlayer:decisionState.decisionPlayer,
          decisionState:decisionState,
          candidateActions:ranked.map(function(item){return item.action;}),
          rankedSolutions:ranked,
          teachingPoint:template.teachingPoint
        };
      }
    }
    throw new Error("Could not generate a meaningful puzzle.");
  }

  function generateQueue(count,options){
    var result=[],previous=null;
    options=options||{};
    for(var i=0;i<count;i+=1){
      var puzzle=generatePuzzle(options);
      var guard=0;
      while(puzzle.category===previous&&guard<8){
        puzzle=generatePuzzle(options);
        guard+=1;
      }
      result.push(puzzle);
      previous=puzzle.category;
    }
    return result;
  }

  return{
    clone:clone,
    applyEvent:applyEvent,
    deriveDecisionState:deriveDecisionState,
    validateState:validateState,
    generatePuzzle:generatePuzzle,
    generateQueue:generateQueue
  };
});