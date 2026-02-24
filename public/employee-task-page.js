// Add Task Row
function addTaskRow() {
  const table = document.getElementById('taskTable');
  const row = document.createElement('tr');
  row.className = 'table-row';

  row.innerHTML = `
    <td class="px-4 py-3">
      <input 
        name="task[]"
        placeholder="Enter task name"
        required
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </td>
    <td class="px-4 py-3">
      <input 
        name="description[]"
        placeholder="Task description"
        required
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </td>
    <td class="px-4 py-3">
      <select
        name="status[]"
        required
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
      >
        <option value="">Select Status</option>
        <option value="pending">pending</option>
        <option value="in-progress">in-progress</option>
        <option value="completed">completed</option>
      </select>
    </td>
  `;

  table.appendChild(row);
}

// Navigation Functions
function resetNavStyles() {
  const showReportsBtn = document.getElementById('showReportsBtn');
  const addReportBtn = document.getElementById('addReportBtn');

  if (!showReportsBtn || !addReportBtn) return;

  showReportsBtn.classList.remove('active', 'bg-gray-100', 'font-medium');
  addReportBtn.classList.remove('active', 'bg-gray-100', 'font-medium');

  showReportsBtn.classList.add('text-gray-700');
  addReportBtn.classList.add('text-gray-700');
}

function showReports() {
  const weeklyReportForm = document.getElementById('weeklyReportForm');
  const reportsList = document.getElementById('reportsList');
  const showReportsBtn = document.getElementById('showReportsBtn');
  const addReportBtn = document.getElementById('addReportBtn');

  if (!weeklyReportForm || !reportsList) return;

  weeklyReportForm.classList.add('hidden');
  reportsList.classList.remove('hidden');

  if (showReportsBtn && addReportBtn) {
    resetNavStyles();
    showReportsBtn.classList.add('active');
  }
}

function showNewReport() {
  const weeklyReportForm = document.getElementById('weeklyReportForm');
  const reportsList = document.getElementById('reportsList');
  const showReportsBtn = document.getElementById('showReportsBtn');
  const addReportBtn = document.getElementById('addReportBtn');

  if (!weeklyReportForm || !reportsList) return;

  reportsList.classList.add('hidden');
  weeklyReportForm.classList.remove('hidden');

  if (showReportsBtn && addReportBtn) {
    resetNavStyles();
    addReportBtn.classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  showNewReport();

  // Sync hidden fields right before form submits
  const reportForm = document.querySelector('form[action="/employee/create-report"]');
  if (reportForm) {
    reportForm.addEventListener('submit', function () {
      document.getElementById('leaveInfoHidden').value = JSON.stringify(leaveEntries);
      document.getElementById('attendanceEventsHidden').value = JSON.stringify(attendanceEvents);
    });
  }
});

function handleLeaveTypeChange() {
  const leaveType = document.getElementById('leaveType');
  const singleDaySection = document.getElementById('singleDaySection');
  const halfDaySection = document.getElementById('halfDaySection');
  const multipleDaysSection = document.getElementById('multipleDaysSection');
  const officeHolidaySection = document.getElementById('officeHolidaySection');
  const leaveNotesSection = document.getElementById('leaveNotesSection');

  if (!leaveType) return;

  // Hide all sections first
  if (singleDaySection) singleDaySection.classList.add('hidden');
  if (halfDaySection) halfDaySection.classList.add('hidden');
  if (multipleDaysSection) multipleDaysSection.classList.add('hidden');
  if (officeHolidaySection) officeHolidaySection.classList.add('hidden');
  if (leaveNotesSection) leaveNotesSection.classList.add('hidden');

  if (leaveType.value === 'single-full') {
    if (singleDaySection) singleDaySection.classList.remove('hidden');
    if (leaveNotesSection) leaveNotesSection.classList.remove('hidden');
  } else if (leaveType.value === 'single-half') {
    if (singleDaySection) singleDaySection.classList.remove('hidden');
    if (halfDaySection) halfDaySection.classList.remove('hidden');
    if (leaveNotesSection) leaveNotesSection.classList.remove('hidden');
  } else if (leaveType.value === 'multiple') {
    if (multipleDaysSection) multipleDaysSection.classList.remove('hidden');
    if (leaveNotesSection) leaveNotesSection.classList.remove('hidden');
  } else if (leaveType.value === 'office-holiday') {
    if (officeHolidaySection) officeHolidaySection.classList.remove('hidden');
  }
}

