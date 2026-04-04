// @ts-check

// NOT CONNECTED YET THIS IS JUST A MOCKUP

// import mongoose from 'mongoose'
// const { Schema, model, models } = mongoose
//
// let cached = global.mongoose || (global.mongoose = { conn: null, promise: null })
//
// export const connectToDB = async () => {
//   if (cached.conn) return cached.conn
//
//   if (!cached.promise) {
//     cached.promise = mongoose
//       .connect(process.env.MONGODB_URI, {
//         dbName: 'locum',
//         bufferCommands: false,
//         connectTimeoutMS: 30000,
//       })
//       .then((instance) => {
//         mongoose.set('strictQuery', true)
//         return instance
//       })
//   }
//
//   cached.conn = await cached.promise
//   return cached.conn
// }
//
// const matchRunResultSchema = new Schema({
//   runId: { type: String, required: true },
//   physicianId: { type: String, required: true, index: true },
//   jobId: { type: String, required: true },
//   rank: { type: Number },
//   score: { type: Number, required: true },
//   breakdown: { type: Schema.Types.Mixed },
//   flags: { type: [String], default: [] },
//   isActive: { type: Boolean, default: true, index: true },
//   computedAt: { type: Date, default: Date.now },
//   notifiedAt: { type: Date, default: null },
// })
//
// const MatchRunResult = models.MatchRunResult || model('MatchRunResult', matchRunResultSchema)
//
// const OPEN_STATUSES = new Set(['Pending', 'Awaiting Payment'])
// const TOP_K = 5
//
// export async function getTopMatchesForPhysicianMongo(physicianId, { reservations }) {
//   await connectToDB()
//
//   const openJobIds = [...new Set(
//     reservations.filter((r) => OPEN_STATUSES.has(r.status)).map((r) => r.locumJobId)
//   )]
//
//   const results = await MatchRunResult
//     .find({
//       physicianId,
//       isActive: true,
//       jobId: { $in: openJobIds },
//     })
//     .sort({ score: -1 })
//     .limit(TOP_K)
//     .lean()
//
//   const totalOpenMatches = await MatchRunResult.countDocuments({
//     physicianId,
//     isActive: true,
//     jobId: { $in: openJobIds },
//   })
//
//   return { topMatches: results, totalOpenMatches }
// }
