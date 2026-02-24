const User = require('./model/user');
const WeeklyStatusReport = require('./model/weeklyStatusReport');

const cron = require('node-cron');
const webpush = require('web-push');

// ─────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────
webpush.setVapidDetails(
  'mailto:newteamconspicuoussolutions@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// ─────────────────────────────────────────
// HELPER — send notification to one user
// ─────────────────────────────────────────
async function sendPush(user, title, body) {
  if (!user.pushSubscription) return { status: 'skipped', name: user.name };

  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify({ title, body }));
    return { status: 'sent', name: user.name };
  } catch (err) {
    // Subscription expired or invalid — clean it up
    if (err.statusCode === 410 || err.statusCode === 404) {
      await User.findByIdAndUpdate(user._id, { pushSubscription: null });
      console.log(`[PUSH] Cleaned expired subscription for ${user.name}`);
    }
    return { status: 'failed', name: user.name, reason: err.message };
  }
}

// ─────────────────────────────────────────
// HELPER — log results summary
// ─────────────────────────────────────────
function logResults(label, results) {
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  console.log(
    `[CRON] ${label} → Sent: ${sent} | Failed: ${failed} | Skipped (no subscription): ${skipped}`,
  );
  results
    .filter((r) => r.status === 'failed')
    .forEach((r) => {
      console.log(`  ✗ ${r.name}: ${r.reason}`);
    });
}

// ─────────────────────────────────────────
// JOB 1 — Every Saturday 10:30 AM / 05:00 PM / 05:30 PM
//          Remind EVERYONE to fill WSR
// ─────────────────────────────────────────
async function saturdayReminder() {
  console.log(`\n[CRON] ── Saturday Reminder ── ${new Date().toLocaleString()}`);
  try {
    const employees = await User.find({ role: 'employee', isActive: true });

    if (employees.length === 0) {
      console.log('[CRON] No active employees found.');
      return;
    }

    const results = await Promise.all(
      employees.map((emp) =>
        sendPush(
          emp,
          'Weekly Status Report Reminder',
          `Hi ${emp.name}, please submit your Weekly Status Report for this week before the deadline!`,
        ),
      ),
    );

    logResults('Saturday', results);
  } catch (err) {
    console.error('[CRON] Saturday reminder error:', err);
  }
}

// ─────────────────────────────────────────
// JOB 2 — Every Monday 10:30 AM
//          Remind ONLY those who haven't submitted
// ─────────────────────────────────────────
async function mondayFollowUp() {
  console.log(`\n[CRON] ── Monday Follow-up ── ${new Date().toLocaleString()}`);
  try {
    // Look back 7 days to find who submitted this week
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const submittedUserIds = await WeeklyStatusReport.find({
      createdAt: { $gte: sevenDaysAgo },
    }).distinct('user');

    const pendingEmployees = await User.find({
      role: 'employee',
      isActive: true,
      _id: { $nin: submittedUserIds },
    });

    if (pendingEmployees.length === 0) {
      console.log('[CRON] Monday — Everyone submitted this week. No follow-ups needed.');
      return;
    }

    console.log(`[CRON] Monday — ${pendingEmployees.length} employee(s) have not submitted.`);

    const results = await Promise.all(
      pendingEmployees.map((emp) =>
        sendPush(
          emp,
          'WSR Not Submitted!',
          `Hi ${emp.name}, you still haven't submitted your Weekly Status Report. Please submit it now!`,
        ),
      ),
    );

    logResults('Monday', results);
  } catch (err) {
    console.error('[CRON] Monday follow-up error:', err);
  }
}

// ─────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────
function scheduleJobs() {
  // Every Saturday at 10:30 AM
  cron.schedule('30 10 * * 6', saturdayReminder, {
    timezone: 'Asia/Kolkata',
  });

  // Every Saturday at 5:00 PM
  cron.schedule('0 17 * * 6', saturdayReminder, {
    timezone: 'Asia/Kolkata',
  });

  // Every Saturday at 5:30 PM
  cron.schedule('30 17 * * 6', saturdayReminder, {
    timezone: 'Asia/Kolkata',
  });

  // Every Monday at 10:30 AM
  cron.schedule('30 10 * * 1', mondayFollowUp, {
    timezone: 'Asia/Kolkata',
  });

  console.log(
    '[CRON] Jobs scheduled → Saturday 10:30AM | 5:00PM | 5:30PM (remind all) | Monday 10:30AM (remind pending)',
  );
}

// ─────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────
module.exports = {
  scheduleJobs,
  saturdayReminder, // exported for manual testing
  mondayFollowUp, // exported for manual testing
};
