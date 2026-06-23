import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  Filter,
  GitBranch,
  Globe2,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Shirt,
  ShieldCheck,
  Table2,
  UsersRound,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";
import { buildBracket } from "./bracket.js";
import {
  NOTIFICATION_STORAGE_KEY,
  createLiveNotification,
  createNotificationState,
  getLiveNotificationEvents,
  getNotificationSupport,
} from "./notifications.js";

const FIFA_API_BASE = "https://api.fifa.com/api/v3";
const FIFA_TIMELINE_URL = "https://api.fifa.com/api/v3/timelines";
const FIFA_SEASON_ID = "285023";
const FIFA_MATCH_CENTRE_BASE = "https://www.fifa.com";
const TIME_ZONE = "America/Buenos_Aires";
const LIVE_FIXTURE_REFRESH_MS = 15000;
const IDLE_FIXTURE_REFRESH_MS = 60000;
const LIVE_DETAIL_REFRESH_MS = 10000;
const IDLE_DETAIL_REFRESH_MS = 60000;
const LIVE_MATCH_STATUSES = new Set([3, 11]);

const I18N = {
  en: {
    code: "en",
    fifaLanguage: "en",
    fifaPath: "en",
    locale: "en-US",
    htmlLang: "en",
    sourceLoading: "Loading",
    sourceFifa: "FIFA API",
    sourceCache: "Local cache",
    sourceSnapshot: "Offline snapshot",
    title: "Fixtu26",
    tagline: "World Cup 26 fixture, groups and live match detail",
    brandKicker: "Unofficial match companion",
    refresh: "Refresh",
    install: "Install",
    installPwa: "Install PWA",
    notifications: {
      enable: "Alerts",
      enabled: "Alerts on",
      blocked: "Blocked",
      unsupported: "No alerts",
      title: "Live match alerts",
      permissionDenied: "Notifications are blocked in this browser."
    },
    fixture: "Fixture",
    groups: "Groups",
    bracket: {
      title: "Bracket",
      subtitle: "Knockout stage",
      emptyTitle: "Knockout bracket not published yet",
      emptyBody: "When FIFA publishes knockout matches, they will appear here.",
      matches: "matches",
      winner: "Winner",
      penalties: "Penalties",
      rounds: {
        round32: "Round of 32",
        round16: "Round of 16",
        quarterfinals: "Quarter-finals",
        semifinals: "Semi-finals",
        thirdPlace: "Third place",
        final: "Final"
      }
    },
    mainViews: "Main views",
    matches: "matches",
    played: "played",
    live: "live",
    lastLoad: "last load",
    status: {
      played: "Played",
      live: "Live",
      upcoming: "Upcoming",
      scheduled: "Scheduled"
    },
    statusFilters: {
      all: "All",
      live: "Live",
      played: "Played",
      upcoming: "Upcoming"
    },
    filters: {
      status: "Status",
      stage: "Stage",
      allStages: "All",
      group: "Group",
      allGroups: "All",
      search: "Search"
    },
    noMatchesTitle: "No matches for those filters",
    noMatchesBody: "Try changing stage, group or search.",
    noGroupsTitle: "No groups published",
    noGroupsBody: "When FIFA publishes the group stage, it will appear here.",
    teams: "Teams",
    standings: "Standings",
    pointsTable: "Points table",
    table: {
      team: "Team",
      played: "P",
      won: "W",
      drawn: "D",
      lost: "L",
      goalsFor: "GF",
      goalsAgainst: "GA",
      goalDiff: "GD",
      points: "Pts"
    },
    spotlightLive: "Live match",
    spotlightNext: "Next match",
    venueTbd: "Venue TBD",
    liveMatches: "Live matches",
    previousLive: "Previous live match",
    nextLive: "Next live match",
    stageTbd: "Stage TBD",
    match: "Match",
    matchNumber: "Match",
    detail: {
      facts: "Facts",
      stats: "Stats",
      lineup: "Lineup",
      timeline: "Timeline",
      loading: "Loading match data...",
      matchDetail: "Match detail"
    },
    facts: {
      date: "Date",
      stadium: "Stadium",
      stage: "Stage",
      status: "Status",
      referee: "Referee",
      attendance: "Attendance"
    },
    stadiumTbd: "Stadium TBD",
    cityTbd: "City TBD",
    tbd: "TBD",
    notPublished: "Not published",
    noAttendance: "Not published",
    noReferee: "Not published",
    final: "Finished",
    scheduled: "Scheduled",
    fifaData: "FIFA data",
    stats: {
      score: "Score",
      minutePeriod: "Minute / period",
      period: "Period",
      possession: "Possession",
      available: "Available",
      unavailable: "--",
      published: "Published by FIFA",
      notPublished: "Not published for this match",
      statistic: "Statistic",
      goalsDetected: "Goals detected",
      cards: "Cards",
      fouls: "Fouls recorded",
      substitutions: "Substitutions",
      fifaEvents: "FIFA events"
    },
    positions: {
      goalkeeper: "Goalkeeper",
      defender: "Defender",
      midfielder: "Midfielder",
      forward: "Forward",
      squad: "Squad"
    },
    formation: {
      empty: "FIFA has not published this team's starting lineup yet.",
      bench: "Substitutes",
      aria: "Lineup for"
    },
    timeline: {
      empty: "The timeline appears when FIFA publishes match events.",
      error: "Could not load the timeline.",
      event: "Event"
    },
    selectMatch: "Select a match",
    knockout: "Knockout",
    goal: "Goal",
    apiErrors: {
      refresh: "Could not refresh FIFA API; using local cache.",
      fixture: "Could not load the fixture.",
      detail: "Could not load live match details."
    },
    refereeNeedles: ["referee", "árbitro"],
    eventNeedles: {
      goal: ["goal", "gol"],
      card: ["card", "tarjeta"],
      foul: ["foul", "falta"],
      substitution: ["substitution", "substitute", "cambio", "sustit"]
    }
  },
  es: {
    code: "es",
    fifaLanguage: "es",
    fifaPath: "es",
    locale: "es-AR",
    htmlLang: "es",
    sourceLoading: "Cargando",
    sourceFifa: "FIFA API",
    sourceCache: "Cache local",
    sourceSnapshot: "Snapshot offline",
    title: "Fixtu26",
    tagline: "Fixture, grupos y detalle en vivo del Mundial 26",
    brandKicker: "Companion no oficial",
    refresh: "Actualizar",
    install: "Instalar",
    installPwa: "Instalar PWA",
    notifications: {
      enable: "Alertas",
      enabled: "Alertas activas",
      blocked: "Bloqueadas",
      unsupported: "Sin alertas",
      title: "Alertas de partidos en vivo",
      permissionDenied: "Las notificaciones estan bloqueadas en este navegador."
    },
    fixture: "Fixture",
    groups: "Grupos",
    bracket: {
      title: "Llaves",
      subtitle: "Eliminación directa",
      emptyTitle: "Las llaves todavía no fueron publicadas",
      emptyBody: "Cuando FIFA publique los cruces eliminatorios, aparecerán acá.",
      matches: "partidos",
      winner: "Ganador",
      penalties: "Penales",
      rounds: {
        round32: "Dieciseisavos",
        round16: "Octavos",
        quarterfinals: "Cuartos",
        semifinals: "Semifinales",
        thirdPlace: "Tercer puesto",
        final: "Final"
      }
    },
    mainViews: "Vistas principales",
    matches: "partidos",
    played: "jugados",
    live: "en vivo",
    lastLoad: "ultima carga",
    status: {
      played: "Jugado",
      live: "En vivo",
      upcoming: "Próximo",
      scheduled: "Programado"
    },
    statusFilters: {
      all: "Todos",
      live: "En vivo",
      played: "Jugados",
      upcoming: "Próximos"
    },
    filters: {
      status: "Estado",
      stage: "Fase",
      allStages: "Todas",
      group: "Grupo",
      allGroups: "Todos",
      search: "Buscar"
    },
    noMatchesTitle: "No hay partidos para esos filtros",
    noMatchesBody: "Probá cambiar fase, grupo o búsqueda.",
    noGroupsTitle: "No hay grupos publicados",
    noGroupsBody: "Cuando FIFA publique la fase de grupos, aparecerán acá.",
    teams: "Equipos",
    standings: "Tabla de posiciones",
    pointsTable: "Tabla de posiciones",
    table: {
      team: "Equipo",
      played: "PJ",
      won: "G",
      drawn: "E",
      lost: "P",
      goalsFor: "GF",
      goalsAgainst: "GC",
      goalDiff: "DG",
      points: "Pts"
    },
    spotlightLive: "Partido en vivo",
    spotlightNext: "Próximo partido",
    venueTbd: "Sede por definir",
    liveMatches: "Partidos en vivo",
    previousLive: "Partido en vivo anterior",
    nextLive: "Siguiente partido en vivo",
    stageTbd: "Fase por definir",
    match: "Partido",
    matchNumber: "Partido",
    detail: {
      facts: "Datos",
      stats: "Estadísticas",
      lineup: "Formación",
      timeline: "Cronología",
      loading: "Cargando datos del partido...",
      matchDetail: "Detalle del partido"
    },
    facts: {
      date: "Fecha",
      stadium: "Estadio",
      stage: "Fase",
      status: "Estado",
      referee: "Árbitro",
      attendance: "Asistencia"
    },
    stadiumTbd: "Estadio por definir",
    cityTbd: "Ciudad por definir",
    tbd: "TBC",
    notPublished: "No publicado",
    noAttendance: "No publicada",
    noReferee: "No publicado",
    final: "Finalizado",
    scheduled: "Programado",
    fifaData: "Dato FIFA",
    stats: {
      score: "Marcador",
      minutePeriod: "Minuto / periodo",
      period: "Periodo",
      possession: "Posesión",
      available: "Disponible",
      unavailable: "--",
      published: "Publicada por FIFA",
      notPublished: "No publicada para este partido",
      statistic: "Estadística",
      goalsDetected: "Goles detectados",
      cards: "Tarjetas",
      fouls: "Faltas registradas",
      substitutions: "Cambios",
      fifaEvents: "Eventos FIFA"
    },
    positions: {
      goalkeeper: "Arquero",
      defender: "Defensa",
      midfielder: "Medio",
      forward: "Delantero",
      squad: "Plantel"
    },
    formation: {
      empty: "FIFA todavía no publicó la formación inicial de este equipo.",
      bench: "Suplentes",
      aria: "Formación de"
    },
    timeline: {
      empty: "La cronología aparece cuando FIFA publica eventos del partido.",
      error: "No se pudo cargar la cronología.",
      event: "Evento"
    },
    selectMatch: "Seleccioná un partido",
    knockout: "Eliminatoria",
    goal: "Gol",
    apiErrors: {
      refresh: "No se pudo refrescar FIFA API; se usa cache local.",
      fixture: "No se pudo cargar el fixture.",
      detail: "No se pudo cargar el detalle en vivo."
    },
    refereeNeedles: ["árbitro", "referee"],
    eventNeedles: {
      goal: ["gol", "goal"],
      card: ["tarjeta", "card"],
      foul: ["falta", "foul"],
      substitution: ["sustit", "cambio", "substitution", "substitute"]
    }
  }
};

