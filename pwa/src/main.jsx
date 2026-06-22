import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  Shirt,
  ShieldCheck,
  Table2,
  Trophy,
  UsersRound,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const FIFA_FIXTURE_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idSeason=285023";
const FIFA_TIMELINE_URL = "https://api.fifa.com/api/v3/timelines";
const MATCH_CENTRE_BASE = "https://www.fifa.com/es/match-centre/match";
const TIME_ZONE = "America/Buenos_Aires";
const LIVE_FIXTURE_REFRESH_MS = 15000;
const IDLE_FIXTURE_REFRESH_MS = 60000;
const LIVE_DETAIL_REFRESH_MS = 10000;
const IDLE_DETAIL_REFRESH_MS = 60000;

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

function localized(value, locale = "es-ES") {
  if (!Array.isArray(value)) return "";
  return (
    value.find((entry) => entry.Locale === locale)?.Description ??
    value[0]?.Description ??
    ""
  );
}

function teamName(team, placeholder) {
  return localized(team?.TeamName) || team?.Abbreviation || placeholder || "Por definir";
}

function teamCode(team, placeholder) {
  return team?.Abbreviation || placeholder || "TBD";
}

function personName(value) {
  return localized(value?.Name) || localized(value?.NameShort) || localized(value?.PlayerName) || "";
}

function playerName(player) {
  return localized(player?.PlayerName) || localized(player?.ShortName) || "Jugador";
}

function scoreValue(teamScore, fallback) {
  return teamScore ?? fallback ?? null;
}

function statusLabel(status) {
  if (status === 0) return "Jugado";
  if (status === 3) return "En vivo";
  if (status === 1) return "Próximo";
  return "Programado";
}

function statusTone(status) {
  if (status === 0) return "played";
  if (status === 3) return "live";
  if (status === 1) return "upcoming";
  return "scheduled";
}

function toMatch(raw) {
  const homeScore = scoreValue(raw.Home?.Score, raw.HomeTeamScore);
  const awayScore = scoreValue(raw.Away?.Score, raw.AwayTeamScore);
  const status = raw.MatchStatus;
  const stage = localized(raw.StageName);
  const group = localized(raw.GroupName);
  const stadium = localized(raw.Stadium?.Name);
  const city = localized(raw.Stadium?.CityName);

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
    statusLabel: statusLabel(status),
    statusTone: statusTone(status),
    stage,
    group,
    stadium,
    city,
    country: raw.Stadium?.IdCountry || "",
    homeName: teamName(raw.Home, raw.PlaceHolderA),
    awayName: teamName(raw.Away, raw.PlaceHolderB),
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

function formatDate(iso, options = {}) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE,
    ...options
  }).format(new Date(iso));
}

