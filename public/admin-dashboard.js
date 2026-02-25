// Mobile menu toggle
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('mobileMenuOverlay');

openSidebar.addEventListener('click', () => {
  sidebar.classList.add('active');
  overlay.classList.remove('hidden');
});

closeSidebar.addEventListener('click', () => {
  sidebar.classList.remove('active');
  overlay.classList.add('hidden');
});

overlay.addEventListener('click', () => {
  sidebar.classList.remove('active');
  overlay.classList.add('hidden');
});

// ── Filter + Search state ──────────────────────────────
let currentFilter = 'all';

// Filter employees by role
function filterEmployees(role) {
  currentFilter = role;
  document.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
  document.getElementById('filter-' + role).classList.add('active');
  applyFilters();
}

// Search employees
function searchEmployees() {
  applyFilters();
}

// Combined filter + search logic
function applyFilters() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  let count = 0;
  document.querySelectorAll('#employeeTableBody .employee-row').forEach((row) => {
    const roleMatch = currentFilter === 'all' || row.dataset.role === currentFilter;
    const searchMatch = !q || row.dataset.name.includes(q) || row.dataset.email.includes(q);
    const visible = roleMatch && searchMatch;
    row.style.display = visible ? '' : 'none';
    if (visible) count++;
  });
  document.getElementById('showingCount').textContent = count;
}

let selectedEmployeeId = null;

// DELETE EMPLOYEE MODAL FUNCTION
function deleteEmployee(employeeId) {
  selectedEmployeeId = employeeId;

  const modal = document.getElementById('deleteModal');
  const content = document.getElementById('deleteModalContent');

  modal.classList.remove('hidden');

  setTimeout(() => {
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
  }, 50);
}

async function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  const content = document.getElementById('deleteModalContent');

  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
  const btn = this;
  const originalContent = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = `
    <svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
    </svg>
    <span>Deleting...</span>
  `;

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const response = await fetch(`/admin/employees/${selectedEmployeeId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (data.success) {
      window.location.reload();
    } else {
      alert(data.message || 'Error deleting employee');
    }
  } catch (error) {
    alert('Something went wrong.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
    closeDeleteModal();
  }
});

// EDIT EMPLOYEE MODAL

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function openEditModal(button) {
  const employee = JSON.parse(decodeURIComponent(button.dataset.employee));
  const modal = document.getElementById('editEmployeeModal');
  const modalContent = document.getElementById('modalContent');

  document.getElementById('editEmployeeId').value = employee._id;
  document.getElementById('editName').value = employee.name;
  const rawId = (employee.userId || '').replace('@conspicuous.com', '');
  document.getElementById('editUserId').value = rawId;
  document.getElementById('editPassword').value = '';

  if (employee.role === 'admin') {
    document.getElementById('editRoleAdmin').checked = true;
    document.getElementById('exEmployeeWarning').classList.add('hidden');
  } else if (employee.role === 'ex-employee') {
    document.getElementById('editRoleExEmployee').checked = true;
    document.getElementById('exEmployeeWarning').classList.remove('hidden');
  } else {
    document.getElementById('editRoleEmployee').checked = true;
    document.getElementById('exEmployeeWarning').classList.add('hidden');
  }

  document.getElementById('displayEmployeeId').textContent = employee._id;
  document.getElementById('displayCreatedAt').textContent = formatDate(employee.createdAt);
  document.getElementById('displayUpdatedAt').textContent = formatDate(employee.updatedAt);

  document.getElementById('modalSuccessAlert').classList.add('hidden');
  document.getElementById('modalErrorAlert').classList.add('hidden');

  modal.classList.remove('hidden');
  await delay(50);
  modalContent.classList.remove('scale-95', 'opacity-0');
  modalContent.classList.add('scale-100', 'opacity-100');
}

async function closeEditModal() {
  const modal = document.getElementById('editEmployeeModal');
  const modalContent = document.getElementById('modalContent');

  modalContent.classList.remove('scale-100', 'opacity-100');
  modalContent.classList.add('scale-95', 'opacity-0');

  await delay(200);

  modal.classList.add('hidden');
  document.getElementById('editEmployeeForm').reset();
}

function toggleEditPassword() {
  const passwordInput = document.getElementById('editPassword');
  const eyeIcon = document.getElementById('editEyeIcon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>';
  } else {
    passwordInput.type = 'password';
    eyeIcon.innerHTML =
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
  }
}

async function updateEmployee() {
  const updateBtn = document.getElementById('updateBtn');
  const originalBtnContent = updateBtn.innerHTML;

  updateBtn.disabled = true;
  updateBtn.innerHTML = `
    <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>Updating...</span>
  `;

  const employeeId = document.getElementById('editEmployeeId').value;
  const formData = {
    name: document.getElementById('editName').value,
    userId: document.getElementById('editUserId').value,
    password: document.getElementById('editPassword').value,
    role: document.querySelector('input[name="editRole"]:checked').value,
  };

  try {
    await delay(1500);

    const response = await fetch(`/admin/dashboard/${employeeId}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('modalSuccessMessage').textContent =
        data.message || 'Employee updated successfully!';
      document.getElementById('modalSuccessAlert').classList.remove('hidden');
      document.getElementById('modalErrorAlert').classList.add('hidden');

      await delay(1500);
      await closeEditModal();
      window.location.reload();
    } else {
      document.getElementById('modalErrorMessage').textContent =
        data.error || 'Failed to update employee';
      document.getElementById('modalErrorAlert').classList.remove('hidden');
      document.getElementById('modalSuccessAlert').classList.add('hidden');
    }
  } catch (error) {
    document.getElementById('modalErrorMessage').textContent =
      'An error occurred. Please try again.';
    document.getElementById('modalErrorAlert').classList.remove('hidden');
    document.getElementById('modalSuccessAlert').classList.add('hidden');
  } finally {
    updateBtn.disabled = false;
    updateBtn.innerHTML = originalBtnContent;
  }
}

