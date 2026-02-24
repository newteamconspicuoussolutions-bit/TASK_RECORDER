function handleLeaveTypeChange() {
  const leaveType = document.getElementById("leaveType").value;
  const singleDaySection = document.getElementById("singleDaySection");
  const halfDaySection = document.getElementById("halfDaySection");
  const multipleDaysSection = document.getElementById("multipleDaysSection");
  const leaveNotesSection = document.getElementById("leaveNotesSection");

  singleDaySection.classList.add("hidden");
  halfDaySection.classList.add("hidden");
  multipleDaysSection.classList.add("hidden");
  leaveNotesSection.classList.add("hidden");

  if (leaveType === "single-full") {
    singleDaySection.classList.remove("hidden");
    leaveNotesSection.classList.remove("hidden");
  } else if (leaveType === "single-half") {
    singleDaySection.classList.remove("hidden");
    halfDaySection.classList.remove("hidden");
    leaveNotesSection.classList.remove("hidden");
  } else if (leaveType === "multiple") {
    multipleDaysSection.classList.remove("hidden");
    leaveNotesSection.classList.remove("hidden");
  }

  updateLeaveInfo();
}

function calculateLeaveDays() {
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;
  const leaveDaysCount = document.getElementById("leaveDaysCount");
  const totalDaysSpan = document.getElementById("totalDays");

  if (fromDate && toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to >= from) {
      const diffTime = Math.abs(to - from);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      totalDaysSpan.textContent = diffDays;
      leaveDaysCount.classList.remove("hidden");
    } else {
      leaveDaysCount.classList.add("hidden");
    }
  } else {
    leaveDaysCount.classList.add("hidden");
  }

  updateLeaveInfo();
}

