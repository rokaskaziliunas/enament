# Esports Live Hub

A local full-stack esports live-score application built with a headless WordPress CMS, Next.js, a Node.js Socket.IO service, and MongoDB.

The application has two kinds of data:

- **Content data** comes from WordPress through WPGraphQL. This includes team names, slugs, and logos.
- **Live and historical match data** is generated or received by the Node.js service. It is broadcast to browsers over Socket.IO and stored in MongoDB.

## Architecture

```text
                        WPGraphQL
                            |
                            v
+----------------+    HTTP/GraphQL    +----------------+
| WordPress +    | -----------------> | Next.js        |
| ACF            |                    | frontend       |
+----------------+                    +-------+--------+
                                              |
                                      Socket.IO/WebSocket
                                              |
                                              v
                                      +-------+--------+
                                      | Node.js server |
                                      | Express        |
                                      | Socket.IO      |
                                      +---+--------+---+
                                          |        ^
                              MongoDB save |        | active match list
                                          v        |
                                      +---+--------+---+
                                      | MongoDB          |
                                      | match history    |
                                      +------------------+

                                      +------------------+
                                      | Telemetry emitter|
                                      | Node.js/tsx       |
                                      +------------------+
```

## Responsibilities

### WordPress CMS

WordPress is the content source for teams. The project uses:

- WordPress
- WPGraphQL
- Advanced Custom Fields (ACF)
- WPGraphQL for ACF

The Team custom post type must expose the `Team Info` field group in GraphQL. The relevant ACF fields are:

- `logo`, returned as a media connection
- `tag`
- `region`

The frontend currently uses this GraphQL shape:

```graphql
team(id: $teamASlug, idType: SLUG) {
  title
  teamInfo {
    logo {
      node {
        sourceUrl
      }
    }
  }
}
```

### Next.js frontend

The frontend renders the match page and subscribes to real-time updates.

Important files:

- `frontend/app/page.tsx`: home page with match links
- `frontend/app/match/[teamA]/[teamB]/page.tsx`: server-rendered match route
- `frontend/components/LiveMatch.tsx`: live score UI
- `frontend/hooks/useSocket.ts`: Socket.IO client hook
- `frontend/lib/wordpress.ts`: WPGraphQL client and team query
- `frontend/next.config.ts`: local remote-image configuration

### Node.js server

The Node service is responsible for:

- Socket.IO connections and match rooms
- Tracking which matches are currently viewed
- Receiving telemetry from the emitter
- Saving telemetry to MongoDB
- Broadcasting saved telemetry to the correct browser room

The server runs on port `4000`.

### Telemetry emitter

`server/emit-server.ts` is a development simulator. It polls the server for currently viewed matches, fetches the corresponding team names from WordPress, and generates a score update every three seconds.

It does not use hard-coded team arguments. It discovers active match IDs from:

```text
GET http://localhost:4000/api/active-matches
```

This means opening a match in the browser is enough to start its simulation.

### MongoDB

MongoDB is the persistent store for match history. It is accessed only by the Node server, never by browser code.

Important files:

- `server/db.ts`: MongoDB connection
- `server/models/Match.ts`: match document and telemetry snapshot schemas

## Data Flow

### Initial page load

For a URL such as:

```text
http://localhost:3000/match/rana-verona/club-voleibol-emeve
```

Next.js:

1. Reads `teamA` and `teamB` from the route.
2. Queries WordPress using those slugs.
3. Receives team titles and ACF logo URLs.
4. Builds the stable match ID:

```text
match-rana-verona-club-voleibol-emeve
```

5. Renders the live panel with both scores initially set to `0`.
6. Connects the browser to the Node Socket.IO server.
7. Joins the matching Socket.IO room.

### Live update

The emitter sends a request to the Node server:

```http
POST /api/broadcast-telemetry
Content-Type: application/json
```

```json
{
  "matchId": "match-rana-verona-club-voleibol-emeve",
  "telemetryData": {
    "teamAScore": 4,
    "teamBScore": 6,
    "currentMap": "Haven"
  }
}
```

The server then:

