require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT;
const path = require('path');

const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const mongoose = require('mongoose');
const crypto = require('crypto');
const webpush = require('web-push');
webpush.setVapidDetails(
  'mailto:newteamconspicuoussolutions@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { saturdayReminder, mondayFollowUp } = require('./notifications');
const { scheduleJobs } = require('./notifications.js');

const MONGODB_URL = process.env.ATLASDB_URL;

// DATABASE CONNECTION
mongoose
  .connect(MONGODB_URL)
  .then(() => {
    console.log('MongoDB connected');
    scheduleJobs();
  })
  .catch((err) => console.log(err));

// Model
const User = require('./model/user.js');
const Task = require('./model/task.js');
const WeeklyStatusReport = require('./model/weeklyStatusReport.js');

// SESSION SETUP
app.set('trust proxy', 1);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.ATLASDB_URL,
      ttl: 24 * 60 * 60, // 1 day in seconds
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  }),
);

// PASSPORT SETUP
app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
  if (req.isAuthenticated()) {
    return isSingleSession(req, res, next);
  }
  next();
});

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ===================== MIDDLEWARE =====================

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.redirect('/login');
}

function isActiveUser(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }

  if (req.user.role === 'ex-employee' || req.user.isActive === false) {
    req.logout((err) => {
      if (err) console.error('Logout error for ex-employee:', err);
      req.session.destroy(() => {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({
            error: 'Your account has been deactivated. Please contact your administrator.',
          });
        }
        return res.redirect('/login?reason=deactivated');
      });
    });
    return;
  }

  next();
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin' && req.user.isActive) return next();
  if (!req.isAuthenticated()) return res.redirect('/login');
  return res.status(403).send('Admin access only');
}

function isEmployee(req, res, next) {
  if (
    req.isAuthenticated() &&
    (req.user.role === 'employee' || req.user.role === 'admin') &&
    req.user.isActive
  )
    return next();
  if (!req.isAuthenticated()) return res.redirect('/login');
  return res.status(403).send('Employee access only');
}

async function isSingleSession(req, res, next) {
  if (!req.user) return next();

  try {
    const freshUser = await User.findById(req.user._id).select('sessionToken');

    if (!freshUser || freshUser.sessionToken !== req.session.sessionToken) {
      return req.logout(() => {
        req.session.destroy(() => {
          if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res
              .status(401)
              .json({ error: 'Session expired. You have been logged in from another device.' });
          }
          return res.redirect('/login?reason=session_expired');
        });
      });
    }

    next();
  } catch (err) {
    console.error('Session check error:', err);
    next();
  }
}

// ===================== BASIC ROUTES =====================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
  res.render('login', {
    deactivated: req.query.reason === 'deactivated',
    sessionExpired: req.query.reason === 'session_expired',
  });
});

app.get('/signup', (req, res) => res.render('signup'));

// ===================== SIGNUP =====================

