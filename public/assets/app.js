'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
let categories = [];
let categoryButtonColors = { Todas: 'btn-neutral' };
const state = { data: null, week: monday(new Date()), category: 'Todas', search: '', view: 'week', saving: false, deleteId: null, reportReady: false };
const csrf = $('meta[name="csrf-token"]').content;
let toastTimer;
let pendingImport = null;
let aiController = null;
let aiSuggestion = null;

function setTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]').content = dark ? '#121212' : '#ffffff';
    $('#theme-toggle').textContent = dark ? 'Modo claro' : 'Modo oscuro';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    try { localStorage.setItem('bitacora-theme', theme); } catch {}
}

setTheme(document.documentElement.dataset.theme);
$('#theme-toggle').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

function localDate(value) {
    return new Date(`${value}T12:00:00`);
}

function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, count) {
    const result = new Date(date);
    result.setDate(result.getDate() + count);
    return result;
}

function monday(date) {
    const result = new Date(date);
    result.setHours(12, 0, 0, 0);
    result.setDate(result.getDate() - (result.getDay() + 6) % 7);
    return result;
}

function formatDate(date, options) {
    return new Intl.DateTimeFormat('es', options).format(date);
}

function weekRange(start) {
    const end = addDays(start, 4);
    const month = 'long';
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `Semana del ${start.getDate()} al ${end.getDate()} de ${formatDate(end, { month })} de ${end.getFullYear()}`;
    }
    return `Semana del ${formatDate(start, { day: 'numeric', month, year: 'numeric' })} al ${formatDate(end, { day: 'numeric', month, year: 'numeric' })}`;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function normalize(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tasksOfWeek() {
    const start = dateKey(state.week);
    const end = dateKey(addDays(state.week, 4));
    return state.data.tasks.filter(task => task.date >= start && task.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}

function toast(message, error = false) {
    clearTimeout(toastTimer);
    const region = $('#toast-region');
    region.replaceChildren();
    const item = document.createElement('div');
    item.className = `toast-message${error ? ' error' : ''}`;
    item.textContent = message;
    region.append(item);
    toastTimer = setTimeout(() => region.replaceChildren(), 4500);
}

function storageStatus(text, error = false) {
    const status = $('#storage-status');
    status.classList.toggle('error', error);
    status.replaceChildren(document.createElement('span'), document.createTextNode(text));
}

async function request(input) {
    const response = await fetch('api.php', {
        method: input ? 'POST' : 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: input ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {},
        body: input ? JSON.stringify(input) : undefined,
    });
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('El servidor no respondió correctamente. Comprueba que la app esté ejecutándose con PHP.');
    }
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
}

async function save(input, form, errorTarget) {
    if (state.saving) return false;
    state.saving = true;
    const controls = [...form.querySelectorAll('button, input, textarea, select')];
    controls.forEach(control => { control.disabled = true; });
    errorTarget.textContent = '';
    storageStatus('Guardando…');
    try {
        state.data = await request(input);
        state.reportReady = false;
        render();
        storageStatus('Guardado en JSON');
        return true;
    } catch (error) {
        errorTarget.textContent = error.message;
        storageStatus('No se pudo guardar', true);
        return false;
    } finally {
        state.saving = false;
        controls.forEach(control => { control.disabled = false; });
    }
}

function categoryColorToken(category) {
    return `--color-${(categoryButtonColors[category] || 'btn-neutral').replace('btn-', '')}`;
}

function renderCategories() {
    categories = state.data.categories.map(category => category.name);
    categoryButtonColors = Object.fromEntries([
        ['Todas', 'btn-neutral'],
        ...state.data.categories.map(category => [category.name, `btn-${category.color}`]),
    ]);
    if (state.category !== 'Todas' && !categories.includes(state.category)) state.category = 'Todas';
    const select = $('#task-category');
    const selected = select.value;
    select.innerHTML = categories.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    if (categories.includes(selected)) select.value = selected;
    $('#categories-list').innerHTML = categories.map(name => {
        const count = state.data.tasks.filter(task => task.category === name).length;
        const token = categoryColorToken(name);
        return `<div class="category-row"><div><span class="badge" style="background:var(${token});color:var(${token}-content)">${escapeHtml(name)}</span><span class="category-usage">${count} ${count === 1 ? 'tarea' : 'tareas'}</span></div><div class="category-actions"><button class="btn btn-xs category-edit-button" type="button" data-edit-category="${escapeHtml(name)}" aria-label="Editar categoría ${escapeHtml(name)}">Editar</button><button class="btn btn-xs btn-error category-delete-button" type="button" data-delete-category="${escapeHtml(name)}" aria-label="Eliminar categoría ${escapeHtml(name)}">Eliminar</button></div></div>`;
    }).join('');
}

function renderProfile() {
    const { profile } = state.data;
    $('#sidebar-name').textContent = profile.name;
    $('#sidebar-area').textContent = profile.area;
    $('#avatar-initials').textContent = profile.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    $('.app-footer>span:last-child').textContent = `Bitácora · ${profile.name}`;
}

function render() {
    if (!state.data) return;
    renderCategories();
    renderProfile();
    renderWeek();
    renderHistory();
}

function renderWeek() {
    const tasks = tasksOfWeek();
    $('#week-range').textContent = weekRange(state.week);
    $('#activity-count').textContent = tasks.length;
    $('#category-filters').innerHTML = ['Todas', ...categories].map(category => `<button class="btn btn-sm filter-chip ${categoryButtonColors[category]}" data-filter="${escapeHtml(category)}" aria-pressed="${state.category === category}">${escapeHtml(category)}</button>`).join('');
    const visible = tasks.filter(task => (state.category === 'Todas' || task.category === state.category)
        && normalize(`${task.title} ${task.description} ${task.category}`).includes(normalize(state.search)));
    const filtered = state.category !== 'Todas' || Boolean(state.search);
    const sections = [];
    const todayKey = dateKey(new Date());
    const days = Array.from({ length: 5 }, (_, offset) => addDays(state.week, offset));
    days.sort((a, b) => Number(dateKey(b) === todayKey) - Number(dateKey(a) === todayKey));
    for (const date of days) {
        const key = dateKey(date);
        const dayTasks = visible.filter(task => task.date === key);
        if (filtered && !dayTasks.length) continue;
        const today = key === todayKey;
        sections.push(`<details class="day-section"${today ? ' open' : ''}>
            <summary class="day-heading"><span class="day-number">${date.getDate()}</span><div><h3>${escapeHtml(capitalize(formatDate(date, { weekday: 'long' })))}</h3><small>${escapeHtml(formatDate(date, { month: 'long', year: 'numeric' }))}</small></div>${today ? '<span class="today-badge">HOY</span>' : ''}<span class="day-count">${dayTasks.length} ${dayTasks.length === 1 ? 'tarea' : 'tareas'}</span><button class="day-add" data-add-date="${key}" title="Añadir tarea" aria-label="Añadir tarea el ${escapeHtml(formatDate(date, { day: 'numeric', month: 'long' }))}">＋</button></summary>
            ${dayTasks.length ? dayTasks.map(taskMarkup).join('') : `<div class="empty-day"><span>Sin tareas.</span><button data-add-date="${key}">＋ Registrar tarea</button></div>`}
        </details>`);
    }
    $('#task-list').innerHTML = sections.length ? sections.join('') : '<div class="empty-results"><h3>No encontramos tareas</h3><p>Prueba otra palabra o categoría.</p><button class="btn" data-clear-filters>Limpiar filtros</button></div>';
}

function taskMarkup(task) {
    return `<article class="task-card" data-category="${escapeHtml(task.category)}" style="--task-color:var(${categoryColorToken(task.category)})"><span class="task-check" aria-label="Tarea realizada">✓</span><div class="task-content"><h4 class="task-title">${escapeHtml(task.title)}</h4>${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}<div class="task-meta"><span class="category-tag" data-category="${escapeHtml(task.category)}">${escapeHtml(task.category)}</span></div></div><div class="task-actions"><button class="btn btn-xs btn-warning task-action" data-edit="${escapeHtml(task.id)}" title="Editar tarea" aria-label="Editar: ${escapeHtml(task.title)}">✎</button><button class="btn btn-xs btn-error task-action delete" data-delete="${escapeHtml(task.id)}" title="Eliminar tarea" aria-label="Eliminar: ${escapeHtml(task.title)}">×</button></div></article>`;
}

function renderHistory() {
    const currentWeek = dateKey(monday(new Date()));
    const weeks = new Map();
    for (const task of state.data.tasks) {
        if ([0, 6].includes(localDate(task.date).getDay())) continue;
        const key = dateKey(monday(localDate(task.date)));
        weeks.set(key, (weeks.get(key) || 0) + 1);
    }
    $('#history-list').innerHTML = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, count]) => `<button class="history-card" data-week="${date}"><strong>${escapeHtml(weekRange(localDate(date)))}${date === currentWeek ? ' <span class="badge badge-success history-status">En curso</span>' : ''}</strong><small>${count} ${count === 1 ? 'tarea registrada' : 'tareas registradas'}<span class="history-arrow">Ver semana →</span></small></button>`).join('') || '<div class="empty-results"><h3>Tu historia empieza aquí</h3><p>Registra una tarea para crear tu primera semana.</p></div>';
}