1. Validates the match ID and scores.
2. Upserts the match document in MongoDB.
3. Appends a timestamped telemetry snapshot.
4. Broadcasts `telemetry_update` to the room.
5. The browser updates the React state and UI.

The broadcast happens after the database operation succeeds.

### Navigation and active matches

Each browser socket is associated with one match. When the user changes pages:

- The old match room is left.
- The socket is disconnected.
- The server removes the viewer from the old match.
- The emitter stops the old simulation when no browser is viewing it.

The server counts viewers, so one viewer leaving does not deactivate a match that is still open in another browser tab.

## MongoDB Match Schema

Each match is stored as one document:

```ts
{
  matchId: string,
  teamASlug: string,
  teamBSlug: string,
  teamAScore: number,
  teamBScore: number,
  currentMap: string,
  status: "LIVE" | "COMPLETED",
  startedAt: Date,
  completedAt?: Date,
  history: [
    {
      teamAScore: number,
      teamBScore: number,
      currentMap: string,
      recordedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

The history array stores the latest 1,000 snapshots for each match. A match becomes `COMPLETED` when either team reaches `13`.

The current frontend does not display historical matches yet. MongoDB currently provides persistence for future history pages, result pages, charts, or statistics.

## Requirements

Install the following before starting:

- Docker Desktop with Docker Compose
- Node.js 20 or newer recommended
- npm
- A reachable MongoDB database, such as MongoDB Atlas
- A modern browser

## Configuration

### Frontend environment

Create or update `frontend/.env.local`:

```env
NEXT_PUBLIC_WORDPRESS_API_URL=http://localhost:8000/graphql
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Variables prefixed with `NEXT_PUBLIC_` are available to browser code. Do not put database credentials in this file.

### Server environment

Create `server/.env` using `server/.env.example` as a template:

```env
MONGO_DB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
```

`MONGO_DB_URI` is server-only. Never commit `server/.env` or expose this value with the `NEXT_PUBLIC_` prefix.

If a real credential was ever placed in a public or client-exposed environment file, rotate that MongoDB password and review the Atlas user permissions.

## WordPress Setup

The local WordPress files are in `cms/wp-data`.

The project expects:

1. A `team` custom post type.
2. WPGraphQL enabled.
3. Advanced Custom Fields enabled.
4. WPGraphQL for ACF enabled.
5. The Team ACF field group configured with:
   - Location: post type is `team`
   - GraphQL exposure enabled
   - GraphQL field name: `teamInfo`
6. The logo image field configured with:
   - Field name: `logo`
   - GraphQL exposure enabled
   - Image return format: Array
7. Each team has a logo assigned in the `logo` field.

The ACF image response should be queryable as:

```graphql
teamInfo {
  logo {
    node {
      sourceUrl
    }
  }
}
```

The frontend uses `/fallback-logo.svg` if a team has no assigned logo.

## Installation

Install the frontend dependencies:

```powershell
cd frontend
npm install
```

Install the server dependencies:

```powershell
cd server
npm install
```

## Running the Project

Run each service in a separate terminal.

### 1. Start WordPress

From the project root:

```powershell
cd cms
docker compose up
```

WordPress will be available at:

```text
http://localhost:8000
```

The GraphQL endpoint is:

```text
http://localhost:8000/graphql
```

### 2. Start the Node.js server

```powershell
cd server
npm run dev
```

The server will be available at:

```text
http://localhost:4000
```

It should print:

```text
WebSocket Engine running on port 4000
```

### 3. Start the Next.js frontend

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

### 4. Start the telemetry emitter

```powershell
cd server
npx tsx emit-server.ts
```

The emitter waits until a match page is open. When it detects one, it prints the WordPress team names and starts sending score updates.

## Available Scripts

### Frontend

Run from `frontend`:

```powershell
npm run dev
npm run build
npm run start
npm run lint
```

### Server

Run from `server`:

```powershell
npm run dev
```

The server `test` script is currently a placeholder and does not run automated tests.

## API Reference

### `GET /api/active-matches`

Returns match IDs currently viewed by at least one connected browser:

