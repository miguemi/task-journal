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
    <link href="assets/app.css" rel="stylesheet">
    <script src="assets/app.js" defer></script>
</head>
<body>
    <div class="app-shell">
        <aside class="sidebar">
            <a class="brand" href="./" aria-label="Bitácora, inicio">Bitácora</a>
            <nav aria-label="Navegación principal">
                <button class="nav-item active" id="nav-week"><span aria-hidden="true">▦</span> Mi semana <span class="nav-dot"></span></button>
                <button class="nav-item" id="nav-history"><span aria-hidden="true">▤</span> Historial de reportes</button>
                <button class="nav-item" id="nav-profile"><span aria-hidden="true">⚙</span> Mi perfil</button>
                <button class="nav-item" id="nav-import">Importar respaldo</button>
                <button class="nav-item" id="nav-categories">Categorías</button>
            </nav>
            <div class="sidebar-bottom">
                <button id="backup-button" class="backup-button">↓ &nbsp; Respaldar mis datos <span>JSON</span></button>
                <button class="user-card" id="profile-shortcut"><span class="avatar-placeholder" id="avatar-initials">—</span><span><strong id="sidebar-name">Mi perfil</strong><small id="sidebar-area">Área</small></span><span class="user-settings">↗</span></button>
            </div>
        </aside>

        <main class="main-content">
            <header class="topbar"><span><span class="breadcrumb-muted">Mi espacio</span><span class="breadcrumb-separator">/</span><span id="breadcrumb-current">Reporte semanal</span></span><div class="topbar-actions"><span class="storage-status" id="storage-status" role="status"><span></span> Guardado en JSON</span><button class="btn btn-sm" id="theme-toggle" type="button" aria-pressed="false">Modo oscuro</button></div></header>
            <section class="page-heading"><div><h1 id="page-title">Reporte semanal</h1><p id="page-description" hidden></p></div><div class="heading-actions"><button class="btn btn-primary" id="add-task-top"><span aria-hidden="true">＋</span> Nueva tarea</button><button class="btn export-button" id="export-pdf"><span aria-hidden="true">↗</span> Generar reporte <span class="pdf-badge">PDF</span></button></div></section>

            <section id="week-view">
                <div class="week-toolbar"><div class="week-picker"><button class="btn btn-ghost btn-square" id="previous-week" aria-label="Semana anterior">‹</button><div><strong id="week-range"></strong></div><button class="btn btn-ghost btn-square" id="next-week" aria-label="Semana siguiente">›</button><button class="btn btn-ghost btn-sm today-button" id="current-week">Esta semana</button></div></div>
                <div class="content-grid">
                    <section class="activity-panel">
                        <div class="section-title"><h2>Tareas <span class="badge" id="activity-count">0</span></h2><label class="search-box"><span aria-hidden="true">⌕</span><input id="task-search" type="search" placeholder="Buscar tarea…" aria-label="Buscar tarea"></label></div>
                        <div class="filter-row" id="category-filters" aria-label="Filtrar por categoría"></div>
                        <div id="task-list" aria-live="polite"><div class="loading-state"><span class="loading loading-spinner loading-sm"></span> Cargando tu bitácora…</div></div>
                    </section>
                </div>
            </section>

            <section id="history-view" hidden><div class="section-title"><h2>Tus semanas registradas</h2></div><div id="history-list" class="history-list"></div></section>
            <footer class="app-footer"><span>Datos locales · JSON</span><span>Bitácora</span></footer>
        </main>
    </div>

    <dialog id="task-dialog" class="modal">
        <div class="modal-box task-modal">
            <form id="task-form"><div class="modal-heading"><div><span class="eyebrow">TU REGISTRO DIARIO</span><h2 id="task-dialog-title">Nueva tarea</h2></div><button type="button" class="btn btn-ghost btn-circle close-dialog" aria-label="Cerrar">✕</button></div>
                <input type="hidden" name="id">
                <label class="field-label" for="task-title">¿En qué trabajaste?</label><textarea class="textarea" id="task-title" name="title" rows="3" maxlength="600" placeholder="Ej. Implementación del requerimiento de pago combinado" required></textarea>
                <label class="field-label" for="task-description">Detalles <span>(opcional)</span></label><textarea class="textarea" id="task-description" name="description" rows="4" maxlength="4000" placeholder="Contexto, cambios realizados o resultados…"></textarea>
                <div class="ai-actions"><button class="btn btn-sm" id="improve-task" type="button" disabled>Mejorar redacción</button><span class="ai-notice">Envía el título, los detalles y la categoría a DeepSeek. Puede generar un costo.</span></div>
                <p class="form-error" id="ai-error" role="alert"></p>
                <section class="ai-preview" id="ai-preview" aria-live="polite" hidden><h3>Propuesta de redacción</h3><p id="ai-title"></p><p id="ai-description"></p><p class="ai-notice">Revisa que conserve los hechos antes de aplicarla.</p><div class="ai-actions"><button class="btn btn-sm btn-primary" id="apply-ai" type="button">Aplicar sugerencia</button><button class="btn btn-sm btn-ghost" id="discard-ai" type="button">Descartar</button></div></section>
                <div class="form-row"><div><label class="field-label" for="task-date">Fecha</label><input class="input" id="task-date" name="date" type="date" required min="2000-01-01" max="2100-12-31"></div><div><label class="field-label" for="task-category">Categoría</label><select class="select" id="task-category" name="category" required></select></div></div>
                <p class="form-error" id="task-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-ghost close-dialog">Cancelar</button><button class="btn btn-primary" type="submit">Guardar tarea</button></div>
            </form>
        </div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>

    <dialog id="profile-dialog" class="modal"><div class="modal-box"><form id="profile-form"><div class="modal-heading"><div><span class="eyebrow">LA FIRMA DE TU TRABAJO</span><h2>Mi perfil</h2></div><button type="button" class="btn btn-ghost btn-circle close-dialog" aria-label="Cerrar">✕</button></div><label class="field-label" for="profile-name">Nombre completo</label><input class="input" id="profile-name" name="name" maxlength="100" required><label class="field-label" for="profile-role">Cargo o profesión</label><input class="input" id="profile-role" name="role" maxlength="100" required><label class="field-label" for="profile-area">Área</label><input class="input" id="profile-area" name="area" maxlength="100" required><p class="form-error" id="profile-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn btn-ghost close-dialog">Cancelar</button><button class="btn btn-primary" type="submit">Guardar perfil</button></div></form></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>

    <dialog id="delete-dialog" class="modal"><div class="modal-box"><h2>¿Eliminar esta tarea?</h2><p class="delete-description">Se quitará de tu registro y del reporte. Esta acción no se puede deshacer.</p><p class="form-error" id="delete-error" role="alert"></p><div class="modal-actions"><button class="btn btn-ghost close-dialog">Cancelar</button><button class="btn btn-error" id="confirm-delete">Eliminar tarea</button></div></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>

    <dialog id="report-dialog" class="modal"><div class="modal-box report-modal"><div class="modal-heading"><div><span class="eyebrow">LISTO PARA COMPARTIR</span><h2>Tu reporte semanal</h2></div><button class="btn btn-ghost btn-circle close-dialog" aria-label="Cerrar">✕</button></div><p class="report-instructions" id="report-instructions">Para descargarlo, elige «Guardar como PDF» en el diálogo de impresión. Papel A4, escala 100 %, sin encabezados ni pies del navegador.</p><div class="report-options"><label><input type="checkbox" class="checkbox checkbox-sm" id="include-empty-days"> Incluir días sin tareas</label><button class="btn btn-primary" id="print-report">↓ Guardar como PDF</button></div><div class="report-frame-wrap"><iframe id="report-frame" title="Vista previa del reporte semanal"></iframe></div></div><form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form></dialog>
    <dialog id="import-dialog" class="modal">
        <div class="modal-box">
            <form id="import-form">
                <div class="modal-heading"><h2>Importar respaldo</h2><button type="button" class="btn btn-ghost btn-circle close-dialog" aria-label="Cerrar">✕</button></div>
                <p class="import-description">Restaura un respaldo JSON de Bitácora. Reemplazará todas las tareas y el perfil actuales; no se combinarán los registros.</p>
                <button type="button" class="btn btn-sm" id="import-backup-current">Descargar respaldo actual</button>
                <label class="field-label" for="import-file">Selecciona tu respaldo JSON (máximo 5 MB)</label>
                <input class="file-input file-input-sm import-file" type="file" id="import-file" accept=".json,application/json" required>
                <p class="import-preview" id="import-preview" role="status" hidden></p>
                <label class="import-confirmation"><input class="checkbox checkbox-sm" type="checkbox" id="import-confirm" required><span>Confirmo que quiero reemplazar mis datos actuales por los de este respaldo.</span></label>
                <p class="form-error" id="import-error" role="alert"></p>
                <div class="modal-actions"><button type="button" class="btn btn-ghost close-dialog">Cancelar</button><button type="submit" class="btn btn-primary" id="import-submit" disabled>Importar y reemplazar</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <dialog id="categories-dialog" class="modal">
        <div class="modal-box">
            <div class="modal-heading"><h2>Categorías</h2><button class="btn btn-ghost btn-circle close-dialog" type="button" aria-label="Cerrar">✕</button></div>
            <div id="categories-list" class="categories-list"></div>
            <form id="category-form">
                <h3 id="category-form-title">Nueva categoría</h3>
                <input type="hidden" name="originalName" value="">
                <label class="field-label" for="category-name">Nombre</label><input class="input" id="category-name" name="name" maxlength="30" placeholder="Ej. Documentación" required>
                <label class="field-label" for="category-color">Color</label><select class="select" id="category-color" name="color"><option value="info">Azul</option><option value="error">Rojo</option><option value="warning">Amarillo</option><option value="success">Verde</option><option value="secondary">Rosa</option><option value="accent">Turquesa</option><option value="neutral">Neutro</option><option value="orange">Naranja</option><option value="violet">Violeta</option><option value="purple">Púrpura</option><option value="indigo">Índigo</option><option value="lime">Lima</option><option value="emerald">Esmeralda</option><option value="cyan">Cian</option><option value="brown">Marrón</option></select>
                <p class="form-error" id="category-error" role="alert"></p>
                <div class="modal-actions"><button class="btn btn-ghost" id="category-cancel-edit" type="button" hidden>Cancelar edición</button><button class="btn btn-primary" id="category-submit" type="submit">Crear categoría</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <dialog id="category-delete-dialog" class="modal">
        <div class="modal-box">
            <form id="category-delete-form">
                <div class="modal-heading"><h2>Eliminar categoría</h2><button class="btn btn-ghost btn-circle close-dialog" type="button" aria-label="Cerrar">✕</button></div>
                <input type="hidden" name="name">
                <p id="category-delete-description" class="delete-description"></p>
                <div id="category-replacement-field" hidden><label class="field-label" for="category-replacement">Reasignar sus tareas a</label><select class="select" id="category-replacement" name="replacement"></select></div>
                <p class="form-error" id="category-delete-error" role="alert"></p>
                <div class="modal-actions"><button class="btn btn-ghost close-dialog" type="button">Cancelar</button><button class="btn btn-error" id="category-delete-submit" type="submit">Eliminar categoría</button></div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button aria-label="Cerrar">cerrar</button></form>
    </dialog>
    <div class="toast toast-end" id="toast-region" role="status" aria-live="polite"></div>
    <noscript><div class="noscript-notice">Activa JavaScript para registrar tareas y generar tus reportes.</div></noscript>
</body>
</html>
