import { Schema, model, models } from 'mongoose'

// Define the schema for job history entries
const reservationSchema = new Schema({
  locumJobId: {
    type: Schema.Types.ObjectId,
    ref: 'LocumJob',
    required: true,
  },
  // DEPRECATED: Legacy field from 1-to-1 booking model (pre-Open Lobby)
  // In the new system, rejection reasons are stored in applicants[].applicationLog[].note
  // This field is no longer written to or read from, but kept for backward compatibility
  // with old reservation data. Can be safely removed after data migration.
  // negativeResponseStatus: {
  //   status: {
  //     type: String,
  //     enum: ["Cancelled", "Rejected"],
  //   },
  //   reason: {
  //     rejectedUser: {
  //       type: Schema.Types.ObjectId,
  //       ref: "User",
  //     },
  //     rejectionReason: {
  //       type: String,
  //     },
  //   },
  // },
  status: {
    type: String,
    enum: ['Pending', 'Requested', 'Awaiting Payment', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Expired'],
    default: 'Pending',
    required: true, //TODO: add drafts
  },
  reservationDate: {
    from: {
      type: Date,
    },
    to: {
      type: Date,
    },
  },
  reservationDetails: {
    facilityName: {
      type: String,
    },
    creatorName: {
      type: String,
    },
    creatorImg: {
      type: String,
    },
    fullAddress: {
      streetNumber: {
        type: String,
      },
      streetName: {
        type: String,
      },
      city: {
        type: String,
      },
      province: {
        type: String,
      },
      country: {
        type: String,
      },
      postalCode: {
        type: String,
      },
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
    },
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  reservedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  simpleJobIdForUser: {
    type: String,
    required: true,
  },

  dateModified: {
    type: Date,
    default: Date.now,
  },
  reviewId: {
    type: Schema.Types.ObjectId,
    ref: 'Review',
  },

  transactionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  reviewsCompleted: {
    type: Boolean,
    default: false,
  },

  smartMatching: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  applicants: {
    type: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        // Quick-access field for UI badges and filtering
        currentApplicationStage: {
          type: String,
          enum: ['Applied', 'Selected', 'Archived', 'Withdrawn', 'Cancelled'],
          required: true,
        },
        applicationLog: [
          {
            event: {
              type: String,
              enum: ['Applied', 'Selected', 'Archived', 'Withdrawn', 'Cancelled'],
              required: true,
            },
            at: { type: Date, required: true, default: Date.now },
            note: { type: String },
          },
        ],
      },
    ],
    default: [],
  },
})

// Pre-save hook to ensure currentApplicationStage matches the last log entry
reservationSchema.pre('save', async function () {
  // Only run if applicants array was modified to avoid unnecessary iterations
  if (!this.isModified('applicants')) {
    return
  }

  if (this.applicants && Array.isArray(this.applicants)) {
    this.applicants.forEach((applicant) => {
      if (
        applicant &&
        applicant.applicationLog &&
        Array.isArray(applicant.applicationLog) &&
        applicant.applicationLog.length > 0
      ) {
        const lastLogEntry = applicant.applicationLog[applicant.applicationLog.length - 1]
        if (lastLogEntry && lastLogEntry.event) {
          applicant.currentApplicationStage = lastLogEntry.event
        }
      }
    })
  }
})

// Reviews should only be created when status changes to "Completed"

const Reservation = models.Reservation || model('Reservation', reservationSchema)

export default Reservation
