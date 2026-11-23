'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
let categories = [];
const categoryPalette = {
    neutral: { button: 'btn-neutral', badge: 'badge-neutral', text: 'text-base-content/70' },
    info: { button: 'btn-info', badge: 'badge-info', text: 'text-info' },
    error: { button: 'btn-error', badge: 'badge-error', text: 'text-error' },
    warning: { button: 'btn-warning', badge: 'badge-warning', text: 'text-warning' },
    success: { button: 'btn-success', badge: 'badge-success', text: 'text-success' },
    secondary: { button: 'btn-secondary', badge: 'badge-secondary', text: 'text-secondary' },
    accent: { button: 'btn-accent', badge: 'badge-accent', text: 'text-accent' },
    orange: { button: 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700', badge: 'border-orange-600 bg-orange-600 text-white', text: 'text-orange-600' },
    violet: { button: 'border-violet-500 bg-violet-500 text-white hover:bg-violet-600', badge: 'border-violet-500 bg-violet-500 text-white', text: 'text-violet-500' },
    purple: { button: 'border-fuchsia-600 bg-fuchsia-600 text-white hover:bg-fuchsia-700', badge: 'border-fuchsia-600 bg-fuchsia-600 text-white', text: 'text-fuchsia-600' },
    indigo: { button: 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700', badge: 'border-indigo-600 bg-indigo-600 text-white', text: 'text-indigo-500' },
    lime: { button: 'border-lime-500 bg-lime-500 text-lime-950 hover:bg-lime-600', badge: 'border-lime-500 bg-lime-500 text-lime-950', text: 'text-lime-600' },
    emerald: { button: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700', badge: 'border-emerald-600 bg-emerald-600 text-white', text: 'text-emerald-600' },
    cyan: { button: 'border-cyan-500 bg-cyan-500 text-cyan-950 hover:bg-cyan-600', badge: 'border-cyan-500 bg-cyan-500 text-cyan-950', text: 'text-cyan-600' },
    brown: { button: 'border-amber-800 bg-amber-800 text-white hover:bg-amber-900', badge: 'border-amber-800 bg-amber-800 text-white', text: 'text-amber-700' },
};
const state = { data: null, week: monday(new Date()), category: 'Todas', search: '', view: 'week', saving: false, deleteId: null, reportReady: false };
const csrf = $('meta[name="csrf-token"]').content;
let toastTimer;
let pendingImport = null;
let aiController = null;
let aiSuggestion = null;
const scriptLanguages = {
    bash: { name: 'Bash / Shell', extension: 'sh', color: 'border-emerald-700 bg-emerald-700 text-white' },
    powershell: { name: 'PowerShell', extension: 'ps1', color: 'border-blue-800 bg-blue-800 text-white' },
    python: { name: 'Python', extension: 'py', color: 'border-amber-400 bg-amber-400 text-amber-950' },
    javascript: { name: 'JavaScript', extension: 'js', color: 'border-yellow-300 bg-yellow-300 text-yellow-950' },
    typescript: { name: 'TypeScript', extension: 'ts', color: 'border-sky-700 bg-sky-700 text-white' },
    php: { name: 'PHP', extension: 'php', color: 'border-indigo-600 bg-indigo-600 text-white' },
    kotlin: { name: 'Kotlin', extension: 'kts', color: 'border-purple-600 bg-purple-600 text-white' },
    json: { name: 'JSON', extension: 'json', color: 'border-slate-600 bg-slate-600 text-white' },
    sql: { name: 'SQL', extension: 'sql', color: 'border-orange-700 bg-orange-700 text-white' },
    other: { name: 'Otro / Texto', extension: 'txt', color: 'border-stone-600 bg-stone-600 text-white' },
};
const scriptState = { search: '', language: '', favorites: false, deleteId: null };
const scriptLanguageOptions = Object.entries(scriptLanguages).map(([value, language]) => `<option value="${value}">${language.name}</option>`).join('');
$('#script-language').innerHTML = scriptLanguageOptions;
$('#script-language-filter').insertAdjacentHTML('beforeend', scriptLanguageOptions);

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
    item.className = `alert text-sm ${error ? 'alert-error' : 'alert-success'}`;
    item.textContent = message;
    region.append(item);
    toastTimer = setTimeout(() => region.replaceChildren(), 4500);
}

function storageStatus(text, error = false) {
    const status = $('#storage-status');
    status.classList.toggle('text-error', error);
    status.classList.toggle('text-base-content/60', !error);
    status.textContent = text;
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

function categoryClasses(name, component = 'text') {
    const color = state.data.categories.find(category => category.name === name)?.color || 'neutral';
    return (categoryPalette[color] || categoryPalette.neutral)[component];
}

function renderCategories() {
    categories = state.data.categories.map(category => category.name);
    if (state.category !== 'Todas' && !categories.includes(state.category)) state.category = 'Todas';
    const select = $('#task-category');
    const selected = select.value;
    select.innerHTML = categories.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    if (categories.includes(selected)) select.value = selected;
    $('#categories-list').innerHTML = categories.map(name => {
        const count = state.data.tasks.filter(task => task.category === name).length;
        return `<div class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 py-3"><div class="flex min-w-0 flex-wrap items-center gap-2"><span class="badge h-auto whitespace-normal break-words ${categoryClasses(name, 'badge')}">${escapeHtml(name)}</span><span class="text-xs text-base-content/60">${count} ${count === 1 ? 'tarea' : 'tareas'}</span></div><div class="flex shrink-0 gap-2"><button class="btn btn-xs" type="button" data-edit-category="${escapeHtml(name)}" aria-label="Editar categoría ${escapeHtml(name)}">Editar</button><button class="btn btn-xs btn-error" type="button" data-delete-category="${escapeHtml(name)}" aria-label="Eliminar categoría ${escapeHtml(name)}">Eliminar</button></div></div>`;
    }).join('');
}

function renderProfile() {
    const { profile } = state.data;
    $('#footer-profile').textContent = `Bitácora · ${profile.name}`;
}

function render() {
    if (!state.data) return;
    renderCategories();
    renderProfile();
    renderWeek();
    renderHistory();
    renderScripts();
}

function renderWeek() {
    const tasks = tasksOfWeek();
    $('#week-range').textContent = weekRange(state.week);
    $('#activity-count').textContent = tasks.length;
    $('#category-filters').innerHTML = ['Todas', ...categories].map(category => `<button class="btn btn-sm ${category === 'Todas' ? 'btn-neutral' : categoryClasses(category, 'button')} ${state.category === category ? 'outline-2 outline-offset-2 outline-current' : ''}" data-filter="${escapeHtml(category)}" aria-pressed="${state.category === category}">${escapeHtml(category)}</button>`).join('');
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
        sections.push(`<details class="collapse collapse-arrow border border-base-300 bg-base-100"${today ? ' open' : ''}>
            <summary class="collapse-title flex flex-wrap items-center gap-3 text-sm"><span class="badge badge-neutral">${date.getDate()}</span><span><span class="block font-medium">${escapeHtml(capitalize(formatDate(date, { weekday: 'long' })))}</span><span class="block text-xs text-base-content/60">${escapeHtml(formatDate(date, { month: 'long', year: 'numeric' }))}</span></span>${today ? '<span class="badge badge-primary badge-sm">HOY</span>' : ''}<span class="ml-auto text-xs text-base-content/60">${dayTasks.length} ${dayTasks.length === 1 ? 'tarea' : 'tareas'}</span><button class="btn btn-ghost btn-square btn-xs" data-add-date="${key}" title="Añadir tarea" aria-label="Añadir tarea el ${escapeHtml(formatDate(date, { day: 'numeric', month: 'long' }))}">＋</button></summary>
            <div class="collapse-content text-sm">${dayTasks.length ? dayTasks.map(taskMarkup).join('') : `<div class="flex flex-wrap items-center justify-between gap-3 py-4 text-base-content/60"><span>Sin tareas.</span><button class="btn btn-ghost btn-sm" data-add-date="${key}">＋ Registrar tarea</button></div>`}</div>
        </details>`);
    }
    $('#task-list').innerHTML = sections.length ? sections.join('') : '<div class="card items-center gap-3 border border-base-300 bg-base-100 p-8 text-center"><h3 class="font-medium">No encontramos tareas</h3><p class="text-base-content/60">Prueba otra palabra o categoría.</p><button class="btn btn-sm" data-clear-filters>Limpiar filtros</button></div>';
}

function taskMarkup(task) {
    return `<article class="flex items-start gap-3 border-b border-base-300 py-4 last:border-b-0"><span class="mt-1 text-success" aria-label="Tarea realizada">✓</span><div class="min-w-0 flex-1"><h4 class="whitespace-pre-wrap break-words font-normal">${escapeHtml(task.title)}</h4>${task.description ? `<p class="mt-1 whitespace-pre-wrap break-words text-base-content/60">${escapeHtml(task.description)}</p>` : ''}<span class="badge badge-sm mt-2 h-auto whitespace-normal break-words ${categoryClasses(task.category, 'badge')}">${escapeHtml(task.category)}</span></div><div class="flex shrink-0 gap-2"><button class="btn btn-xs btn-warning" data-edit="${escapeHtml(task.id)}" title="Editar tarea" aria-label="Editar: ${escapeHtml(task.title)}">✎</button><button class="btn btn-xs btn-error" data-delete="${escapeHtml(task.id)}" title="Eliminar tarea" aria-label="Eliminar: ${escapeHtml(task.title)}">×</button></div></article>`;
}

function renderHistory() {
    const currentWeek = dateKey(monday(new Date()));
    const weeks = new Map();
    for (const task of state.data.tasks) {
        if ([0, 6].includes(localDate(task.date).getDay())) continue;
        const key = dateKey(monday(localDate(task.date)));
        weeks.set(key, (weeks.get(key) || 0) + 1);
    }
    $('#history-list').innerHTML = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, count]) => `<button class="card card-xs h-full border border-base-300 bg-base-100 text-left shadow-sm transition hover:border-primary hover:shadow-md" data-week="${date}"><span class="card-body w-full gap-2"><span class="flex items-center justify-between gap-2"><svg class="size-4 text-primary" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>${date === currentWeek ? '<span class="badge badge-success badge-xs">En curso</span>' : ''}</span><span class="card-title text-sm font-medium">${escapeHtml(weekRange(localDate(date)))}</span><span class="text-xs text-base-content/60">${count} ${count === 1 ? 'tarea registrada' : 'tareas registradas'}</span><span class="card-actions mt-auto justify-end border-t border-base-300 pt-2 text-xs text-primary">Ver semana →</span></span></button>`).join('') || '<div class="card gap-3 border border-base-300 bg-base-100 p-8 text-center col-span-full"><h3 class="font-medium">Tu historia empieza aquí</h3><p class="text-base-content/60">Registra una tarea para crear tu primera semana.</p></div>';
}