app.post('/signup', async (req, res) => {
  try {
    const { name, userId, password } = req.body;

    if (!name || !userId || !password) return res.status(400).send('All fields required');

    if (password.length < 6) return res.status(400).send('Password must be at least 6 characters');

    const fullUserId = userId.toUpperCase().trim().endsWith('@conspicuous.com')
      ? userId.toUpperCase().trim()
      : `${userId.toUpperCase().trim()}@conspicuous.com`;

    const existingUser = await User.findOne({ userId: fullUserId });

    if (existingUser) return res.status(400).send('User ID already exists');

    const newUser = new User({
      name: name.trim(),
      userId: userId.trim(),
      role: 'employee',
    });

    User.register(newUser, password, (err, user) => {
      if (err) return res.status(500).send(err.message);

      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).send('Login failed');

        return res.redirect(`/employee/dashboard/${user._id}`);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ===================== LOGIN =====================

app.post('/login', (req, res, next) => {
  if (req.body.userId && !req.body.userId.endsWith('@conspicuous.com')) {
    req.body.userId = `${req.body.userId.toUpperCase()}@conspicuous.com`;
  }

  passport.authenticate('local', async (err, user, info) => {
    if (err) return res.status(500).json({ error: 'Server error' });

    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account is deactivated. Contact admin.' });
    }

    req.login(user, async (loginErr) => {
      if (loginErr) return res.status(500).json({ error: 'Login failed' });

      // Generate and save a new session token (invalidates all other devices)
      const token = crypto.randomBytes(32).toString('hex');
      await User.findByIdAndUpdate(user._id, { sessionToken: token });
      req.session.sessionToken = token;

      const redirectUrl =
        user.role === 'admin' ? '/admin/dashboard' : `/employee/dashboard/${user._id}`;
      return res.json({ success: true, redirectUrl });
    });
  })(req, res, next);
});

// ===================== EMPLOYEE ROUTES =====================

app.get('/employee/dashboard/:userId', isAuthenticated, isEmployee, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).send('Unauthorized');
    }

    const reports = await WeeklyStatusReport.find({
      user: req.user._id,
    })
      .populate('tasks')
      .sort({ createdAt: -1 });

    res.render('employee-task-page', {
      user: req.user,
      reports,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading dashboard');
  }
});

app.post('/employee/create-report', isAuthenticated, isEmployee, async (req, res) => {
  try {
    let { task, description, status, week, leaveInfo, attendanceEvents } = req.body;

    if (!week) {
      return res.status(400).send('Week is required');
    }

    // Parse leaveInfo
    let parsedLeave = [];
    if (leaveInfo) {
      if (Array.isArray(leaveInfo)) {
        parsedLeave = leaveInfo.filter((item) => item && item.trim() !== '');
      } else if (typeof leaveInfo === 'string') {
        try {
          const parsed = JSON.parse(leaveInfo);
          if (Array.isArray(parsed)) {
            parsedLeave = parsed.filter((item) => item && item.trim() !== '');
          } else if (parsed && parsed.trim() !== '') {
            parsedLeave = [parsed];
          }
        } catch (err) {
          if (leaveInfo.trim() !== '') {
            parsedLeave = [leaveInfo.trim()];
          }
        }
      }
    }

    // Parse attendanceEvents
    let parsedAttendanceEvents = [];
    if (attendanceEvents) {
      try {
        const parsed =
          typeof attendanceEvents === 'string' ? JSON.parse(attendanceEvents) : attendanceEvents;

        if (Array.isArray(parsed)) {
          parsedAttendanceEvents = parsed
            .filter((e) => e && e.type && e.date && e.time)
            .map((e) => ({
              type: e.type,
              date: new Date(e.date),
              time: e.time,
              reason: e.reason?.trim() || '',
            }));
        }
      } catch (err) {
        console.error('Failed to parse attendanceEvents:', err);
        // Non-fatal — continue without attendance events
      }
    }

    // Parse and save tasks
    const ALLOWED_STATUS = ['pending', 'in-progress', 'completed'];
    const taskDocs = [];

    if (task && !Array.isArray(task)) task = [task];
    if (description && !Array.isArray(description)) description = [description];
    if (status && !Array.isArray(status)) status = [status];

    if (task && status) {
      for (let i = 0; i < task.length; i++) {
        if (!task[i] || !status[i]) continue;

        if (!ALLOWED_STATUS.includes(status[i])) {
          return res.status(400).send('Invalid task status');
        }

        const newTask = await Task.create({
          taskName: task[i].trim(),
          description: description?.[i]?.trim() || '',
          status: status[i],
          createdBy: req.user._id,
        });

        taskDocs.push(newTask._id);
      }
    }

    if (taskDocs.length === 0 && parsedLeave.length === 0 && parsedAttendanceEvents.length === 0) {
      return res.status(400).send('Please add at least one task, leave entry, or attendance event');
    }

    await WeeklyStatusReport.create({
      user: req.user._id,
      duration: week.trim(),
      leaveInfo: parsedLeave,
      attendanceEvents: parsedAttendanceEvents,
      tasks: taskDocs,
    });

    return res.redirect(`/employee/dashboard/${req.user._id}`);
  } catch (error) {
    console.error('Weekly report error:', error);
    return res.status(500).send('Server error while saving report');
  }
});

app.get('/employee/dashboard/:userId/show-report/:reportId', async (req, res) => {
  try {
    const { userId, reportId } = req.params;

    const report = await WeeklyStatusReport.findById(reportId)
      .populate('tasks')
      .populate('user', 'name userId');

    if (!report) {
      return res.status(404).send('Report not found');
    }

    if (report.user._id.toString() !== userId) {
      return res.status(403).send('Unauthorized');
    }

    res.render('includes/report-details', { report, userId });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).send('Server error');
  }
});

