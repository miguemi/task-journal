'use strict';

const noteState = { search: '', images: [], processing: false, version: 0, detailId: null, deleteId: null };

function renderNotes() {
    const notes = state.data.notes || [];
    const visible = notes.filter(note => normalize(`${note.title} ${note.details} ${note.steps} ${note.tags}`).includes(normalize(noteState.search)))
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'es'));
    $('#note-count').textContent = `${visible.length} de ${notes.length} notas`;
    $('#note-list').innerHTML = visible.map(note => {
        const id = escapeHtml(note.id);
        const image = note.images[0];
        return `<article class="card min-w-0 overflow-hidden border border-base-300 bg-base-100">
            ${image ? `<button class="block w-full bg-base-300" data-note-action="view" data-note-id="${id}" aria-label="Ver capturas de ${escapeHtml(note.title)}"><img class="h-28 w-full object-contain" src="${escapeHtml(image.data)}" alt="${escapeHtml(image.name)}" loading="lazy"></button>` : ''}
            <div class="card-body gap-2 p-3">
                <h3 class="break-words font-semibold">${escapeHtml(note.title)}</h3>
                <p class="line-clamp-2 whitespace-pre-wrap break-words text-xs text-base-content/70">${escapeHtml(note.details)}</p>
                ${note.steps ? '<span class="text-xs text-success">✓ Solución documentada</span>' : '<span class="text-xs text-base-content/60">Solución por documentar</span>'}
                ${note.tags ? `<div class="flex flex-wrap gap-1">${note.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => `<span class="badge badge-ghost badge-xs h-auto whitespace-normal break-all">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                <div class="mt-auto flex flex-wrap items-center gap-2 pt-1"><button class="btn btn-primary btn-xs" data-note-action="view" data-note-id="${id}">Ver nota</button><button class="btn btn-xs" data-note-action="edit" data-note-id="${id}">Editar</button><button class="btn btn-ghost btn-xs text-error" data-note-action="delete" data-note-id="${id}">Eliminar</button>${note.images.length ? `<span class="ml-auto text-xs text-base-content/60">${note.images.length} ${note.images.length === 1 ? 'captura' : 'capturas'}</span>` : ''}</div>
            </div>
        </article>`;
    }).join('') || (notes.length ? '<p class="col-span-full py-6 text-base-content/60">No hay notas que coincidan con la búsqueda.</p>' : '');
}

function renderNoteImages() {
    $('#note-image-previews').innerHTML = noteState.images.map((image, index) => `<div class="overflow-hidden rounded-box border border-base-300 bg-base-200"><button class="block w-full" type="button" data-preview-note-image="${index}" aria-label="Ampliar ${escapeHtml(image.name)}"><img class="h-32 w-full object-contain" src="${escapeHtml(image.data)}" alt="${escapeHtml(image.name)}"></button><div class="flex items-center gap-2 p-2"><span class="min-w-0 flex-1 truncate text-xs">${escapeHtml(image.name)}</span><button class="btn btn-ghost btn-xs text-error" type="button" data-remove-note-image="${index}" aria-label="Quitar ${escapeHtml(image.name)}">Quitar</button></div></div>`).join('');
}

function openNote(note = null) {
    if (!state.data || state.saving) return;
    const form = $('#note-form');
    form.reset();
    noteState.version++;
    noteState.processing = false;
    noteState.images = (note?.images || []).map(image => ({ ...image }));
    form.elements.id.value = note?.id || '';
    for (const name of ['title', 'commerce', 'details', 'steps', 'tags']) form.elements[name].value = note?.[name] || '';
    form.elements.date.value = note?.date || dateKey(new Date());
    form.elements.status.value = note?.status || 'pending';
    $('#note-dialog-title').textContent = note ? 'Editar nota' : 'Nueva nota';
    $('#note-error').textContent = '';
    $('#note-submit').disabled = false;
    $('#note-images').disabled = false;
    renderNoteImages();
    $('#note-dialog').showModal();
    form.elements.title.focus();
}

function showNoteImage(image) {
    $('#note-image-title').textContent = image.name;
    $('#note-full-image').src = image.data;
    $('#note-full-image').alt = image.name;
    $('#note-image-dialog').showModal();
}

function openNoteDetail(note) {
    noteState.detailId = note.id;
    $('#note-detail-title').textContent = note.title;
    $('#note-detail-content').innerHTML = `<h3 class="mb-2 font-medium">Reporte / problema</h3><p class="whitespace-pre-wrap break-words text-base-content/80">${escapeHtml(note.details)}</p>
        <h3 class="mt-6 mb-2 font-medium">Solución y pasos a seguir</h3><p class="whitespace-pre-wrap break-words ${note.steps ? '' : 'text-base-content/60'}">${escapeHtml(note.steps || 'Todavía no se han documentado los pasos de solución.')}</p>
        ${note.images.length ? `<h3 class="mt-6 mb-3 font-medium">Fotos y capturas</h3><div class="grid gap-3 sm:grid-cols-2">${note.images.map((image, index) => `<button class="overflow-hidden rounded-box border border-base-300 bg-base-200 text-left" data-detail-note-image="${index}" aria-label="Ampliar ${escapeHtml(image.name)}"><img class="h-56 w-full object-contain" src="${escapeHtml(image.data)}" alt="${escapeHtml(image.name)}"><span class="block truncate p-2 text-xs text-base-content/60">${escapeHtml(image.name)} · Ampliar</span></button>`).join('')}</div>` : ''}
        ${note.tags ? `<p class="mt-5 break-words text-xs text-base-content/60">Etiquetas: ${escapeHtml(note.tags)}</p>` : ''}`;
    $('#note-detail-dialog').showModal();
}