```json
{
  "matchIds": [
    "match-rana-verona-club-voleibol-emeve"
  ]
}
```

### `POST /api/broadcast-telemetry`

Validates, saves, and broadcasts match telemetry.

Request:

```json
{
  "matchId": "match-team-a-team-b",
  "telemetryData": {
    "teamAScore": 3,
    "teamBScore": 2,
    "currentMap": "Haven"
  }
}
```

Success:

```json
{
  "success": true
}
```

Invalid input returns HTTP `400`. A MongoDB connection or save failure returns HTTP `503`.

### Socket.IO events

Client to server:

```text
join_match(matchId)
leave_match(matchId)
```

Server to client:

```text
telemetry_update(telemetryData)
```

## Troubleshooting

### The frontend is at the top-left

The match route must render the panel inside its full-screen centered `<main>` wrapper. Check:

```text
frontend/app/match/[teamA]/[teamB]/page.tsx
```

### Scores do not update

Check the following:

1. The Node server is running on port `4000`.
2. `NEXT_PUBLIC_SOCKET_URL` is set correctly.
3. The browser console shows a successful Socket.IO connection.
4. The server reports that the browser joined the expected room.
5. The emitter is running.
6. The emitter is using the same active match ID shown by `/api/active-matches`.
7. MongoDB is reachable, because the server saves before broadcasting.

### The emitter says no match is active

Open a match page first. Then request:

```powershell
Invoke-RestMethod http://localhost:4000/api/active-matches
```

The response should contain the match ID.

### Team names or logos are missing

Check the WordPress GraphQL endpoint and confirm the team slugs exist. Verify that the ACF group is named `teamInfo` in GraphQL and that the logo query returns `sourceUrl`.

### Logos show the fallback image

The team exists, but its ACF `logo` field is empty or the image URL cannot be loaded. Assign a logo in WordPress and verify that the uploaded file is available under `/wp-content/uploads/`.

### MongoDB errors

Check:

- `server/.env` exists.
- `MONGO_DB_URI` is spelled correctly.
- The MongoDB user has access to the selected database.
- Your current IP address is allowed in MongoDB Atlas Network Access.
- The database is reachable from the machine running the Node server.

### Port already in use

The default ports are:

- WordPress: `8000`
- Next.js: `3000`
- Node.js server: `4000`

Stop the process using the port or update the corresponding application configuration and environment variable.

## Security Notes

- Keep MongoDB credentials in `server/.env` only.
- Do not commit `.env` files.
- Rotate credentials that have been exposed.
- Restrict MongoDB Atlas access instead of allowing every IP in production.
- Add authentication and request authorization before exposing the telemetry endpoint publicly.
- Add rate limiting and stricter telemetry validation before production use.
- Replace the simulated emitter with an authenticated real telemetry producer for live deployment.

## Current Limitations

- The emitter is a simulator and uses random score increments.
- The match page defaults the map to `Haven`.
- The home page currently contains manually defined match links.
- There is no frontend match-history page yet.
- There is no API endpoint for reading historical matches yet.
- The server does not currently authenticate telemetry requests.
- The server stores up to 1,000 snapshots per match rather than an unlimited event stream.

## Suggested Next Steps

1. Add `GET /api/matches/:matchId` to read saved history.
2. Add a match-history page in Next.js.
3. Move match and tournament listings into WordPress instead of hard-coded home-page links.
4. Add authentication between the emitter and Node server.
5. Add automated tests for match lifecycle, room membership, telemetry validation, and MongoDB persistence.
6. Add a real telemetry adapter in place of the random emitter.

## Project Structure

```text
.
├── README.md
├── cms/
│   ├── docker-compose.yml
│   └── wp-data/
├── frontend/
│   ├── app/
│   │   ├── match/[teamA]/[teamB]/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/LiveMatch.tsx
│   ├── hooks/useSocket.ts
│   ├── lib/wordpress.ts
│   ├── next.config.ts
│   └── package.json
└── server/
    ├── db.ts
    ├── emit-server.ts
    ├── models/Match.ts
    ├── server.ts
    ├── .env.example
    └── package.json
```
