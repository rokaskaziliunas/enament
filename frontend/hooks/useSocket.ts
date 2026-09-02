import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000"

export interface TelemetryPayload {
  teamAScore?: number
  teamBScore?: number
  currentMap?: string
  killsTeamA?: number
  killsTeamB?: number
  [key: string]: unknown
}

export const useSocket = (
  matchId?: string,
  onTelemetryUpdate?: (data: TelemetryPayload) => void,
) => {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL, {
      transports: ["websocket"],
    })

    socketRef.current = socket

    socket.on("connect", () => {
      console.log("Connected to WebSocket Engine:", socket.id)

      if (matchId) {
        socket.emit("join_match", matchId)
      }
    })

    socket.on("connect_error", (error) => {
      console.error("Socket connection failed:", error.message)
    })

    if (onTelemetryUpdate) {
      socket.on("telemetry_update", (data: TelemetryPayload) => {
        onTelemetryUpdate(data)
      })
    }

    return () => {
      if (matchId) {
        socket.emit("leave_match", matchId)
      }
      socket.disconnect()
      socketRef.current = null
    }
  }, [matchId, onTelemetryUpdate])

  return {
    getSocket: () => socketRef.current,
  }
}