app.get('/employee/dashboard/:userId/edit-report/:reportId', async (req, res) => {
  try {
    const { userId, reportId } = req.params;

    const report = await WeeklyStatusReport.findById(reportId)
      .populate('tasks')
      .populate('user', 'name userId');

    if (!report) {
      return res.status(404).send('Report not found');
    }

    if (report.user._id.toString() !== userId) {
      return res.status(403).send('Unauthorized');
    }

    res.render('includes/edit-report', { report, userId });
  } catch (error) {
    console.error('Error fetching report for edit:', error);
    res.status(500).send('Server error');
  }
});

app.post(
  '/employee/dashboard/:userId/update-report/:reportId',
  isAuthenticated,
  isEmployee,
  async (req, res) => {
    try {
      const { userId, reportId } = req.params;
      const { duration, leaveInfo, attendanceEvents, tasks } = req.body;

      const report = await WeeklyStatusReport.findById(reportId);

      if (!report) return res.status(404).send('Report not found');
      if (report.user.toString() !== userId) return res.status(403).send('Unauthorized');

      report.duration = duration;

      // Update leaveInfo
      if (leaveInfo) {
        if (Array.isArray(leaveInfo)) {
          report.leaveInfo = leaveInfo.filter((item) => item && item.trim() !== '');
        } else if (typeof leaveInfo === 'string' && leaveInfo.trim() !== '') {
          report.leaveInfo = [leaveInfo.trim()];
        } else {
          report.leaveInfo = [];
        }
      } else {
        report.leaveInfo = [];
      }

      // Update attendanceEvents
      if (attendanceEvents) {
        try {
          const parsed =
            typeof attendanceEvents === 'string' ? JSON.parse(attendanceEvents) : attendanceEvents;

          if (Array.isArray(parsed)) {
            report.attendanceEvents = parsed
              .filter((e) => e && e.type && e.date && e.time)
              .map((e) => ({
                type: e.type,
                date: new Date(e.date),
                time: e.time,
                reason: e.reason?.trim() || '',
              }));
          }
        } catch (err) {
          console.error('Failed to parse attendanceEvents on update:', err);
          // Non-fatal — keep existing attendanceEvents untouched
        }
      } else {
        report.attendanceEvents = [];
      }

      // Update tasks
      if (tasks) {
        const taskUpdates = Array.isArray(tasks) ? tasks : [tasks];

        for (const t of taskUpdates) {
          if (!t.taskName) continue;

          if (t.taskId) {
            await Task.findByIdAndUpdate(t.taskId, {
              taskName: t.taskName,
              description: t.description || '',
              status: t.status,
            });
          } else {
            const newTask = await Task.create({
              taskName: t.taskName,
              description: t.description || '',
              status: t.status,
              createdBy: userId,
            });

            report.tasks.push(newTask._id);
          }
        }
      }

      await report.save();

      res.redirect(`/employee/dashboard/${userId}/show-report/${reportId}`);
    } catch (err) {
      console.error('Update error:', err);
      res.status(500).send('Server error');
    }
  },
);

