const ROUND_DEFINITIONS = [
  {
    key: "round32",
    matchNumbers: [73, 88],
    needles: ["round of 32", "dieciseisavos", "round 32"]
  },
  {
    key: "round16",
    matchNumbers: [89, 96],
    needles: ["round of 16", "octavos", "round 16"]
  },
  {
    key: "quarterfinals",
    matchNumbers: [97, 100],
    needles: ["quarter", "cuartos"]
  },
  {
    key: "semifinals",
    matchNumbers: [101, 102],
    needles: ["semi", "semifinal"]
  },
  {
    key: "thirdPlace",
    matchNumbers: [103, 103],
    needles: ["third", "tercer"]
  },
  {
    key: "final",
    matchNumbers: [104, 104],
    needles: ["final"]
  }
];

const ROUND_INDEX = new Map(ROUND_DEFINITIONS.map((round, index) => [round.key, index]));

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function bracketRoundKey(match) {
  if (match.group) return null;
  const stage = normalizedText(match.stage);
  const byStage = ROUND_DEFINITIONS.find((round) =>
    round.needles.some((needle) => stage.includes(normalizedText(needle)))
  );
  if (byStage) return byStage.key;

  const number = Number(match.matchNumber);
  const byNumber = ROUND_DEFINITIONS.find(
    (round) => Number.isFinite(number) && number >= round.matchNumbers[0] && number <= round.matchNumbers[1]
  );
  return byNumber?.key || null;
}

export function knockoutWinner(match) {
  if (match.statusTone !== "played") return null;
  const homeScore = Number(match.homeScore);
  const awayScore = Number(match.awayScore);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return { side: "home", code: match.homeCode };
  if (awayScore > homeScore) return { side: "away", code: match.awayCode };

  const homePenalties = Number(match.homePenaltyScore);
  const awayPenalties = Number(match.awayPenaltyScore);
  if (!Number.isFinite(homePenalties) || !Number.isFinite(awayPenalties)) return null;
  if (homePenalties > awayPenalties) return { side: "home", code: match.homeCode };
  if (awayPenalties > homePenalties) return { side: "away", code: match.awayCode };
  return null;
}

export function buildBracket(matches) {
  const roundMap = new Map();

  for (const match of matches) {
    const key = bracketRoundKey(match);
    if (!key) continue;
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        key,
        matches: []
      });
    }
    roundMap.get(key).matches.push({
      ...match,
      winner: knockoutWinner(match)
    });
  }

  const rounds = Array.from(roundMap.values())
    .sort((a, b) => ROUND_INDEX.get(a.key) - ROUND_INDEX.get(b.key))
    .map((round) => ({
      ...round,
      matches: round.matches.slice().sort((a, b) => a.matchNumber - b.matchNumber)
    }));

  return {
    rounds,
    totalMatches: rounds.reduce((total, round) => total + round.matches.length, 0)
  };
}
