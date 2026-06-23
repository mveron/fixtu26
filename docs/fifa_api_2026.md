# API FIFA Mundial 2026

Documento de referencia creado a partir de la exploracion del sitio de FIFA para el fixture del Mundial 2026.

Estado: endpoints verificados en este workspace contra datos reales de FIFA. No parece ser una API publica documentada; son endpoints usados por el frontend de fifa.com y pueden cambiar sin aviso.

## Resumen

Hay tres familias de API utiles:

1. `cxm-api.fifa.com/fifaplusweb/api`
   - API de contenido del sitio.
   - Sirve paginas, articulos, labels y configuracion visual.
   - Util para descubrir secciones y recuperar el articulo original.
   - No es la mejor fuente para el fixture estructurado.

2. `api.fifa.com/api/v3`
   - API principal de datos de partidos FDCP.
   - Sirve fixture, match details, estado, marcador, equipos, estadio, alineaciones y timeline.
   - Es la fuente recomendada para la planilla.

3. `fdh-api.fifa.com/v1`
   - API de estadisticas agregadas y power ranking.
   - Sirve estadisticas de temporada.
   - En la prueba, los endpoints de estadistica por partido devolvieron `404`.

## IDs importantes

Para Copa Mundial FIFA 2026:

| Concepto | ID |
|---|---:|
| `IdCompetition` | `17` |
| `IdSeason` | `285023` |
| Match inaugural usado en pruebas | `400021443` |
| Final usada en pruebas | `400021543` |

Ejemplo de URL de match centre:

```text
https://www.fifa.com/es/match-centre/match/17/285023/289273/400021443
```

La estructura de esa URL es:

```text
/match-centre/match/{competitionId}/{seasonId}/{stageId}/{matchId}
```

## Fuente recomendada para fixture completo

```http
GET https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idSeason=285023
```

Respuesta observada:

```json
{
  "ContinuationToken": null,
  "ContinuationHash": null,
  "Results": []
}
```

En la prueba, `Results` devolvio los 104 partidos.

Campos importantes por partido:

| Campo | Descripcion |
|---|---|
| `IdMatch` | ID unico del partido. |
| `IdCompetition` | Competicion, `17` para Mundial masculino. |
| `IdSeason` | Temporada/torneo, `285023` para 2026. |
| `IdStage` | Fase. |
| `IdGroup` | Grupo, cuando aplica. |
| `MatchNumber` | Numero oficial del partido. |
| `Date` | Fecha/hora UTC ISO, por ejemplo `2026-06-11T19:00:00Z`. |
| `LocalDate` | Fecha/hora local si esta disponible. |
| `TimeDefined` | Booleano; indica si el horario esta confirmado. |
| `StageName` | Nombre localizado de la fase. |
| `GroupName` | Nombre localizado del grupo. |
| `Stadium` | Objeto con estadio, ciudad y pais. |
| `Home` / `Away` | Equipo local/visitante cuando ya esta definido. |
| `PlaceHolderA` / `PlaceHolderB` | Placeholder cuando el equipo aun no esta definido, por ejemplo `W101`. |
| `HomeTeamScore` / `AwayTeamScore` | Marcador final/base si existe. |
| `HomeTeamPenaltyScore` / `AwayTeamPenaltyScore` | Penales si existen. |
| `MatchStatus` | Codigo numerico de estado. |
| `ResultType` | Tipo de resultado. |
| `Officials` | Arbitros/oficiales si existen. |
| `Weather` | Clima si existe. |
| `Attendance` | Asistencia si existe. |
| `Properties` | Metadatos adicionales. |

Ejemplo de uso en Node:

```js
const url = "https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idSeason=285023";
const response = await fetch(url, { headers: { accept: "application/json" } });
const data = await response.json();
const matches = data.Results;

const fixture = matches.map((match) => ({
  matchId: match.IdMatch,
  matchNumber: match.MatchNumber,
  utcDate: match.Date,
  stage: match.StageName?.[0]?.Description ?? "",
  group: match.GroupName?.[0]?.Description ?? "",
  stadium: match.Stadium?.Name?.[0]?.Description ?? "",
  city: match.Stadium?.CityName?.[0]?.Description ?? "",
  home: match.Home?.TeamName?.[0]?.Description ?? match.PlaceHolderA ?? "",
  away: match.Away?.TeamName?.[0]?.Description ?? match.PlaceHolderB ?? "",
  homeScore: match.Home?.Score ?? match.HomeTeamScore ?? null,
  awayScore: match.Away?.Score ?? match.AwayTeamScore ?? null,
}));
```

