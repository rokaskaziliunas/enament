"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { useSocket, TelemetryPayload } from "@/hooks/useSocket"

export interface TeamData {
  name: string
  logo: string
  score: number
}

export interface MatchDataProps {
  matchId: string
  initialMatchData: {
    teamA: TeamData
    teamB: TeamData
    currentMap: string
  }
}

export default function LiveMatch({
  matchId,
  initialMatchData,
}: MatchDataProps) {
  const [matchState, setMatchState] = useState(initialMatchData)

  const handleTelemetryUpdate = useCallback((data: TelemetryPayload) => {
    setMatchState((prev) => ({
      ...prev,
      teamA: {
        ...prev.teamA,
        score: data.teamAScore ?? prev.teamA.score,
      },
      teamB: {
        ...prev.teamB,
        score: data.teamBScore ?? prev.teamB.score,
      },
      currentMap: data.currentMap || prev.currentMap,
    }))
  }, [])

  useSocket(matchId, handleTelemetryUpdate)

  return (
    <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-slate-950/40">
      <div className="flex items-center justify-center gap-2 border-b border-slate-800 px-5 py-4">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-bold uppercase tracking-widest text-red-400">
          Live
        </span>
        <span className="text-xs text-slate-500">{matchState.currentMap}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-7 sm:gap-8 sm:px-10">
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/80 p-3 sm:h-24 sm:w-24">
            <Image
              src={matchState.teamA.logo}
              alt={matchState.teamA.name}
              width={64}
              height={64}
              unoptimized
              className="h-full w-full object-contain"
            />
          </div>
          <span className="line-clamp-2 min-h-10 max-w-36 text-sm font-semibold leading-5 text-slate-200 sm:text-base">
            {matchState.teamA.name}
          </span>
          <span className="mt-2 text-5xl font-black tabular-nums tracking-tight text-blue-400 sm:text-6xl">
            {matchState.teamA.score}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 pt-16">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
            vs
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/80 p-3 sm:h-24 sm:w-24">
            <Image
              src={matchState.teamB.logo}
              alt={matchState.teamB.name}
              width={64}
              height={64}
              unoptimized
              className="h-full w-full object-contain"
            />
          </div>
          <span className="line-clamp-2 min-h-10 max-w-36 text-sm font-semibold leading-5 text-slate-200 sm:text-base">
            {matchState.teamB.name}
          </span>
          <span className="mt-2 text-5xl font-black tabular-nums tracking-tight text-red-400 sm:text-6xl">
            {matchState.teamB.score}
          </span>
        </div>
      </div>
    </section>
  )
}
