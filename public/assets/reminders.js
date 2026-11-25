'use strict';

const reminderState = { filter: 'pending', deleteId: null };

function updateReminderBadge() {
    if (!state.data) return;
    const today = dateKey(new Date());
    const count = (state.data.reminders || []).filter(reminder => !reminder.completed
        && reminder.date && reminder.date <= today).length;
    const badge = $('#reminder-due-count');
    badge.hidden = count === 0;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} recordatorios pendientes para hoy o vencidos`);
}

function renderReminders() {
    updateReminderBadge();
    const reminders = state.data.reminders || [];
    const pending = reminders.filter(reminder => !reminder.completed).length;
    const visible = reminders.filter(reminder => reminderState.filter === 'all'
        || reminder.completed === (reminderState.filter === 'completed'));
    $('#reminder-count').textContent = `${pending} pendientes · ${reminders.length - pending} completados`;
    $('#reminder-list').innerHTML = visible.map(reminder => {
        const id = escapeHtml(reminder.id);
        return `<tr>
            <td class="w-10 align-middle"><input type="checkbox" class="checkbox checkbox-sm checkbox-success" data-reminder-id="${id}" ${reminder.completed ? 'checked' : ''} aria-label="${reminder.completed ? 'Marcar como pendiente' : 'Completar'}: ${escapeHtml(reminder.title)}"></td>
            <td class="min-w-56 py-3 align-middle">
                <h3 class="break-words text-sm font-medium ${reminder.completed ? 'text-base-content/50 line-through' : ''}">${escapeHtml(reminder.title)}</h3>
                ${reminder.date ? `<p class="mt-1 text-xs text-base-content/60"><time datetime="${escapeHtml(reminder.date)}">${escapeHtml(formatDate(localDate(reminder.date), { day: 'numeric', month: 'long', year: 'numeric' }))}</time></p>` : ''}
                ${reminder.description ? `<p class="mt-1 whitespace-pre-wrap break-words text-xs text-base-content/60">${escapeHtml(reminder.description)}</p>` : ''}
            </td>
            <td class="align-middle"><div class="flex justify-end gap-1"><button class="btn btn-xs" data-reminder-action="edit" data-reminder-id="${id}">Editar</button><button class="btn btn-ghost btn-xs text-error" data-reminder-action="delete" data-reminder-id="${id}">Eliminar</button></div></td>
        </tr>`;
    }).join('') || `<tr><td colspan="3" class="p-6 text-center text-sm text-base-content/60">${reminders.length ? 'No hay recordatorios en este filtro.' : 'Aún no tienes recordatorios. Agrega el primero con «Nuevo recordatorio».'}</td></tr>`;
}

function openReminder(reminder = null) {
    if (!state.data || state.saving) return;
    const form = $('#reminder-form');
    form.reset();
    form.elements.id.value = reminder?.id || '';
    form.elements.title.value = reminder?.title || '';
    form.elements.description.value = reminder?.description || '';
    form.elements.date.value = reminder?.date || '';
    form.elements.completed.checked = reminder?.completed || false;
    $('#reminder-dialog-title').textContent = reminder ? 'Editar recordatorio' : 'Nuevo recordatorio';
    $('#reminder-error').textContent = '';
    $('#reminder-dialog').showModal();
}

function initializeReminders() {
    setInterval(updateReminderBadge, 60000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateReminderBadge();
    });
    $('#nav-reminders').addEventListener('click', () => showView('reminders'));
    $('#reminder-filter').addEventListener('change', event => {
        reminderState.filter = event.target.value;
        renderReminders();
    });
    $('#reminder-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = Object.fromEntries(new FormData(form));
        if (await save({
            ...input,
            completed: form.elements.completed.checked,
            action: input.id ? 'reminder.update' : 'reminder.create',
        }, form, $('#reminder-error'))) {
            $('#reminder-dialog').close();
            toast(input.id ? 'Recordatorio actualizado.' : 'Recordatorio guardado.');
        }
    });
    $('#reminder-list').addEventListener('change', async event => {
        const checkbox = event.target.closest('input[data-reminder-id]');
        if (!checkbox) return;
        const reminder = state.data.reminders.find(item => item.id === checkbox.dataset.reminderId);
        if (!reminder) return;
        if (state.saving) {
            checkbox.checked = reminder.completed;
            return;
        }
        const completed = checkbox.checked;
        if (await save({ action: 'reminder.complete', id: reminder.id, completed }, $('#reminder-list'), $('#reminder-list-error'))) {
            toast(completed ? 'Recordatorio completado.' : 'Recordatorio pendiente.');
        } else {
            checkbox.checked = reminder.completed;
        }
    });
    $('#reminder-list').addEventListener('click', event => {
        const button = event.target.closest('[data-reminder-action]');
        if (!button || state.saving) return;
        const reminder = state.data.reminders.find(item => item.id === button.dataset.reminderId);
        if (!reminder) return;
        if (button.dataset.reminderAction === 'edit') openReminder(reminder);
        if (button.dataset.reminderAction === 'delete') {
            reminderState.deleteId = reminder.id;
            $('#reminder-delete-description').textContent = `Se eliminará «${reminder.title}». Esta acción no se puede deshacer.`;
            $('#reminder-delete-error').textContent = '';
            $('#reminder-delete-dialog').showModal();
        }
    });
    $('#confirm-reminder-delete').addEventListener('click', async () => {
        if (await save({ action: 'reminder.delete', id: reminderState.deleteId, confirmed: true }, $('#reminder-delete-dialog'), $('#reminder-delete-error'))) {
            $('#reminder-delete-dialog').close();
            reminderState.deleteId = null;
            toast('Recordatorio eliminado.');
        }
    });
}