## Obtener detalle de un partido

Endpoint recomendado:

```http
GET https://api.fifa.com/api/v3/live/football/{matchId}?language=es
```

Ejemplo:

```http
GET https://api.fifa.com/api/v3/live/football/400021443?language=es
```

Tambien respondio esta variante con IDs completos:

```http
GET https://api.fifa.com/api/v3/live/football/{competitionId}/{seasonId}/{stageId}/{matchId}?language=es
```

Ejemplo:

```http
GET https://api.fifa.com/api/v3/live/football/17/285023/289273/400021443?language=es
```

Campos adicionales observados:

| Campo | Descripcion |
|---|---|
| `HomeTeam` / `AwayTeam` | Equipos con `Players`, `Coaches`, tactica, score, bandera. |
| `Period` | Periodo actual/final. |
| `MatchTime` | Minuto textual, por ejemplo `98'`. |
| `BallPossession` | Posesion si esta disponible. |
| `Officials` | Oficiales. |
| `Weather` | Clima. |
| `Attendance` | Asistencia. |

Para partidos futuros este endpoint puede devolver una respuesta vacia o minima. Para esos casos, usar `calendar/matches` como fuente base.

### Campos utiles para visuales de jugadores

El endpoint `live/football/{matchId}` tambien entrega informacion util para mejorar la UI del detalle de partido:

| Campo | Descripcion |
|---|---|
| `HomeTeam.Tactics` / `AwayTeam.Tactics` | Formacion textual, por ejemplo `4-1-3-2`. |
| `HomeTeam.Players[]` / `AwayTeam.Players[]` | Lista de jugadores, titulares y suplentes. |
| `Players[].IdPlayer` | ID FIFA del jugador. Sirve para cruzar con timeline o stats. |
| `Players[].ShirtNumber` | Numero de camiseta. |
| `Players[].Position` | Codigo de posicion. `0` arquero, `1` defensa, `2` mediocampo, `3` delantero. |
| `Players[].Status` | Estado del jugador en la planilla. |
| `Players[].Captain` | Booleano para capitan. |
| `Players[].FieldStatus` | Estado de campo si esta disponible. |
| `Players[].PlayerPicture.PictureUrl` | URL de imagen del jugador en `digitalhub.fifa.com`. |
| `Players[].LineupX` / `Players[].LineupY` | Coordenadas de alineacion cuando FIFA las publica. En ARG vs AUT estaban vacias. |

Ejemplo real observado para ARG vs AUT (`IdMatch=400021494`):

```json
{
  "IdPlayer": "229397",
  "ShirtNumber": 10,
  "Captain": true,
  "PlayerPicture": {
    "PictureUrl": "https://digitalhub.fifa.com/transform/19823774-fac0-485a-8a8f-572e7324c6c2/MESSI-Lionel_229397"
  }
}
```

## Timeline de eventos

Endpoint:

```http
GET https://api.fifa.com/api/v3/timelines/{matchId}?language=es
```

Ejemplo:

```http
GET https://api.fifa.com/api/v3/timelines/400021443?language=es
```

Tambien respondio esta variante:

```http
GET https://api.fifa.com/api/v3/timelines/{competitionId}/{seasonId}/{stageId}/{matchId}?language=es
```

Ejemplo:

```http
GET https://api.fifa.com/api/v3/timelines/17/285023/289273/400021443?language=es
```

Respuesta observada:

```json
{
  "IdStage": "289273",
  "IdMatch": "400021443",
  "IdCompetition": "17",
  "IdSeason": "285023",
  "IdGroup": "289275",
  "Event": [],
  "Properties": {},
  "IsUpdateable": null
}
```

Campos importantes dentro de `Event`:

| Campo | Descripcion |
|---|---|
| `EventId` | ID del evento. |
| `IdTeam` | Equipo asociado, si aplica. |
| `IdPlayer` | Jugador asociado, si aplica. |
| `Timestamp` | Momento UTC del evento. |
| `MatchMinute` | Minuto mostrado. |
| `Period` | Periodo. |
| `HomeGoals` / `AwayGoals` | Marcador al momento del evento. |
| `Type` | Codigo numerico del tipo de evento. |
| `TypeLocalized` | Nombre localizado del tipo de evento. |
| `EventDescription` | Descripcion localizada. |
| `PositionX` / `PositionY` | Coordenadas si aplica. |
| `Qualifiers` | Metadatos del evento. |

