(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GameLogic = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VALID_SPOTS = [
    "leftCorner","rightCorner","leftDunker","rightDunker","dunkerSpot",
    "paint","leftWing","rightWing","leftSlot","rightSlot","top"
  ];

  function speedScore(seconds) {
    if (seconds < 1) return 100;
    if (seconds < 2) return 80;
    if (seconds < 3) return 60;
    if (seconds < 5) return 40;
    return 20;
  }

  function comboBonus(streakBeforeAnswer) {
    return Math.min(Math.max(0, streakBeforeAnswer) * 5, 50);
  }

  function average(values) {
    if (!values || !values.length) return 0;
    return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
  }

  function normalizeSpot(name) {
    return name === "dunkerSpot" ? "rightDunker" : name;
  }

  function buildChallengeQueue(pool, count, randomFn) {
    if (!Array.isArray(pool) || pool.length === 0) return [];
    var random = randomFn || Math.random;
    var result = [];
    var previousId = null;

    while (result.length < count) {
      var options = pool.filter(function (scenario) {
        return pool.length === 1 || scenario.id !== previousId;
      });
      var index = Math.floor(random() * options.length);
      if (index < 0) index = 0;
      if (index >= options.length) index = options.length - 1;
      var chosen = options[index];
      result.push(chosen);
      previousId = chosen.id;
    }
    return result;
  }

  function validateScenarios(scenarios) {
    var issues = [];
    var ids = Object.create(null);
    var valid = Object.create(null);
    VALID_SPOTS.forEach(function (spot) { valid[spot] = true; });

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return ["Scenario list must be a non-empty array."];
    }

    scenarios.forEach(function (scenario, index) {
      var label = scenario && scenario.id ? scenario.id : "scenario #" + (index + 1);
      if (!scenario || typeof scenario !== "object") {
        issues.push(label + ": must be an object");
        return;
      }
      if (!scenario.id) issues.push(label + ": missing id");
      else if (ids[scenario.id]) issues.push(label + ": duplicate id");
      else ids[scenario.id] = true;

      if (![1,2,3,4,5].includes(scenario.controlledPlayer)) {
        issues.push(label + ": invalid controlledPlayer");
      }

      var players = scenario.positions ? Object.keys(scenario.positions) : [];
      if (players.length !== 5) issues.push(label + ": expected five player positions");
      ["1","2","3","4","5"].forEach(function (player) {
        if (!scenario.positions || !valid[scenario.positions[player]]) {
          issues.push(label + ": invalid/missing position for player " + player);
        }
      });

      ["ballFrom","ballTo","correctPosition"].forEach(function (field) {
        if (!valid[scenario[field]]) issues.push(label + ": invalid " + field);
      });

      if (!scenario.correctAction) issues.push(label + ": missing correctAction");
      if (!scenario.explanation) issues.push(label + ": missing explanation");
      if (!scenario.triggerText) issues.push(label + ": missing triggerText");

      if (scenario.automaticMoves) {
        Object.keys(scenario.automaticMoves).forEach(function (player) {
          if (!["1","2","3","4","5"].includes(String(player))) {
            issues.push(label + ": invalid automaticMoves player " + player);
          }
          if (!valid[scenario.automaticMoves[player]]) {
            issues.push(label + ": invalid automaticMoves spot for player " + player);
          }
        });
      }
    });

    return issues;
  }

  function countByRole(scenarios) {
    return scenarios.reduce(function (counts, scenario) {
      counts[scenario.controlledPlayer] = (counts[scenario.controlledPlayer] || 0) + 1;
      return counts;
    }, {});
  }

  return {
    VALID_SPOTS: VALID_SPOTS.slice(),
    speedScore: speedScore,
    comboBonus: comboBonus,
    average: average,
    normalizeSpot: normalizeSpot,
    buildChallengeQueue: buildChallengeQueue,
    validateScenarios: validateScenarios,
    countByRole: countByRole
  };
});