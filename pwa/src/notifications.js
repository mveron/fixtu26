export const NOTIFICATION_STORAGE_KEY = "fixtu26.notifications.enabled";

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/icon-96.png";

function notificationPermission(env) {
  return env.Notification?.permission || "default";
}

export function getNotificationSupport(env = globalThis) {
  const supported = Boolean(env.Notification && env.navigator?.serviceWorker);
  return {
    supported,
    permission: supported ? notificationPermission(env) : "unsupported"
  };
}

export function createNotificationState(initial = []) {
  return {
    sent: new Set(initial),
    scores: new Map()
  };
}

function matchClock(match) {
  return match.raw?.MatchTime || match.raw?.MatchMinute || match.raw?.MatchClock || "live";
}

function numericScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreSnapshot(match) {
  return {
    home: numericScore(match.homeScore),
    away: numericScore(match.awayScore)
  };
}

function scoreText(match) {
  return `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`;
}

function teamLabel(match, side) {
  return side === "home" ? match.homeName || match.homeCode : match.awayName || match.awayCode;
}

export function getLiveNotificationEvents(match, state) {
  if (!match || match.statusTone !== "live") return [];

  const events = [];
  const startKey = `${match.id}:start`;
  if (!state.sent.has(startKey)) {
    state.sent.add(startKey);
    events.push({ type: "start", key: startKey });
  }

  const nextScore = scoreSnapshot(match);
  const previousScore = state.scores.get(match.id);
  state.scores.set(match.id, nextScore);

  if (!previousScore) return events;

  const homeGoal = previousScore.home !== null && nextScore.home !== null && nextScore.home > previousScore.home;
  const awayGoal = previousScore.away !== null && nextScore.away !== null && nextScore.away > previousScore.away;

  for (const side of [homeGoal ? "home" : null, awayGoal ? "away" : null].filter(Boolean)) {
    const goalKey = `${match.id}:goal:${side}:${nextScore.home}-${nextScore.away}`;
    if (state.sent.has(goalKey)) continue;
    state.sent.add(goalKey);
    events.push({ type: "goal", side, key: goalKey });
  }

  return events;
}

export function createLiveNotification(match, event = { type: "start" }, language = "en") {
  const clock = matchClock(match);
  const isGoal = event.type === "goal";
  const labels = language === "es"
    ? {
        startTitle: "Comenzo el partido",
        startBody: "Partido en vivo",
        goalTitle: "Gol",
        minute: "min"
      }
    : {
        startTitle: "Kick-off",
        startBody: "Live match",
        goalTitle: "Goal",
        minute: "min"
      };

  return {
    tag: `fixtu26-${event.key || `${event.type}-${match.id}`}`,
    title: isGoal
      ? `${labels.goalTitle}: ${teamLabel(match, event.side)}`
      : `${labels.startTitle}: ${match.homeCode} vs ${match.awayCode}`,
    body: isGoal
      ? `${match.homeCode} ${scoreText(match)} ${match.awayCode} · ${clock}`
      : `${scoreText(match)} · ${labels.startBody}`,
    url: `/?match=${encodeURIComponent(match.id)}`,
    icon: ICON,
    badge: BADGE
  };
}