app.delete('/employee/dashboard/:userId/report/:reportId/task/:taskId', async (req, res) => {
  try {
    const { userId, reportId, taskId } = req.params;

    const report = await WeeklyStatusReport.findById(reportId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    if (report.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    report.tasks = report.tasks.filter((t) => t.toString() !== taskId);
    await report.save();

    await Task.findByIdAndDelete(taskId);

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===================== ADMIN ROUTES =====================

// Admin dashboard
app.get('/admin/dashboard', isAuthenticated, async (req, res) => {
  try {
    const employees = await User.find().sort({ createdAt: -1 });

    res.render('admin-dashboard', {
      user: req.user,
      employees: employees,
    });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// Update user status
app.patch('/admin/dashboard/:id/status', async (req, res) => {
  try {
    let { isActive } = req.body;

    isActive = isActive === true || isActive === 'true';

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update employee
app.post(
  '/admin/dashboard/:employeeId/edit',
  isAuthenticated,
  isActiveUser,
  isAdmin,
  async (req, res) => {
    try {
      const { name, userId, password, role } = req.body;

      if (!name || !userId) {
        return res.status(400).json({ error: 'Name and user ID are required' });
      }

      if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters long' });
      }

      const VALID_ROLES = ['employee', 'admin', 'ex-employee'];
      if (role && !VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified' });
      }

      // Prevent an admin from demoting themselves
      if (req.params.employeeId === req.user._id.toString() && role === 'ex-employee') {
        return res.status(400).json({ error: 'You cannot mark yourself as an ex-employee' });
      }

      const fullUserId = userId.toUpperCase().trim().endsWith('@conspicuous.com')
        ? userId.toUpperCase().trim()
        : `${userId.toUpperCase().trim()}@conspicuous.com`;

      const existingUser = await User.findOne({
        userId: fullUserId,
        _id: { $ne: req.params.employeeId },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'This user ID is already taken' });
      }

      const employee = await User.findById(req.params.employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const previousRole = employee.role;

      employee.name = name.trim();
      employee.userId = fullUserId;
      employee.role = role || 'employee';

      // When marking as ex-employee: disable account and block password changes
      if (role === 'ex-employee') {
        employee.isActive = false;

        console.log(
          `[ADMIN ACTION] User marked as ex-employee (access revoked): ${employee.userId} by ${req.user.userId}`,
        );
      } else {
        // Re-activating a previously deactivated ex-employee
        if (previousRole === 'ex-employee') {
          employee.isActive = true;
          console.log(
            `[ADMIN ACTION] Ex-employee re-activated: ${employee.userId} by ${req.user.userId}`,
          );
        }

        // Only allow password changes for active (non ex-employee) accounts
        if (password && password.trim().length > 0) {
          if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
          }
          await employee.setPassword(password);
        }
      }

      await employee.save();

      console.log(`[ADMIN ACTION] Employee updated: ${employee.userId} by ${req.user.userId}`);

      res.status(200).json({
        message:
          role === 'ex-employee'
            ? 'Employee marked as ex-employee and access has been revoked'
            : 'Employee updated successfully',
        employee: {
          id: employee._id,
          name: employee.name,
          userId: employee.userId,
          role: employee.role,
          isActive: employee.isActive,
        },
      });
    } catch (error) {
      console.error('Error updating employee:', error);

      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0];
        return res.status(400).json({ error: firstError.message });
      }

      res.status(500).json({ error: 'An error occurred while updating the employee' });
    }
  },
);

// Create user page
app.get('/admin/create-user', isAuthenticated, isAdmin, (req, res) => {
  res.render('includes/admin/admin-create-user', {
    user: req.user,
  });
});

// Create new user
app.post('/admin/create-user', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, userId, password, role } = req.body;

    if (!name || !userId || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (role && !['employee', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    const fullUserId = userId.toUpperCase().trim().endsWith('@conspicuous.com')
      ? userId.toUpperCase().trim()
      : `${userId.toUpperCase().trim()}@conspicuous.com`;

    const existingUser = await User.findOne({ userId: fullUserId });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this ID already exists' });
    }

    const newUser = new User({
      name: name.trim(),
      userId: userId.trim(),
      role: role || 'employee',
    });

    await User.register(newUser, password);

    console.log(`[ADMIN ACTION] User created: ${newUser.userId} by ${req.user.userId}`);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        userId: newUser.userId,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error.name === 'UserExistsError') {
      return res.status(400).json({ error: 'A user with this ID already exists' });
    }

    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      return res.status(400).json({ error: firstError.message });
    }

    res.status(500).json({ error: 'An error occurred while creating the user. Please try again.' });
  }
});

// Add admin page
app.get('/admin/add-admin', isAuthenticated, (req, res) => {
  res.render('includes/admin/add-new-admin', {
    error: null,
    success: null,
  });
});

// Add admin
app.post('/admin/add-admin', isAuthenticated, async (req, res) => {
  try {
    const { name, userId, password } = req.body;

    if (!name || !userId || !password) {
      return res.render('includes/admin/add-new-admin', {
        error: 'All fields are required.',
        success: null,
      });
    }

    if (password.length < 6) {
      return res.render('includes/admin/add-new-admin', {
        error: 'Password must be at least 6 characters.',
        success: null,
      });
    }

    const fullUserId = userId.toUpperCase().trim().endsWith('@conspicuous.com')
      ? userId.toUpperCase().trim()
      : `${userId.toUpperCase().trim()}@conspicuous.com`;

    const existingUser = await User.findOne({ userId: fullUserId });

    if (existingUser) {
      return res.render('includes/admin/add-new-admin', {
        error: 'User ID already exists.',
        success: null,
      });
    }

    const newAdmin = new User({
      name: name.trim(),
      userId: userId.trim(),
      role: 'admin',
      isActive: true,
    });

    await newAdmin.setPassword(password);
    await newAdmin.save();

    console.log(`Admin created: ${newAdmin.userId}`);

    res.render('includes/admin/add-new-admin', {
      error: null,
      success: 'Admin created successfully!',
    });
  } catch (error) {
    console.error(error);
    res.render('includes/admin/add-new-admin', {
      error: 'Server error occurred.',
      success: null,
    });
  }
});

// Admin employees page
app.get('/admin/employees', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const employees = await User.find().sort({ createdAt: -1 });

    const employeesWithReports = await Promise.all(
      employees.map(async (employee) => {
        const reports = await WeeklyStatusReport.find({ user: employee._id })
          .populate('tasks')
          .sort({ createdAt: -1 })
          .limit(3);

        const reportCount = await WeeklyStatusReport.countDocuments({
          user: employee._id,
        });

        return {
          ...employee.toObject(),
          reportCount: reportCount,
          recentReports: reports,
        };
      }),
    );

    res.render('includes/admin/admin-employees', {
      user: req.user,
      employeesWithReports: employeesWithReports,
    });
  } catch (error) {
    console.error('Error loading employees:', error);
    res.status(500).send('Error loading employees');
  }
});

// View employee's weekly reports
app.get('/admin/employees/:employeeId/reports', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).send('Employee not found');
    }

    const reports = await WeeklyStatusReport.find({ user: employeeId })
      .populate('tasks')
      .sort({ createdAt: -1 });

    res.render('includes/admin/admin-employee-reports', {
      user: req.user,
      employee: employee,
      reports: reports,
    });
  } catch (error) {
    console.error('Error loading employee reports:', error);
    res.status(500).send('Error loading reports');
  }
});