function updateLeaveInfo() {
  const leaveType = document.getElementById("leaveType").value;
  let leaveInfoText = "";

  if (leaveType === "single-full") {
    const date = document.getElementById("singleDate").value;
    const notes = document.getElementById("leaveNotes").value;
    if (date) {
      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      leaveInfoText = `Full Day Leave on ${formattedDate}`;
      if (notes) leaveInfoText += ` - ${notes}`;
    }
  } else if (leaveType === "single-half") {
    const date = document.getElementById("singleDate").value;
    const halfDayPeriod = document.querySelector(
      'input[name="halfDayPeriod"]:checked',
    )?.value;
    const notes = document.getElementById("leaveNotes").value;
    if (date && halfDayPeriod) {
      const formattedDate = new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const period =
        halfDayPeriod === "first-half"
          ? "First Half (Morning)"
          : "Second Half (Afternoon)";
      leaveInfoText = `Half Day Leave (${period}) on ${formattedDate}`;
      if (notes) leaveInfoText += ` - ${notes}`;
    }
  } else if (leaveType === "multiple") {
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;
    const notes = document.getElementById("leaveNotes").value;
    if (fromDate && toDate) {
      const formattedFromDate = new Date(fromDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const formattedToDate = new Date(toDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const totalDays = document.getElementById("totalDays").textContent;
      leaveInfoText = `Leave from ${formattedFromDate} to ${formattedToDate} (${totalDays} days)`;
      if (notes) leaveInfoText += ` - ${notes}`;
    }
  }

  appendLeaveInfo(leaveInfoText);
}

function parseExistingLeaveInfo() {
  const existingLeaveInfo = `<%= report.leaveInfo || '' %>`;

  if (!existingLeaveInfo || existingLeaveInfo.trim() === "") {
    return;
  }

  if (existingLeaveInfo.includes("Full Day Leave on")) {
    document.getElementById("leaveType").value = "single-full";

    const dateMatch = existingLeaveInfo.match(/on\s+(.+?)(?:\s+-|$)/);
    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate)) {
        document.getElementById("singleDate").value = parsedDate
          .toISOString()
          .split("T")[0];
      }
    }

    const notesMatch = existingLeaveInfo.match(/\s+-\s+(.+)$/);
    if (notesMatch) {
      document.getElementById("leaveNotes").value = notesMatch[1].trim();
    }

    handleLeaveTypeChange();
  } else if (existingLeaveInfo.includes("Half Day Leave")) {
    document.getElementById("leaveType").value = "single-half";

    const dateMatch = existingLeaveInfo.match(/on\s+(.+?)(?:\s+-|$)/);
    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate)) {
        document.getElementById("singleDate").value = parsedDate
          .toISOString()
          .split("T")[0];
      }
    }

    if (
      existingLeaveInfo.includes("First Half") ||
      existingLeaveInfo.includes("Morning")
    ) {
      setTimeout(() => {
        const firstHalfRadio = document.querySelector(
          'input[name="halfDayPeriod"][value="first-half"]',
        );
        if (firstHalfRadio) firstHalfRadio.checked = true;
      }, 100);
    } else if (
      existingLeaveInfo.includes("Second Half") ||
      existingLeaveInfo.includes("Afternoon")
    ) {
      setTimeout(() => {
        const secondHalfRadio = document.querySelector(
          'input[name="halfDayPeriod"][value="second-half"]',
        );
        if (secondHalfRadio) secondHalfRadio.checked = true;
      }, 100);
    }

    const notesMatch = existingLeaveInfo.match(/\s+-\s+(.+)$/);
    if (notesMatch) {
      document.getElementById("leaveNotes").value = notesMatch[1].trim();
    }

    handleLeaveTypeChange();
  } else if (existingLeaveInfo.includes("Leave from")) {
    document.getElementById("leaveType").value = "multiple";

    const dateRangeMatch = existingLeaveInfo.match(
      /from\s+(.+?)\s+to\s+(.+?)\s+\(/,
    );
    if (dateRangeMatch) {
      const fromDateStr = dateRangeMatch[1].trim();
      const toDateStr = dateRangeMatch[2].trim();

      const fromDate = new Date(fromDateStr);
      const toDate = new Date(toDateStr);

      if (!isNaN(fromDate)) {
        document.getElementById("fromDate").value = fromDate
          .toISOString()
          .split("T")[0];
      }
      if (!isNaN(toDate)) {
        document.getElementById("toDate").value = toDate
          .toISOString()
          .split("T")[0];
      }
    }

    const notesMatch = existingLeaveInfo.match(/\)\s+-\s+(.+)$/);
    if (notesMatch) {
      document.getElementById("leaveNotes").value = notesMatch[1].trim();
    }

    handleLeaveTypeChange();
    calculateLeaveDays();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  parseExistingLeaveInfo();

  const leaveNotes = document.getElementById("leaveNotes");
  const singleDate = document.getElementById("singleDate");
  const halfDayRadios = document.querySelectorAll(
    'input[name="halfDayPeriod"]',
  );

  if (leaveNotes) {
    leaveNotes.addEventListener("input", updateLeaveInfo);
  }

  if (singleDate) {
    singleDate.addEventListener("change", updateLeaveInfo);
  }

  halfDayRadios.forEach((radio) => {
    radio.addEventListener("change", updateLeaveInfo);
  });
});
const leaveNotes = document.getElementById("leaveNotes");
const singleDate = document.getElementById("singleDate");
const halfDayRadios = document.querySelectorAll('input[name="halfDayPeriod"]');

if (leaveNotes) {
  leaveNotes.addEventListener("input", updateLeaveInfo);
}

if (singleDate) {
  singleDate.addEventListener("change", updateLeaveInfo);
}

halfDayRadios.forEach((radio) => {
  radio.addEventListener("change", updateLeaveInfo);
});

function handleSave() {
  const saveButton = document.getElementById("saveButton");
  const saveText = document.getElementById("saveText");
  const saveIcon = document.getElementById("saveIcon");

  // Disable button
  saveButton.disabled = true;
  saveButton.classList.add("opacity-75", "cursor-not-allowed");

  // Change text to "Saving..."
  saveText.textContent = "Saving...";

  // Add spinner icon
  saveIcon.innerHTML =
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>';
  saveIcon.classList.add("animate-spin");

  // Wait 1.5 seconds before submitting
  setTimeout(() => {
    document.getElementById("editReportForm").submit();
  }, 1500);
}