function showView(view) {
    state.view = view;
    $('#week-view').hidden = view !== 'week';
    $('#history-view').hidden = view !== 'history';
    $('#export-pdf').hidden = view !== 'week';
    $('#nav-week').classList.toggle('active', view === 'week');
    $('#nav-history').classList.toggle('active', view === 'history');
    $('#page-title').textContent = view === 'week' ? 'Reporte semanal' : 'Historial de reportes';
    $('#page-description').textContent = view === 'week' ? '' : 'Consulta tus semanas anteriores.';
    $('#page-description').hidden = view === 'week';
    $('#breadcrumb-current').textContent = view === 'week' ? 'Reporte semanal' : 'Historial de reportes';
}

function changeWeek(date) {
    const key = dateKey(date);
    if (key < '2000-01-01' || key > '2100-12-31') return;
    state.week = monday(date);
    state.category = 'Todas';
    state.search = '';
    state.reportReady = false;
    $('#task-search').value = '';
    showView('week');
    renderWeek();
}

function openTask(date, task = null) {
    if (!state.data) return;
    const form = $('#task-form');
    form.reset();
    $('#task-error').textContent = '';
    form.elements.id.value = task?.id || '';
    form.elements.title.value = task?.title || '';
    form.elements.description.value = task?.description || '';
    form.elements.date.value = task?.date || date;
    form.elements.date.setCustomValidity('');
    form.elements.category.value = task?.category || categories[0] || '';
    resetAiSuggestion();
    $('#task-dialog-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    $('#task-dialog').showModal();
    $('#task-title').focus();
}

function openProfile() {
    if (!state.data) return;
    const form = $('#profile-form');
    for (const [key, value] of Object.entries(state.data.profile)) form.elements[key].value = value;
    $('#profile-error').textContent = '';
    $('#profile-dialog').showModal();
}

function defaultTaskDate() {
    const today = dateKey(new Date());
    return today >= dateKey(state.week) && today <= dateKey(addDays(state.week, 4)) ? today : dateKey(state.week);
}

function resetAiSuggestion() {
    aiController?.abort();
    aiController = null;
    aiSuggestion = null;
    $('#ai-preview').hidden = true;
    $('#ai-error').textContent = '';
    $('#improve-task').textContent = 'Mejorar redacción';
    $('#improve-task').removeAttribute('aria-busy');
    $('#improve-task').disabled = state.saving || !$('#task-title').value.trim();
}

for (const selector of ['#task-title', '#task-description', '#task-category']) {
    $(selector).addEventListener('input', resetAiSuggestion);
}
$('#task-dialog').addEventListener('close', resetAiSuggestion);
$('#discard-ai').addEventListener('click', resetAiSuggestion);
$('#improve-task').addEventListener('click', async () => {
    if (aiController || state.saving || !$('#task-title').value.trim()) return;
    resetAiSuggestion();
    const controller = new AbortController();
    aiController = controller;
    const button = $('#improve-task');
    button.disabled = true;
    button.textContent = 'Mejorando…';
    button.setAttribute('aria-busy', 'true');
    try {
        const response = await fetch('improve.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({
                title: $('#task-title').value,
                description: $('#task-description').value,
                category: $('#task-category').value,
            }),
            signal: controller.signal,
        });
        let data;
        try { data = await response.json(); } catch { throw new Error('El servidor no respondió correctamente. Intenta nuevamente.'); }
        if (aiController !== controller) return;
        if (!response.ok) throw new Error(data.error || 'No se pudo mejorar la redacción.');
        if (typeof data.suggestion?.title !== 'string' || typeof data.suggestion?.description !== 'string') {
            throw new Error('La propuesta recibida no es válida.');
        }
        aiSuggestion = data.suggestion;
        $('#ai-title').textContent = aiSuggestion.title;
        $('#ai-description').textContent = aiSuggestion.description;
        $('#ai-description').hidden = !aiSuggestion.description;
        $('#ai-preview').hidden = false;
    } catch (error) {
        if (aiController === controller && error.name !== 'AbortError') $('#ai-error').textContent = error.message;
    } finally {
        if (aiController === controller) {
            aiController = null;
            button.textContent = 'Mejorar redacción';
            button.removeAttribute('aria-busy');
            button.disabled = state.saving || !$('#task-title').value.trim();
        }
    }
});
$('#apply-ai').addEventListener('click', () => {
    if (!aiSuggestion || state.saving) return;
    $('#task-title').value = aiSuggestion.title;
    $('#task-description').value = aiSuggestion.description;
    resetAiSuggestion();
    toast('Propuesta aplicada. Pulsa «Guardar tarea» para conservarla.');
});