Para partidos futuros, `Event` puede venir vacio.

### Estadisticas basicas derivables desde timeline

La pagina de FIFA del partido Argentina vs Austria muestra una pestana de estadisticas con bloques como ataque, posesion, disciplina, remates, pases y rupturas de linea. Esas estadisticas completas no aparecieron como objeto estructurado en `live/football/{matchId}` ni en `timelines/{matchId}`.

Sin embargo, `timelines/{matchId}` si permite derivar metricas basicas a partir de `Event[]`, agrupando por `Type` o `TypeLocalized` y por `IdTeam`.

Para ARG vs AUT (`IdMatch=400021494`) se observaron 81 eventos y se pudieron derivar:

| Metrica derivada | Argentina | Austria | Fuente |
|---|---:|---:|---|
| Goles | 2 | 0 | Timeline `TypeLocalized = ¡Gol!` |
| Remates registrados | 12 | 6 | Timeline `Type = 12` / `Remate a puerta` |
| Faltas | 12 | 12 | Timeline `Falta` |
| Corners | 1 | 3 | Timeline `Saque de esquina` |
| Amarillas | 2 | 2 | Timeline `Tarjeta amarilla` |
| Sustituciones | 5 | 5 | Timeline `Sustitución` |
| Fuera de juego | 2 | 0 | Timeline `Fuera de juego` |

Recomendacion para la app:

1. Mostrar primero estas estadisticas derivadas porque salen de endpoints accesibles.
2. Etiquetarlas internamente como "event stats" para no confundirlas con las estadisticas oficiales avanzadas de FIFA.
3. Mantener el tab preparado para incorporar estadisticas avanzadas si aparece un endpoint accesible y estable.
4. Usar `IdPlayer` del timeline para resaltar jugador, foto y nombre cuando coincida con `HomeTeam.Players[]` o `AwayTeam.Players[]`.

## Estadisticas de temporada

Power ranking de temporada:

```http
GET https://fdh-api.fifa.com/v1/powerranking/season/285023.json
```

Estadisticas de jugadores por temporada:

```http
GET https://fdh-api.fifa.com/v1/stats/season/285023/players.json
```

Respuesta de `players.json`:

```json
{
  "45191": [
    ["Assists", 0, true],
    ["AttemptAtGoal", 0, true]
  ]
}
```

Cada clave superior es un `IdPlayer`. Cada estadistica viene como:

```text
[nombreDeEstadistica, valor, isPostMatch]
```

## Endpoints probados que no conviene usar como fuente principal

Pagina/articulo:

```http
GET https://cxm-api.fifa.com/fifaplusweb/api/pages/es/tournaments/mens/worldcup/canadamexicousa2026/articles/calendario-fixture-mundial-2026-partidos-fechas
```

Articulo:

```http
GET https://cxm-api.fifa.com/fifaplusweb/api/sections/article/S9YG2JmeGYaMUCBbm0CcD?locale=es
```

Estos endpoints sirven para reconstruir el articulo visible, pero el fixture aparece como rich text y links, no como dataset completo.

Match details labels/config:

```http
GET https://cxm-api.fifa.com/fifaplusweb/api/sections/matchdetails/header?locale=es&competitionId=17&seasonId=285023&stageId=289273&matchId=400021443
GET https://cxm-api.fifa.com/fifaplusweb/api/sections/matchdetails/tabs?locale=es&competitionId=17&seasonId=285023&stageId=289273&matchId=400021443
GET https://cxm-api.fifa.com/fifaplusweb/api/sections/matchdetails/videos?locale=es&competitionId=17&seasonId=285023&stageId=289273&matchId=400021443
```

Estos endpoints devuelven labels y configuracion de UI, no el objeto del partido.

## Endpoints que fallaron o no filtraron bien

No usar para buscar un match puntual:

```http
GET https://api.fifa.com/api/v3/calendar/matches?IdMatch=400021443&language=es
GET https://api.fifa.com/api/v3/calendar/matches?idMatch=400021443&language=es
```

En la prueba devolvieron resultados no filtrados o no relacionados. Para un match puntual:

1. Usar `live/football/{matchId}` si se necesita detalle.
2. O descargar `calendar/matches?count=500&idSeason=285023` y filtrar localmente por `IdMatch`.

Estadisticas por partido en FDH:

```http
GET https://fdh-api.fifa.com/v1/stats/match/400021443/teams.json
GET https://fdh-api.fifa.com/v1/stats/match/400021443/players.json
GET https://fdh-api.fifa.com/v1/powerranking/match/400021443.json
```