function deleteTask(reportId, taskId) {
  if (
    !confirm(
      "Are you sure you want to delete this task? This action cannot be undone.",
    )
  ) {
    return;
  }

  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  if (taskElement) {
    taskElement.style.opacity = "0.5";
    taskElement.style.pointerEvents = "none";
  }

  fetch(`/employee/dashboard/<%= userId %>/report/${reportId}/task/${taskId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Show success feedback
        if (taskElement) {
          taskElement.style.transition = "all 0.3s ease";
          taskElement.style.transform = "translateX(100%)";
          taskElement.style.opacity = "0";

          setTimeout(() => {
            window.location.reload();
          }, 300);
        }
      } else {
        alert("Error deleting task: " + data.message);
        if (taskElement) {
          taskElement.style.opacity = "1";
          taskElement.style.pointerEvents = "auto";
        }
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Error deleting task. Please try again.");
      if (taskElement) {
        taskElement.style.opacity = "1";
        taskElement.style.pointerEvents = "auto";
      }
    });
}

//   <!-- Add More Task Functionality -->
let newTaskIndex = `<%= report.tasks.length %>`;

function addNewTask() {
  const list = document.getElementById("tasksList");

  const html = `
  <div class="border-2 border-gray-200 rounded-xl p-6 relative task-item hover:border-blue-300 transition bg-white">

    <button type="button" onclick="removeLocalTask(this)"
      class="absolute top-4 right-4 text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg transition">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
    </button>

    <div class="pr-14">
      <div class="flex items-center mb-5">
        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mr-3">
          <span class="text-sm font-bold text-gray-600">#${newTaskIndex + 1}</span>
        </div>
        <h3 class="text-lg font-bold text-gray-900">Task ${newTaskIndex + 1}</h3>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Task Name *</label>
        <input type="text" name="tasks[${newTaskIndex}][taskName]" required
          class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm font-medium">
      </div>

      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Description</label>
        <textarea name="tasks[${newTaskIndex}][description]" rows="3"
          class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm resize-none"></textarea>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Status *</label>
        <div class="grid grid-cols-3 gap-3">
          ${["pending", "in-progress", "completed"]
            .map(
              (s) => `
            <label class="relative cursor-pointer">
              <input type="radio" name="tasks[${newTaskIndex}][status]" value="${s}" ${s === "pending" ? "checked" : ""}
                class="peer sr-only">
              <div class="px-4 py-3 border-2 border-gray-200 rounded-lg text-center transition
                peer-checked:border-${s === "pending" ? "amber" : s === "in-progress" ? "blue" : "green"}-500
                peer-checked:bg-${s === "pending" ? "amber" : s === "in-progress" ? "blue" : "green"}-50">
                <span class="text-sm font-semibold">${s.replace("-", " ")}</span>
              </div>
            </label>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  </div>`;

  list.insertAdjacentHTML("beforeend", html);
  newTaskIndex++;
}

function removeLocalTask(btn) {
  btn.closest(".task-item").remove();
}

// ADD LEAVE INFO
let leaveArray = [];

function appendLeaveInfo(text) {
  if (!text) return;

  leaveArray.push(text);
  updateHiddenLeaveInput();
}

function removeLeave(index) {
  leaveArray.splice(index, 1);
  updateHiddenLeaveInput();
  location.reload(); // simple refresh to reflect UI
}

function updateHiddenLeaveInput() {
  const hidden = document.getElementById("leaveInfoHidden");
  hidden.value = "";

  leaveArray.forEach((v) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "leaveInfo[]";
    input.value = v;
    hidden.parentNode.appendChild(input);
  });
}

const existingLeaves = `<%- JSON.stringify(report.leaveInfo || []) %>`;
leaveArray = [...existingLeaves];