// Edit employee report page
app.get(
  '/admin/employees/:employeeId/reports/:reportId/edit',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { employeeId, reportId } = req.params;

      const employee = await User.findById(employeeId);
      const report = await WeeklyStatusReport.findById(reportId).populate('tasks').populate('user');

      if (!employee || !report) return res.status(404).send('Not found');

      res.render('includes/admin/admin-edit-employee-report', {
        user: req.user,
        employee,
        report,
      });
    } catch (err) {
      console.error('Edit GET error:', err);
      res.status(500).send('Server error');
    }
  },
);

// Update employee report
app.post(
  '/admin/employees/:employeeId/reports/:reportId/update',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { employeeId, reportId } = req.params;
      const { duration, leaveInfo, attendanceEvents, tasks } = req.body;

      const report = await WeeklyStatusReport.findById(reportId);

      if (!report) return res.status(404).send('Report not found');

      report.duration = duration;

      report.leaveInfo = Array.isArray(leaveInfo)
        ? leaveInfo.filter((l) => l.trim() !== '')
        : leaveInfo
          ? [leaveInfo]
          : [];

      // Parse attendanceEvents from JSON string (sent via hidden input)
      if (attendanceEvents) {
        let eventsArr = [];

        try {
          const parsed =
            typeof attendanceEvents === 'string' ? JSON.parse(attendanceEvents) : attendanceEvents;

          eventsArr = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
          console.error('Failed to parse attendanceEvents:', parseErr);
          eventsArr = [];
        }

        report.attendanceEvents = eventsArr
          .filter((e) => e.type && e.date && e.time)
          .map((e) => ({
            type: e.type,
            date: new Date(e.date),
            time: e.time,
            reason: e.reason?.trim() ?? '',
          }));
      } else {
        report.attendanceEvents = [];
      }

      if (tasks) {
        const taskArr = Array.isArray(tasks) ? tasks : [tasks];

        for (const t of taskArr) {
          if (t.taskId) {
            await Task.findByIdAndUpdate(t.taskId, {
              taskName: t.taskName,
              description: t.description,
              status: t.status,
            });
          } else {
            const newTask = await Task.create({
              taskName: t.taskName,
              description: t.description,
              status: t.status,
              createdBy: employeeId,
            });

            report.tasks.push(newTask._id);
          }
        }
      }

      await report.save();

      res.redirect(`/admin/employees/${employeeId}/reports`);
    } catch (err) {
      console.error('Admin update error:', err);
      res.status(500).send('Server Error');
    }
  },
);

