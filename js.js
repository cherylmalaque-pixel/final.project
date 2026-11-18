document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('booking-form');
  const alertMsg = document.getElementById('alert-msg');
  const tableBody = document.getElementById('records-table-body');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const dateInput = document.getElementById('booking-date');
  const editIndexInput = document.getElementById('edit-index');
  const submitButton = document.getElementById('submit-btn');
  const cancelEditButton = document.getElementById('cancel-edit-btn');
  const recoveryButton = document.getElementById('recover-storage-btn');
  const summary = document.getElementById('booking-summary');
  const storageKey = 'appointments';
  const validServices = new Set([
    'General Consultation',
    'Dental Checkup',
    'Therapy Session'
  ]);
  const validTimes = new Set(['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM']);
  let alertTimer;
  let storageNeedsRecovery = false;
  let appointments = [];

  function showAlert(message, type = 'danger') {
    alertMsg.textContent = message;
    alertMsg.className = `alert alert-${type}`;
    if (alertTimer) {
      clearTimeout(alertTimer);
    }
    alertTimer = setTimeout(() => alertMsg.classList.add('hidden'), 6000);
  }

  function getToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  function isValidAppointment(app) {
    return app !== null &&
      typeof app === 'object' &&
      typeof app.refCode === 'string' &&
      app.refCode.length > 0 &&
      typeof app.name === 'string' &&
      app.name.trim().length > 0 &&
      validServices.has(app.service) &&
      isValidDate(app.date) &&
      validTimes.has(app.time) &&
      (app.status === 'Confirmed' || app.status === 'Cancelled');
  }

  function loadAppointments() {
    let stored;
    try {
      stored = localStorage.getItem(storageKey);
    } catch (error) {
      showAlert('This browser does not allow access to saved appointments. Changes may not be retained.');
      return [];
    }

    if (stored === null) {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      storageNeedsRecovery = true;
      recoveryButton.classList.remove('hidden');
      showAlert('Saved appointment data is unreadable. Repair it before making changes.');
      return [];
    }

    if (!Array.isArray(parsed)) {
      storageNeedsRecovery = true;
      recoveryButton.classList.remove('hidden');
      showAlert('Saved appointment data has an invalid format. Repair it before making changes.');
      return [];
    }

    const validRecords = parsed.filter(isValidAppointment);
    if (validRecords.length !== parsed.length) {
      storageNeedsRecovery = true;
      recoveryButton.classList.remove('hidden');
      showAlert('Some saved records are invalid and were skipped. Repair the saved data before making changes.', 'warning');
    }
    return validRecords;
  }

  function saveAppointments(updatedAppointments, repair = false) {
    if (storageNeedsRecovery && !repair) {
      showAlert('Repair the saved data before making changes.');
      return false;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedAppointments));
    } catch (error) {
      showAlert('Could not save appointments in this browser. Check browser storage and try again.');
      return false;
    }

    appointments = updatedAppointments;
    storageNeedsRecovery = false;
    recoveryButton.classList.add('hidden');
    return true;
  }

  function addCell(row, label, content) {
    const cell = document.createElement('td');
    cell.dataset.label = label;
    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content;
    }
    row.appendChild(cell);
    return cell;
  }

  function makeActionButton(text, action, index, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn table-action ${className}`;
    button.textContent = text;
    button.dataset.action = action;
    button.dataset.index = String(index);
    return button;
  }

  function renderTable() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedStatus = statusFilter.value;
    const matches = appointments
      .map((appointment, index) => ({ appointment, index }))
      .filter(({ appointment }) => {
        const matchesQuery =
          appointment.name.toLocaleLowerCase().includes(query) ||
          appointment.refCode.toLocaleLowerCase().includes(query);
        const matchesStatus = !selectedStatus || appointment.status === selectedStatus;
        return matchesQuery && matchesStatus;
      });

    tableBody.replaceChildren();
    if (matches.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'empty-state';
      cell.textContent = appointments.length === 0
        ? 'No appointments yet. Choose a service to make your first booking.'
        : 'No appointments match your search or filter.';
      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    matches.forEach(({ appointment, index }) => {
      const row = document.createElement('tr');
      const reference = document.createElement('strong');
      reference.textContent = appointment.refCode;
      addCell(row, 'Reference', reference);
      addCell(row, 'Name', appointment.name);
      addCell(row, 'Service', appointment.service);
      addCell(row, 'Date & time', `${appointment.date} at ${appointment.time}`);

      const status = document.createElement('span');
      status.className = `status-chip ${appointment.status === 'Cancelled' ? 'status-cancelled' : 'status-confirmed'}`;
      status.textContent = appointment.status;
      addCell(row, 'Status', status);

      const actions = document.createElement('div');
      actions.className = 'table-actions';
      actions.appendChild(makeActionButton('Edit', 'edit', index, 'edit-btn'));
      if (appointment.status === 'Confirmed') {
        actions.appendChild(makeActionButton('Cancel', 'cancel', index, 'danger-btn'));
      } else {
        actions.appendChild(makeActionButton('Restore', 'restore', index, 'secondary-btn'));
      }
      actions.appendChild(makeActionButton('Delete', 'delete', index, 'text-btn'));
      addCell(row, 'Actions', actions);
      tableBody.appendChild(row);
    });
  }

  function resetForm() {
    form.reset();
    editIndexInput.value = '-1';
    submitButton.textContent = 'Confirm booking';
    cancelEditButton.classList.add('hidden');
  }

  function showSummary(appointment, title) {
    document.getElementById('summary-title').textContent = title;
    document.getElementById('summary-ref').textContent = appointment.refCode;
    document.getElementById('summary-name').textContent = appointment.name;
    document.getElementById('summary-service').textContent = appointment.service;
    document.getElementById('summary-datetime').textContent = `${appointment.date} at ${appointment.time}`;
    document.getElementById('summary-status').textContent = appointment.status;
    summary.classList.remove('hidden');
    summary.focus();
  }

  function hasSlotConflict(date, time, ignoreIndex = -1) {
    return appointments.some((appointment, index) =>
      index !== ignoreIndex &&
      appointment.date === date &&
      appointment.time === time &&
      appointment.status === 'Confirmed'
    );
  }

  function generateReferenceCode() {
    let reference;
    do {
      reference = `QB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (appointments.some(appointment => appointment.refCode === reference));
    return reference;
  }

  function beginEdit(index) {
    const appointment = appointments[index];
    if (!appointment) {
      showAlert('That appointment could not be found. Refresh the list and try again.');
      return;
    }

    document.getElementById('client-name').value = appointment.name;
    document.getElementById('service-type').value = appointment.service;
    dateInput.value = appointment.date;
    document.getElementById('booking-time').value = appointment.time;
    editIndexInput.value = String(index);
    submitButton.textContent = 'Save changes';
    cancelEditButton.classList.remove('hidden');
    summary.classList.add('hidden');
    window.location.hash = '#book';
    document.getElementById('client-name').focus();
  }

  function updateStatus(index, status) {
    const appointment = appointments[index];
    if (!appointment) {
      showAlert('That appointment could not be found. Refresh the list and try again.');
      return;
    }

    if (status === 'Confirmed') {
      if (appointment.date < getToday()) {
        showAlert('Past appointments cannot be restored. Edit the date first.');
        return;
      }
      if (hasSlotConflict(appointment.date, appointment.time, index)) {
        showAlert('That time slot has since been booked. Edit this appointment to choose another slot.');
        return;
      }
    }

    const updatedAppointments = appointments.map((item, itemIndex) =>
      itemIndex === index ? { ...item, status } : item
    );
    if (saveAppointments(updatedAppointments)) {
      renderTable();
      showAlert(`Appointment ${status.toLowerCase()}.`, 'success');
    }
  }

  dateInput.min = getToday();
  appointments = loadAppointments();
  renderTable();

  document.querySelectorAll('[data-book-service]').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById('service-type').value = button.dataset.bookService;
      document.getElementById('book').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('client-name').focus({ preventScroll: true });
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();

    const name = document.getElementById('client-name').value.trim();
    const service = document.getElementById('service-type').value;
    const date = dateInput.value;
    const time = document.getElementById('booking-time').value;
    const editIndex = Number.parseInt(editIndexInput.value, 10);

    if (!name) {
      showAlert('Enter your full name.');
      document.getElementById('client-name').focus();
      return;
    }
    if (!validServices.has(service)) {
      showAlert('Choose one of the listed services.');
      document.getElementById('service-type').focus();
      return;
    }
    if (!date || date < getToday()) {
      showAlert('Choose today or a future date.');
      dateInput.focus();
      return;
    }
    if (!validTimes.has(time)) {
      showAlert('Choose one of the available time slots.');
      document.getElementById('booking-time').focus();
      return;
    }
    if (storageNeedsRecovery) {
      showAlert('Repair the saved data before making changes.');
      return;
    }
    if (hasSlotConflict(date, time, editIndex)) {
      showAlert('This date and time slot is already booked. Choose another available slot.');
      document.getElementById('booking-time').focus();
      return;
    }

    let appointment;
    let updatedAppointments;
    if (editIndex === -1) {
      appointment = {
        refCode: generateReferenceCode(),
        name,
        service,
        date,
        time,
        status: 'Confirmed'
      };
      updatedAppointments = [...appointments, appointment];
    } else {
      const existing = appointments[editIndex];
      if (!Number.isInteger(editIndex) || !existing) {
        showAlert('That appointment could not be found. Refresh the list and try again.');
        resetForm();
        return;
      }
      appointment = { ...existing, name, service, date, time };
      updatedAppointments = appointments.map((item, index) => index === editIndex ? appointment : item);
    }

    if (!saveAppointments(updatedAppointments)) {
      return;
    }

    renderTable();
    resetForm();
    summary.classList.remove('hidden');
    showSummary(appointment, editIndex === -1 ? 'Appointment confirmed' : 'Appointment updated');
    showAlert(editIndex === -1 ? 'Your appointment has been booked.' : 'Your appointment has been updated.', 'success');
  });

  cancelEditButton.addEventListener('click', () => {
    resetForm();
    showAlert('Editing stopped. No changes were made.', 'success');
  });

  tableBody.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || !tableBody.contains(button)) {
      return;
    }

    const index = Number.parseInt(button.dataset.index, 10);
    const appointment = appointments[index];
    if (!Number.isInteger(index) || !appointment) {
      showAlert('That appointment could not be found. Refresh the list and try again.');
      return;
    }

    switch (button.dataset.action) {
      case 'edit':
        beginEdit(index);
        break;
      case 'cancel':
        if (window.confirm(`Cancel the appointment ${appointment.refCode}?`)) {
          updateStatus(index, 'Cancelled');
        }
        break;
      case 'restore':
        updateStatus(index, 'Confirmed');
        break;
      case 'delete':
        if (window.confirm(`Permanently delete appointment ${appointment.refCode}?`)) {
          const updatedAppointments = appointments.filter((item, itemIndex) => itemIndex !== index);
          if (saveAppointments(updatedAppointments)) {
            renderTable();
            showAlert('Appointment deleted.', 'success');
          }
        }
        break;
      default:
        showAlert('That action is not available.');
    }
  });

  searchInput.addEventListener('input', renderTable);
  statusFilter.addEventListener('change', renderTable);

  recoveryButton.addEventListener('click', () => {
    if (!window.confirm('Replace unreadable saved data with the readable appointments currently shown?')) {
      return;
    }
    if (saveAppointments(appointments, true)) {
      renderTable();
      showAlert('Saved data repaired. New changes will be stored in this browser.', 'success');
    }
  });
});
