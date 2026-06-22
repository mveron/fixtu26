import test from "node:test";
import assert from "node:assert/strict";
import { buildBracket, knockoutWinner } from "./bracket.js";

function match(overrides) {
  return {
    id: String(overrides.matchNumber),
    matchNumber: overrides.matchNumber,
    stage: overrides.stage,
    group: overrides.group || "",
    date: overrides.date || `2026-07-${String(overrides.matchNumber).slice(-2).padStart(2, "0")}T20:00:00Z`,
    statusTone: overrides.statusTone || "upcoming",
    homeCode: overrides.homeCode || "HOM",
    awayCode: overrides.awayCode || "AWY",
    homeName: overrides.homeName || "Home",
    awayName: overrides.awayName || "Away",
    homeScore: overrides.homeScore ?? null,
    awayScore: overrides.awayScore ?? null,
    homePenaltyScore: overrides.homePenaltyScore,
    awayPenaltyScore: overrides.awayPenaltyScore
  };
}

test("builds ordered knockout rounds and ignores group-stage matches", () => {
  const bracket = buildBracket([
    match({ matchNumber: 1, stage: "First Stage", group: "Group A" }),
    match({ matchNumber: 104, stage: "Final" }),
    match({ matchNumber: 97, stage: "Quarter-finals" }),
    match({ matchNumber: 73, stage: "Round of 32" }),
    match({ matchNumber: 101, stage: "Semi-finals" }),
    match({ matchNumber: 89, stage: "Round of 16" }),
    match({ matchNumber: 103, stage: "Third-place match" })
  ]);

  assert.deepEqual(
    bracket.rounds.map((round) => round.key),
    ["round32", "round16", "quarterfinals", "semifinals", "thirdPlace", "final"]
  );
  assert.equal(bracket.totalMatches, 6);
  assert.equal(bracket.rounds[0].matches[0].matchNumber, 73);
});

test("detects winners from score and penalty shootout", () => {
  assert.deepEqual(
    knockoutWinner(match({
      matchNumber: 104,
      stage: "Final",
      statusTone: "played",
      homeCode: "ARG",
      awayCode: "FRA",
      homeScore: 3,
      awayScore: 2
    })),
    { side: "home", code: "ARG" }
  );

  assert.deepEqual(
    knockoutWinner(match({
      matchNumber: 97,
      stage: "Quarter-finals",
      statusTone: "played",
      homeCode: "BRA",
      awayCode: "ESP",
      homeScore: 1,
      awayScore: 1,
      homePenaltyScore: 4,
      awayPenaltyScore: 5
    })),
    { side: "away", code: "ESP" }
  );
});
