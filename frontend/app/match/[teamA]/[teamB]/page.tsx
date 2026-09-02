import LiveMatch from "@/components/LiveMatch"
import { fetchGraphQL, GET_MATCH_TEAMS_QUERY } from "@/lib/wordpress"

interface PageProps {
  params: Promise<{ teamA: string; teamB: string }>
}

export default async function MatchPage({ params }: PageProps) {
  const { teamA, teamB } = await params

  const wpData = await fetchGraphQL(GET_MATCH_TEAMS_QUERY, {
    teamASlug: teamA,
    teamBSlug: teamB,
  })

  const initialMatchData = {
    teamA: {
      name: wpData?.teamA?.title || teamA,
      logo:
        wpData?.teamA?.teamInfo?.logo?.node?.sourceUrl || "/fallback-logo.svg",
      score: 0,
    },
    teamB: {
      name: wpData?.teamB?.title || teamB,
      logo:
        wpData?.teamB?.teamInfo?.logo?.node?.sourceUrl || "/fallback-logo.svg",
      score: 0,
    },
    currentMap: "Haven",
  }

  const matchId = `match-${teamA}-${teamB}`

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 sm:px-6">
      <LiveMatch matchId={matchId} initialMatchData={initialMatchData} />
    </main>
  )
}
