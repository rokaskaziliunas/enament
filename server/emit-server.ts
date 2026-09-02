const WP_GRAPHQL_URL =
  process.env.WORDPRESS_API_URL || "http://localhost:8000/graphql"
const SERVER_URL = "http://localhost:4000"

const GET_MATCH_TEAMS_QUERY = `
  query GetMatchTeams($teamASlug: ID!, $teamBSlug: ID!) {
    teamA: team(id: $teamASlug, idType: SLUG) {
      title
      slug
    }
    teamB: team(id: $teamBSlug, idType: SLUG) {
      title
      slug
    }
  }
`

async function fetchMatchTeamsFromWP(slugA: string, slugB: string) {
  try {
    const response = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GET_MATCH_TEAMS_QUERY,
        variables: { teamASlug: slugA, teamBSlug: slugB },
      }),
    })

    const json = await response.json()
    return {
      teamA: json.data?.teamA || { title: slugA, slug: slugA },
      teamB: json.data?.teamB || { title: slugB, slug: slugB },
    }
  } catch (error) {
    console.warn(
      "Could not fetch teams from WP GraphQL, using provided slugs as fallbacks.",
    )
    return {
      teamA: { title: slugA, slug: slugA },
      teamB: { title: slugB, slug: slugB },
    }
  }
}

interface MatchSimulation {
  interval: ReturnType<typeof setInterval>
  teamATitle: string
  teamBTitle: string
  teamAScore: number
  teamBScore: number
}

const simulations = new Map<string, MatchSimulation>()
const simulationsStarting = new Set<string>()

async function startSimulation(matchId: string) {
  const slugs = matchId.match(/^match-(.+)-(.+)$/)
  if (!slugs || simulations.has(matchId) || simulationsStarting.has(matchId)) return

  simulationsStarting.add(matchId)
  const [, teamASlug, teamBSlug] = slugs
  try {
    const { teamA, teamB } = await fetchMatchTeamsFromWP(teamASlug, teamBSlug)

    if (simulations.has(matchId)) return

    const simulation: MatchSimulation = {
      interval: setInterval(() => undefined, 0),
      teamATitle: teamA.title,
      teamBTitle: teamB.title,
      teamAScore: 0,
      teamBScore: 0,
    }

    simulation.interval = setInterval(async () => {
      if (Math.random() > 0.5) {
        simulation.teamAScore += 1
      } else {
        simulation.teamBScore += 1
      }

      try {
        await fetch(`${SERVER_URL}/api/broadcast-telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            telemetryData: {
              teamAScore: simulation.teamAScore,
              teamBScore: simulation.teamBScore,
              currentMap: "Haven",
            },
          }),
        })

        console.log(
          `Emitting update -> ${simulation.teamATitle}: ${simulation.teamAScore} | ${simulation.teamBTitle}: ${simulation.teamBScore}`,
        )
      } catch (error) {
        console.error(`Failed to post telemetry for ${matchId}:`, error)
      }

      if (simulation.teamAScore >= 13 || simulation.teamBScore >= 13) {
        clearInterval(simulation.interval)
        simulations.delete(matchId)
        console.log(`Match simulation complete: ${matchId}`)
      }
    }, 3000)

    simulations.set(matchId, simulation)
    console.log(
      `Starting simulation: ${teamA.title} vs ${teamB.title} (${matchId})`,
    )
  } finally {
    simulationsStarting.delete(matchId)
  }
}

async function syncSimulations() {
  try {
    const response = await fetch(`${SERVER_URL}/api/active-matches`)
    const { matchIds } = (await response.json()) as { matchIds: string[] }
    const activeMatchIds = new Set(matchIds)

    for (const matchId of activeMatchIds) {
      await startSimulation(matchId)
    }

    for (const [matchId, simulation] of simulations) {
      if (!activeMatchIds.has(matchId)) {
        clearInterval(simulation.interval)
        simulations.delete(matchId)
        console.log(`Stopped simulation; no browser is viewing ${matchId}`)
      } else {
        continue
      }
    }
  } catch (error) {
    console.error("Could not read active matches:", error)
  }
}

console.log("Telemetry emitter is waiting for an open match...")
setInterval(() => void syncSimulations(), 2000)
void syncSimulations()