const LanguageContext = React.createContext({ language: "en", i18n: I18N.en });

function useLanguage() {
  return React.useContext(LanguageContext);
}

function resolveLanguage(value) {
  return String(value || "").toLowerCase().startsWith("es") ? "es" : "en";
}

function detectUserLanguage() {
  const params = new URLSearchParams(window.location.search);
  const urlLanguage = params.get("lang");
  if (urlLanguage) return resolveLanguage(urlLanguage);
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return resolveLanguage(browserLanguages.find(Boolean));
}

function languageConfig(language) {
  return I18N[language] || I18N.en;
}

function fifaUrl(path, language) {
  const { fifaLanguage } = languageConfig(language);
  return `${FIFA_API_BASE}/${path}?language=${fifaLanguage}&count=500&idSeason=${FIFA_SEASON_ID}`;
}

function timelineUrl(matchId, language) {
  const { fifaLanguage } = languageConfig(language);
  return `${FIFA_TIMELINE_URL}/${matchId}?language=${fifaLanguage}`;
}

function matchCentreBase(language) {
  const { fifaPath } = languageConfig(language);
  return `${FIFA_MATCH_CENTRE_BASE}/${fifaPath}/match-centre/match`;
}

function freshUrl(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

async function fetchFifaJson(url) {
  const response = await fetch(freshUrl(url), {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`FIFA API ${response.status}`);
  return response.json();
}

function documentIsVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function localized(value, language = "en") {
  if (!Array.isArray(value)) return "";
  const { locale, code } = languageConfig(language);
  return (
    value.find((entry) => entry.Locale === locale)?.Description ??
    value.find((entry) => String(entry.Locale || "").toLowerCase().startsWith(code))?.Description ??
    value[0]?.Description ??
    ""
  );
}

function teamName(team, placeholder, language = "en") {
  return localized(team?.TeamName, language) || team?.Abbreviation || placeholder || languageConfig(language).tbd;
}

function teamCode(team, placeholder) {
  return team?.Abbreviation || placeholder || "TBD";
}

function personName(value, language = "en") {
  return localized(value?.Name, language) || localized(value?.NameShort, language) || localized(value?.PlayerName, language) || "";
}

function playerName(player, language = "en") {
  return localized(player?.PlayerName, language) || localized(player?.ShortName, language) || languageConfig(language).positions.squad;
}

function scoreValue(teamScore, fallback) {
  return teamScore ?? fallback ?? null;
}

function statusLabel(status, language = "en") {
  const { status: labels } = languageConfig(language);
  if (status === 0) return labels.played;
  if (LIVE_MATCH_STATUSES.has(status)) return labels.live;
  if (status === 1) return labels.upcoming;
  return labels.scheduled;
}

function statusTone(status) {
  if (status === 0) return "played";
  if (LIVE_MATCH_STATUSES.has(status)) return "live";
  if (status === 1) return "upcoming";
  return "scheduled";
}

function toMatch(raw, language = "en") {
  const homeScore = scoreValue(raw.Home?.Score, raw.HomeTeamScore);
  const awayScore = scoreValue(raw.Away?.Score, raw.AwayTeamScore);
  const status = raw.MatchStatus;
  const stage = localized(raw.StageName, language);
  const group = localized(raw.GroupName, language);
  const stadium = localized(raw.Stadium?.Name, language);
  const city = localized(raw.Stadium?.CityName, language);

  return {
    id: raw.IdMatch,
    competitionId: raw.IdCompetition,
    seasonId: raw.IdSeason,
    stageId: raw.IdStage,
    groupId: raw.IdGroup,
    matchNumber: raw.MatchNumber,
    date: raw.Date,
    localDate: raw.LocalDate,
    timeDefined: raw.TimeDefined,
    status,
    statusLabel: statusLabel(status, language),
    statusTone: statusTone(status),
    stage,
    group,
    stadium,
    city,
    country: raw.Stadium?.IdCountry || "",
    homeName: teamName(raw.Home, raw.PlaceHolderA, language),
    awayName: teamName(raw.Away, raw.PlaceHolderB, language),
    homeCode: teamCode(raw.Home, raw.PlaceHolderA),
    awayCode: teamCode(raw.Away, raw.PlaceHolderB),
    homeFlag: raw.Home?.PictureUrl,
    awayFlag: raw.Away?.PictureUrl,
    homeScore,
    awayScore,
    homePenaltyScore: raw.HomeTeamPenaltyScore,
    awayPenaltyScore: raw.AwayTeamPenaltyScore,
    placeholderA: raw.PlaceHolderA,
    placeholderB: raw.PlaceHolderB,
    officials: raw.Officials || [],
    weather: raw.Weather || {},
    attendance: raw.Attendance,
    raw
  };
}

function flagUrl(template) {
  return template?.replace("{format}", "sq").replace("{size}", "4");
}

function formatDate(iso, options = {}, language = "en") {
  if (!iso) return "";
  return new Intl.DateTimeFormat(languageConfig(language).locale, {
    timeZone: TIME_ZONE,
    ...options
  }).format(new Date(iso));
}

function dateKey(iso, language = "en") {
  return formatDate(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }, language);
}

function timeLabel(match, language = "en") {
  if (!match.timeDefined) return languageConfig(language).tbd;
  return formatDate(match.date, {
    hour12: false,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  }, language);
}

function kickoffTime(match) {
  const timestamp = new Date(match.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function compareMatchesByKickoff(a, b) {
  return kickoffTime(a) - kickoffTime(b) || a.matchNumber - b.matchNumber;
}

function liveClockFromRaw(raw, language = "en") {
  return raw?.MatchTime || raw?.MatchMinute || raw?.MatchClock || languageConfig(language).status.live;
}

function liveClockLabel(match, language = "en") {
  return liveClockFromRaw(match.raw, language);
}

function scoreFromRaw(match, raw, side) {
  const team = side === "home" ? raw?.HomeTeam || raw?.Home : raw?.AwayTeam || raw?.Away;
  const topLevelScore = side === "home" ? raw?.HomeTeamScore : raw?.AwayTeamScore;
  const fallback = side === "home" ? match.homeScore : match.awayScore;
  return scoreValue(team?.Score, scoreValue(topLevelScore, fallback));
}

function findLiveFeedMatch(data, matchId) {
  return (data?.Results || []).find((entry) => String(entry.IdMatch) === String(matchId)) || null;
}

function mergeLiveFeedMatch(match, liveEntry) {
  if (!liveEntry) return match.raw;

  const homeScore = scoreValue(liveEntry.HomeTeam?.Score, scoreValue(liveEntry.HomeTeamScore, match.raw.HomeTeamScore));
  const awayScore = scoreValue(liveEntry.AwayTeam?.Score, scoreValue(liveEntry.AwayTeamScore, match.raw.AwayTeamScore));

  return {
    ...match.raw,
    ...liveEntry,
    Home: liveEntry.HomeTeam || liveEntry.Home || match.raw.Home,
    Away: liveEntry.AwayTeam || liveEntry.Away || match.raw.Away,
    HomeTeam: liveEntry.HomeTeam || match.raw.Home,
    AwayTeam: liveEntry.AwayTeam || match.raw.Away,
    MatchStatus: liveEntry.MatchStatus ?? match.raw.MatchStatus,
    MatchTime: liveEntry.MatchTime || match.raw.MatchTime,
    MatchMinute: liveEntry.MatchMinute || match.raw.MatchMinute,
    MatchClock: liveEntry.MatchClock || match.raw.MatchClock,
    HomeTeamScore: homeScore,
    AwayTeamScore: awayScore
  };
}

function liveMatchStatus(match, raw) {
  return raw?.MatchStatus ?? match.status;
}

function liveMatchTone(match, raw) {
  return statusTone(liveMatchStatus(match, raw));
}

function liveMatchLabel(match, raw, language = "en") {
  return statusLabel(liveMatchStatus(match, raw), language);
}

function detailClockLabel(match, raw, language = "en") {
  const tone = liveMatchTone(match, raw);
  const i18n = languageConfig(language);
  if (tone === "live") return liveClockFromRaw(raw, language);
  if (tone === "played") return i18n.final;
  return i18n.scheduled;
}

function normalizedScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function useScorePulse(matchKey, homeScore, awayScore) {
  const previousRef = useRef({ matchKey, homeScore, awayScore });
  const [goalSide, setGoalSide] = useState(null);

  useEffect(() => {
    const previous = previousRef.current;
    const previousHome = normalizedScore(previous.homeScore);
    const previousAway = normalizedScore(previous.awayScore);
    const nextHome = normalizedScore(homeScore);
    const nextAway = normalizedScore(awayScore);

    previousRef.current = { matchKey, homeScore, awayScore };

    if (previous.matchKey !== matchKey) {
      setGoalSide(null);
      return undefined;
    }

    const homeGoal = previousHome !== null && nextHome !== null && nextHome > previousHome;
    const awayGoal = previousAway !== null && nextAway !== null && nextAway > previousAway;
    const nextSide = homeGoal ? "home" : awayGoal ? "away" : null;

    if (!nextSide) return undefined;

    setGoalSide(nextSide);
    const timeout = window.setTimeout(() => setGoalSide(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [matchKey, homeScore, awayScore]);

  return goalSide;
}

function AnimatedScore({ homeScore, awayScore, goalSide, separator = ":", compact = false }) {
  const { i18n } = useLanguage();
  const hasScore = homeScore !== null || awayScore !== null;

  if (!hasScore) {
    return <strong className="animated-score score-vs">vs</strong>;
  }

  return (
    <strong
      className={`animated-score ${compact ? "compact" : ""} ${goalSide ? `goal-${goalSide}` : ""}`}
      aria-live="polite"
    >
      <span className={`score-number home ${goalSide === "home" ? "score-goal" : ""}`}>
        {homeScore ?? "-"}
      </span>
      <span className="score-separator">{separator}</span>
      <span className={`score-number away ${goalSide === "away" ? "score-goal" : ""}`}>
        {awayScore ?? "-"}
      </span>
      {goalSide && <span className="goal-flash">{i18n.goal}</span>}
    </strong>
  );
}

function useFixture(language) {
  const i18n = languageConfig(language);
  const [matches, setMatches] = useState([]);
  const [source, setSource] = useState(i18n.sourceLoading);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const cacheKey = `fixture-cache-${language}`;

  const loadFixture = useCallback(async (preferNetwork = true, options = {}) => {
    const silent = options.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      if (preferNetwork && navigator.onLine) {
        const data = await fetchFifaJson(fifaUrl("calendar/matches", language));
        const normalized = data.Results.map((raw) => toMatch(raw, language)).sort(compareMatchesByKickoff);
        setMatches(normalized);
        setUpdatedAt(new Date());
        localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
        setSource(i18n.sourceFifa);
      } else {
        throw new Error("offline");
      }
    } catch (networkError) {
      if (silent) return;
      try {
        const cached = localStorage.getItem(cacheKey);
        const data = cached
          ? JSON.parse(cached).data
          : await fetch("/fixture-seed.json").then((response) => response.json());
        setMatches(data.Results.map((raw) => toMatch(raw, language)).sort(compareMatchesByKickoff));
        setSource(cached ? i18n.sourceCache : i18n.sourceSnapshot);
        setUpdatedAt(cached ? new Date(JSON.parse(cached).savedAt) : null);
        if (preferNetwork) setError(i18n.apiErrors.refresh);
      } catch (fallbackError) {
        setError(i18n.apiErrors.fixture);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cacheKey, i18n, language]);

  useEffect(() => {
    loadFixture();
  }, [loadFixture]);

  const hasLiveMatch = matches.some((match) => match.statusTone === "live");

  useEffect(() => {
    const refreshInterval = hasLiveMatch ? LIVE_FIXTURE_REFRESH_MS : IDLE_FIXTURE_REFRESH_MS;
    const refreshSilently = () => {
      if (navigator.onLine && documentIsVisible()) {
        loadFixture(true, { silent: true });
      }
    };
    const intervalId = window.setInterval(refreshSilently, refreshInterval);
    const handleVisibilityChange = () => {
      if (documentIsVisible()) refreshSilently();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasLiveMatch, loadFixture]);

  return { matches, source, loading, error, updatedAt, refresh: () => loadFixture(true) };
}

function useMatchFeed(match) {
  const { language, i18n } = useLanguage();
  const [liveMatch, setLiveMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadMatchFeed = useCallback(async (options = {}) => {
    if (!match?.id) return;
    const silent = options.silent === true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [liveResult, timelineResult] = await Promise.allSettled([
        fetchFifaJson(fifaUrl("live/football", language)),
        fetchFifaJson(timelineUrl(match.id, language))
      ]);
      if (requestIdRef.current !== requestId) return;

      const liveEntry =
        liveResult.status === "fulfilled" ? findLiveFeedMatch(liveResult.value, match.id) : null;
      setLiveMatch(mergeLiveFeedMatch(match, liveEntry));
      setEvents(timelineResult.status === "fulfilled" ? timelineResult.value.Event || [] : []);

      if (liveResult.status === "rejected" && timelineResult.status === "rejected" && !silent) {
        setError(i18n.apiErrors.detail);
      }
    } catch {
      if (requestIdRef.current !== requestId) return;
      if (!silent) {
        setLiveMatch(match.raw);
        setEvents([]);
        setError(i18n.apiErrors.detail);
      }
    } finally {
      if (requestIdRef.current === requestId && !silent) setLoading(false);
    }
  }, [i18n, language, match]);

  useEffect(() => {
    setLiveMatch(match?.raw || null);
    loadMatchFeed();
  }, [loadMatchFeed, match?.raw]);

  useEffect(() => {
    if (!match?.id) return undefined;
    const detailInterval = match.statusTone === "live" ? LIVE_DETAIL_REFRESH_MS : IDLE_DETAIL_REFRESH_MS;
    const refreshSilently = () => {
      if (navigator.onLine && documentIsVisible()) {
        loadMatchFeed({ silent: true });
      }
    };
    const intervalId = window.setInterval(refreshSilently, detailInterval);
    const handleVisibilityChange = () => {
      if (documentIsVisible()) refreshSilently();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadMatchFeed, match?.id, match?.statusTone]);

  return {
    liveMatch: liveMatch || match?.raw || null,
    events,
    loading,
    error,
    refresh: () => loadMatchFeed()
  };
}

function useTimeline(match) {
  const { language } = useLanguage();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!match?.id) return;
      setLoading(true);
      setStatus("idle");
      try {
        const data = await fetchFifaJson(timelineUrl(match.id, language));
        if (!active) return;
        setEvents((data.Event || []).slice().reverse().slice(0, 8));
        setStatus("ok");
      } catch {
        if (!active) return;
        setEvents([]);
        setStatus("error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [language, match?.id]);

  return { events, loading, status };
}

function groupByDate(matches, language = "en") {
  return matches.reduce((groups, match) => {
    const key = dateKey(match.date, language);
    if (!groups[key]) groups[key] = [];
    groups[key].push(match);
    return groups;
  }, {});
}

function teamRecord(match, side) {
  const prefix = side === "home" ? "home" : "away";
  return {
    id: side === "home" ? match.raw.Home?.IdTeam : match.raw.Away?.IdTeam,
    code: match[`${prefix}Code`],
    name: match[`${prefix}Name`],
    flag: match[`${prefix}Flag`]
  };
}

function addTeam(table, team) {
  const key = team.id || team.code || team.name;
  if (!key || key === "TBD") return null;
  if (!table.has(key)) {
    table.set(key, {
      ...team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    });
  }
  return table.get(key);
}

function applyResult(team, goalsFor, goalsAgainst) {
  team.played += 1;
  team.goalsFor += goalsFor;
  team.goalsAgainst += goalsAgainst;
  team.goalDiff = team.goalsFor - team.goalsAgainst;
  if (goalsFor > goalsAgainst) {
    team.won += 1;
    team.points += 3;
  } else if (goalsFor === goalsAgainst) {
    team.drawn += 1;
    team.points += 1;
  } else {
    team.lost += 1;
  }
}

function compareStandings(a, b, language = "en") {
  const { locale } = languageConfig(language);
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name, locale)
  );
}

function buildGroups(matches, language = "en") {
  const { locale } = languageConfig(language);
  const groupMap = new Map();
  for (const match of matches) {
    if (!match.group) continue;
    const key = match.groupId || match.group;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        id: key,
        name: match.group,
        stage: match.stage,
        order: match.groupId || 999,
        teams: new Map(),
        matches: []
      });
    }

    const group = groupMap.get(key);
    const home = addTeam(group.teams, teamRecord(match, "home"));
    const away = addTeam(group.teams, teamRecord(match, "away"));
    group.matches.push(match);

    const scoreReady =
      (match.statusTone === "played" || match.statusTone === "live") &&
      Number.isFinite(match.homeScore) &&
      Number.isFinite(match.awayScore);

    if (scoreReady && home && away) {
      applyResult(home, match.homeScore, match.awayScore);
      applyResult(away, match.awayScore, match.homeScore);
    }
  }

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      teams: Array.from(group.teams.values()).sort((a, b) => a.name.localeCompare(b.name, locale)),
      standings: Array.from(group.teams.values()).sort((a, b) => compareStandings(a, b, language)),
      matches: group.matches.slice().sort(compareMatchesByKickoff)
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale));
}

function initialView() {
  const viewParam = new URLSearchParams(window.location.search).get("view");
  return ["fixture", "groups", "bracket"].includes(viewParam) ? viewParam : "fixture";
}

function initialStatus() {
  const statusParam = new URLSearchParams(window.location.search).get("status");
  return ["all", "live", "played", "upcoming"].includes(statusParam) ? statusParam : "all";
}

function initialDetailMatchId() {
  return new URLSearchParams(window.location.search).get("match");
}

function storedNotificationsEnabled() {
  try {
    return localStorage.getItem(NOTIFICATION_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredNotificationsEnabled(enabled) {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Preference persistence is best-effort; notification permission remains the source of truth.
  }
}

async function showPwaNotification(payload) {
  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    data: { url: payload.url }
  };

  if (navigator.serviceWorker?.ready) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(payload.title, options);
    return;
  }

  new Notification(payload.title, options);
}

function useLiveNotifications(liveMatches, language) {
  const [support, setSupport] = useState(() => getNotificationSupport(window));
  const [enabled, setEnabled] = useState(() => storedNotificationsEnabled());
  const notifiedRef = useRef(createNotificationState());

  useEffect(() => {
    setSupport(getNotificationSupport(window));
  }, []);

  const toggle = useCallback(async () => {
    if (!support.supported) return;
    if (enabled) {
      setEnabled(false);
      setStoredNotificationsEnabled(false);
      return;
    }

    let permission = support.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    const nextSupport = getNotificationSupport(window);
    setSupport(nextSupport);

    const allowed = permission === "granted";
    setEnabled(allowed);
    setStoredNotificationsEnabled(allowed);
  }, [enabled, support.permission, support.supported]);

  useEffect(() => {
    if (!enabled || support.permission !== "granted") return;
    for (const match of liveMatches) {
      for (const event of getLiveNotificationEvents(match, notifiedRef.current)) {
        showPwaNotification(createLiveNotification(match, event, language)).catch(() => {});
      }
    }
  }, [enabled, language, liveMatches, support.permission]);

  const status =
    !support.supported ? "unsupported" : support.permission === "denied" ? "blocked" : enabled ? "enabled" : "idle";

  return { ...support, enabled, status, toggle };
}

function App() {
  const [language] = useState(detectUserLanguage);
  const i18n = languageConfig(language);
  const languageContext = useMemo(() => ({ language, i18n }), [i18n, language]);
  const { matches, source, loading, error, updatedAt, refresh } = useFixture(language);
  const [view, setView] = useState(initialView);
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [detailMatchId, setDetailMatchId] = useState(initialDetailMatchId);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const phases = useMemo(
    () => Array.from(new Set(matches.map((match) => match.stage).filter(Boolean))),
    [matches]
  );
  const groups = useMemo(
    () => Array.from(new Set(matches.map((match) => match.group).filter(Boolean))),
    [matches]
  );
  const groupData = useMemo(() => buildGroups(matches, language), [language, matches]);
  const bracketData = useMemo(() => buildBracket(matches), [matches]);

  const filteredMatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return matches.filter((match) => {
      const statusOk =
        status === "all" ||
        (status === "live" && match.statusTone === "live") ||
        (status === "played" && match.statusTone === "played") ||
        (status === "upcoming" && match.statusTone !== "played" && match.statusTone !== "live");
      const phaseOk = phase === "all" || match.stage === phase;
      const groupOk = group === "all" || match.group === group;
      const queryOk =
        !normalizedQuery ||
        [match.homeName, match.awayName, match.homeCode, match.awayCode, match.stadium, match.city]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return statusOk && phaseOk && groupOk && queryOk;
    });
  }, [matches, status, phase, group, query]);

  const detailMatch = matches.find((match) => match.id === detailMatchId);

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return (
      matches.find((match) => new Date(match.date).getTime() >= now && match.statusTone !== "played") ||
      matches.find((match) => match.statusTone !== "played") ||
      matches[0]
    );
  }, [matches]);
  const liveMatches = useMemo(
    () => matches.filter((match) => match.statusTone === "live").sort(compareMatchesByKickoff),
    [matches]
  );
  const notifications = useLiveNotifications(liveMatches, language);

  const grouped = groupByDate(filteredMatches, language);
  const playedCount = matches.filter((match) => match.statusTone === "played").length;
  const liveCount = liveMatches.length;

  useEffect(() => {
    document.documentElement.lang = i18n.htmlLang;
  }, [i18n.htmlLang]);

  useEffect(() => {
    if (!loading && matches.length > 0 && status === "live" && liveCount === 0) {
      setStatus("all");
    }
  }, [liveCount, loading, matches.length, status]);

  useEffect(() => {
    if (!groupData.length) return;
    if (!groupData.some((groupItem) => String(groupItem.id) === String(activeGroupId))) {
      setActiveGroupId(String(groupData[0].id));
    }
  }, [activeGroupId, groupData]);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  if (detailMatch) {
    return (
      <LanguageContext.Provider value={languageContext}>
        <MatchScreen
          match={detailMatch}
          onBack={() => setDetailMatchId(null)}
          source={source}
          refresh={refresh}
          loading={loading}
        />
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={languageContext}>
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/icons/icon-96.png" alt="" aria-hidden="true" />
          <div className="brand-copy">
            <span className="brand-kicker">{i18n.brandKicker}</span>
            <h1>{i18n.title}</h1>
            <p>{i18n.tagline}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`connection ${navigator.onLine ? "online" : "offline"}`}>
            {navigator.onLine ? <Wifi size={15} /> : <WifiOff size={15} />}
            {source}
          </span>
          <button className="icon-button" onClick={refresh} disabled={loading} title={i18n.refresh}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            <span>{i18n.refresh}</span>
          </button>
          <button
            className={`icon-button notification-button ${notifications.status === "enabled" ? "active" : ""}`}
            onClick={notifications.toggle}
            disabled={notifications.status === "unsupported" || notifications.status === "blocked"}
            title={
              notifications.status === "blocked"
                ? i18n.notifications.permissionDenied
                : i18n.notifications.title
            }
          >
            {notifications.status === "enabled" ? <BellRing size={18} /> : <Bell size={18} />}
            <span>{i18n.notifications[notifications.status] || i18n.notifications.enable}</span>
          </button>
          <button
            className="icon-button secondary"
            onClick={installApp}
            disabled={!installPrompt}
            title={i18n.installPwa}
          >
            <Download size={18} />
            <span>{i18n.install}</span>
          </button>
        </div>
      </header>

      <PrimaryNav activeView={view} setView={setView} />

      {error && <div className="notice">{error}</div>}

      <section className="score-strip">
        <MatchSpotlight
          liveMatches={liveMatches}
          nextMatch={nextMatch}
          onOpen={(match) => match && setDetailMatchId(match.id)}
        />
        <div className="metric">
          <strong>{matches.length}</strong>
          <span>{i18n.matches}</span>
        </div>
        <div className="metric">
          <strong>{playedCount}</strong>
          <span>{i18n.played}</span>
        </div>
        <div className="metric">
          <strong>{liveCount}</strong>
          <span>{i18n.live}</span>
        </div>
        <div className="metric timestamp">
          <strong>
            {updatedAt
              ? formatDate(updatedAt.toISOString(), {
                  hour12: false,
                  hourCycle: "h23",
                  hour: "2-digit",
                  minute: "2-digit"
                }, language)
              : "--"}
          </strong>
          <span>{i18n.lastLoad}</span>
        </div>
      </section>

      {view === "fixture" ? (
        <section className="workspace clean">
          <div className="fixture-pane">
            <Filters
              status={status}
              setStatus={setStatus}
              phase={phase}
              setPhase={setPhase}
              group={group}
              setGroup={setGroup}
              query={query}
              setQuery={setQuery}
              phases={phases}
              groups={groups}
              showLiveFilter={liveCount > 0}
            />
            <div className="match-list" aria-live="polite">
              {loading && !matches.length ? (
                <SkeletonList />
              ) : filteredMatches.length ? (
                Object.entries(grouped).map(([day, dayMatches]) => (
                  <section className="day-group" key={day}>
                    <div className="day-heading">
                      <CalendarDays size={16} />
                      <h2>{day}</h2>
                      <span>{dayMatches.length}</span>
                    </div>
                    {dayMatches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        selected={false}
                        onSelect={() => setDetailMatchId(match.id)}
                      />
                    ))}
                  </section>
                ))
              ) : (
                <div className="empty-state">
                  <Filter size={30} />
                  <strong>{i18n.noMatchesTitle}</strong>
                  <span>{i18n.noMatchesBody}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : view === "groups" ? (
        <GroupsScreen
          groups={groupData}
          activeGroupId={activeGroupId}
          setActiveGroupId={setActiveGroupId}
          loading={loading && !matches.length}
          onOpenMatch={(match) => setDetailMatchId(match.id)}
        />
      ) : (
        <BracketScreen
          bracket={bracketData}
          loading={loading && !matches.length}
          onOpenMatch={(match) => setDetailMatchId(match.id)}
        />
      )}
    </main>
    </LanguageContext.Provider>
  );
}