En la prueba devolvieron `404`.

Para el partido Argentina vs Austria tambien se probaron:

```http
GET https://fdh-api.fifa.com/v1/stats/match/400021494/teams.json
GET https://fdh-api.fifa.com/v1/stats/match/400021494/players.json
GET https://fdh-api.fifa.com/v1/powerranking/match/400021494.json
```

Resultado observado: `404` en los tres endpoints.

## Gameday API observada en el frontend de FIFA

El bundle publico de `www.fifa.com` contiene referencias a una API Gameday:

```text
https://gameday-prod.fifa.mangodev.co.uk/1-0
```

El frontend incluye funciones internas equivalentes a:

```http
GET /events?query=_externalId==`{matchId}`
GET /events?query=(tag name==`urn:gd:tag:event:fdcp:match_id` value==`{matchId}`)
GET /keyMoments?query=(tag name==`urn:gd:tag:km:fifa:fdcp:match_id` value==`{matchId}`)
```

Tambien se observo que Gameday puede mapear estadisticas desde tags de participantes:

```text
participants.team.tags
urn:gd:tag:football:stats:...
urn:gd:tag:football:stats:unofficial
```

Pero al probarlo directamente desde este workspace:

```http
GET https://gameday-prod.fifa.mangodev.co.uk/1-0/events?query=_externalId%3D%3D%60400021494%60&limit=1
```

Resultado observado: `403 Forbidden`.

Conclusion: no conviene integrar Gameday directamente en la PWA hasta encontrar un acceso permitido y estable. Para produccion, usar `api.fifa.com/api/v3` y derivar estadisticas basicas desde timeline.

## Normalizacion recomendada

Funcion util para campos localizados:

```js
function localized(value, locale = "es-ES") {
  if (!Array.isArray(value)) return "";
  return (
    value.find((entry) => entry.Locale === locale)?.Description ??
    value[0]?.Description ??
    ""
  );
}
```

Funcion para obtener nombre de equipo o placeholder:

```js
function teamName(team, placeholder) {
  return localized(team?.TeamName) || team?.Abbreviation || placeholder || "";
}
```

Funcion para convertir fecha UTC:

```js
function formatInTimeZone(isoDate, timeZone = "America/Buenos_Aires") {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(isoDate));
}
```

## Flujo recomendado para actualizar una planilla

1. Descargar fixture completo:

```http
GET https://api.fifa.com/api/v3/calendar/matches?language=es&count=500&idSeason=285023
```

2. Filtrar/ordenar por `MatchNumber` o `Date`.

3. Para cada partido:
   - Usar `Home.TeamName` / `Away.TeamName` si existen.
   - Usar `PlaceHolderA` / `PlaceHolderB` si no hay equipos.
   - Guardar `IdMatch`, `IdStage`, `IdGroup` y link a match centre.
   - Convertir `Date` desde UTC a la zona horaria deseada.

4. Para partidos jugados o en vivo, enriquecer opcionalmente con:

```http
GET https://api.fifa.com/api/v3/live/football/{matchId}?language=es
GET https://api.fifa.com/api/v3/timelines/{matchId}?language=es
```

5. No depender de los endpoints `sections/matchdetails/*` para datos deportivos.

## Evidencia local de esta exploracion

Archivos utiles en el workspace:

| Archivo | Contenido |
|---|---|
| `api_probe/13_200.json` | Fixture completo de temporada con 104 partidos. |
| `api_probe/03_200.json` | Detalle `live/football` del partido `400021443`. |
| `api_probe/04_200.json` | Timeline del partido `400021443`. |
| `api_probe_stats/04_200.json` | Estadisticas de jugadores por temporada. |
| `api_probe_stats/05_200.json` | Power ranking de temporada. |
| `module_25276.txt` | Modulo frontend donde se ve `getMatch`, `getLiveMatch`, `getTimeline`. |
| `module_39442.txt` | Modulo frontend de scores/fixtures. |
| `module_53891.txt` | Modulo frontend de estadisticas FDH. |

## Notas de riesgo

- Estos endpoints no parecen tener contrato publico estable.
- FIFA puede cambiar paths, parametros o estructura de campos.
- Algunos campos solo aparecen cuando el partido ya fue jugado o esta en vivo.
- `Date` esta en UTC; para uso local hay que convertir zona horaria.
- El fixture del articulo y el fixture de `calendar/matches` pueden diferir si FIFA actualiza datos; priorizar `calendar/matches`.