app.post(
  '/admin/employees/:employeeId/create-report',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      let { task, description, status, week, leaveInfo, attendanceEvents } = req.body;

      if (!week) {
        return res.status(400).send('Week is required');
      }

      const employee = await User.findById(employeeId);
      if (!employee) return res.status(404).send('Employee not found');

      // Parse leaveInfo
      let parsedLeave = [];
      if (leaveInfo) {
        if (Array.isArray(leaveInfo)) {
          parsedLeave = leaveInfo.filter((item) => item && item.trim() !== '');
        } else if (typeof leaveInfo === 'string') {
          try {
            const parsed = JSON.parse(leaveInfo);
            if (Array.isArray(parsed)) {
              parsedLeave = parsed.filter((item) => item && item.trim() !== '');
            } else if (parsed && parsed.trim() !== '') {
              parsedLeave = [parsed];
            }
          } catch (err) {
            if (leaveInfo.trim() !== '') {
              parsedLeave = [leaveInfo.trim()];
            }
          }
        }
      }

      // Parse attendanceEvents (sent as JSON string from hidden input)
      let parsedAttendanceEvents = [];
      if (attendanceEvents) {
        try {
          const parsed =
            typeof attendanceEvents === 'string' ? JSON.parse(attendanceEvents) : attendanceEvents;

          if (Array.isArray(parsed)) {
            parsedAttendanceEvents = parsed
              .filter((e) => e.type && e.date && e.time)
              .map((e) => ({
                type: e.type,
                date: new Date(e.date),
                time: e.time,
                reason: e.reason?.trim() ?? '',
              }));
          }
        } catch (parseErr) {
          console.error('Failed to parse attendanceEvents:', parseErr);
        }
      }

      // Parse tasks
      const ALLOWED_STATUS = ['pending', 'in-progress', 'completed'];
      const taskDocs = [];

      if (task && !Array.isArray(task)) task = [task];
      if (description && !Array.isArray(description)) description = [description];
      if (status && !Array.isArray(status)) status = [status];

      if (task && status) {
        for (let i = 0; i < task.length; i++) {
          if (!task[i] || !status[i]) continue;

          if (!ALLOWED_STATUS.includes(status[i])) {
            return res.status(400).send('Invalid task status');
          }

          const newTask = await Task.create({
            taskName: task[i].trim(),
            description: description?.[i]?.trim() || '',
            status: status[i],
            createdBy: req.user._id,
          });

          taskDocs.push(newTask._id);
        }
      }

      if (
        taskDocs.length === 0 &&
        parsedLeave.length === 0 &&
        parsedAttendanceEvents.length === 0
      ) {
        return res
          .status(400)
          .send('Please add at least one task, leave entry, or attendance event');
      }

      await WeeklyStatusReport.create({
        user: employeeId,
        duration: week.trim(),
        leaveInfo: parsedLeave,
        attendanceEvents: parsedAttendanceEvents,
        tasks: taskDocs,
      });

      return res.redirect(`/admin/employees/${employeeId}/reports`);
    } catch (error) {
      console.error('Admin Weekly report error:', error);
      return res.status(500).send('Server error while saving report');
    }
  },
);
// Delete employee task
app.delete(
  '/admin/employees/:employeeId/reports/:reportId/task/:taskId/delete',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { reportId, taskId } = req.params;

      await Task.findByIdAndDelete(taskId);
      await WeeklyStatusReport.findByIdAndUpdate(reportId, {
        $pull: { tasks: taskId },
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Delete task error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
);

// Delete employee report
app.delete(
  '/admin/employees/:employeeId/reports/:reportId/delete',
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { employeeId, reportId } = req.params;

      const report = await WeeklyStatusReport.findById(reportId);

      if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
      }

      if (report.user.toString() !== employeeId) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      await Task.deleteMany({ _id: { $in: report.tasks } });
      await report.deleteOne();

      return res.json({ success: true });
    } catch (err) {
      console.error('Delete error:', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  },
);

// Delete employee
app.delete('/admin/employees/:employeeId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (employeeId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const reports = await WeeklyStatusReport.find({ user: employeeId });
    for (const report of reports) {
      await Task.deleteMany({ _id: { $in: report.tasks } });
    }
    await WeeklyStatusReport.deleteMany({ user: employeeId });

    await User.findByIdAndDelete(employeeId);

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/admin/employees/:employeeId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Skip file requests
    if (employeeId.includes('.')) {
      return res.status(404).send('Not found');
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).send('Invalid employee ID');
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).send('Employee not found');
    }

    res.render('includes/admin/admin-add-employee-report', {
      user: req.user,
      employee,
    });
  } catch (err) {
    console.error('Add Report GET error:', err);
    res.status(500).send('Server Error');
  }
});