function PrimaryNav({ activeView, setView }) {
  const { i18n } = useLanguage();
  const items = [
    ["fixture", i18n.fixture, CalendarDays],
    ["groups", i18n.groups, Table2],
    ["bracket", i18n.bracket.title, GitBranch]
  ];

  return (
    <nav className="primary-nav" aria-label={i18n.mainViews}>
      {items.map(([value, label, Icon]) => (
        <button
          key={value}
          className={activeView === value ? "active" : ""}
          onClick={() => setView(value)}
        >
          <Icon size={17} />
          {label}
        </button>
      ))}
    </nav>
  );
}

function BracketScreen({ bracket, loading, onOpenMatch }) {
  const { i18n } = useLanguage();

  if (loading) {
    return (
      <section className="bracket-screen">
        <SkeletonList />
      </section>
    );
  }

  if (!bracket.totalMatches) {
    return (
      <section className="bracket-screen">
        <div className="empty-state">
          <GitBranch size={30} />
          <strong>{i18n.bracket.emptyTitle}</strong>
          <span>{i18n.bracket.emptyBody}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="bracket-screen">
      <div className="bracket-hero">
        <div>
          <span>{i18n.bracket.subtitle}</span>
          <h2>{i18n.bracket.title}</h2>
        </div>
        <strong>{bracket.totalMatches} {i18n.bracket.matches}</strong>
      </div>

      <div className="bracket-scroll" aria-label={i18n.bracket.title}>
        <div className="bracket-board">
          {bracket.rounds.map((round) => (
            <section className={`bracket-round ${round.key}`} key={round.key}>
              <div className="bracket-round-head">
                <h3>{i18n.bracket.rounds[round.key] || round.key}</h3>
                <span>{round.matches.length}</span>
              </div>
              <div className="bracket-match-stack">
                {round.matches.map((match) => (
                  <BracketMatchCard key={match.id} match={match} onOpen={() => onOpenMatch(match)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function BracketMatchCard({ match, onOpen }) {
  const { language, i18n } = useLanguage();
  const goalSide = useScorePulse(match.id, match.homeScore, match.awayScore);
  const isLive = match.statusTone === "live";
  const hasPenalties =
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined &&
    Number.isFinite(Number(match.homePenaltyScore)) &&
    Number.isFinite(Number(match.awayPenaltyScore));
  return (
    <button
      className={`bracket-match ${isLive ? "live" : ""} ${goalSide ? `goal-${goalSide}` : ""}`}
      onClick={onOpen}
    >
      <div className="bracket-match-meta">
        <span>{i18n.matchNumber} {match.matchNumber}</span>
        <strong>{timeLabel(match, language)}</strong>
      </div>

      <BracketTeamRow
        code={match.homeCode}
        name={match.homeName}
        flag={match.homeFlag}
        score={match.homeScore}
        penaltyScore={match.homePenaltyScore}
        winner={match.winner?.side === "home"}
        highlight={goalSide === "home"}
        hasPenalties={hasPenalties}
      />
      <BracketTeamRow
        code={match.awayCode}
        name={match.awayName}
        flag={match.awayFlag}
        score={match.awayScore}
        penaltyScore={match.awayPenaltyScore}
        winner={match.winner?.side === "away"}
        highlight={goalSide === "away"}
        hasPenalties={hasPenalties}
      />

      <div className="bracket-match-footer">
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
        {hasPenalties && <small>{i18n.bracket.penalties}</small>}
        {match.winner && <small>{i18n.bracket.winner}: {match.winner.code}</small>}
      </div>
    </button>
  );
}

function BracketTeamRow({ code, name, flag, score, penaltyScore, winner, highlight, hasPenalties }) {
  return (
    <div className={`bracket-team ${winner ? "winner" : ""} ${highlight ? "goal-side" : ""}`}>
      {flag ? <img src={flagUrl(flag)} alt="" /> : <span className="flag-placeholder">{code?.[0] || "?"}</span>}
      <div>
        <strong>{code}</strong>
        <small>{name}</small>
      </div>
      <span className="bracket-score">{score ?? "-"}</span>
      {hasPenalties && <span className="bracket-penalty">{penaltyScore ?? "-"}</span>}
    </div>
  );
}

function GroupsScreen({ groups, activeGroupId, setActiveGroupId, loading, onOpenMatch }) {
  const { i18n } = useLanguage();
  const activeGroup = groups.find((group) => String(group.id) === String(activeGroupId)) || groups[0];

  if (loading) {
    return (
      <section className="groups-screen">
        <SkeletonList />
      </section>
    );
  }

  if (!activeGroup) {
    return (
      <section className="groups-screen">
        <div className="empty-state">
          <UsersRound size={30} />
          <strong>{i18n.noGroupsTitle}</strong>
          <span>{i18n.noGroupsBody}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="groups-screen">
      <div className="group-picker" aria-label={i18n.groups}>
        {groups.map((group) => (
          <button
            key={group.id}
            className={String(group.id) === String(activeGroup.id) ? "active" : ""}
            onClick={() => setActiveGroupId(String(group.id))}
          >
            <span>{group.name}</span>
            <small>{group.teams.length} {i18n.teams.toLowerCase()}</small>
          </button>
        ))}
      </div>

      <div className="groups-layout">
        <section className="group-card standings-card">
          <div className="group-card-head">
            <div>
              <span>{activeGroup.stage}</span>
              <h2>{activeGroup.name}</h2>
            </div>
            <strong>{i18n.standings}</strong>
          </div>
          <StandingsTable standings={activeGroup.standings} />
        </section>

        <aside className="group-side">
          <section className="group-card">
            <div className="group-panel-title">
              <UsersRound size={17} />
              <h3>{i18n.teams}</h3>
            </div>
            <div className="group-team-grid">
              {activeGroup.teams.map((team) => (
                <div className="group-team-card" key={team.id || team.code}>
                  {team.flag ? <img src={flagUrl(team.flag)} alt="" /> : <span>{team.code[0]}</span>}
                  <div>
                    <strong>{team.code}</strong>
                    <small>{team.name}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="group-card">
            <div className="group-panel-title">
              <CalendarDays size={17} />
              <h3>{i18n.matches}</h3>
            </div>
            <div className="group-match-list">
              {activeGroup.matches.map((match) => (
                <GroupMatchItem key={match.id} match={match} onOpen={() => onOpenMatch(match)} />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function StandingsTable({ standings }) {
  const { i18n } = useLanguage();
  return (
    <div className="standings-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{i18n.table.team}</th>
            <th>{i18n.table.played}</th>
            <th>{i18n.table.won}</th>
            <th>{i18n.table.drawn}</th>
            <th>{i18n.table.lost}</th>
            <th>{i18n.table.goalsFor}</th>
            <th>{i18n.table.goalsAgainst}</th>
            <th>{i18n.table.goalDiff}</th>
            <th>{i18n.table.points}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, index) => (
            <tr key={team.id || team.code} className={index < 2 ? "qualify" : ""}>
              <td>{index + 1}</td>
              <td>
                <div className="standing-team">
                  {team.flag ? <img src={flagUrl(team.flag)} alt="" /> : <span>{team.code[0]}</span>}
                  <div>
                    <strong>{team.code}</strong>
                    <small>{team.name}</small>
                  </div>
                </div>
              </td>
              <td>{team.played}</td>
              <td>{team.won}</td>
              <td>{team.drawn}</td>
              <td>{team.lost}</td>
              <td>{team.goalsFor}</td>
              <td>{team.goalsAgainst}</td>
              <td>{team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}</td>
              <td>
                <strong>{team.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupMatchItem({ match, onOpen }) {
  const { language } = useLanguage();
  const goalSide = useScorePulse(match.id, match.homeScore, match.awayScore);
  const isLive = match.statusTone === "live";
  return (
    <button
      className={`group-match-item ${isLive ? "live" : ""} ${goalSide ? `goal-${goalSide}` : ""}`}
      onClick={onOpen}
    >
      <div className="group-match-time">
        <strong>{timeLabel(match, language)}</strong>
        <span>#{match.matchNumber}</span>
      </div>
      <div className="group-match-teams">
        <span>{match.homeCode}</span>
        <AnimatedScore homeScore={match.homeScore} awayScore={match.awayScore} goalSide={goalSide} separator="-" compact />
        <span>{match.awayCode}</span>
      </div>
      <div className="group-match-meta">
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
        <small>{match.city || match.stadium}</small>
      </div>
    </button>
  );
}

function SpotlightCard({ match, hasLive, title, onOpen }) {
  const { language, i18n } = useLanguage();
  const goalSide = useScorePulse(match?.id, match?.homeScore, match?.awayScore);

  const meta = hasLive
    ? [liveClockLabel(match, language), match.stage, match.group].filter(Boolean).join(" · ")
    : `${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" }, language)} · ${timeLabel(match, language)}`;

  function openActiveMatch() {
    onOpen(match);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openActiveMatch();
    }
  }

  return (
    <section
      className={`match-spotlight ${hasLive ? "live" : "upcoming"} ${goalSide ? `goal-${goalSide}` : ""}`}
      role="button"
      tabIndex={0}
      onClick={openActiveMatch}
      onKeyDown={handleKeyDown}
      aria-label={`${title}: ${match.homeCode} vs ${match.awayCode}`}
    >
      <div className="spotlight-topline">
        <span>{title}</span>
      </div>

      <div className="spotlight-scoreboard">
        <div className={`spotlight-team ${goalSide === "home" ? "goal-side" : ""}`}>
          {match.homeFlag && <img src={flagUrl(match.homeFlag)} alt="" />}
          <strong>{match.homeCode}</strong>
        </div>
        <div className="spotlight-score">
          <AnimatedScore
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            goalSide={goalSide}
          />
          <span>{meta}</span>
        </div>
        <div className={`spotlight-team away ${goalSide === "away" ? "goal-side" : ""}`}>
          {match.awayFlag && <img src={flagUrl(match.awayFlag)} alt="" />}
          <strong>{match.awayCode}</strong>
        </div>
      </div>

      <div className="spotlight-footer">
        <span>
          <MapPin size={14} />
          {match.city || match.stadium || i18n.venueTbd}
        </span>
      </div>
    </section>
  );
}

function MatchSpotlight({ liveMatches, nextMatch, onOpen }) {
  const { i18n } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeStartRef = useRef(null);
  const hasLive = liveMatches.length > 0;
  const spotlightMatches = hasLive ? liveMatches : nextMatch ? [nextMatch] : [];
  const multipleLive = hasLive && spotlightMatches.length > 1;
  const title = hasLive ? i18n.spotlightLive : i18n.spotlightNext;

  useEffect(() => {
    setActiveIndex(0);
  }, [hasLive, spotlightMatches.length]);

  if (!spotlightMatches.length) return null;

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + spotlightMatches.length) % spotlightMatches.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % spotlightMatches.length);
  }

  function previous(event) {
    event.stopPropagation();
    showPrevious();
  }

  function next(event) {
    event.stopPropagation();
    showNext();
  }

  function stopCarouselKeyDown(event) {
    event.stopPropagation();
  }

  function handlePointerDown(event) {
    if (!multipleLive) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event) {
    if (!multipleLive || !swipeStartRef.current) return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) showNext();
    else showPrevious();
  }

  if (!multipleLive) {
    return (
      <SpotlightCard
        match={spotlightMatches[0]}
        hasLive={hasLive}
        title={title}
        onOpen={onOpen}
      />
    );
  }

  return (
    <section className="spotlight-carousel-shell live" aria-label={i18n.liveMatches}>
      <div
        className="spotlight-carousel-viewport"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <div className="spotlight-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {spotlightMatches.map((match, index) => (
            <div className="spotlight-slide" key={match.id} aria-hidden={index !== activeIndex}>
              <SpotlightCard match={match} hasLive={hasLive} title={title} onOpen={onOpen} />
            </div>
          ))}
        </div>
      </div>
      <div className="spotlight-controls" aria-label={i18n.liveMatches}>
        <button type="button" onClick={previous} onKeyDown={stopCarouselKeyDown} aria-label={i18n.previousLive}>
          <ChevronLeft size={16} />
        </button>
        <div>
          {spotlightMatches.map((match, index) => (
            <span key={match.id} className={index === activeIndex ? "active" : ""} />
          ))}
        </div>
        <small>{activeIndex + 1} / {spotlightMatches.length}</small>
        <button type="button" onClick={next} onKeyDown={stopCarouselKeyDown} aria-label={i18n.nextLive}>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

function Filters(props) {
  const { i18n } = useLanguage();
  const statusOptions = [
    ["all", i18n.statusFilters.all],
    ...(props.showLiveFilter ? [["live", i18n.statusFilters.live]] : []),
    ["played", i18n.statusFilters.played],
    ["upcoming", i18n.statusFilters.upcoming]
  ];

  return (
    <div className="filters">
      <div className={`segmented options-${statusOptions.length}`} role="tablist" aria-label={i18n.filters.status}>
        {statusOptions.map(([value, label]) => (
          <button
            key={value}
            className={props.status === value ? "active" : ""}
            onClick={() => props.setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <label>
        <span>{i18n.filters.stage}</span>
        <select value={props.phase} onChange={(event) => props.setPhase(event.target.value)}>
          <option value="all">{i18n.filters.allStages}</option>
          {props.phases.map((phase) => (
            <option key={phase} value={phase}>
              {phase}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{i18n.filters.group}</span>
        <select value={props.group} onChange={(event) => props.setGroup(event.target.value)}>
          <option value="all">{i18n.filters.allGroups}</option>
          {props.groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>
      <label className="search-field">
        <Search size={16} />
        <input
          value={props.query}
          onChange={(event) => props.setQuery(event.target.value)}
          placeholder={i18n.filters.search}
        />
      </label>
    </div>
  );
}

function MatchRow({ match, selected, onSelect }) {
  const { language } = useLanguage();
  const goalSide = useScorePulse(match.id, match.homeScore, match.awayScore);
  const isLive = match.statusTone === "live";
  return (
    <button
      className={`match-row ${selected ? "selected" : ""} ${isLive ? "live" : ""} ${goalSide ? `goal-${goalSide}` : ""}`}
      onClick={onSelect}
    >
      <div className="row-time">
        <span>{timeLabel(match, language)}</span>
        <small>#{match.matchNumber}</small>
      </div>
      <TeamCell name={match.homeName} code={match.homeCode} flag={match.homeFlag} highlight={goalSide === "home"} />
      <div className="score-cell">
        <AnimatedScore homeScore={match.homeScore} awayScore={match.awayScore} goalSide={goalSide} separator="-" compact />
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
      </div>
      <TeamCell name={match.awayName} code={match.awayCode} flag={match.awayFlag} align="right" highlight={goalSide === "away"} />
      <div className="row-venue">
        <MapPin size={14} />
        <span>{match.city || match.stadium}</span>
      </div>
    </button>
  );
}

function TeamCell({ name, code, flag, align = "left", highlight = false }) {
  return (
    <div className={`team-cell ${align} ${highlight ? "goal-side" : ""}`}>
      {flag ? <img src={flagUrl(flag)} alt="" /> : <span className="flag-placeholder">{code[0]}</span>}
      <div>
        <strong>{code}</strong>
        <span>{name}</span>
      </div>
    </div>
  );
}

function MatchScreen({ match, onBack, source, refresh, loading }) {
  const { language, i18n } = useLanguage();
  const [tab, setTab] = useState("datos");
  const { liveMatch, events, loading: detailLoading, error, refresh: refreshDetail } = useMatchFeed(match);
  const matchUrl = `${matchCentreBase(language)}/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;
  const liveRaw = liveMatch || match.raw;
  const homeScore = scoreFromRaw(match, liveRaw, "home");
  const awayScore = scoreFromRaw(match, liveRaw, "away");
  const currentTone = liveMatchTone(match, liveRaw);
  const currentStatus = liveMatchLabel(match, liveRaw, language);
  const goalSide = useScorePulse(match.id, homeScore, awayScore);
  const scoreMeta =
    currentTone === "live"
      ? [detailClockLabel(match, liveRaw, language), match.stage, match.group].filter(Boolean).join(" · ")
      : `${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" }, language)} · ${timeLabel(match, language)}`;
  const tabs = [
    ["datos", i18n.detail.facts, ClipboardList],
    ["stats", i18n.detail.stats, BarChart3],
    ["formacion", i18n.detail.lineup, Shirt],
    ["cronologia", i18n.detail.timeline, ListChecks]
  ];
  async function handleRefresh() {
    await Promise.allSettled([refresh(), refreshDetail()]);
  }

  return (
    <main className="app-shell match-screen">
      <header className="match-topbar">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          {i18n.fixture}
        </button>
        <div className="match-topbar-status">
          <span className={`connection ${navigator.onLine ? "online" : "offline"}`}>
            {navigator.onLine ? <Wifi size={15} /> : <WifiOff size={15} />}
            {source}
          </span>
          <button className="icon-button" onClick={handleRefresh} disabled={loading || detailLoading} title={i18n.refresh}>
            <RefreshCw size={18} className={loading || detailLoading ? "spin" : ""} />
            <span>{i18n.refresh}</span>
          </button>
        </div>
      </header>

      {error && <div className="notice">{error}</div>}

      <section className={`match-hero ${currentTone === "live" ? "live" : ""} ${goalSide ? `goal-${goalSide}` : ""}`}>
        <div className="match-context">
          <span className={`status-pill ${currentTone}`}>{currentStatus}</span>
          <span>{i18n.matchNumber} {match.matchNumber}</span>
          <span>{match.stage}</span>
          {match.group && <span>{match.group}</span>}
        </div>
        <div className="match-hero-score">
          <DetailTeam match={match} side="home" highlight={goalSide === "home"} />
          <div className="hero-scoreline">
            <AnimatedScore homeScore={homeScore} awayScore={awayScore} goalSide={goalSide} />
            <span>{scoreMeta}</span>
          </div>
          <DetailTeam match={match} side="away" highlight={goalSide === "away"} />
        </div>
        <div className="match-meta-row">
          <span>
            <MapPin size={15} />
            {match.stadium || i18n.stadiumTbd} · {match.city || i18n.cityTbd}
          </span>
          <a href={matchUrl} target="_blank" rel="noreferrer">
            FIFA match centre
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <nav className="detail-tabs" aria-label={i18n.detail.matchDetail}>
        {tabs.map(([value, label, Icon]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <section className="detail-surface">
        {detailLoading && <div className="inline-loading">{i18n.detail.loading}</div>}
        {tab === "datos" && <MatchFacts match={match} liveMatch={liveMatch} />}
        {tab === "stats" && <MatchStats match={match} liveMatch={liveMatch} events={events} />}
        {tab === "formacion" && <FormationView match={match} liveMatch={liveMatch} />}
        {tab === "cronologia" && <TimelineView events={events} />}
      </section>
    </main>
  );
}

function MatchFacts({ match, liveMatch }) {
  const { language, i18n } = useLanguage();
  const officials = liveMatch?.Officials || match.officials || [];
  const referee =
    officials.find((official) => {
      const type = localized(official.TypeLocalized, language).toLowerCase();
      return i18n.refereeNeedles.some((needle) => type.includes(needle));
    }) || officials[0];
  const attendance = liveMatch?.Attendance ?? match.attendance;
  const period = detailClockLabel(match, liveMatch || match.raw, language);

  return (
    <div className="facts-grid">
      <InfoItem icon={<Clock3 size={17} />} label={i18n.facts.date} value={`${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" }, language)} · ${timeLabel(match, language)}`} />
      <InfoItem icon={<MapPin size={17} />} label={i18n.facts.stadium} value={`${match.stadium || i18n.stadiumTbd} · ${match.city || ""}`} />
      <InfoItem icon={<Globe2 size={17} />} label={i18n.facts.stage} value={[match.stage, match.group].filter(Boolean).join(" · ")} />
      <InfoItem icon={<Activity size={17} />} label={i18n.facts.status} value={`${match.statusLabel} · ${period}`} />
      <InfoItem icon={<ShieldCheck size={17} />} label={i18n.facts.referee} value={personName(referee, language) || i18n.noReferee} />
      <InfoItem icon={<UsersRound size={17} />} label={i18n.facts.attendance} value={attendance ? attendance.toLocaleString(i18n.locale) : i18n.noAttendance} />
    </div>
  );
}

function eventTeamStats(events, match, language = "en") {
  const { eventNeedles } = languageConfig(language);
  const teams = {
    home: { label: match.homeCode, id: match.raw.Home?.IdTeam, goals: 0, cards: 0, fouls: 0, subs: 0, events: 0 },
    away: { label: match.awayCode, id: match.raw.Away?.IdTeam, goals: 0, cards: 0, fouls: 0, subs: 0, events: 0 }
  };
  for (const event of events) {
    const side = event.IdTeam === teams.home.id ? "home" : event.IdTeam === teams.away.id ? "away" : null;
    if (!side) continue;
    const label = localized(event.TypeLocalized, language).toLowerCase();
    teams[side].events += 1;
    if (eventNeedles.goal.some((needle) => label.includes(needle))) teams[side].goals += 1;
    if (eventNeedles.card.some((needle) => label.includes(needle))) teams[side].cards += 1;
    if (eventNeedles.foul.some((needle) => label.includes(needle))) teams[side].fouls += 1;
    if (eventNeedles.substitution.some((needle) => label.includes(needle))) teams[side].subs += 1;
  }
  return teams;
}

function MatchStats({ match, liveMatch, events }) {
  const { language, i18n } = useLanguage();
  const stats = eventTeamStats(events, match, language);
  const liveRaw = liveMatch || match.raw;
  const homeScore = scoreFromRaw(match, liveRaw, "home");
  const awayScore = scoreFromRaw(match, liveRaw, "away");
  const goalSide = useScorePulse(match.id, homeScore, awayScore);
  const rows = [
    [i18n.stats.goalsDetected, stats.home.goals, stats.away.goals],
    [i18n.stats.cards, stats.home.cards, stats.away.cards],
    [i18n.stats.fouls, stats.home.fouls, stats.away.fouls],
    [i18n.stats.substitutions, stats.home.subs, stats.away.subs],
    [i18n.stats.fifaEvents, stats.home.events, stats.away.events]
  ];
  const hasPossession = liveMatch?.BallPossession || liveMatch?.TerritorialPossesion;

  return (
    <div className="stats-layout">
      <div className="stat-card primary">
        <span>{i18n.stats.score}</span>
        <AnimatedScore homeScore={homeScore} awayScore={awayScore} goalSide={goalSide} separator="-" compact />
        <small>
          {match.homeCode} vs {match.awayCode}
        </small>
      </div>
      <div className="stat-card">
        <span>{i18n.stats.minutePeriod}</span>
        <strong>{detailClockLabel(match, liveRaw, language)}</strong>
        <small>{liveMatch?.Period ? `${i18n.stats.period} ${liveMatch.Period}` : i18n.fifaData}</small>
      </div>
      <div className="stat-card">
        <span>{i18n.stats.possession}</span>
        <strong>{hasPossession ? i18n.stats.available : i18n.stats.unavailable}</strong>
        <small>{hasPossession ? i18n.stats.published : i18n.stats.notPublished}</small>
      </div>
      <div className="stats-table">
        <div className="stats-table-head">
          <strong>{match.homeCode}</strong>
          <span>{i18n.stats.statistic}</span>
          <strong>{match.awayCode}</strong>
        </div>
        {rows.map(([label, home, away]) => (
          <div className="stats-table-row" key={label}>
            <strong>{home}</strong>
            <span>{label}</span>
            <strong>{away}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function positionLabel(position, language = "en") {
  const { positions } = languageConfig(language);
  if (position === 0) return positions.goalkeeper;
  if (position === 1) return positions.defender;
  if (position === 2) return positions.midfielder;
  if (position === 3) return positions.forward;
  return positions.squad;
}

function starterSortValue(player) {
  const positionOrder = { 0: 0, 1: 1, 2: 2, 3: 3 };
  return (positionOrder[player.Position] ?? 4) * 100 + (player.ShirtNumber || 0);
}

function fallbackTacticLines(players) {
  const counts = players.reduce(
    (acc, player) => {
      if (player.Position === 0) acc[0] += 1;
      else if (player.Position === 1) acc[1] += 1;
      else if (player.Position === 2) acc[2] += 1;
      else if (player.Position === 3) acc[3] += 1;
      return acc;
    },
    [0, 0, 0, 0]
  );

  const outfield = counts.slice(1).filter(Boolean);
  return [counts[0] || 1, ...(outfield.length ? outfield : [4, 3, 3])];
}

function tacticLines(tactic, players) {
  const parsed = String(tactic || "")
    .split("-")
    .map((chunk) => Number.parseInt(chunk, 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!parsed.length) return fallbackTacticLines(players);

  const expectedOutfield = Math.max(players.length - 1, 0);
  const parsedTotal = parsed.reduce((sum, value) => sum + value, 0);
  if (parsedTotal !== expectedOutfield) return fallbackTacticLines(players);

  return [1, ...parsed];
}

function pitchPlacements(players, tactic) {
  const sortedPlayers = players.slice().sort((a, b) => starterSortValue(a) - starterSortValue(b));
  const lines = tacticLines(tactic, sortedPlayers);
  const lineGap = lines.length > 1 ? 72 / (lines.length - 1) : 0;
  let offset = 0;

  return lines.flatMap((lineCount, lineIndex) => {
    const linePlayers = sortedPlayers.slice(offset, offset + lineCount);
    offset += lineCount;

    const y = lines.length === 1 ? 50 : 88 - lineIndex * lineGap;
    return linePlayers.map((player, slotIndex) => ({
      player,
      lineCount: linePlayers.length,
      x: ((slotIndex + 1) * 100) / (linePlayers.length + 1),
      y
    }));
  });
}

function teamFromLive(match, liveMatch, side) {
  if (side === "home") return liveMatch?.HomeTeam || liveMatch?.Home || match.raw.Home;
  return liveMatch?.AwayTeam || liveMatch?.Away || match.raw.Away;
}

function FormationView({ match, liveMatch }) {
  const home = teamFromLive(match, liveMatch, "home");
  const away = teamFromLive(match, liveMatch, "away");
  return (
    <div className="formation-grid">
      <TeamFormation title={match.homeName} code={match.homeCode} flag={match.homeFlag} team={home} />
      <TeamFormation title={match.awayName} code={match.awayCode} flag={match.awayFlag} team={away} />
    </div>
  );
}

function TeamFormation({ title, code, flag, team }) {
  const { language, i18n } = useLanguage();
  const players = team?.Players || [];
  const starters = players.filter((player) => player.Status === 1).slice(0, 11);
  const bench = starters.length ? players.filter((player) => player.Status !== 1).slice(0, 9) : [];

  return (
    <section className="formation-card">
      <div className="formation-card-head">
        <div className="formation-team-title">
          {flag ? <img src={flagUrl(flag)} alt="" /> : <span className="formation-flag-fallback">{code[0]}</span>}
          <div>
            <span>{code}</span>
            <h2>{title}</h2>
          </div>
        </div>
        <strong>{team?.Tactics || "TBC"}</strong>
      </div>
      {starters.length ? (
        <PitchFormation players={starters} tactic={team?.Tactics} teamCode={code} />
      ) : (
        <div className="timeline-empty formation-empty">{i18n.formation.empty}</div>
      )}
      {bench.length > 0 && (
        <details className="bench-list">
          <summary>{i18n.formation.bench}</summary>
          {bench.map((player) => (
            <div className="bench-row" key={player.IdPlayer || `${code}-bench-${player.ShirtNumber}`}>
              <span>{player.ShirtNumber || "--"}</span>
              {playerName(player, language)}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function PitchFormation({ players, tactic, teamCode }) {
  const { language, i18n } = useLanguage();
  const placements = pitchPlacements(players, tactic);

  return (
    <div className="pitch-formation" aria-label={`${i18n.formation.aria} ${teamCode}`}>
      <span className="pitch-halfway" aria-hidden="true" />
      <span className="pitch-circle" aria-hidden="true" />
      <span className="pitch-box pitch-box-top" aria-hidden="true" />
      <span className="pitch-box pitch-box-bottom" aria-hidden="true" />
      <span className="pitch-goal pitch-goal-top" aria-hidden="true" />
      <span className="pitch-goal pitch-goal-bottom" aria-hidden="true" />
      {placements.map(({ player, lineCount, x, y }) => (
        <div
          className={`pitch-player line-${lineCount}`}
          key={player.IdPlayer || `${teamCode}-${player.ShirtNumber}-${x}-${y}`}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <span className="pitch-number">{player.ShirtNumber || "--"}</span>
          <strong>{playerName(player, language)}</strong>
          <small>
            {positionLabel(player.Position, language)}
            {player.Captain ? " - C" : ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ events }) {
  const { language, i18n } = useLanguage();
  const sortedEvents = events.slice().reverse();
  if (!sortedEvents.length) {
    return (
      <div className="timeline-empty large">
        {i18n.timeline.empty}
      </div>
    );
  }
  return (
    <div className="timeline-list full">
      {sortedEvents.map((event) => (
        <div className="timeline-event" key={event.EventId}>
          <strong>{event.MatchMinute || "--"}</strong>
          <div>
            <span>{localized(event.TypeLocalized, language) || i18n.timeline.event}</span>
            <p>{localized(event.EventDescription, language)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchDetail({ match }) {
  const { language, i18n } = useLanguage();
  const { events, loading, status } = useTimeline(match);
  if (!match) {
    return (
      <aside className="detail-pane empty">
        <ShieldCheck size={32} />
        <strong>{i18n.selectMatch}</strong>
      </aside>
    );
  }

  const matchUrl = `${matchCentreBase(language)}/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;

  return (
    <aside className="detail-pane">
      <div className="detail-header">
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
        <a href={matchUrl} target="_blank" rel="noreferrer">
          FIFA match centre
        </a>
      </div>

      <div className="detail-score">
        <DetailTeam match={match} side="home" />
        <div className="detail-scoreline">
          <span>{i18n.matchNumber} {match.matchNumber}</span>
          <strong>
            {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
          </strong>
          <small>{match.stage}</small>
        </div>
        <DetailTeam match={match} side="away" />
      </div>

      <div className="detail-grid">
        <InfoItem icon={<Clock3 size={17} />} label={i18n.facts.date} value={`${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" }, language)} · ${timeLabel(match, language)}`} />
        <InfoItem icon={<MapPin size={17} />} label={i18n.facts.stadium} value={`${match.stadium || i18n.stadiumTbd} · ${match.city || ""}`} />
        <InfoItem icon={<Globe2 size={17} />} label={i18n.filters.group} value={match.group || i18n.knockout} />
        <InfoItem icon={<ShieldCheck size={17} />} label="ID FIFA" value={match.id} />
      </div>

      <section className="timeline">
        <div className="panel-title">
          <h3>{i18n.detail.timeline}</h3>
          {loading && <span>{i18n.sourceLoading}</span>}
        </div>
        {events.length ? (
          events.map((event) => (
            <div className="timeline-event" key={event.EventId}>
              <strong>{event.MatchMinute || "--"}</strong>
              <div>
                <span>{localized(event.TypeLocalized, language) || i18n.timeline.event}</span>
                <p>{localized(event.EventDescription, language)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="timeline-empty">
            {status === "error"
              ? i18n.timeline.error
              : i18n.timeline.empty}
          </div>
        )}
      </section>
    </aside>
  );
}

function DetailTeam({ match, side, highlight = false }) {
  const isHome = side === "home";
  const name = isHome ? match.homeName : match.awayName;
  const code = isHome ? match.homeCode : match.awayCode;
  const flag = isHome ? match.homeFlag : match.awayFlag;
  return (
    <div className={`detail-team ${highlight ? "goal-side" : ""}`}>
      {flag ? <img src={flagUrl(flag)} alt="" /> : <span className="detail-flag">{code[0]}</span>}
      <strong>{code}</strong>
      <span>{name}</span>
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="info-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="skeleton-list">
      {Array.from({ length: 8 }).map((_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
