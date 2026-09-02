import "dotenv/config"
import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { connectDB } from "./db"
import { Match } from "./models/Match"

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

const activeMatches = new Set<string>()
const socketMatches = new Map<string, string>()
const matchViewers = new Map<string, number>()

function removeViewer(socketId: string) {
  const matchId = socketMatches.get(socketId)
  if (!matchId) return

  const viewers = (matchViewers.get(matchId) ?? 1) - 1
  if (viewers <= 0) {
    matchViewers.delete(matchId)
    activeMatches.delete(matchId)
  } else {
    matchViewers.set(matchId, viewers)
  }

  socketMatches.delete(socketId)
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on("join_match", (matchId: string) => {
    const previousMatchId = socketMatches.get(socket.id)
    if (previousMatchId && previousMatchId !== matchId) {
      removeViewer(socket.id)
      socket.leave(`match_${previousMatchId}`)
    }

    socket.join(`match_${matchId}`)
    activeMatches.add(matchId)
    socketMatches.set(socket.id, matchId)
    matchViewers.set(matchId, (matchViewers.get(matchId) ?? 0) + 1)
    console.log(`Socket ${socket.id} joined match_${matchId}`)
  })

  socket.on("leave_match", (matchId: string) => {
    socket.leave(`match_${matchId}`)
    if (socketMatches.get(socket.id) === matchId) {
      removeViewer(socket.id)
    }
  })

  socket.on("disconnect", () => {
    removeViewer(socket.id)
    console.log(`Client disconnected: ${socket.id}`)
  })
})

app.use(express.json())
app.get("/api/active-matches", (_req, res) => {
  res.json({ matchIds: [...activeMatches] })
})

app.post("/api/broadcast-telemetry", (req, res) => {
  const { matchId, telemetryData } = req.body

  if (typeof matchId !== "string" || !telemetryData) {
    res.status(400).json({ success: false, error: "Invalid telemetry payload" })
    return
  }

  const matchSlugs = matchId.match(/^match-(.+)-(.+)$/)
  const teamAScore = Number(telemetryData.teamAScore)
  const teamBScore = Number(telemetryData.teamBScore)

  if (
    !matchSlugs ||
    !Number.isFinite(teamAScore) ||
    !Number.isFinite(teamBScore) ||
    teamAScore < 0 ||
    teamBScore < 0
  ) {
    res.status(400).json({ success: false, error: "Invalid match telemetry" })
    return
  }

  const recordedAt = new Date()
  const status = teamAScore >= 13 || teamBScore >= 13 ? "COMPLETED" : "LIVE"

  void connectDB()
    .then(() =>
      Match.findOneAndUpdate(
        { matchId },
        {
          $set: {
            teamAScore,
            teamBScore,
            currentMap: telemetryData.currentMap || "Map 1",
            status,
            ...(status === "COMPLETED" ? { completedAt: recordedAt } : {}),
          },
          $setOnInsert: {
            teamASlug: matchSlugs[1],
            teamBSlug: matchSlugs[2],
            startedAt: recordedAt,
          },
          $push: {
            history: {
              $each: [
                {
                  teamAScore,
                  teamBScore,
                  currentMap: telemetryData.currentMap || "Map 1",
                  recordedAt,
                },
              ],
              $slice: -1000,
            },
          },
        },
        { upsert: true, new: true },
      ),
    )
    .then(() => {
      io.to(`match_${matchId}`).emit("telemetry_update", telemetryData)
      res.status(200).json({ success: true })
    })
    .catch((error) => {
      console.error("Could not save match telemetry:", error)
      res.status(503).json({ success: false, error: "Database unavailable" })
    })
})

httpServer.listen(4000, () => {
  console.log("WebSocket Engine running on port 4000")
})
