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
  return new Set(initial);
}

function matchClock(match) {
  return match.raw?.MatchTime || match.raw?.MatchMinute || match.raw?.MatchClock || "live";
}

function matchSignature(match) {
  return [
    match.id,
    match.homeScore ?? "-",
    match.awayScore ?? "-",
    String(matchClock(match)).replace(/[^a-zA-Z0-9]/g, "")
  ].join("-");
}

export function shouldNotifyLiveMatch(match, state) {
  if (!match || match.statusTone !== "live") return false;
  const signature = matchSignature(match);
  if (state.has(signature)) return false;
  state.add(signature);
  return true;
}

export function createLiveNotification(match, language = "en") {
  const clock = matchClock(match);
  const liveLabel = language === "es" ? "Partido en vivo" : "Live match";
  const homeScore = match.homeScore ?? "-";
  const awayScore = match.awayScore ?? "-";
  return {
    tag: `fixtu26-live-${matchSignature(match)}`,
    title: `${match.homeCode} ${homeScore} - ${awayScore} ${match.awayCode}`,
    body: `${clock} · ${liveLabel}`,
    url: `/?match=${encodeURIComponent(match.id)}`,
    icon: ICON,
    badge: BADGE
  };
}