$('#add-task-top').addEventListener('click', () => openTask(defaultTaskDate()));
$('#previous-week').addEventListener('click', () => changeWeek(addDays(state.week, -7)));
$('#next-week').addEventListener('click', () => changeWeek(addDays(state.week, 7)));
$('#current-week').addEventListener('click', () => changeWeek(new Date()));
$('#nav-week').addEventListener('click', () => showView('week'));
$('#nav-history').addEventListener('click', () => showView('history'));
$('#nav-profile').addEventListener('click', openProfile);
function resetCategoryForm() {
    $('#category-form').reset();
    $('#category-form').elements.originalName.value = '';
    $('#category-form-title').textContent = 'Nueva categoría';
    $('#category-submit').textContent = 'Crear categoría';
    $('#category-cancel-edit').hidden = true;
    $('#category-error').textContent = '';
}

$('#category-cancel-edit').addEventListener('click', () => {
    if (!state.saving) resetCategoryForm();
});
$('#nav-categories').addEventListener('click', () => {
    if (!state.data || state.saving) return;
    resetCategoryForm();
    renderCategories();
    $('#categories-dialog').showModal();
});
$('#category-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    const editing = Boolean(input.originalName);
    const selectedCategory = state.category;
    if (await save({ ...input, action: editing ? 'category.update' : 'category.create' }, form, $('#category-error'))) {
        if (editing && selectedCategory === input.originalName) {
            state.category = input.name.trim();
            renderWeek();
        }
        resetCategoryForm();
        toast(editing ? 'Categoría actualizada.' : 'Categoría creada.');
    }
});
$('#categories-list').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-category]');
    if (editButton && !state.saving) {
        const category = state.data.categories.find(item => item.name === editButton.dataset.editCategory);
        if (!category) return;
        const form = $('#category-form');
        form.elements.originalName.value = category.name;
        form.elements.name.value = category.name;
        form.elements.color.value = category.color;
        $('#category-form-title').textContent = 'Editar categoría';
        $('#category-submit').textContent = 'Guardar cambios';
        $('#category-cancel-edit').hidden = false;
        $('#category-error').textContent = '';
        form.elements.name.focus();
        return;
    }
    const button = event.target.closest('[data-delete-category]');
    if (!button || state.saving) return;
    const name = button.dataset.deleteCategory;
    const count = state.data.tasks.filter(task => task.category === name).length;
    const choices = categories.filter(category => category !== name);
    const form = $('#category-delete-form');
    form.reset();
    form.elements.name.value = name;
    $('#category-delete-error').textContent = choices.length ? '' : 'Crea otra categoría antes de eliminar la última.';
    $('#category-delete-submit').disabled = !choices.length;
    $('#category-delete-description').textContent = count
        ? `«${name}» tiene ${count} ${count === 1 ? 'tarea registrada' : 'tareas registradas'}. Se reasignarán a la categoría que elijas; no se eliminará ninguna tarea.`
        : `¿Eliminar la categoría «${name}»? No tiene tareas registradas.`;
    $('#category-replacement-field').hidden = !count;
    $('#category-replacement').required = count > 0;
    $('#category-replacement').innerHTML = '<option value="">Selecciona una categoría</option>'
        + choices.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    $('#category-delete-dialog').showModal();
});
$('#category-delete-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    if (await save({ ...input, action: 'category.delete', confirmed: true }, form, $('#category-delete-error'))) {
        if ($('#category-form').elements.originalName.value === input.name) resetCategoryForm();
        $('#category-delete-dialog').close();
        toast('Categoría eliminada. Las tareas se conservaron.');
    }
});
$('#profile-shortcut').addEventListener('click', openProfile);
$('#task-search').addEventListener('input', event => { state.search = event.target.value.trim(); renderWeek(); });
$('#task-date').addEventListener('input', event => {
    const input = event.currentTarget;
    const weekend = input.value && [0, 6].includes(localDate(input.value).getDay());
    input.setCustomValidity(weekend ? 'Selecciona un día hábil, de lunes a viernes.' : '');
});
$('#category-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.category = button.dataset.filter;
    renderWeek();
});
$('#history-list').addEventListener('click', event => {
    const button = event.target.closest('[data-week]');
    if (button) changeWeek(localDate(button.dataset.week));
});
$('#task-list').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-add-date')) {
        event.preventDefault();
        openTask(button.dataset.addDate);
    }
    if (button.hasAttribute('data-edit')) {
        const task = state.data.tasks.find(item => item.id === button.dataset.edit);
        if (task) openTask(task.date, task);
    }
    if (button.hasAttribute('data-delete')) {
        state.deleteId = button.dataset.delete;
        $('#delete-error').textContent = '';
        $('#delete-dialog').showModal();
    }
    if (button.hasAttribute('data-clear-filters')) {
        state.category = 'Todas';
        state.search = '';
        $('#task-search').value = '';
        renderWeek();
    }
});
document.addEventListener('click', event => {
    const button = event.target.closest('.close-dialog');
    if (button && !state.saving) button.closest('dialog').close();
});
document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { if (state.saving) event.preventDefault(); });
    $('.modal-backdrop', dialog)?.addEventListener('submit', event => { if (state.saving) event.preventDefault(); });
});
$('#task-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    const success = await save({ ...input, action: input.id ? 'task.update' : 'task.create' }, form, $('#task-error'));
    if (success) {
        $('#task-dialog').close();
        changeWeek(localDate(input.date));
        toast(input.id ? 'Tarea actualizada.' : 'Tarea guardada.');
    }
});
$('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    if (await save({ ...input, action: 'profile.update' }, form, $('#profile-error'))) {
        $('#profile-dialog').close();
        toast('Tu perfil está actualizado.');
    }
});
$('#confirm-delete').addEventListener('click', async () => {
    if (await save({ action: 'task.delete', id: state.deleteId }, $('#delete-dialog'), $('#delete-error'))) {
        $('#delete-dialog').close();
        state.deleteId = null;
        toast('Tarea eliminada.');
    }
});
$('#backup-button').addEventListener('click', () => {
    if (!state.data) return;
    const blob = new Blob([JSON.stringify(state.data, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitacora-respaldo-${dateKey(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Respaldo JSON descargado.');
});

function updateImportButton() {
    $('#import-submit').disabled = state.saving || !pendingImport || !$('#import-confirm').checked;
}

$('#nav-import').addEventListener('click', () => {
    if (!state.data) return;
    pendingImport = null;
    $('#import-form').reset();
    $('#import-error').textContent = '';
    $('#import-preview').textContent = '';
    $('#import-preview').hidden = true;
    updateImportButton();
    $('#import-dialog').showModal();
});
$('#import-backup-current').addEventListener('click', () => $('#backup-button').click());
$('#import-confirm').addEventListener('change', updateImportButton);
$('#import-file').addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files[0];
    pendingImport = null;
    $('#import-confirm').checked = false;
    $('#import-error').textContent = '';
    $('#import-preview').hidden = true;
    updateImportButton();
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        $('#import-error').textContent = 'El respaldo supera el límite de 5 MB.';
        return;
    }
    try {
        const backup = JSON.parse(await file.text());
        if (input.files[0] !== file) return;
        if (!backup || typeof backup !== 'object' || !backup.profile
            || typeof backup.profile.name !== 'string' || !Array.isArray(backup.tasks)) {
            throw new Error('El archivo no es un respaldo válido de Bitácora.');
        }
        if (backup.tasks.length > 10000) throw new Error('El respaldo supera el límite de 10000 tareas.');
        pendingImport = backup;
        $('#import-preview').textContent = `${backup.profile.name} · ${backup.tasks.length} tareas en el respaldo. Actualmente tienes ${state.data.tasks.length} tareas que serán reemplazadas.`;
        $('#import-preview').hidden = false;
    } catch (error) {
        if (input.files[0] !== file) return;
        $('#import-error').textContent = error instanceof SyntaxError ? 'El archivo no contiene un JSON válido.' : error.message;
    }
    updateImportButton();
});
$('#import-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!pendingImport || !$('#import-confirm').checked) return;
    const success = await save({ action: 'backup.import', backup: pendingImport, confirmed: true }, event.currentTarget, $('#import-error'));
    updateImportButton();
    if (success) {
        pendingImport = null;
        $('#import-dialog').close();
        showView('history');
        toast('Respaldo importado. Tus datos se han restaurado.');
    }
});

// The report uses native browser printing: no PDF library or external data service.
const reportCss = `
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#ededed;color:#262626;font:14px Arial,Helvetica,sans-serif}
    .sheet{width:210mm;height:297mm;background:#fff;margin:20px auto;padding:15mm 17mm 12mm;display:flex;flex-direction:column;break-after:page;overflow:hidden}
    .report-header{flex:none;display:flex;justify-content:space-between;gap:20px;border-top:4px solid #b83232;padding-top:12px;padding-bottom:14px;border-bottom:1px solid #d4d4d4;margin-bottom:14px}
    .monogram,.overline{display:none}
    h1{font-size:14px;line-height:1.5;margin:0 0 7px;font-weight:600;color:#a52b2b}
    .range{font-size:14px;color:#737373;margin:0}
    .author{text-align:right;padding-top:4px;max-width:250px;overflow-wrap:anywhere}
    .author strong{display:block;font-size:14px;margin-bottom:4px;font-weight:600}
    .author span{display:block;font-size:14px;color:#737373;line-height:1.5}
    .summary{display:flex;flex-wrap:wrap;gap:8px 20px;flex:none;margin-bottom:16px;padding:9px 12px;background:#fff8dc;border-left:4px solid #cadb62;font-size:14px;color:#525252}
    .summary-total{flex-basis:100%}
    .summary strong{font-size:14px;color:#171717;margin-right:5px;font-weight:600}
    .summary-category{color:var(--category-color)}
    .summary-category strong{color:inherit}
    .summary span{font-size:14px}
    .summary-note{display:none}
    .report-body{flex:1;min-height:0;overflow:visible;font-size:var(--task-size);line-height:1.45}
    .day-heading{display:flex;align-items:center;gap:9px;background:#fff8dc;border-bottom:1px solid #eee3b6;padding:7px 9px;margin:0 0 7px}
    .day-heading:not(:first-child){margin-top:9px}
    .day-heading .number{min-width:28px;padding:4px;background:#e4ed9b;color:#171717;text-align:center;font-weight:600;font-size:14px}
    .day-heading strong{font-size:14px;display:block;font-weight:600;color:#171717}
    .day-heading small{display:block;font-size:14px;color:#737373;margin-top:2px}
    .day-heading .day-total{margin-left:auto;color:#737373;font-size:14px}
    .report-task{padding:0 0 7px 13px;position:relative;overflow-wrap:anywhere}
    .report-task:before{content:"";position:absolute;left:1px;top:6px;width:3px;height:3px;background:#b83232;border-radius:50%}
    .report-task p{margin:0;white-space:pre-wrap}
    .report-task .task-title{font-weight:400;color:#171717}
    .report-task .task-detail{color:#737373;font-size:inherit;margin-top:2px}
    .report-task .task-category{display:inline-block;margin-left:6px;padding:1px 5px;border:1px solid currentColor;border-radius:3px;color:var(--category-color);font-size:.9em;line-height:1.3;white-space:nowrap}
    .report-empty{font-size:14px;color:#737373;margin:0;padding:0 0 8px 13px}
    .report-footer{flex:none;border-top:1px solid #e5e5e5;margin-top:13px;padding-top:10px;display:flex;justify-content:space-between;gap:15px;font-size:14px;color:#737373}
    .report-footer>span:first-child{max-width:80%;overflow-wrap:anywhere}
    .report-footer b{color:#262626;font-weight:400}
    @page{size:A4 portrait;margin:0}
    @media print{html,body{width:210mm;background:#fff}#report-pages{zoom:1!important}.sheet{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}}
`;

function reportHeader(profile) {
    const initials = profile.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    return `<header class="report-header"><div><div class="monogram">${escapeHtml(initials)}</div><p class="overline">BITÁCORA DE ACTIVIDADES</p><h1>Reporte semanal</h1><p class="range">${escapeHtml(weekRange(state.week))}</p></div><div class="author"><strong>${escapeHtml(profile.name)}</strong><span>${escapeHtml(profile.role)}</span><span>${escapeHtml(profile.area)}</span></div></header>`;
}

function buildReport() {
    const tasks = tasksOfWeek();
    const frame = $('#report-frame');
    state.reportReady = false;
    $('#print-report').disabled = true;
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(`Reporte semanal - ${state.data.profile.name} - ${dateKey(state.week)}`)}</title><style>${reportCss}</style></head><body><main id="report-pages"></main></body></html>`);
    doc.close();
    const pagesRoot = doc.getElementById('report-pages');
    const profile = state.data.profile;
    const includeEmpty = $('#include-empty-days').checked;
    const groups = [];
    for (let offset = 0; offset < 5; offset++) {
        const date = addDays(state.week, offset);
        const items = tasks.filter(task => task.date === dateKey(date));
        if (items.length || includeEmpty) groups.push({ date, items });
    }
    const categoryCounts = categories.map(category => ({
        category,
        count: tasks.filter(task => task.category === category).length,
        color: getComputedStyle(document.documentElement).getPropertyValue(categoryColorToken(category)).trim() || '#525252',
    })).filter(({ count }) => count > 0);
    const summary = `<div class="summary"><div class="summary-total"><strong>${tasks.length}</strong><span>Tareas realizadas</span></div>${categoryCounts.map(({ category, count, color }) => `<div class="summary-category" style="--category-color:${escapeHtml(color)}"><span>${escapeHtml(category)}:</span> <strong>${count}</strong></div>`).join('')}</div>`;
    let pageBodies = [];
    let body;

    function newPage() {
        const sheet = doc.createElement('article');
        sheet.className = 'sheet';
        sheet.innerHTML = (pageBodies.length === 0 ? reportHeader(profile) + summary : '')
            + `<div class="report-body"></div><footer class="report-footer"><span>${escapeHtml(profile.name)} · ${escapeHtml(profile.area)}</span><span class="page-count"></span></footer>`;
        pagesRoot.append(sheet);
        body = sheet.querySelector('.report-body');
        pageBodies.push(body);
    }

    function heading(group) {
        const node = doc.createElement('div');
        node.className = 'day-heading';
        node.innerHTML = `<span class="number">${group.date.getDate()}</span><div><strong>${escapeHtml(formatDate(group.date, { weekday: 'long' }))}</strong><small>${escapeHtml(formatDate(group.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></div><span class="day-total">${group.items.length} ${group.items.length === 1 ? 'tarea' : 'tareas'}</span>`;
        body.append(node);
        return node;
    }

    function taskNode(task, fragment = null) {
        const node = doc.createElement('div');
        node.className = 'report-task';
        node.style.setProperty('--category-color', categoryCounts.find(row => row.category === task.category)?.color || '#525252');
        if (fragment !== null) {
            const paragraph = doc.createElement('p');
            paragraph.textContent = fragment;
            node.append(paragraph);
        } else {
            node.innerHTML = `<p class="task-title">${escapeHtml(task.title)}</p>${task.description ? `<p class="task-detail">${escapeHtml(task.description)}</p>` : ''}`;
        }
        const label = doc.createElement('span');
        label.className = 'task-category';
        label.textContent = task.category;
        node.firstElementChild.append(' ', label);
        return node;
    }

    function fits() {
        return body.scrollHeight <= body.clientHeight;
    }

    function paginate(size) {
        pagesRoot.replaceChildren();
        pagesRoot.style.setProperty('--task-size', `${size}pt`);
        pageBodies = [];
        newPage();
        for (const group of groups) {
            let dayHeading = heading(group);
            if (!group.items.length) {
                const empty = doc.createElement('p');
                empty.className = 'report-empty';
                empty.textContent = 'Sin actividades registradas.';
                body.append(empty);
                if (!fits()) {
                    empty.remove();
                    dayHeading.remove();
                    newPage();
                    dayHeading = heading(group);
                    body.append(empty);
                }
            }
            for (const task of group.items) {
                const node = taskNode(task);
                body.append(node);
                if (fits()) continue;
                node.remove();
                const hasDayTasks = dayHeading === null || dayHeading.nextElementSibling !== null;
                if (!hasDayTasks) dayHeading.remove();
                if (body.children.length) {
                    newPage();
                }
                dayHeading = hasDayTasks ? null : heading(group);
                body.append(node);
                if (fits()) continue;
                node.remove();
                // Very long entries are split across pages, never truncated.
                const characters = Array.from(task.title + (task.description ? '\n' + task.description : ''));
                let offset = 0;
                while (offset < characters.length) {
                    let low = 1;
                    let high = characters.length - offset;
                    let best = 0;
                    while (low <= high) {
                        const middle = Math.floor((low + high) / 2);
                        const candidate = taskNode(task, characters.slice(offset, offset + middle).join(''));
                        body.append(candidate);
                        const fitsHere = fits();
                        candidate.remove();
                        if (fitsHere) { best = middle; low = middle + 1; } else { high = middle - 1; }
                    }
                    if (!best) {
                        const moveHeading = dayHeading !== null && dayHeading.nextElementSibling === null;
                        if (moveHeading) dayHeading.remove();
                        newPage();
                        dayHeading = moveHeading ? heading(group) : null;
                        continue;
                    }
                    body.append(taskNode(task, characters.slice(offset, offset + best).join('')));
                    offset += best;
                    if (offset < characters.length) {
                        newPage();
                        dayHeading = null;
                    }
                }
            }
        }
        return pageBodies.length;
    }

    let pageCount;
    for (const fontSize of [10.2, 9.6, 9]) {
        pageCount = paginate(fontSize);
        if (pageCount <= 3) break;
    }
    doc.querySelectorAll('.page-count').forEach((node, index) => {
        node.innerHTML = `<b>${String(index + 1).padStart(2, '0')}</b> / ${String(pageCount).padStart(2, '0')}`;
    });
    $('#report-instructions').textContent = `${pageCount} ${pageCount === 1 ? 'página' : 'páginas'} A4.${pageCount > 3 ? ' Esta semana supera las 3 páginas; se conserva todo el contenido.' : ''} Para descargar, elige «Guardar como PDF», A4, escala 100 % y desactiva los encabezados y pies del navegador.`;
    fitPreview();
    state.reportReady = true;
    $('#print-report').disabled = false;
}

function fitPreview() {
    const frame = $('#report-frame');
    const pages = frame.contentDocument?.getElementById('report-pages');
    if (pages) pages.style.zoom = Math.min(1, Math.max(0.25, (frame.clientWidth - 24) / (210 * 96 / 25.4)));
}

function openReport() {
    if (!state.data) return;
    if (!tasksOfWeek().length) {
        toast('Registra al menos una tarea para generar el reporte.', true);
        return;
    }
    $('#report-dialog').showModal();
    try {
        buildReport();
    } catch {
        $('#report-instructions').textContent = 'No se pudo preparar el reporte. Cierra esta ventana y vuelve a intentarlo.';
        toast('No se pudo preparar el reporte.', true);
    }
}

$('#export-pdf').addEventListener('click', openReport);
$('#include-empty-days').addEventListener('change', () => {
    try { buildReport(); } catch { toast('No se pudo actualizar la vista previa.', true); }
});
$('#print-report').addEventListener('click', () => {
    if (!state.reportReady) return;
    const frame = $('#report-frame');
    frame.contentWindow.focus();
    frame.contentWindow.print();
});
window.addEventListener('resize', fitPreview);

async function initialize() {
    const requiresData = ['#add-task-top', '#previous-week', '#next-week', '#current-week', '#export-pdf', '#nav-history', '#nav-profile', '#nav-import', '#nav-categories', '#profile-shortcut', '#backup-button', '#task-search'];
    requiresData.forEach(selector => { $(selector).disabled = true; });
    try {
        state.data = await request();
        render();
        storageStatus('Guardado en JSON');
    } catch (error) {
        $('#task-list').innerHTML = `<div class="empty-results"><h3>No se pudo abrir tu bitácora</h3><p>${escapeHtml(error.message)}</p><button class="btn" id="retry-load">Volver a intentar</button></div>`;
        $('#retry-load').addEventListener('click', initialize);
        storageStatus('Sin conexión con el JSON', true);
    } finally {
        if (state.data) requiresData.forEach(selector => { $(selector).disabled = false; });
    }
}

initialize();