// EX-EMPLOYEE WARNING
document.querySelectorAll('input[name="editRole"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const warning = document.getElementById('exEmployeeWarning');
    const checked = document.querySelector('input[name="editRole"]:checked');
    warning.classList.toggle('hidden', checked?.value !== 'ex-employee');
  });
});

document.getElementById('editEmployeeModal')?.addEventListener('click', function (e) {
  if (e.target === this) closeEditModal();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const editModal = document.getElementById('editEmployeeModal');
    if (editModal && !editModal.classList.contains('hidden')) closeEditModal();

    const statusModal = document.getElementById('statusModal');
    if (statusModal && !statusModal.classList.contains('hidden')) closeStatusModal();
  }
});

// STATUS MODAL

let selectedUserId = null;
let newStatus = null;

function toggleUserStatus(button, employeeName, employeeUserId) {
  selectedUserId = button.dataset.id;

  const currentStatus = button.dataset.active === 'true';
  newStatus = !currentStatus;

  const modal = document.getElementById('statusModal');
  const content = document.getElementById('statusModalContent');
  const title = document.getElementById('statusTitle');
  const message = document.getElementById('statusMessage');
  const statusBadge = document.getElementById('currentStatusBadge');
  const confirmBtn = document.getElementById('confirmStatusBtn');

  document.getElementById('statusEmployeeName').textContent = employeeName;
  document.getElementById('statusEmployeeUserId').textContent = employeeUserId;

  if (currentStatus) {
    statusBadge.className =
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700';
    statusBadge.innerHTML = '<span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Active';
  } else {
    statusBadge.className =
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700';
    statusBadge.innerHTML = '<span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Inactive';
  }

  if (newStatus) {
    title.textContent = 'Activate Employee';
    message.textContent = 'This will restore account access';
    confirmBtn.textContent = 'Activate';
    confirmBtn.className =
      'px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded transition';
  } else {
    title.textContent = 'Deactivate Employee';
    message.textContent = 'This will revoke account access';
    confirmBtn.textContent = 'Deactivate';
    confirmBtn.className =
      'px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded transition';
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
  }, 50);
}

function closeStatusModal() {
  const modal = document.getElementById('statusModal');
  const content = document.getElementById('statusModalContent');

  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 200);
}

document.getElementById('confirmStatusBtn').addEventListener('click', async function () {
  const btn = this;
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Processing...';

  try {
    await new Promise((r) => setTimeout(r, 1500));

    const res = await fetch(`/admin/dashboard/${selectedUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newStatus }),
    });

    const data = await res.json();

    if (data.success) {
      closeStatusModal();
      window.location.reload();
    } else {
      alert(data.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (err) {
    alert('Error occurred');
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

document.getElementById('statusModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'statusModal') closeStatusModal();
});
