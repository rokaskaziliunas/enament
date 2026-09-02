import { Schema, model, models } from "mongoose"

export interface TelemetrySnapshot {
  teamAScore: number
  teamBScore: number
  currentMap: string
  recordedAt: Date
}

export interface MatchDocument {
  matchId: string
  teamASlug: string
  teamBSlug: string
  teamAScore: number
  teamBScore: number
  currentMap: string
  status: "LIVE" | "COMPLETED"
  startedAt: Date
  completedAt?: Date
  history: TelemetrySnapshot[]
  createdAt: Date
  updatedAt: Date
}

const telemetrySnapshotSchema = new Schema<TelemetrySnapshot>(
  {
    teamAScore: { type: Number, required: true, min: 0 },
    teamBScore: { type: Number, required: true, min: 0 },
    currentMap: { type: String, required: true },
    recordedAt: { type: Date, required: true },
  },
  { _id: false },
)

const matchSchema = new Schema<MatchDocument>(
  {
    matchId: { type: String, required: true, unique: true, index: true },
    teamASlug: { type: String, required: true, index: true },
    teamBSlug: { type: String, required: true, index: true },
    teamAScore: { type: Number, default: 0, min: 0 },
    teamBScore: { type: Number, default: 0, min: 0 },
    currentMap: { type: String, default: "Map 1" },
    status: {
      type: String,
      enum: ["LIVE", "COMPLETED"],
      default: "LIVE",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    history: { type: [telemetrySnapshotSchema], default: [] },
  },
  { timestamps: true },
)

export const Match = models.Match || model<MatchDocument>("Match", matchSchema)