async function prepareNoteImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        throw new Error('Selecciona imágenes JPG, PNG o WebP de hasta 5 MB cada una.');
    }
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('La imagen es demasiado grande. Usa una captura de menor resolución.');
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo preparar la captura.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let data;
        for (const quality of [0.85, 0.7, 0.5]) {
            data = canvas.toDataURL('image/jpeg', quality);
            if (data.length <= 1398127) break;
        }
        if (data.length > 1398127) throw new Error('La captura sigue siendo muy grande. Recórtala antes de adjuntarla.');
        return { name: `${(file.name || 'captura').replace(/\.[^.]*$/, '').slice(0, 110)}.jpg`, data };
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function addNoteImages(files) {
    if (!files.length || state.saving || noteState.processing) return;
    $('#note-error').textContent = '';
    if (noteState.images.length + files.length > 3) {
        $('#note-error').textContent = 'Cada nota admite hasta 3 imágenes. Quita alguna antes de agregar otra.';
        return;
    }
    const version = noteState.version;
    noteState.processing = true;
    $('#note-submit').disabled = true;
    $('#note-images').disabled = true;
    try {
        const images = [];
        for (const file of files) {
            images.push(await prepareNoteImage(file));
            if (version !== noteState.version) return;
        }
        noteState.images.push(...images);
        renderNoteImages();
    } catch (error) {
        if (version === noteState.version) $('#note-error').textContent = error.name === 'EncodingError' ? 'No se pudo abrir la imagen. Prueba otra captura.' : error.message;
    } finally {
        if (version === noteState.version) {
            noteState.processing = false;
            $('#note-submit').disabled = false;
            $('#note-images').disabled = false;
            $('#note-images').value = '';
        }
    }
}

function initializeNotes() {
    $('#nav-notes').addEventListener('click', () => showView('notes'));
    $('#note-search').addEventListener('input', event => { noteState.search = event.target.value.trim(); renderNotes(); });
    $('#note-images').addEventListener('change', event => addNoteImages([...event.target.files]));
    $('#note-form').addEventListener('paste', event => {
        const files = [...(event.clipboardData?.files || [])];
        if (!files.length) return;
        event.preventDefault();
        addNoteImages(files);
    });
    $('#note-image-previews').addEventListener('click', event => {
        if (state.saving || noteState.processing) return;
        const remove = event.target.closest('[data-remove-note-image]');
        if (remove) {
            noteState.images.splice(Number(remove.dataset.removeNoteImage), 1);
            renderNoteImages();
        }
        const preview = event.target.closest('[data-preview-note-image]');
        if (preview) showNoteImage(noteState.images[Number(preview.dataset.previewNoteImage)]);
    });
    $('#note-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (noteState.processing) return;
        const form = event.currentTarget;
        const input = Object.fromEntries(new FormData(form));
        if (await save({ ...input, images: noteState.images, action: input.id ? 'note.update' : 'note.create' }, form, $('#note-error'))) {
            $('#note-dialog').close();
            toast(input.id ? 'Nota actualizada.' : 'Nota guardada con sus capturas.');
        }
    });
    $('#note-dialog').addEventListener('close', () => {
        noteState.version++;
        noteState.processing = false;
        noteState.images = [];
        $('#note-image-previews').replaceChildren();
    });
    $('#note-image-dialog').addEventListener('close', () => $('#note-full-image').removeAttribute('src'));
    $('#note-list').addEventListener('click', event => {
        const button = event.target.closest('[data-note-action]');
        if (!button || state.saving) return;
        const note = state.data.notes.find(item => item.id === button.dataset.noteId);
        if (!note) return;
        if (button.dataset.noteAction === 'view') openNoteDetail(note);
        if (button.dataset.noteAction === 'edit') openNote(note);
        if (button.dataset.noteAction === 'delete') {
            noteState.deleteId = note.id;
            $('#note-delete-description').textContent = `Se eliminará «${note.title}», junto con sus capturas y solución. Esta acción no se puede deshacer.`;
            $('#note-delete-error').textContent = '';
            $('#note-delete-dialog').showModal();
        }
    });
    $('#note-detail-edit').addEventListener('click', () => {
        if (state.saving) return;
        const note = state.data.notes.find(item => item.id === noteState.detailId);
        if (!note) return;
        $('#note-detail-dialog').close();
        openNote(note);
    });
    $('#note-detail-content').addEventListener('click', event => {
        const button = event.target.closest('[data-detail-note-image]');
        const note = state.data.notes.find(item => item.id === noteState.detailId);
        if (button && note) showNoteImage(note.images[Number(button.dataset.detailNoteImage)]);
    });
    $('#confirm-note-delete').addEventListener('click', async () => {
        if (await save({ action: 'note.delete', id: noteState.deleteId, confirmed: true }, $('#note-delete-dialog'), $('#note-delete-error'))) {
            $('#note-delete-dialog').close();
            noteState.deleteId = null;
            toast('Nota eliminada.');
        }
    });
}