function dateKey(iso) {
  return formatDate(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
}

function timeLabel(match) {
  if (!match.timeDefined) return "TBC";
  return formatDate(match.date, {
    hour12: false,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function kickoffTime(match) {
  const timestamp = new Date(match.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function compareMatchesByKickoff(a, b) {
  return kickoffTime(a) - kickoffTime(b) || a.matchNumber - b.matchNumber;
}

function liveClockFromRaw(raw) {
  return raw?.MatchTime || raw?.MatchMinute || raw?.MatchClock || "En vivo";
}

function liveClockLabel(match) {
  return liveClockFromRaw(match.raw);
}

function scoreFromRaw(match, raw, side) {
  const team = side === "home" ? raw?.Home : raw?.Away;
  const topLevelScore = side === "home" ? raw?.HomeTeamScore : raw?.AwayTeamScore;
  const fallback = side === "home" ? match.homeScore : match.awayScore;
  return scoreValue(team?.Score, scoreValue(topLevelScore, fallback));
}

function liveMatchStatus(match, raw) {
  return raw?.MatchStatus ?? match.status;
}

function liveMatchTone(match, raw) {
  return statusTone(liveMatchStatus(match, raw));
}

function liveMatchLabel(match, raw) {
  return statusLabel(liveMatchStatus(match, raw));
}

function detailClockLabel(match, raw) {
  const tone = liveMatchTone(match, raw);
  if (tone === "live") return liveClockFromRaw(raw);
  if (tone === "played") return "Finalizado";
  return "Programado";
}

function useFixture() {
  const [matches, setMatches] = useState([]);
  const [source, setSource] = useState("Cargando");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadFixture = useCallback(async (preferNetwork = true, options = {}) => {
    const silent = options.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      if (preferNetwork && navigator.onLine) {
        const data = await fetchFifaJson(FIFA_FIXTURE_URL);
        const normalized = data.Results.map(toMatch).sort(compareMatchesByKickoff);
        setMatches(normalized);
        setUpdatedAt(new Date());
        localStorage.setItem("fixture-cache", JSON.stringify({ savedAt: Date.now(), data }));
        setSource("FIFA API");
      } else {
        throw new Error("offline");
      }
    } catch (networkError) {
      if (silent) return;
      try {
        const cached = localStorage.getItem("fixture-cache");
        const data = cached
          ? JSON.parse(cached).data
          : await fetch("/fixture-seed.json").then((response) => response.json());
        setMatches(data.Results.map(toMatch).sort(compareMatchesByKickoff));
        setSource(cached ? "Cache local" : "Snapshot offline");
        setUpdatedAt(cached ? new Date(JSON.parse(cached).savedAt) : null);
        if (preferNetwork) setError("No se pudo refrescar FIFA API; se usa cache local.");
      } catch (fallbackError) {
        setError("No se pudo cargar el fixture.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadTimeline = useCallback(async (options = {}) => {
    if (!match?.id) return;
    const silent = options.silent === true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await fetchFifaJson(`${FIFA_TIMELINE_URL}/${match.id}?language=es`);
      if (requestIdRef.current !== requestId) return;
      setEvents(data.Event || []);
    } catch {
      if (requestIdRef.current !== requestId) return;
      if (!silent) {
        setEvents([]);
        setError("No se pudo cargar la cronología en vivo.");
      }
    } finally {
      if (requestIdRef.current === requestId && !silent) setLoading(false);
    }
  }, [match?.id]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    if (!match?.id) return undefined;
    const detailInterval = match.statusTone === "live" ? LIVE_DETAIL_REFRESH_MS : IDLE_DETAIL_REFRESH_MS;
    const refreshSilently = () => {
      if (navigator.onLine && documentIsVisible()) {
        loadTimeline({ silent: true });
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
  }, [loadTimeline, match?.id, match?.statusTone]);

  return {
    liveMatch: match?.raw || null,
    events,
    loading,
    error,
    refresh: () => loadTimeline()
  };
}

function useTimeline(match) {
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
        const data = await fetchFifaJson(`${FIFA_TIMELINE_URL}/${match.id}?language=es`);
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
  }, [match?.id]);

  return { events, loading, status };
}

function groupByDate(matches) {
  return matches.reduce((groups, match) => {
    const key = dateKey(match.date);
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

function compareStandings(a, b) {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name, "es")
  );
}

function buildGroups(matches) {
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
      teams: Array.from(group.teams.values()).sort((a, b) => a.name.localeCompare(b.name, "es")),
      standings: Array.from(group.teams.values()).sort(compareStandings),
      matches: group.matches.slice().sort(compareMatchesByKickoff)
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
}

function App() {
  const { matches, source, loading, error, updatedAt, refresh } = useFixture();
  const [view, setView] = useState("fixture");
  const [status, setStatus] = useState("all");
  const [phase, setPhase] = useState("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");
  const [detailMatchId, setDetailMatchId] = useState(null);
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
  const groupData = useMemo(() => buildGroups(matches), [matches]);

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

  const grouped = groupByDate(filteredMatches);
  const playedCount = matches.filter((match) => match.statusTone === "played").length;
  const liveCount = liveMatches.length;

  useEffect(() => {
    if (status === "live" && liveCount === 0) {
      setStatus("all");
    }
  }, [liveCount, status]);

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
      <MatchScreen
        match={detailMatch}
        onBack={() => setDetailMatchId(null)}
        source={source}
        refresh={refresh}
        loading={loading}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Trophy size={22} />
          </div>
          <div>
            <h1>Fixture Mundial 2026</h1>
            <p>Partidos, grupos, estados y detalle en tiempo real</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className={`connection ${navigator.onLine ? "online" : "offline"}`}>
            {navigator.onLine ? <Wifi size={15} /> : <WifiOff size={15} />}
            {source}
          </span>
          <button className="icon-button" onClick={refresh} disabled={loading} title="Actualizar">
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            <span>Actualizar</span>
          </button>
          <button
            className="icon-button secondary"
            onClick={installApp}
            disabled={!installPrompt}
            title="Instalar PWA"
          >
            <Download size={18} />
            <span>Instalar</span>
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
          <span>partidos</span>
        </div>
        <div className="metric">
          <strong>{playedCount}</strong>
          <span>jugados</span>
        </div>
        <div className="metric">
          <strong>{liveCount}</strong>
          <span>en vivo</span>
        </div>
        <div className="metric timestamp">
          <strong>
            {updatedAt
              ? formatDate(updatedAt.toISOString(), {
                  hour12: false,
                  hourCycle: "h23",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "--"}
          </strong>
          <span>ultima carga</span>
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
                  <strong>No hay partidos para esos filtros</strong>
                  <span>Probá cambiar fase, grupo o búsqueda.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <GroupsScreen
          groups={groupData}
          activeGroupId={activeGroupId}
          setActiveGroupId={setActiveGroupId}
          loading={loading && !matches.length}
          onOpenMatch={(match) => setDetailMatchId(match.id)}
        />
      )}
    </main>
  );
}

function PrimaryNav({ activeView, setView }) {
  const items = [
    ["fixture", "Fixture", CalendarDays],
    ["groups", "Grupos", Table2]
  ];

  return (
    <nav className="primary-nav" aria-label="Vistas principales">
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

function GroupsScreen({ groups, activeGroupId, setActiveGroupId, loading, onOpenMatch }) {
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
          <strong>No hay grupos publicados</strong>
          <span>Cuando FIFA publique la fase de grupos, aparecerán acá.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="groups-screen">
      <div className="group-picker" aria-label="Grupos">
        {groups.map((group) => (
          <button
            key={group.id}
            className={String(group.id) === String(activeGroup.id) ? "active" : ""}
            onClick={() => setActiveGroupId(String(group.id))}
          >
            <span>{group.name}</span>
            <small>{group.teams.length} equipos</small>
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
            <strong>Tabla de posiciones</strong>
          </div>
          <StandingsTable standings={activeGroup.standings} />
        </section>

        <aside className="group-side">
          <section className="group-card">
            <div className="group-panel-title">
              <UsersRound size={17} />
              <h3>Equipos</h3>
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
              <h3>Partidos</h3>
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
  return (
    <div className="standings-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>Pts</th>
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
  const hasScore = match.homeScore !== null || match.awayScore !== null;
  return (
    <button className="group-match-item" onClick={onOpen}>
      <div className="group-match-time">
        <strong>{timeLabel(match)}</strong>
        <span>#{match.matchNumber}</span>
      </div>
      <div className="group-match-teams">
        <span>{match.homeCode}</span>
        <strong>{hasScore ? `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}` : "vs"}</strong>
        <span>{match.awayCode}</span>
      </div>
      <div className="group-match-meta">
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
        <small>{match.city || match.stadium}</small>
      </div>
    </button>
  );
}

function MatchSpotlight({ liveMatches, nextMatch, onOpen }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasLive = liveMatches.length > 0;
  const spotlightMatches = hasLive ? liveMatches : nextMatch ? [nextMatch] : [];
  const activeMatch = spotlightMatches[activeIndex] || spotlightMatches[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [hasLive, spotlightMatches.length]);

  if (!activeMatch) return null;

  const hasScore = activeMatch.homeScore !== null || activeMatch.awayScore !== null;
  const multipleLive = hasLive && spotlightMatches.length > 1;
  const title = hasLive ? "Partido en vivo" : "Próximo partido";
  const meta = hasLive
    ? [liveClockLabel(activeMatch), activeMatch.stage, activeMatch.group].filter(Boolean).join(" · ")
    : `${formatDate(activeMatch.date, { weekday: "short", day: "2-digit", month: "short" })} · ${timeLabel(activeMatch)}`;

  function previous(event) {
    event.stopPropagation();
    setActiveIndex((current) => (current - 1 + spotlightMatches.length) % spotlightMatches.length);
  }

  function next(event) {
    event.stopPropagation();
    setActiveIndex((current) => (current + 1) % spotlightMatches.length);
  }

  function stopCarouselKeyDown(event) {
    event.stopPropagation();
  }

  function openActiveMatch() {
    onOpen(activeMatch);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openActiveMatch();
    }
  }

  return (
    <section
      className={`match-spotlight ${hasLive ? "live" : "upcoming"}`}
      role="button"
      tabIndex={0}
      onClick={openActiveMatch}
      onKeyDown={handleKeyDown}
      aria-label={`${title}: ${activeMatch.homeCode} vs ${activeMatch.awayCode}`}
    >
      <div className="spotlight-topline">
        <span>{title}</span>
        {multipleLive && <small>{activeIndex + 1} / {spotlightMatches.length}</small>}
      </div>

      <div className="spotlight-scoreboard">
        <div className="spotlight-team">
          {activeMatch.homeFlag && <img src={flagUrl(activeMatch.homeFlag)} alt="" />}
          <strong>{activeMatch.homeCode}</strong>
        </div>
        <div className="spotlight-score">
          {hasScore ? (
            <strong>
              {activeMatch.homeScore ?? "-"} : {activeMatch.awayScore ?? "-"}
            </strong>
          ) : (
            <strong>vs</strong>
          )}
          <span>{meta}</span>
        </div>
        <div className="spotlight-team away">
          {activeMatch.awayFlag && <img src={flagUrl(activeMatch.awayFlag)} alt="" />}
          <strong>{activeMatch.awayCode}</strong>
        </div>
      </div>

      <div className="spotlight-footer">
        <span>
          <MapPin size={14} />
          {activeMatch.city || activeMatch.stadium || "Sede por definir"}
        </span>
        {multipleLive && (
          <div className="spotlight-controls" aria-label="Partidos en vivo">
            <button
              type="button"
              onClick={previous}
              onKeyDown={stopCarouselKeyDown}
              aria-label="Partido en vivo anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              {spotlightMatches.map((match, index) => (
                <span key={match.id} className={index === activeIndex ? "active" : ""} />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              onKeyDown={stopCarouselKeyDown}
              aria-label="Siguiente partido en vivo"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Filters(props) {
  const statusOptions = [
    ["all", "Todos"],
    ...(props.showLiveFilter ? [["live", "En vivo"]] : []),
    ["played", "Jugados"],
    ["upcoming", "Próximos"]
  ];

  return (
    <div className="filters">
      <div className={`segmented options-${statusOptions.length}`} role="tablist" aria-label="Estado">
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
        <span>Fase</span>
        <select value={props.phase} onChange={(event) => props.setPhase(event.target.value)}>
          <option value="all">Todas</option>
          {props.phases.map((phase) => (
            <option key={phase} value={phase}>
              {phase}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Grupo</span>
        <select value={props.group} onChange={(event) => props.setGroup(event.target.value)}>
          <option value="all">Todos</option>
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
          placeholder="Buscar"
        />
      </label>
    </div>
  );
}

function MatchRow({ match, selected, onSelect }) {
  const hasScore = match.homeScore !== null || match.awayScore !== null;
  return (
    <button className={`match-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="row-time">
        <span>{timeLabel(match)}</span>
        <small>#{match.matchNumber}</small>
      </div>
      <TeamCell name={match.homeName} code={match.homeCode} flag={match.homeFlag} />
      <div className="score-cell">
        {hasScore ? (
          <strong>
            {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
          </strong>
        ) : (
          <strong>vs</strong>
        )}
        <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
      </div>
      <TeamCell name={match.awayName} code={match.awayCode} flag={match.awayFlag} align="right" />
      <div className="row-venue">
        <MapPin size={14} />
        <span>{match.city || match.stadium}</span>
      </div>
    </button>
  );
}

function TeamCell({ name, code, flag, align = "left" }) {
  return (
    <div className={`team-cell ${align}`}>
      {flag ? <img src={flagUrl(flag)} alt="" /> : <span className="flag-placeholder">{code[0]}</span>}
      <div>
        <strong>{code}</strong>
        <span>{name}</span>
      </div>
    </div>
  );
}

function MatchScreen({ match, onBack, source, refresh, loading }) {
  const [tab, setTab] = useState("datos");
  const { liveMatch, events, loading: detailLoading, error, refresh: refreshDetail } = useMatchFeed(match);
  const matchUrl = `${MATCH_CENTRE_BASE}/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;
  const liveRaw = liveMatch || match.raw;
  const homeScore = scoreFromRaw(match, liveRaw, "home");
  const awayScore = scoreFromRaw(match, liveRaw, "away");
  const currentTone = liveMatchTone(match, liveRaw);
  const currentStatus = liveMatchLabel(match, liveRaw);
  const scoreMeta =
    currentTone === "live"
      ? [detailClockLabel(match, liveRaw), match.stage, match.group].filter(Boolean).join(" · ")
      : `${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" })} · ${timeLabel(match)}`;
  const tabs = [
    ["datos", "Datos", ClipboardList],
    ["stats", "Estadísticas", BarChart3],
    ["formacion", "Formación", Shirt],
    ["cronologia", "Cronología", ListChecks]
  ];
  async function handleRefresh() {
    await Promise.allSettled([refresh(), refreshDetail()]);
  }

  return (
    <main className="app-shell match-screen">
      <header className="match-topbar">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={18} />
          Fixture
        </button>
        <div className="match-topbar-status">
          <span className={`connection ${navigator.onLine ? "online" : "offline"}`}>
            {navigator.onLine ? <Wifi size={15} /> : <WifiOff size={15} />}
            {source}
          </span>
          <button className="icon-button" onClick={handleRefresh} disabled={loading || detailLoading} title="Actualizar">
            <RefreshCw size={18} className={loading || detailLoading ? "spin" : ""} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {error && <div className="notice">{error}</div>}

      <section className="match-hero">
        <div className="match-context">
          <span className={`status-pill ${currentTone}`}>{currentStatus}</span>
          <span>Partido {match.matchNumber}</span>
          <span>{match.stage}</span>
          {match.group && <span>{match.group}</span>}
        </div>
        <div className="match-hero-score">
          <DetailTeam match={match} side="home" />
          <div className="hero-scoreline">
            <strong>
              {homeScore ?? "-"} : {awayScore ?? "-"}
            </strong>
            <span>{scoreMeta}</span>
          </div>
          <DetailTeam match={match} side="away" />
        </div>
        <div className="match-meta-row">
          <span>
            <MapPin size={15} />
            {match.stadium || "Estadio por definir"} · {match.city || "Ciudad por definir"}
          </span>
          <a href={matchUrl} target="_blank" rel="noreferrer">
            FIFA match centre
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <nav className="detail-tabs" aria-label="Detalle del partido">
        {tabs.map(([value, label, Icon]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <section className="detail-surface">
        {detailLoading && <div className="inline-loading">Cargando datos del partido...</div>}
        {tab === "datos" && <MatchFacts match={match} liveMatch={liveMatch} />}
        {tab === "stats" && <MatchStats match={match} liveMatch={liveMatch} events={events} />}
        {tab === "formacion" && <FormationView match={match} liveMatch={liveMatch} />}
        {tab === "cronologia" && <TimelineView events={events} />}
      </section>
    </main>
  );
}

function MatchFacts({ match, liveMatch }) {
  const officials = liveMatch?.Officials || match.officials || [];
  const referee = officials.find((official) => localized(official.TypeLocalized).toLowerCase().includes("árbitro")) || officials[0];
  const attendance = liveMatch?.Attendance ?? match.attendance;
  const period = detailClockLabel(match, liveMatch || match.raw);

  return (
    <div className="facts-grid">
      <InfoItem icon={<Clock3 size={17} />} label="Fecha" value={`${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" })} · ${timeLabel(match)}`} />
      <InfoItem icon={<MapPin size={17} />} label="Estadio" value={`${match.stadium || "Por definir"} · ${match.city || ""}`} />
      <InfoItem icon={<Globe2 size={17} />} label="Fase" value={[match.stage, match.group].filter(Boolean).join(" · ")} />
      <InfoItem icon={<Activity size={17} />} label="Estado" value={`${match.statusLabel} · ${period}`} />
      <InfoItem icon={<ShieldCheck size={17} />} label="Árbitro" value={personName(referee) || "No publicado"} />
      <InfoItem icon={<UsersRound size={17} />} label="Asistencia" value={attendance ? attendance.toLocaleString("es-AR") : "No publicada"} />
    </div>
  );
}

function eventTeamStats(events, match) {
  const teams = {
    home: { label: match.homeCode, id: match.raw.Home?.IdTeam, goals: 0, cards: 0, fouls: 0, subs: 0, events: 0 },
    away: { label: match.awayCode, id: match.raw.Away?.IdTeam, goals: 0, cards: 0, fouls: 0, subs: 0, events: 0 }
  };
  for (const event of events) {
    const side = event.IdTeam === teams.home.id ? "home" : event.IdTeam === teams.away.id ? "away" : null;
    if (!side) continue;
    const label = localized(event.TypeLocalized).toLowerCase();
    teams[side].events += 1;
    if (label.includes("gol")) teams[side].goals += 1;
    if (label.includes("tarjeta")) teams[side].cards += 1;
    if (label.includes("falta")) teams[side].fouls += 1;
    if (label.includes("sustit") || label.includes("cambio")) teams[side].subs += 1;
  }
  return teams;
}

function MatchStats({ match, liveMatch, events }) {
  const stats = eventTeamStats(events, match);
  const liveRaw = liveMatch || match.raw;
  const homeScore = scoreFromRaw(match, liveRaw, "home");
  const awayScore = scoreFromRaw(match, liveRaw, "away");
  const rows = [
    ["Goles detectados", stats.home.goals, stats.away.goals],
    ["Tarjetas", stats.home.cards, stats.away.cards],
    ["Faltas registradas", stats.home.fouls, stats.away.fouls],
    ["Cambios", stats.home.subs, stats.away.subs],
    ["Eventos FIFA", stats.home.events, stats.away.events]
  ];
  const hasPossession = liveMatch?.BallPossession || liveMatch?.TerritorialPossesion;

  return (
    <div className="stats-layout">
      <div className="stat-card primary">
        <span>Marcador</span>
        <strong>
          {homeScore ?? "-"} - {awayScore ?? "-"}
        </strong>
        <small>
          {match.homeCode} vs {match.awayCode}
        </small>
      </div>
      <div className="stat-card">
        <span>Minuto / periodo</span>
        <strong>{detailClockLabel(match, liveRaw)}</strong>
        <small>{liveMatch?.Period ? `Periodo ${liveMatch.Period}` : "Dato FIFA"}</small>
      </div>
      <div className="stat-card">
        <span>Posesión</span>
        <strong>{hasPossession ? "Disponible" : "--"}</strong>
        <small>{hasPossession ? "Publicada por FIFA" : "No publicada para este partido"}</small>
      </div>
      <div className="stats-table">
        <div className="stats-table-head">
          <strong>{match.homeCode}</strong>
          <span>Estadística</span>
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

function positionLabel(position) {
  if (position === 0) return "Arquero";
  if (position === 1) return "Defensa";
  if (position === 2) return "Medio";
  if (position === 3) return "Delantero";
  return "Plantel";
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
  if (side === "home") return liveMatch?.HomeTeam || match.raw.Home;
  return liveMatch?.AwayTeam || match.raw.Away;
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
        <div className="timeline-empty formation-empty">FIFA todavía no publicó la formación inicial de este equipo.</div>
      )}
      {bench.length > 0 && (
        <details className="bench-list">
          <summary>Suplentes</summary>
          {bench.map((player) => (
            <div className="bench-row" key={player.IdPlayer || `${code}-bench-${player.ShirtNumber}`}>
              <span>{player.ShirtNumber || "--"}</span>
              {playerName(player)}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function PitchFormation({ players, tactic, teamCode }) {
  const placements = pitchPlacements(players, tactic);

  return (
    <div className="pitch-formation" aria-label={`Formación de ${teamCode}`}>
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
          <strong>{playerName(player)}</strong>
          <small>
            {positionLabel(player.Position)}
            {player.Captain ? " - C" : ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ events }) {
  const sortedEvents = events.slice().reverse();
  if (!sortedEvents.length) {
    return (
      <div className="timeline-empty large">
        La cronología aparece cuando FIFA publica eventos del partido.
      </div>
    );
  }
  return (
    <div className="timeline-list full">
      {sortedEvents.map((event) => (
        <div className="timeline-event" key={event.EventId}>
          <strong>{event.MatchMinute || "--"}</strong>
          <div>
            <span>{localized(event.TypeLocalized) || "Evento"}</span>
            <p>{localized(event.EventDescription)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchDetail({ match }) {
  const { events, loading, status } = useTimeline(match);
  if (!match) {
    return (
      <aside className="detail-pane empty">
        <ShieldCheck size={32} />
        <strong>Seleccioná un partido</strong>
      </aside>
    );
  }

  const matchUrl = `${MATCH_CENTRE_BASE}/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;

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
          <span>Partido {match.matchNumber}</span>
          <strong>
            {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
          </strong>
          <small>{match.stage}</small>
        </div>
        <DetailTeam match={match} side="away" />
      </div>

      <div className="detail-grid">
        <InfoItem icon={<Clock3 size={17} />} label="Fecha" value={`${formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" })} · ${timeLabel(match)}`} />
        <InfoItem icon={<MapPin size={17} />} label="Estadio" value={`${match.stadium || "Por definir"} · ${match.city || ""}`} />
        <InfoItem icon={<Globe2 size={17} />} label="Grupo" value={match.group || "Eliminatoria"} />
        <InfoItem icon={<ShieldCheck size={17} />} label="ID FIFA" value={match.id} />
      </div>

      <section className="timeline">
        <div className="panel-title">
          <h3>Cronología</h3>
          {loading && <span>Cargando</span>}
        </div>
        {events.length ? (
          events.map((event) => (
            <div className="timeline-event" key={event.EventId}>
              <strong>{event.MatchMinute || "--"}</strong>
              <div>
                <span>{localized(event.TypeLocalized) || "Evento"}</span>
                <p>{localized(event.EventDescription)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="timeline-empty">
            {status === "error"
              ? "No se pudo cargar la cronología."
              : "La cronología aparece cuando FIFA publica eventos del partido."}
          </div>
        )}
      </section>
    </aside>
  );
}

function DetailTeam({ match, side }) {
  const isHome = side === "home";
  const name = isHome ? match.homeName : match.awayName;
  const code = isHome ? match.homeCode : match.awayCode;
  const flag = isHome ? match.homeFlag : match.awayFlag;
  return (
    <div className="detail-team">
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
