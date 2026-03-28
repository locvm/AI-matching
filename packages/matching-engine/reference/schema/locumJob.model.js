import { generateSlug } from '@/utils/utils'
import { Schema, model, models } from 'mongoose'

const LocumJobSchema = new Schema({
  postTitle: {
    type: String,

    // required: [true, "Title is required!"],
  },
  facilityName: {
    type: String,
    required: [true, 'Facility name is required!'],
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
      required: [true, 'City is required!'],
    },
    province: {
      type: String,
      default: 'Ontario',
      required: [true, 'Province is required!'],
    },
    country: {
      type: String,
      default: 'Canada',
      required: [true, 'Country is required!'],
    },
    postalCode: {
      type: String,
    },
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  locumPay: {
    type: String,
  },
  additionalPayInfo: {
    type: String,
  },
  instructions: {
    type: String,
  },
  notes: {
    type: String,
  },
  experience: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: [true],
  },
  modifiedAt: {
    type: Date,
    default: null,
  },
  dateRange: {
    from: {
      type: Date,
      required: [true, 'Start date is required!'],
    },
    to: {
      type: Date,
      required: [true, 'End date is required!'],
    },
  },

  practiceType: {
    type: [String],
  },
  patientType: {
    type: [String],
  },
  schedule: {
    type: String,
  },

  medProfession: {
    type: String,
    //required:[true, "Medical Profession is required."],
  },
  medSpeciality: {
    type: String,
  },

  facilityInfo: {
    emr: {
      type: String,
    },
  },

  cityImage: {
    type: String,
  },
  // jobType: {
  //   type: String,
  //   enum: ["FTE", "PT"],
  //   default: "FTE",
  //   required: false,
  // },
  isUsingJetpay: {
    type: Boolean,
    required: true,
  },
  isDepositRequested: {
    type: Boolean,
    required: true,
  },

  jobId: {
    type: String,
    required: true,
  },

  slug: {
    type: String,
  },

  isReviewed: {
    type: Boolean,
  },
  reservationId: {
    type: Schema.Types.ObjectId,
    ref: 'Reservation',
  },
  locumCreator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required!'],
  },
  isPostedByRecruiter: {
    type: Boolean,
    default: false,
    required: true,
  },
})

// Create 2dsphere index for geospatial queries
LocumJobSchema.index({ location: '2dsphere' })

// Pre-save hook to generate slug
LocumJobSchema.pre('save', async function () {
  const fieldsToCheck = ['postTitle', 'facilityName', 'fullAddress', 'jobId']
  const shouldGenerateSlug = this.isNew || fieldsToCheck.some((field) => this.isModified(field))

  if (shouldGenerateSlug) {
    try {
      this.slug = generateSlug(this.postTitle || this.facilityName, this.fullAddress?.city, this.jobId)
    } catch (error) {
      console.warn('Slug generation failed:', error.message)
    }
  }
})

//check if user exists if not create new
const LocumJob = models.LocumJob || model('LocumJob', LocumJobSchema)

export default LocumJob
