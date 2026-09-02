import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Esports Live Hub</h1>
      <p className="text-gray-400 mb-8">
        Select a match to view live telemetry:
      </p>

      <div className="flex gap-4">
        <Link
          href="/match/rana-verona/club-voleibol-emeve"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition"
        >
          Rana Verona vs Club Voleibol Emeve
        </Link>
        <Link
          href="/match/galdakao-bt/rana-verona"
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition"
        >
          Galdakao BT vs Rana Verona
        </Link>
      </div>
    </main>
  )
}
