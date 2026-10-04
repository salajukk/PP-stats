(function(root,factory){
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.GameLogic=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  function speedScore(seconds){
    if(seconds<1)return 100;
    if(seconds<2)return 80;
    if(seconds<3)return 60;
    if(seconds<5)return 40;
    return 20;
  }

  function comboBonus(streakBeforeAnswer){
    return Math.min(Math.max(0,streakBeforeAnswer)*5,50);
  }

  function average(values){
    if(!values||!values.length)return 0;
    return values.reduce(function(sum,value){return sum+value;},0)/values.length;
  }

  function classificationFactor(classification){
    if(classification==="BEST")return 1;
    if(classification==="GOOD")return .8;
    if(classification==="ACCEPTABLE")return .5;
    if(classification==="POOR")return .2;
    return 0;
  }

  function pointsForOutcome(seconds,classification,streakBeforeAnswer){
    if(classification==="WRONG")return -30;
    var factor=classificationFactor(classification);
    var base=Math.round(speedScore(seconds)*factor);
    var bonus=(classification==="BEST"||classification==="GOOD")?comboBonus(streakBeforeAnswer):0;
    return base+bonus;
  }

  function summarizeAttempts(attempts){
    var summary={total:0,BEST:0,GOOD:0,ACCEPTABLE:0,POOR:0,WRONG:0,averageTime:0};
    if(!attempts||!attempts.length)return summary;
    var times=[];
    attempts.forEach(function(item){
      summary.total+=1;
      if(Object.prototype.hasOwnProperty.call(summary,item.classification))summary[item.classification]+=1;
      if(Number.isFinite(item.responseTime))times.push(item.responseTime);
    });
    summary.averageTime=average(times);
    return summary;
  }

  return{
    speedScore:speedScore,
    comboBonus:comboBonus,
    average:average,
    classificationFactor:classificationFactor,
    pointsForOutcome:pointsForOutcome,
    summarizeAttempts:summarizeAttempts
  };
});