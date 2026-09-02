export async function fetchGraphQL(query: string, variables = {}) {
  const res = await fetch(
    process.env.NEXT_PUBLIC_WORDPRESS_API_URL ||
      "http://localhost:8000/graphql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 60 }, // Cache CMS data for 60 seconds
    },
  )

  const json = await res.json()
  if (json.errors) {
    throw new Error("Failed to fetch WordPress API")
  }

  return json.data
}

// Query to pull Team A and Team B data from WPGraphQL
export const GET_MATCH_TEAMS_QUERY = `
  query GetMatchTeams($teamASlug: ID!, $teamBSlug: ID!) {
    teamA: team(id: $teamASlug, idType: SLUG) {
      title
      teamInfo {
        logo {
          node {
            sourceUrl
          }
        }
      }
    }
    teamB: team(id: $teamBSlug, idType: SLUG) {
      title
      teamInfo {
        logo {
          node {
            sourceUrl
          }
        }
      }
    }
  }
`