function showView(view) {
    state.view = view;
    $('#week-view').hidden = view !== 'week';
    $('#history-view').hidden = view !== 'history';
    $('#scripts-view').hidden = view !== 'scripts';
    $('#export-pdf').hidden = view !== 'week';
    $('#nav-week').classList.toggle('menu-active', view === 'week');
    $('#nav-history').classList.toggle('menu-active', view === 'history');
    $('#nav-scripts').classList.toggle('menu-active', view === 'scripts');
    const titles = { week: 'Reporte semanal', history: 'Historial de reportes', scripts: 'Mis scripts' };
    $('#page-title').textContent = titles[view];
    $('#page-description').textContent = view === 'scripts' ? 'Tu biblioteca personal de soluciones cotidianas.' : 'Consulta tus semanas anteriores.';
    $('#page-description').hidden = view === 'week';
    $('#breadcrumb-current').textContent = titles[view];
    $('#add-task-top').textContent = view === 'scripts' ? '＋ Nuevo script' : '＋ Nueva tarea';
}

function renderScripts() {
    const scripts = state.data.scripts || [];
    const visible = scripts.filter(script => (!scriptState.language || script.language === scriptState.language)
        && (!scriptState.favorites || script.favorite)
        && normalize(`${script.title} ${script.description} ${script.tags} ${script.code} ${scriptLanguages[script.language].name}`).includes(normalize(scriptState.search)))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'es'));
    $('#script-count').textContent = `${visible.length} de ${scripts.length} scripts`;
    $('#script-favorites').classList.toggle('btn-warning', scriptState.favorites);
    $('#script-favorites').setAttribute('aria-pressed', String(scriptState.favorites));
    $('#script-list').innerHTML = visible.map(script => {
        const id = escapeHtml(script.id);
        const lines = script.code.split(/\r\n|\r|\n/);
        const preview = lines.slice(0, 6).map(line => line.slice(0, 180)).join('\n');
        const tags = script.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        return `<article class="card min-w-0 overflow-hidden border border-base-300 bg-base-100">
            <div class="card-body gap-3 p-5">
                <div class="flex items-center justify-between gap-2"><span class="badge badge-sm ${scriptLanguages[script.language].color}">${scriptLanguages[script.language].name}</span><button class="btn btn-ghost btn-square btn-sm ${script.favorite ? 'text-warning' : ''}" data-script-action="favorite" data-script-id="${id}" aria-label="${script.favorite ? 'Quitar de' : 'Añadir a'} favoritos: ${escapeHtml(script.title)}" aria-pressed="${script.favorite}">${script.favorite ? '★' : '☆'}</button></div>
                <h3 class="break-words font-semibold">${escapeHtml(script.title)}</h3>
                <p class="line-clamp-2 whitespace-pre-wrap break-words text-base-content/60">${escapeHtml(script.description || 'Sin notas. Tu código, listo para reutilizar.')}</p>
                <div class="overflow-hidden rounded-box bg-slate-900 p-3 text-slate-200"><pre class="h-36 overflow-hidden font-mono text-xs leading-6" aria-label="Vista previa del código"><code>${highlightScript(preview, script.language)}</code></pre><div class="mt-2 border-t border-white/20 pt-2 text-xs text-slate-400">${lines.length} ${lines.length === 1 ? 'línea' : 'líneas'} · Vista previa</div></div>
                <div class="flex flex-wrap gap-1">${tags.map(tag => `<span class="badge badge-ghost badge-sm h-auto whitespace-normal break-all">${escapeHtml(tag)}</span>`).join('')}</div>
                <div class="mt-auto flex flex-wrap gap-2 pt-2"><button class="btn btn-primary btn-sm" data-script-action="copy" data-script-id="${id}">Copiar</button><button class="btn btn-sm" data-script-action="edit" data-script-id="${id}">Ver / Editar</button><button class="btn btn-sm btn-ghost" data-script-action="download" data-script-id="${id}">Descargar</button><button class="btn btn-xs btn-ghost" data-script-action="duplicate" data-script-id="${id}">Duplicar</button><button class="btn btn-xs btn-ghost text-error" data-script-action="delete" data-script-id="${id}">Eliminar</button></div>
            </div>
        </article>`;
    }).join('') || (scripts.length ? '<div class="card col-span-full items-center gap-3 border border-dashed border-base-300 bg-base-100 px-6 py-12 text-center"><h3 class="font-semibold">Ningún script coincide</h3><p class="text-base-content/60">Prueba otro lenguaje, etiqueta o palabra.</p><button class="btn btn-primary btn-sm" data-script-action="clear">Limpiar filtros</button></div>' : '');
}

