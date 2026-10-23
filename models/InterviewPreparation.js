
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
  },

  answer: {
    type: String,
    default: "",
    trim: true,
  },

  category: {
    type: String,
    default: "Technical",
    trim: true,
  },

  isPracticed: {
    type: Boolean,
    default: false,
  },
});

const revisionTopicSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    trim: true,
  },

  isCompleted: {
    type: Boolean,
    default: false,
  },
});

const interviewPreparationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },

    interviewDate: {
      type: Date,
      default: null,
    },

    interviewType: {
      type: String,
      enum: ["Technical", "HR", "Assessment", "Other"],
      default: "Technical",
    },

    questions: [questionSchema],

    preparationNotes: {
      type: String,
      default: "",
      trim: true,
    },

    revisionTopics: [revisionTopicSchema],
  },
  {
    timestamps: true,
  }
);

interviewPreparationSchema.index(
  { user: 1, application: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "InterviewPreparation",
  interviewPreparationSchema
);
