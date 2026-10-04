(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GameLogic=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  function speedScore(seconds){
    if(seconds<1.5)return 100;
    if(seconds<2.5)return 80;
    if(seconds<4)return 60;
    if(seconds<6)return 40;
    return 20;
  }

  function comboBonus(streakBeforeAnswer){
    return Math.min(Math.max(0,streakBeforeAnswer)*5,50);
  }

  function pointsForAnswer(seconds,correct,streakBeforeAnswer){
    return correct?speedScore(seconds)+comboBonus(streakBeforeAnswer):-30;
  }

  function average(values){
    if(!values||!values.length)return 0;
    return values.reduce(function(sum,value){return sum+value;},0)/values.length;
  }

  return{
    speedScore:speedScore,
    comboBonus:comboBonus,
    pointsForAnswer:pointsForAnswer,
    average:average
  };
});