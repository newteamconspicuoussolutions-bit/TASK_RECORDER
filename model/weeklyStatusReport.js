const mongoose = require('mongoose');

const weeklyStatusReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    duration: {
      type: String, // W10
      required: true,
      trim: true,
    },

    leaveInfo: {
      type: [String],
      default: [],
    },

    attendanceEvents: [
      {
        type: {
          type: String,
          enum: ['early-leave', 'late-arrival'],
          required: true,
        },
        date: {
          type: Date,
          required: true,
        },
        time: {
          type: String, // stored as "HH:MM" (24hr)
          required: true,
        },
        reason: {
          type: String,
          trim: true,
          default: '',
        },
      },
    ],

    tasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('WeeklyStatusReport', weeklyStatusReportSchema);