function openScript(script = null, duplicate = false) {
    if (!state.data || state.saving) return;
    const form = $('#script-form');
    form.reset();
    form.elements.id.value = duplicate ? '' : script?.id || '';
    form.elements.title.value = script ? (duplicate ? `${script.title.slice(0, 112)} (copia)` : script.title) : '';
    form.elements.description.value = script?.description || '';
    form.elements.language.value = script?.language || 'bash';
    form.elements.code.value = script?.code || '';
    form.elements.tags.value = script?.tags || '';
    form.elements.favorite.checked = script?.favorite || false;
    $('#script-error').textContent = '';
    $('#script-dialog-title').textContent = duplicate ? 'Duplicar script' : script ? 'Ver / Editar script' : 'Nuevo script';
    $('#script-dialog').showModal();
    form.elements.code.scrollTop = 0;
    form.elements.code.scrollLeft = 0;
    renderScriptHighlight();
    form.elements.title.focus();
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

$('#add-task-top').addEventListener('click', () => state.view === 'scripts' ? openScript() : openTask(defaultTaskDate()));
$('#previous-week').addEventListener('click', () => changeWeek(addDays(state.week, -7)));
$('#next-week').addEventListener('click', () => changeWeek(addDays(state.week, 7)));
$('#current-week').addEventListener('click', () => changeWeek(new Date()));
$('#nav-week').addEventListener('click', () => showView('week'));
$('#nav-history').addEventListener('click', () => showView('history'));
$('#nav-scripts').addEventListener('click', () => showView('scripts'));
$('#script-search').addEventListener('input', event => { scriptState.search = event.target.value.trim(); renderScripts(); });
$('#script-language-filter').addEventListener('change', event => { scriptState.language = event.target.value; renderScripts(); });
$('#script-favorites').addEventListener('click', () => { scriptState.favorites = !scriptState.favorites; renderScripts(); });
$('#script-code').addEventListener('input', renderScriptHighlight);
$('#script-code').addEventListener('scroll', syncScriptHighlightScroll);
$('#script-language').addEventListener('change', renderScriptHighlight);
$('#script-code').addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    const input = event.currentTarget;
    if (input.value.length - (input.selectionEnd - input.selectionStart) + 4 > input.maxLength) return;
    event.preventDefault();
    input.setRangeText('    ', input.selectionStart, input.selectionEnd, 'end');
    renderScriptHighlight();
});
$('#script-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    input.favorite = form.elements.favorite.checked;
    if (await save({ ...input, action: input.id ? 'script.update' : 'script.create' }, form, $('#script-error'))) {
        $('#script-dialog').close();
        toast(input.id ? 'Script actualizado.' : 'Script guardado en tu biblioteca.');
    }
});
$('#script-list').addEventListener('click', async event => {
    const button = event.target.closest('[data-script-action]');
    if (!button || state.saving) return;
    const action = button.dataset.scriptAction;
    if (action === 'new') return openScript();
    if (action === 'clear') {
        scriptState.search = '';
        scriptState.language = '';
        scriptState.favorites = false;
        $('#script-search').value = '';
        $('#script-language-filter').value = '';
        renderScripts();
        return;
    }
    const script = state.data.scripts.find(item => item.id === button.dataset.scriptId);
    if (!script) return;
    if (action === 'edit' || action === 'duplicate') return openScript(script, action === 'duplicate');
    if (action === 'copy') {
        try {
            await navigator.clipboard.writeText(script.code);
            toast('Código copiado.');
        } catch {
            openScript(script);
            $('#script-code').focus();
            $('#script-code').select();
            toast('Copia automática no disponible. Código seleccionado: usa Ctrl+C o ⌘C.', true);
        }
    }
    if (action === 'download') {
        const url = URL.createObjectURL(new Blob([script.code], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        const name = normalize(script.title).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'script';
        link.href = url;
        link.download = `${name}.${scriptLanguages[script.language].extension}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Script descargado.');
    }
    if (action === 'favorite') {
        const errorTarget = document.createElement('span');
        const success = await save({ action: 'script.favorite', id: script.id, favorite: !script.favorite }, button, errorTarget);
        if (!success && errorTarget.textContent) toast(errorTarget.textContent, true);
    }
    if (action === 'delete') {
        scriptState.deleteId = script.id;
        $('#script-delete-description').textContent = `«${script.title}» se quitará de tu biblioteca. Esta acción no se puede deshacer.`;
        $('#script-delete-error').textContent = '';
        $('#script-delete-dialog').showModal();
    }
});
$('#confirm-script-delete').addEventListener('click', async () => {
    if (await save({ action: 'script.delete', id: scriptState.deleteId, confirmed: true }, $('#script-delete-dialog'), $('#script-delete-error'))) {
        $('#script-delete-dialog').close();
        scriptState.deleteId = null;
        toast('Script eliminado.');
    }
});
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
    const button = event.target.closest('[data-close-dialog]');
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
        if (backup.scripts !== undefined && (!Array.isArray(backup.scripts) || backup.scripts.length > 1000)) {
            throw new Error('El respaldo debe contener una lista de hasta 1000 scripts.');
        }
        pendingImport = backup;
        const scriptNotice = backup.scripts === undefined
            ? 'Es un respaldo anterior: tus scripts actuales se conservarán.'
            : `${backup.scripts.length} scripts en el respaldo; se reemplazarán tus ${state.data.scripts.length} scripts actuales.`;
        $('#import-preview').textContent = `${backup.profile.name} · ${backup.tasks.length} tareas en el respaldo. Actualmente tienes ${state.data.tasks.length} tareas que serán reemplazadas. ${scriptNotice}`;
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
const reportClasses = {
    document: 'm-0 bg-neutral-200 p-0 font-sans text-sm text-neutral-800 print:bg-white',
    pages: 'zoom-100 print:zoom-100',
    sheet: 'mx-auto my-5 flex h-[297mm] w-[210mm] flex-col overflow-hidden bg-white px-[17mm] pt-[15mm] pb-[12mm] break-after-page last:break-after-auto print:m-0 print:[print-color-adjust:exact]',
    header: 'mb-3.5 flex shrink-0 justify-between gap-5 border-t-4 border-b border-t-red-700 border-b-neutral-300 pt-3 pb-3.5',
    headerIntro: 'flex min-w-0 items-center gap-4',
    logo: 'h-20 w-32 shrink-0 object-contain',
    title: 'mb-2 text-sm font-semibold text-red-800',
    muted: 'text-sm text-neutral-500',
    author: 'max-w-64 pt-1 text-right break-words',
    authorName: 'mb-1 block text-sm font-semibold',
    authorDetail: 'block text-sm leading-relaxed text-neutral-500',
    summary: 'mb-4 flex shrink-0 flex-wrap gap-x-5 gap-y-2 border-l-4 border-l-lime-400 bg-amber-50 px-3 py-2 text-sm',
    total: 'basis-full',
    count: 'mr-1 font-semibold',
    body: 'min-h-0 flex-1 leading-[1.45]',
    heading: 'mt-2 mb-2 flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-2 py-2 first:mt-0',
    dayNumber: 'badge badge-soft badge-success rounded-sm text-sm font-semibold',
    dayName: 'block text-sm font-semibold',
    dayDate: 'mt-0.5 block text-sm text-neutral-500',
    dayTotal: 'ml-auto text-sm text-neutral-500',
    task: 'relative pb-[7px] pl-[13px] break-words before:absolute before:top-1.5 before:left-px before:size-[3px] before:rounded-full before:bg-red-700',
    taskTitle: 'm-0 whitespace-pre-wrap font-normal text-neutral-900',
    taskDetail: 'mt-0.5 whitespace-pre-wrap text-neutral-500',
    label: 'badge badge-outline ml-1 h-auto rounded-sm px-1 py-0 align-baseline text-[0.9em] leading-snug whitespace-nowrap',
    fragment: 'm-0 whitespace-pre-wrap',
    empty: 'pb-2 pl-3 text-sm text-neutral-500',
    footer: 'mt-3 flex shrink-0 justify-between gap-4 border-t border-neutral-200 pt-2.5 text-sm text-neutral-500',
    signature: 'max-w-4/5 break-words',
    pageCount: 'shrink-0',
};
const reportSizes = ['text-[10.2pt]', 'text-[9.6pt]', 'text-[9pt]'];
const previewZooms = ['zoom-25', 'zoom-50', 'zoom-75', 'zoom-100'];
let reportGeneration = 0;

async function prepareReportStyles() {
    let source = $('#report-utilities');
    if (!source) {
        source = document.createElement('div');
        source.id = 'report-utilities';
        source.hidden = true;
        source.className = [
            'min-w-[211mm]', ...Object.values(reportClasses), ...reportSizes, ...previewZooms,
            ...Object.values(categoryPalette).flatMap(palette => Object.values(palette)),
        ].join(' ');
        document.body.append(source);
    }
    // Wait for Tailwind's CDN compiler before measuring or copying its generated styles.
    const started = performance.now();
    while (parseFloat(getComputedStyle(source).minWidth) < 790 || !getComputedStyle(source).minWidth.endsWith('px')) {
        if (performance.now() - started > 10000) throw new Error('No se pudo cargar Tailwind.');
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
}

function reportHeader(profile) {
    const logo = new URL('assets/logo.png', document.baseURI).href;
    return `<header class="${reportClasses.header}"><div class="${reportClasses.headerIntro}"><img class="${reportClasses.logo}" src="${escapeHtml(logo)}" alt="Corpo Sistemas" width="128" height="80"><div><h1 class="${reportClasses.title}">Reporte semanal</h1><p class="${reportClasses.muted}">${escapeHtml(weekRange(state.week))}</p></div></div><div class="${reportClasses.author}"><strong class="${reportClasses.authorName}">${escapeHtml(profile.name)}</strong><span class="${reportClasses.authorDetail}">${escapeHtml(profile.role)}</span><span class="${reportClasses.authorDetail}">${escapeHtml(profile.area)}</span></div></header>`;
}

async function buildReport() {
    const generation = ++reportGeneration;
    const tasks = tasksOfWeek();
    const frame = $('#report-frame');
    state.reportReady = false;
    $('#print-report').disabled = true;
    $('#report-instructions').textContent = 'Preparando el reporte…';
    await prepareReportStyles();
    if (generation !== reportGeneration) return;
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html lang="es" data-theme="light"><head><meta charset="utf-8"><title>${escapeHtml(`Reporte semanal - ${state.data.profile.name} - ${dateKey(state.week)}`)}</title></head><body class="${reportClasses.document}"><main class="${reportClasses.pages}" id="report-pages"></main></body></html>`);
    doc.close();
    const stylesLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')].map(link => new Promise((resolve, reject) => {
        const copy = link.cloneNode();
        copy.addEventListener('load', resolve, { once: true });
        copy.addEventListener('error', reject, { once: true });
        doc.head.append(copy);
    }));
    // Reuse generated Tailwind utilities; the report needs no custom stylesheet or runtime.
    for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
        if (sheet.href) continue;
        const style = doc.createElement('style');
        style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n');
        doc.head.append(style);
    }
    await Promise.all(stylesLoaded);
    if (generation !== reportGeneration) return;
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
        color: categoryClasses(category),
    })).filter(({ count }) => count > 0);
    const summary = `<div class="${reportClasses.summary}"><div class="${reportClasses.total}"><strong class="${reportClasses.count}">${tasks.length}</strong><span>Tareas realizadas</span></div>${categoryCounts.map(({ category, count, color }) => `<div class="${color}"><span>${escapeHtml(category)}:</span> <strong class="${reportClasses.count}">${count}</strong></div>`).join('')}</div>`;
    let pageBodies = [];
    let body;

    function newPage() {
        const sheet = doc.createElement('article');
        sheet.className = reportClasses.sheet;
        sheet.innerHTML = (pageBodies.length === 0 ? reportHeader(profile) + summary : '')
            + `<div data-report-body class="${reportClasses.body}"></div><footer class="${reportClasses.footer}"><span class="${reportClasses.signature}">${escapeHtml(profile.name)} · ${escapeHtml(profile.area)}</span><span data-page-count class="${reportClasses.pageCount}"></span></footer>`;
        pagesRoot.append(sheet);
        body = sheet.querySelector('[data-report-body]');
        pageBodies.push(body);
    }

    function heading(group) {
        const node = doc.createElement('div');
        node.className = reportClasses.heading;
        node.innerHTML = `<span class="${reportClasses.dayNumber}">${group.date.getDate()}</span><div><strong class="${reportClasses.dayName}">${escapeHtml(formatDate(group.date, { weekday: 'long' }))}</strong><small class="${reportClasses.dayDate}">${escapeHtml(formatDate(group.date, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></div><span class="${reportClasses.dayTotal}">${group.items.length} ${group.items.length === 1 ? 'tarea' : 'tareas'}</span>`;
        body.append(node);
        return node;
    }

    function taskNode(task, fragment = null) {
        const node = doc.createElement('div');
        node.className = reportClasses.task;
        if (fragment !== null) {
            const paragraph = doc.createElement('p');
            paragraph.className = reportClasses.fragment;
            paragraph.textContent = fragment;
            node.append(paragraph);
        } else {
            node.innerHTML = `<p class="${reportClasses.taskTitle}">${escapeHtml(task.title)}</p>${task.description ? `<p class="${reportClasses.taskDetail}">${escapeHtml(task.description)}</p>` : ''}`;
        }
        const label = doc.createElement('span');
        label.className = `${reportClasses.label} ${categoryClasses(task.category)}`;
        label.textContent = task.category;
        node.firstElementChild.append(' ', label);
        return node;
    }

    function fits() {
        return body.scrollHeight <= body.clientHeight;
    }

    function paginate(size) {
        pagesRoot.replaceChildren();
        pagesRoot.classList.remove(...reportSizes);
        pagesRoot.classList.add(size);
        pageBodies = [];
        newPage();
        for (const group of groups) {
            let dayHeading = heading(group);
            if (!group.items.length) {
                const empty = doc.createElement('p');
                empty.className = reportClasses.empty;
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
    for (const fontSize of reportSizes) {
        pageCount = paginate(fontSize);
        if (pageCount <= 3) break;
    }
    doc.querySelectorAll('[data-page-count]').forEach((node, index) => {
        node.textContent = `${String(index + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`;
    });
    await Promise.all([...doc.images].map(image => image.decode()));
    if (generation !== reportGeneration) return;
    $('#report-instructions').textContent = '';
    fitPreview();
    state.reportReady = true;
    $('#print-report').disabled = false;
}

function fitPreview() {
    const frame = $('#report-frame');
    const pages = frame.contentDocument?.getElementById('report-pages');
    if (pages) {
        const scale = Math.min(1, Math.max(0.25, (frame.clientWidth - 24) / (210 * 96 / 25.4)));
        pages.classList.remove(...previewZooms);
        pages.classList.add(previewZooms[Math.floor(scale * 4) - 1]);
    }
}

async function openReport() {
    if (!state.data) return;
    if (!tasksOfWeek().length) {
        toast('Registra al menos una tarea para generar el reporte.', true);
        return;
    }
    $('#report-dialog').showModal();
    try {
        await buildReport();
    } catch {
        $('#report-instructions').textContent = 'No se pudo preparar el reporte. Cierra esta ventana y vuelve a intentarlo.';
        toast('No se pudo preparar el reporte.', true);
    }
}

$('#export-pdf').addEventListener('click', openReport);
$('#include-empty-days').addEventListener('change', async () => {
    try { await buildReport(); } catch { toast('No se pudo actualizar la vista previa.', true); }
});
$('#print-report').addEventListener('click', () => {
    if (!state.reportReady) return;
    const frame = $('#report-frame');
    frame.contentWindow.focus();
    frame.contentWindow.print();
});
window.addEventListener('resize', fitPreview);

async function initialize() {
    const requiresData = ['#add-task-top', '#previous-week', '#next-week', '#current-week', '#export-pdf', '#nav-history', '#nav-scripts', '#nav-import', '#nav-categories', '#profile-shortcut', '#backup-button', '#task-search', '#script-search', '#script-language-filter', '#script-favorites'];
    requiresData.forEach(selector => { $(selector).disabled = true; });
    try {
        state.data = await request();
        render();
        storageStatus('Guardado en JSON');
    } catch (error) {
        $('#task-list').innerHTML = `<div class="card items-center gap-3 border border-base-300 bg-base-100 p-8 text-center"><h3 class="font-medium">No se pudo abrir tu bitácora</h3><p class="text-base-content/60">${escapeHtml(error.message)}</p><button class="btn btn-sm" id="retry-load">Volver a intentar</button></div>`;
        $('#retry-load').addEventListener('click', initialize);
        storageStatus('Sin conexión con el JSON', true);
    } finally {
        if (state.data) requiresData.forEach(selector => { $(selector).disabled = false; });
    }
}

initialize();
