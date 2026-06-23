import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_STORAGE_KEY,
  createLiveNotification,
  createNotificationState,
  getLiveNotificationEvents,
  getNotificationSupport,
} from "./notifications.js";

const liveMatch = {
  id: "400021492",
  homeCode: "FRA",
  awayCode: "IRQ",
  homeName: "France",
  awayName: "Iraq",
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

test("creates a localized match-start notification payload", () => {
  assert.deepEqual(createLiveNotification(liveMatch, { type: "start", key: "400021492:start" }, "es"), {
    tag: "fixtu26-400021492:start",
    title: "Comenzo el partido: FRA vs IRQ",
    body: "1 - 0 · Partido en vivo",
    url: "/?match=400021492",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png"
  });
});

test("creates a localized goal notification payload", () => {
  assert.deepEqual(createLiveNotification(liveMatch, { type: "goal", side: "home", key: "400021492:goal:home:1-0" }, "en"), {
    tag: "fixtu26-400021492:goal:home:1-0",
    title: "Goal: France",
    body: "FRA 1 - 0 IRQ · 67'",
    url: "/?match=400021492",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-96.png"
  });
});

test("notifies match start once and ignores clock-only updates", () => {
  const state = createNotificationState();
  assert.deepEqual(getLiveNotificationEvents(liveMatch, state), [
    { type: "start", key: "400021492:start" }
  ]);
  assert.deepEqual(
    getLiveNotificationEvents({ ...liveMatch, raw: { MatchTime: "68'" } }, state),
    []
  );
});

test("notifies only when a team scores", () => {
  const state = createNotificationState();
  getLiveNotificationEvents({ ...liveMatch, homeScore: 0, awayScore: 0 }, state);

  assert.deepEqual(getLiveNotificationEvents({ ...liveMatch, homeScore: 1, awayScore: 0 }, state), [
    { type: "goal", side: "home", key: "400021492:goal:home:1-0" }
  ]);
  assert.deepEqual(getLiveNotificationEvents({ ...liveMatch, homeScore: 1, awayScore: 0 }, state), []);
  assert.deepEqual(getLiveNotificationEvents({ ...liveMatch, homeScore: 1, awayScore: 1 }, state), [
    { type: "goal", side: "away", key: "400021492:goal:away:1-1" }
  ]);
});

test("exposes a stable storage key for user preference", () => {
  assert.equal(NOTIFICATION_STORAGE_KEY, "fixtu26.notifications.enabled");
});
