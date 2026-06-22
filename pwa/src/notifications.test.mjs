import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_STORAGE_KEY,
  createLiveNotification,
  createNotificationState,
  getNotificationSupport,
  shouldNotifyLiveMatch
} from "./notifications.js";

const liveMatch = {
  id: "400021492",
  homeCode: "FRA",
  awayCode: "IRQ",
  homeScore: 1,
  awayScore: 0,
  statusTone: "live",
  raw: {
    MatchTime: "67'"
  }
};

test("detects notification support from browser capabilities", () => {
  assert.deepEqual(
    getNotificationSupport({
      Notification: function Notification() {},
      navigator: { serviceWorker: {} }
    }),
    { supported: true, permission: "default" }
  );

  assert.equal(getNotificationSupport({ navigator: {} }).supported, false);
});

test("creates a localized live-match notification payload", () => {
  assert.deepEqual(createLiveNotification(liveMatch, "es"), {
    tag: "fixtu26-live-400021492-1-0-67",
    title: "FRA 1 - 0 IRQ",
    body: "67' · Partido en vivo",
    url: "/?match=400021492",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png"
  });
});

test("deduplicates notifications until the score or clock changes", () => {
  const state = createNotificationState();
  assert.equal(shouldNotifyLiveMatch(liveMatch, state), true);
  assert.equal(shouldNotifyLiveMatch(liveMatch, state), false);
  assert.equal(
    shouldNotifyLiveMatch({ ...liveMatch, awayScore: 1 }, state),
    true
  );
});

test("exposes a stable storage key for user preference", () => {
  assert.equal(NOTIFICATION_STORAGE_KEY, "fixtu26.notifications.enabled");
});
