<?php
declare(strict_types=1);
session_start();
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="es" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf'], ENT_QUOTES, 'UTF-8') ?>">
    <meta name="theme-color" content="#ffffff">
    <script>
        (() => {
            let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            try {
                const saved = localStorage.getItem('bitacora-theme');
                if (saved === 'dark' || saved === 'light') theme = saved;
            } catch {}
            document.documentElement.dataset.theme = theme;
            document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#121212' : '#ffffff';
        })();
    </script>
    <title>Bitácora · Reportes semanales</title>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5/colors/properties.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <script src="assets/app.js" defer></script>
</head>
<body class="min-h-screen bg-base-200 text-sm text-base-content">
    <div class="min-h-screen lg:flex">
        <aside class="flex flex-col gap-6 border-b border-base-300 bg-base-100 p-4 lg:fixed lg:inset-y-0 lg:w-56 lg:border-r lg:border-b-0">
            <a class="btn btn-ghost justify-start text-sm" href="./" aria-label="Bitácora, inicio">Bitácora</a>
            <nav aria-label="Navegación principal">
                <ul class="menu w-full gap-2 p-0">
                <li><button class="menu-active" id="nav-week"><span aria-hidden="true">▦</span> Mi semana</button></li>
                <li><button id="nav-history"><span aria-hidden="true">▤</span> Historial de reportes</button></li>
                <li><button id="nav-categories">Categorías</button></li>
                </ul>
            </nav>
            <div class="mt-auto flex flex-col gap-2">
                <button class="btn btn-ghost btn-sm justify-start gap-3" id="nav-import"><svg class="size-4 shrink-0 text-info" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>Importar respaldo</button>
                <button id="backup-button" class="btn btn-ghost btn-sm justify-start gap-3"><svg class="size-4 shrink-0 text-success" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>Respaldar</button>
                <button class="btn btn-ghost btn-sm justify-start gap-3" id="profile-shortcut"><svg class="size-4 shrink-0 text-secondary" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>Perfil</button>
            </div>
        </aside>

        <main class="min-w-0 flex-1 px-4 lg:ml-56 lg:px-8">
            <header class="navbar flex-wrap gap-3 border-b border-base-300 px-0"><div class="breadcrumbs flex-1 text-sm"><ul><li class="text-base-content/60">Mi espacio</li><li id="breadcrumb-current">Reporte semanal</li></ul></div><div class="flex flex-wrap items-center gap-3"><span class="text-xs text-base-content/60" id="storage-status" role="status">Guardado en JSON</span><button class="btn btn-sm" id="theme-toggle" type="button" aria-pressed="false">Modo oscuro</button></div></header>
            <section class="flex flex-wrap items-center justify-between gap-4 py-6"><div><h1 class="text-sm font-semibold" id="page-title">Reporte semanal</h1><p class="mt-1 text-base-content/60" id="page-description" hidden></p></div><div class="flex flex-wrap gap-3"><button class="btn btn-primary btn-sm" id="add-task-top"><span aria-hidden="true">＋</span> Nueva tarea</button><button class="btn btn-info btn-sm" id="export-pdf"><svg class="size-4 shrink-0" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg> Report PDF</button></div></section>

            <section id="week-view">
                <div class="mb-6 flex flex-wrap items-center gap-2"><button class="btn btn-ghost btn-square btn-sm" id="previous-week" aria-label="Semana anterior">‹</button><strong class="min-w-0 text-sm font-medium" id="week-range"></strong><button class="btn btn-ghost btn-square btn-sm" id="next-week" aria-label="Semana siguiente">›</button><button class="btn btn-ghost btn-sm" id="current-week">Esta semana</button></div>
                <div class="w-full">
                    <section class="w-full">
                        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 class="flex items-center gap-2 font-medium">Tareas <span class="badge badge-sm" id="activity-count">0</span></h2><label class="input input-sm w-full sm:w-64"><span aria-hidden="true">⌕</span><input id="task-search" type="search" placeholder="Buscar tarea…" aria-label="Buscar tarea"></label></div>
                        <div class="mb-6 flex flex-wrap gap-3" id="category-filters" aria-label="Filtrar por categoría"></div>
                        <div class="space-y-4" id="task-list" aria-live="polite"><div class="flex items-center gap-3 py-8 text-base-content/60"><span class="loading loading-spinner loading-sm"></span> Cargando tu bitácora…</div></div>
                    </section>
                </div>
            </section>

            <section id="history-view" hidden><h2 class="mb-4 font-medium">Tus semanas registradas</h2><div id="history-list" class="grid gap-3"></div></section>
            <footer class="mt-8 flex flex-wrap justify-between gap-3 border-t border-base-300 py-4 text-xs text-base-content/60"><span>Datos locales · JSON</span><span id="footer-profile">Bitácora</span></footer>
        </main>
    </div>

    <dialog id="task-dialog" class="modal">
        <div class="modal-box max-w-2xl text-sm">
            <form id="task-form"><div class="mb-4 flex items-start justify-between gap-4"><div><span class="text-xs text-base-content/60">TU REGISTRO DIARIO</span><h2 class="font-semibold" id="task-dialog-title">Nueva tarea</h2></div><button type="button" class="btn btn-ghost btn-circle btn-sm" data-close-dialog aria-label="Cerrar">✕</button></div>
                <input type="hidden" name="id">
                <label class="mb-2 block" for="task-title">¿En qué trabajaste?</label><textarea class="textarea w-full text-sm" id="task-title" name="title" rows="3" maxlength="600" placeholder="Ej. Implementación del requerimiento de pago combinado" required></textarea>
                <label class="mt-4 mb-2 block" for="task-description">Detalles <span class="text-base-content/60">(opcional)</span></label><textarea class="textarea w-full text-sm" id="task-description" name="description" rows="4" maxlength="4000" placeholder="Contexto, cambios realizados o resultados…"></textarea>
                <div class="mt-3 flex flex-wrap items-center gap-3"><button class="btn btn-sm" id="improve-task" type="button" disabled>Mejorar redacción</button><span class="text-xs text-base-content/60">Envía el título, los detalles y la categoría a DeepSeek. Puede generar un costo.</span></div>
                <p class="mt-2 text-sm text-error empty:hidden" id="ai-error" role="alert"></p>
                <section class="card mt-4 border border-base-300 bg-base-200 p-4 text-sm" id="ai-preview" aria-live="polite" hidden><h3 class="mb-2 font-medium">Propuesta de redacción</h3><p class="whitespace-pre-wrap" id="ai-title"></p><p class="mt-2 whitespace-pre-wrap" id="ai-description"></p><p class="mt-3 text-xs text-base-content/60">Revisa que conserve los hechos antes de aplicarla.</p><div class="mt-3 flex flex-wrap gap-3"><button class="btn btn-sm btn-primary" id="apply-ai" type="button">Aplicar sugerencia</button><button class="btn btn-sm btn-ghost" id="discard-ai" type="button">Descartar</button></div></section>
                <div class="mt-4 grid gap-4 sm:grid-cols-2"><div><label class="mb-2 block" for="task-date">Fecha</label><input class="input w-full text-sm" id="task-date" name="date" type="date" required min="2000-01-01" max="2100-12-31"></div><div><label class="mb-2 block" for="task-category">Categoría</label><select class="select w-full text-sm" id="task-category" name="category" required></select></div></div>
                <p class="mt-2 text-sm text-error empty:hidden" id="task-error" role="alert"></p><div class="modal-action flex-wrap gap-2"><button type="button" class="btn btn-ghost btn-sm" data-close-dialog>Cancelar</button><button class="btn btn-primary btn-sm" type="submit">Guardar tarea</button></div>
            </form>
        </div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>

    <dialog id="profile-dialog" class="modal"><div class="modal-box text-sm"><form id="profile-form"><div class="mb-4 flex items-start justify-between gap-4"><div><span class="text-xs text-base-content/60">LA FIRMA DE TU TRABAJO</span><h2 class="font-semibold">Mi perfil</h2></div><button type="button" class="btn btn-ghost btn-circle btn-sm" data-close-dialog aria-label="Cerrar">✕</button></div><label class="mb-2 block" for="profile-name">Nombre completo</label><input class="input w-full text-sm" id="profile-name" name="name" maxlength="100" required><label class="mt-4 mb-2 block" for="profile-role">Cargo o profesión</label><input class="input w-full text-sm" id="profile-role" name="role" maxlength="100" required><label class="mt-4 mb-2 block" for="profile-area">Área</label><input class="input w-full text-sm" id="profile-area" name="area" maxlength="100" required><p class="mt-2 text-error empty:hidden" id="profile-error" role="alert"></p><div class="modal-action flex-wrap gap-2"><button type="button" class="btn btn-ghost btn-sm" data-close-dialog>Cancelar</button><button class="btn btn-primary btn-sm" type="submit">Guardar perfil</button></div></form></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>

    <dialog id="delete-dialog" class="modal"><div class="modal-box text-sm"><h2 class="font-semibold">¿Eliminar esta tarea?</h2><p class="mt-3 text-base-content/60">Se quitará de tu registro y del reporte. Esta acción no se puede deshacer.</p><p class="mt-2 text-error empty:hidden" id="delete-error" role="alert"></p><div class="modal-action flex-wrap gap-2"><button class="btn btn-ghost btn-sm" data-close-dialog>Cancelar</button><button class="btn btn-error btn-sm" id="confirm-delete">Eliminar tarea</button></div></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>

    <dialog id="report-dialog" class="modal"><div class="modal-box max-w-5xl text-sm"><div class="mb-4 flex items-start justify-between gap-4"><div><span class="text-xs text-base-content/60">LISTO PARA COMPARTIR</span><h2 class="font-semibold">Tu reporte semanal</h2></div><button class="btn btn-ghost btn-circle btn-sm" data-close-dialog aria-label="Cerrar">✕</button></div><p class="text-base-content/60 empty:hidden" id="report-instructions"></p><div class="my-4 flex flex-wrap items-center justify-between gap-3"><label class="flex items-center gap-2"><input type="checkbox" class="checkbox checkbox-sm" id="include-empty-days"> Incluir días sin tareas</label><button class="btn btn-primary btn-sm" id="print-report">↓ Guardar como PDF</button></div><div class="overflow-hidden rounded-box border border-base-300 bg-base-200"><iframe class="block h-[65vh] min-h-80 w-full border-0" id="report-frame" title="Vista previa del reporte semanal"></iframe></div></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>
    <dialog id="import-dialog" class="modal">
        <div class="modal-box text-sm">
            <form id="import-form">
                <div class="mb-4 flex items-center justify-between gap-4"><h2 class="font-semibold">Importar respaldo</h2><button type="button" class="btn btn-ghost btn-circle btn-sm" data-close-dialog aria-label="Cerrar">✕</button></div>
                <label class="mb-2 block" for="import-file">Selecciona tu respaldo JSON (máximo 5 MB)</label>
                <input class="file-input file-input-sm w-full" type="file" id="import-file" accept=".json,application/json" required>
                <p class="alert mt-4 block text-sm" id="import-preview" role="status" hidden></p>
                <label class="mt-4 flex items-start gap-3"><input class="checkbox checkbox-sm shrink-0" type="checkbox" id="import-confirm" required><span>Confirmo que quiero reemplazar mis datos actuales por los de este respaldo.</span></label>
                <p class="mt-2 text-error empty:hidden" id="import-error" role="alert"></p>
                <div class="modal-action flex-wrap gap-2"><button type="button" class="btn btn-ghost btn-sm" data-close-dialog>Cancelar</button><button type="submit" class="btn btn-primary btn-sm" id="import-submit" disabled>Importar y reemplazar</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <dialog id="categories-dialog" class="modal">
        <div class="modal-box text-sm">
            <div class="mb-4 flex items-center justify-between gap-4"><h2 class="font-semibold">Categorías</h2><button class="btn btn-ghost btn-circle btn-sm" data-close-dialog type="button" aria-label="Cerrar">✕</button></div>
            <div id="categories-list" class="mb-5"></div>
            <form id="category-form">
                <h3 class="font-medium" id="category-form-title">Nueva categoría</h3>
                <input type="hidden" name="originalName" value="">
                <label class="mt-4 mb-2 block" for="category-name">Nombre</label><input class="input input-sm w-full" id="category-name" name="name" maxlength="30" placeholder="Ej. Documentación" required>
                <label class="mt-4 mb-2 block" for="category-color">Color</label><select class="select select-sm w-full" id="category-color" name="color"><option value="info">Azul</option><option value="error">Rojo</option><option value="warning">Amarillo</option><option value="success">Verde</option><option value="secondary">Rosa</option><option value="accent">Turquesa</option><option value="neutral">Neutro</option><option value="orange">Naranja</option><option value="violet">Violeta</option><option value="purple">Púrpura</option><option value="indigo">Índigo</option><option value="lime">Lima</option><option value="emerald">Esmeralda</option><option value="cyan">Cian</option><option value="brown">Marrón</option></select>
                <p class="mt-2 text-error empty:hidden" id="category-error" role="alert"></p>
                <div class="modal-action flex-wrap gap-2"><button class="btn btn-ghost btn-sm" id="category-cancel-edit" type="button" hidden>Cancelar edición</button><button class="btn btn-primary btn-sm" id="category-submit" type="submit">Crear categoría</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <dialog id="category-delete-dialog" class="modal">
        <div class="modal-box text-sm">
            <form id="category-delete-form">
                <div class="mb-4 flex items-center justify-between gap-4"><h2 class="font-semibold">Eliminar categoría</h2><button class="btn btn-ghost btn-circle btn-sm" data-close-dialog type="button" aria-label="Cerrar">✕</button></div>
                <input type="hidden" name="name">
                <p id="category-delete-description" class="text-base-content/60"></p>
                <div id="category-replacement-field" hidden><label class="mt-4 mb-2 block" for="category-replacement">Reasignar sus tareas a</label><select class="select select-sm w-full" id="category-replacement" name="replacement"></select></div>
                <p class="mt-2 text-error empty:hidden" id="category-delete-error" role="alert"></p>
                <div class="modal-action flex-wrap gap-2"><button class="btn btn-ghost btn-sm" data-close-dialog type="button">Cancelar</button><button class="btn btn-error btn-sm" id="category-delete-submit" type="submit">Eliminar categoría</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <div class="toast toast-end" id="toast-region" role="status" aria-live="polite"></div>
    <noscript><div class="alert alert-warning fixed inset-x-4 top-4 z-50">Activa JavaScript para registrar tareas y generar tus reportes.</div></noscript>
</body>
</html>
