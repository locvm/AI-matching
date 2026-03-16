import { PROVINCES_CANADA } from "@/constants";
import { ONBOARDING_DISCOVERY_SOURCES } from "@/constants/onboarding";
import { Schema, model, models } from "mongoose";

// Define the nested address schema
const AddressSchema = new Schema({
  streetNumber: { type: String },
  streetName: { type: String },
  postalCode: { type: String },
  city: { type: String },
  province: { type: String },
  country: { type: String },
});

const UserSchema = new Schema({
  // Personal Information
  firstName: {
    type: String,
    default: "",
  },
  lastName: {
    type: String,
    default: "",
  },
  languages: {
    type: [String],
    default: [],
  },
  dateOfBirth: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other", "Prefer not to say"],
  },
  email: {
    type: String,
    unique: [true, "Email already exists!"],
    required: [true, "Email is required!"],
  },
  cellPhone: {
    type: String,
  },
  personalAddress: {
    type: String,
  },
  profileUrl: {
    type: String,
    // Remove default - allow null/undefined
  },
  bio: {
    type: String,
  },

  // Work Information

  facilityName: {
    type: String,
  },
  facilityEMR: {
    type: String,
  },
  officeDetails: {
    type: String,
  },
  workAddress: {
    type: AddressSchema,
    default: {},
  },
  workPhone: {
    type: String,
  },
  faxNumber: {
    type: String,
  },
  primaryContact: {
    type: String,
  },
  contactTitle: {
    type: String,
  },
  contactEmail: {
    type: String,
  },

  // Medical Information
  medProfession: {
    type: String,
    enum: {
      values: ["Physician", "Recruiter"],
      message: "Profession must be either 'Physician' or 'Recruiter'",
    },
  },
  medSpeciality: {
    type: String,
  },
  medicalCertification: {
    type: String,
  },
  medicalProvince: {
    type: String,
    enum: PROVINCES_CANADA,
  },
  residentCheck: {
    type: Boolean,
  },
  fellowCheck: {
    type: Boolean,
  },
  medicalStudentCheck: {
    type: Boolean,
  },
  yearOfResidency: {
    type: String,
  },
  emrSystems: {
    type: [String],
    default: [],
  },

  // Recruiter Information
  linkedInUrl: {
    type: String,
  },
  recruiterStatus: {
    type: String,
    enum: ["None", "Pending", "Confirmed", "Rejected"],
    default: "None",
  },

  //CPSO Information
  CPSOProof: {
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rejected"],
      default: "Pending",
    },
    filePath: {
      type: String,
    },
    fileName: {
      type: String,
    },
    verifiedAt: { type: Date },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },

  // Payment Information
  paymentDataConfirmation: {
    type: Boolean,
    default: false,
  },
  discoverySource: {
    type: String,

    default: undefined,
    enum: ONBOARDING_DISCOVERY_SOURCES,
  },

  // Reservations
  reservationsList: {
    createdLocums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Reservation",
      },
    ],
    reservedLocums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Reservation",
      },
    ],
    appliedLocums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Reservation",
      },
    ],
    completedLocums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Reservation",
      },
    ],
    savedLocums: [
      {
        type: Schema.Types.ObjectId,
        ref: "LocumJob",
      },
    ],
    matchedLocums: [
      {
        _id: false,
        jobId: {
          type: Schema.Types.ObjectId,
          ref: "LocumJob",
        },
        suggestedAt: {
          type: Date,
          default: Date.now,
        },
        feedback: {
          type: String,
          enum: ["like", "dislike", null],
          default: null,
        },
        feedbackAt: {
          type: Date,
        },
        unmatched: {
          type: Boolean,
          default: false,
        },
        unmatchedAt: {
          type: Date,
        },
      },
    ],
  },

  // Preferences
  preferences: {
    isLookingForLocums: {
      type: Boolean,
      default: undefined,
    },
    preferredProvinces: {
      type: [String],
      default: undefined,
    },
    specificRegions: {
      type: [String],
      default: undefined,
    },
    availabilityTypes: {
      type: [String],
      default: undefined,
    },
    availabilityYears: {
      type: [String],
      default: undefined,
    },
    availabilityDateRanges: [
      {
        fromMonth: String,
        fromYear: String,
        toMonth: String,
        toYear: String,
      },
    ],
    locumDurations: {
      type: [String],
      default: undefined,
    },
  },

  // Account and Profile Information
  onboardingStep: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  isOnboardingCompleted: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["Admin", "User"],
    default: "User",
  },
  firebaseUid: {
    type: String,
    required: true,
  },
  isProfileComplete: {
    type: Boolean,
    default: false,
  },

  privacyConsent: {
    type: Boolean,
    default: false,
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  modifiedAt: {
    type: Date,
  },
});

const User = models.User || model("User", UserSchema);

export default User;