// ------------- NOTIFICATIONS ------------------

app.post('/employee/save-subscription', isAuthenticated, async (req, res) => {
  try {
    const subscription = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: subscription,
    });
    console.log(`[PUSH] Subscription saved for ${req.user.name}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// run this in mongo shell or add a temp route
app.get('/admin/check-subscriptions', isAuthenticated, isAdmin, async (req, res) => {
  const all = await User.find({ role: 'employee' }, 'name pushSubscription');
  res.json(
    all.map((u) => ({
      name: u.name,
      hasSubscription: !!u.pushSubscription,
    })),
  );
});

app.get('/admin/test/notify-saturday', isAuthenticated, isAdmin, async (req, res) => {
  await saturdayReminder();
  res.json({ success: true, message: 'Saturday reminder triggered manually' });
});

app.get('/admin/test/notify-monday', isAuthenticated, isAdmin, async (req, res) => {
  await mondayFollowUp();
  res.json({ success: true, message: 'Monday follow-up triggered manually' });
});

app.get('/admin/test/notify-me', isAuthenticated, async (req, res) => {
  try {
    const me = await User.findById(req.user._id);

    if (!me.pushSubscription) {
      return res.json({
        success: false,
        message:
          'You have no subscription. Open the dashboard and click Allow on the notification popup first.',
      });
    }

    await webpush.sendNotification(
      me.pushSubscription,
      JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test from your server!',
      }),
    );

    res.json({ success: true, message: 'Notification sent to your device!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===================== LOGOUT =====================

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send('Logout failed');
    res.redirect('/login');
  });
});

// ===================== SERVER =====================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
