const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose').default;

const USER_ID_SUFFIX = '@conspicuous.com';

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['employee', 'admin', 'ex-employee'],
      default: 'employee',
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    pushSubscription: {
      type: Object,
      default: null,
    },
    sessionToken: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (this.isNew || this.isModified('userId')) {
    if (!this.userId.endsWith(USER_ID_SUFFIX)) {
      this.userId = `${this.userId.toUpperCase()}${USER_ID_SUFFIX}`;
    }
  }
});

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'userId',
});

module.exports = mongoose.model('User', userSchema);