function calculateLeaveDays() {
  const fromDate = document.getElementById('fromDate');
  const toDate = document.getElementById('toDate');
  const leaveDaysCount = document.getElementById('leaveDaysCount');
  const totalDaysSpan = document.getElementById('totalDays');

  if (!fromDate || !toDate || !leaveDaysCount || !totalDaysSpan) return;

  if (fromDate.value && toDate.value) {
    const from = new Date(fromDate.value);
    const to = new Date(toDate.value);

    if (to >= from) {
      const diffTime = Math.abs(to - from);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      totalDaysSpan.textContent = diffDays;
      leaveDaysCount.classList.remove('hidden');
    } else {
      leaveDaysCount.classList.add('hidden');
    }
  } else {
    leaveDaysCount.classList.add('hidden');
  }
}

// --------------------------------- LEAVE ENTRIES ---------------------------------

let leaveEntries = [];

function addLeaveEntry() {
  const leaveType = document.getElementById('leaveType');
  if (!leaveType) return;
  if (!leaveType.value) return alert('Select leave type');

  let leaveText = '';

  if (leaveType.value === 'single-full') {
    const date = document.getElementById('singleDate');
    if (!date || !date.value) return alert('Select date');

    const formattedDate = new Date(date.value).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    leaveText = `Full Day Leave on ${formattedDate}`;

    const notes = document.getElementById('leaveNotes');
    if (notes && notes.value) leaveText += ` - ${notes.value}`;
  }

  if (leaveType.value === 'single-half') {
    const date = document.getElementById('singleDate');
    const period = document.querySelector('input[name="halfDayPeriod"]:checked');

    if (!date || !date.value || !period) return alert('Select date & half day period');

    const formattedDate = new Date(date.value).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const periodText =
      period.value === 'first-half' ? 'First Half (Morning)' : 'Second Half (Afternoon)';
    leaveText = `Half Day Leave (${periodText}) on ${formattedDate}`;

    const notes = document.getElementById('leaveNotes');
    if (notes && notes.value) leaveText += ` - ${notes.value}`;
  }

  if (leaveType.value === 'multiple') {
    const fromDate = document.getElementById('fromDate');
    const toDate = document.getElementById('toDate');

    if (!fromDate || !fromDate.value || !toDate || !toDate.value) return alert('Select date range');

    const formattedFromDate = new Date(fromDate.value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedToDate = new Date(toDate.value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const totalDays = document.getElementById('totalDays');
    leaveText = `Leave from ${formattedFromDate} to ${formattedToDate} (${totalDays ? totalDays.textContent : '0'} days)`;

    const notes = document.getElementById('leaveNotes');
    if (notes && notes.value) leaveText += ` - ${notes.value}`;
  }

  if (leaveType.value === 'office-holiday') {
    const holidayDate = document.getElementById('holidayDate');
    const holidayName = document.getElementById('holidayName');

    if (!holidayDate || !holidayDate.value) return alert('Select holiday date');
    if (!holidayName || !holidayName.value.trim()) return alert('Enter holiday name');

    const formattedDate = new Date(holidayDate.value).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    leaveText = `Office Holiday: ${holidayName.value.trim()} on ${formattedDate}`;
  }

  leaveEntries.push(leaveText);
  renderLeaveList();

  // Reset fields
  leaveType.value = '';
  const singleDate = document.getElementById('singleDate');
  const fromDate = document.getElementById('fromDate');
  const toDate = document.getElementById('toDate');
  const leaveNotes = document.getElementById('leaveNotes');
  const holidayDate = document.getElementById('holidayDate');
  const holidayName = document.getElementById('holidayName');

  if (singleDate) singleDate.value = '';
  if (fromDate) fromDate.value = '';
  if (toDate) toDate.value = '';
  if (leaveNotes) leaveNotes.value = '';
  if (holidayDate) holidayDate.value = '';
  if (holidayName) holidayName.value = '';

  document.querySelectorAll('input[name="halfDayPeriod"]').forEach((radio) => {
    radio.checked = false;
  });

  handleLeaveTypeChange();
}

function renderLeaveList() {
  const list = document.getElementById('leaveList');
  const hiddenField = document.getElementById('leaveInfoHidden');

  if (!list || !hiddenField) return;

  list.innerHTML = '';

  leaveEntries.forEach((leave, index) => {
    list.innerHTML += `
      <div class="flex justify-between items-center bg-white p-2 border rounded-md">
        <span class="text-sm">${leave}</span>
        <button type="button" onclick="removeLeave(${index})"
          class="text-red-600 hover:text-red-800 px-2 py-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
  });

  hiddenField.value = JSON.stringify(leaveEntries);
}

function removeLeave(index) {
  leaveEntries.splice(index, 1);
  renderLeaveList();
}

// --------------------------------- EARLY LEAVE / LATE ARRIVAL ---------------------------------

let attendanceEvents = [];

function addAttendanceEvent() {
  const type = document.getElementById('attendanceEventType');
  const date = document.getElementById('attendanceEventDate');
  const time = document.getElementById('attendanceEventTime');
  const reason = document.getElementById('attendanceEventReason');

  if (!type || !type.value) return alert('Select type (Early Leave or Late Arrival)');
  if (!date || !date.value) return alert('Select date');
  if (!time || !time.value) return alert('Enter time');

  const formattedDate = new Date(date.value).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Format time to 12hr
  const [hrs, mins] = time.value.split(':');
  const h = parseInt(hrs);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const formattedTime = `${h % 12 || 12}:${mins} ${suffix}`;

  const typeLabel = type.value === 'early-leave' ? 'Early Leave' : 'Late Arrival';
  let entryText = `${typeLabel} on ${formattedDate} at ${formattedTime}`;
  if (reason && reason.value.trim()) entryText += ` — ${reason.value.trim()}`;

  attendanceEvents.push({
    type: type.value,
    date: date.value,
    time: time.value,
    reason: reason ? reason.value.trim() : '',
    label: entryText,
  });
  renderAttendanceEvents();

  // Reset
  type.value = '';
  date.value = '';
  time.value = '';
  if (reason) reason.value = '';
}

function renderAttendanceEvents() {
  const list = document.getElementById('attendanceEventList');
  const hiddenField = document.getElementById('attendanceEventsHidden');

  if (!list || !hiddenField) return;

  list.innerHTML = '';

  attendanceEvents.forEach((entry, index) => {
    const badgeColor =
      entry.type === 'early-leave' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800';

    const badgeLabel = entry.type === 'early-leave' ? 'Early Leave' : 'Late Arrival';

    list.innerHTML += `
      <div class="flex justify-between items-center bg-white p-2 border rounded-md">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}">${badgeLabel}</span>
          <span class="text-sm text-gray-700">${entry.label.replace(/^(Early Leave|Late Arrival) /, '')}</span>
        </div>
        <button type="button" onclick="removeAttendanceEvent(${index})"
          class="text-red-600 hover:text-red-800 px-2 py-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
  });

  hiddenField.value = JSON.stringify(attendanceEvents);
}

function removeAttendanceEvent(index) {
  attendanceEvents.splice(index, 1);
  renderAttendanceEvents();
}

// --------------------------------- WEEK HANDLING ---------------------------------

function getDateRangeFromWeek(week, year = new Date().getFullYear()) {
  const firstDay = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const start = new Date(firstDay.getTime() + days * 86400000);

  const day = start.getDay();
  const monday = new Date(start);
  monday.setDate(start.getDate() - (day === 0 ? 6 : day - 1));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { monday, sunday };
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const weekInput = document.getElementById('weekInput');
const weekRangeText = document.getElementById('weekRangeText');

function updateWeekRange() {
  if (!weekInput || !weekRangeText) return;

  const value = weekInput.value.trim();
  const match = value.match(/^W(\d{1,2})$/i);

  if (!match) {
    weekRangeText.classList.add('hidden');
    return;
  }

  const week = parseInt(match[1]);
  if (week < 1 || week > 53) {
    weekRangeText.classList.add('hidden');
    return;
  }

  const { monday, sunday } = getDateRangeFromWeek(week);
  weekRangeText.innerText = `${formatDate(monday)} - ${formatDate(sunday)}`;
  weekRangeText.classList.remove('hidden');
}

if (weekInput && weekRangeText) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((today - firstDay) / 86400000) + 1;
  const currentWeek = Math.ceil((dayOfYear + firstDay.getDay()) / 7);

  weekInput.value = `W${currentWeek}`;
  updateWeekRange();

  weekInput.addEventListener('input', updateWeekRange);
}
