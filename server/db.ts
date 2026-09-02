import mongoose from "mongoose"

const mongoUri = process.env.MONGO_DB_URI

let connectionPromise: Promise<typeof mongoose> | null = null

export function connectDB(): Promise<typeof mongoose> {
  if (!mongoUri) {
    throw new Error("MONGO_DB_URI is not configured")
  }

  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose)
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
  }

  return connectionPromise
}
