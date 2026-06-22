import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
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
  Trophy,
  UsersRound,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const FIFA_FIXTURE_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idSeason=285023";
const FIFA_LIVE_URL = "https://api.fifa.com/api/v3/live/football";
const FIFA_TIMELINE_URL = "https://api.fifa.com/api/v3/timelines";
const MATCH_CENTRE_BASE = "https://www.fifa.com/es/match-centre/match";
const TIME_ZONE = "America/Buenos_Aires";

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

function useFixture() {
  const [matches, setMatches] = useState([]);
  const [source, setSource] = useState("Cargando");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  async function loadFixture(preferNetwork = true) {
    setLoading(true);
    setError("");
    try {
      let response;
      if (preferNetwork && navigator.onLine) {
        response = await fetch(FIFA_FIXTURE_URL, { headers: { accept: "application/json" } });
        if (!response.ok) throw new Error(`FIFA API ${response.status}`);
        setSource("FIFA API");
      } else {
        throw new Error("offline");
      }
      const data = await response.json();
      const normalized = data.Results.map(toMatch).sort((a, b) => a.matchNumber - b.matchNumber);
      setMatches(normalized);
      setUpdatedAt(new Date());
      localStorage.setItem("fixture-cache", JSON.stringify({ savedAt: Date.now(), data }));
    } catch (networkError) {
      try {
        const cached = localStorage.getItem("fixture-cache");
        const data = cached
          ? JSON.parse(cached).data
          : await fetch("/fixture-seed.json").then((response) => response.json());
        setMatches(data.Results.map(toMatch).sort((a, b) => a.matchNumber - b.matchNumber));
        setSource(cached ? "Cache local" : "Snapshot offline");
        setUpdatedAt(cached ? new Date(JSON.parse(cached).savedAt) : null);
        if (preferNetwork) setError("No se pudo refrescar FIFA API; se usa cache local.");
      } catch (fallbackError) {
        setError("No se pudo cargar el fixture.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFixture();
  }, []);

  return { matches, source, loading, error, updatedAt, refresh: () => loadFixture(true) };
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
        const response = await fetch(`${FIFA_TIMELINE_URL}/${match.id}?language=es`);
        if (!response.ok) throw new Error(`Timeline ${response.status}`);
        const data = await response.json();
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

function useMatchFeed(match) {
  const [liveMatch, setLiveMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!match?.id) return;
      setLoading(true);
      setError("");
      try {
        const [liveResult, timelineResult] = await Promise.allSettled([
          fetch(`${FIFA_LIVE_URL}/${match.id}?language=es`).then((response) => {
            if (!response.ok) throw new Error(`Live ${response.status}`);
            return response.json();
          }),
          fetch(`${FIFA_TIMELINE_URL}/${match.id}?language=es`).then((response) => {
            if (!response.ok) throw new Error(`Timeline ${response.status}`);
            return response.json();
          })
        ]);
        if (!active) return;
        setLiveMatch(liveResult.status === "fulfilled" && liveResult.value?.IdMatch ? liveResult.value : null);
        setEvents(timelineResult.status === "fulfilled" ? timelineResult.value?.Event || [] : []);
        if (liveResult.status === "rejected" && timelineResult.status === "rejected") {
          setError("No se pudo cargar el detalle en vivo.");
        }
      } catch {
        if (!active) return;
        setLiveMatch(null);
        setEvents([]);
        setError("No se pudo cargar el detalle en vivo.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [match?.id]);

  return { liveMatch, events, loading, error };
}

function groupByDate(matches) {
  return matches.reduce((groups, match) => {
    const key = dateKey(match.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(match);
    return groups;
  }, {});
}

function App() {
  const { matches, source, loading, error, updatedAt, refresh } = useFixture();
  const [status, setStatus] = useState("all");
  const [phase, setPhase] = useState("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
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

  const grouped = groupByDate(filteredMatches);
  const playedCount = matches.filter((match) => match.statusTone === "played").length;
  const liveCount = matches.filter((match) => match.statusTone === "live").length;

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

      {error && <div className="notice">{error}</div>}

      <section className="score-strip">
        <NextMatch match={nextMatch} onOpen={() => nextMatch && setDetailMatchId(nextMatch.id)} />
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
    </main>
  );
}

function NextMatch({ match, onOpen }) {
  if (!match) return null;
  return (
    <button className="next-match" onClick={onOpen}>
      <span>Próximo partido</span>
      <strong>
        {match.homeCode} vs {match.awayCode}
      </strong>
      <small>
        {formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
        {timeLabel(match)} · {match.city}
      </small>
    </button>
  );
}

function Filters(props) {
  const statusOptions = [
    ["all", "Todos"],
    ["live", "En vivo"],
    ["played", "Jugados"],
    ["upcoming", "Próximos"]
  ];

  return (
    <div className="filters">
      <div className="segmented" role="tablist" aria-label="Estado">
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
  const { liveMatch, events, loading: detailLoading, error } = useMatchFeed(match);
  const matchUrl = `${MATCH_CENTRE_BASE}/${match.competitionId}/${match.seasonId}/${match.stageId}/${match.id}`;
  const tabs = [
    ["datos", "Datos", ClipboardList],
    ["stats", "Estadísticas", BarChart3],
    ["formacion", "Formación", Shirt],
    ["cronologia", "Cronología", ListChecks]
  ];

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
          <button className="icon-button" onClick={refresh} disabled={loading} title="Actualizar">
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      {error && <div className="notice">{error}</div>}

      <section className="match-hero">
        <div className="match-context">
          <span className={`status-pill ${match.statusTone}`}>{match.statusLabel}</span>
          <span>Partido {match.matchNumber}</span>
          <span>{match.stage}</span>
          {match.group && <span>{match.group}</span>}
        </div>
        <div className="match-hero-score">
          <DetailTeam match={match} side="home" />
          <div className="hero-scoreline">
            <strong>
              {match.homeScore ?? "-"} : {match.awayScore ?? "-"}
            </strong>
            <span>
              {formatDate(match.date, { weekday: "short", day: "2-digit", month: "short" })} ·{" "}
              {timeLabel(match)}
            </span>
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
  const period = liveMatch?.MatchTime || (match.statusTone === "played" ? "Finalizado" : "Programado");

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
          {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
        </strong>
        <small>
          {match.homeCode} vs {match.awayCode}
        </small>
      </div>
      <div className="stat-card">
        <span>Minuto / periodo</span>
        <strong>{liveMatch?.MatchTime || (match.statusTone === "played" ? "FT" : "--")}</strong>
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

function teamFromLive(match, liveMatch, side) {
  if (side === "home") return liveMatch?.HomeTeam || match.raw.Home;
  return liveMatch?.AwayTeam || match.raw.Away;
}

function FormationView({ match, liveMatch }) {
  const home = teamFromLive(match, liveMatch, "home");
  const away = teamFromLive(match, liveMatch, "away");
  return (
    <div className="formation-grid">
      <TeamFormation title={match.homeName} code={match.homeCode} team={home} />
      <TeamFormation title={match.awayName} code={match.awayCode} team={away} />
    </div>
  );
}

function TeamFormation({ title, code, team }) {
  const players = team?.Players || [];
  const starters = players.filter((player) => player.Status === 1).slice(0, 11);
  const bench = players.filter((player) => player.Status !== 1).slice(0, 9);
  const visiblePlayers = starters.length ? starters : players.slice(0, 11);

  return (
    <section className="formation-card">
      <div className="formation-card-head">
        <div>
          <span>{code}</span>
          <h2>{title}</h2>
        </div>
        <strong>{team?.Tactics || "Formación TBC"}</strong>
      </div>
      {visiblePlayers.length ? (
        <div className="player-list">
          {visiblePlayers.map((player) => (
            <div className="player-row" key={player.IdPlayer || `${code}-${player.ShirtNumber}`}>
              <span>{player.ShirtNumber || "--"}</span>
              <strong>{playerName(player)}</strong>
              <small>
                {positionLabel(player.Position)}
                {player.Captain ? " · C" : ""}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="timeline-empty">FIFA todavía no publicó la formación de este equipo.</div>
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
