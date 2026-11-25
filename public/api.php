<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/categories.php';
require dirname(__DIR__) . '/lib/scripts.php';
require dirname(__DIR__) . '/lib/notes.php';

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function field(array $input, string $key, int $max, bool $required = true): string
{
    $value = $input[$key] ?? '';
    if (!is_string($value) || preg_match('//u', $value) !== 1) {
        throw new InvalidArgumentException('El campo ' . $key . ' no es válido.');
    }
    $value = trim($value);
    if (($required && $value === '') || preg_match_all('/./us', $value) > $max) {
        throw new InvalidArgumentException('Revisa el campo ' . $key . ' (máximo ' . $max . ' caracteres).');
    }
    return $value;
}

$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(['error' => 'Método no permitido.'], 405);
    return;
}
if ($method === 'POST' && (!isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
    respond(['error' => 'La sesión expiró. Recarga la página antes de guardar.'], 403);
    return;
}
session_write_close();
$directory = dirname(__DIR__) . '/storage';
$lock = null;
$temporary = null;

try {
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('No se pudo crear la carpeta de datos.');
    }
    $lock = fopen($directory . '/reportes.lock', 'c');
    if ($lock === false || !flock($lock, $method === 'POST' ? LOCK_EX : LOCK_SH)) {
        throw new RuntimeException('No se pudo acceder al archivo de datos.');
    }
    $file = $directory . '/reportes.json';
    $data = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data) || !isset($data['profile'], $data['tasks'])) {
        throw new RuntimeException('El archivo de datos no tiene el formato esperado.');
    }
    $data['categories'] = validatedCategories($data['categories'] ?? defaultCategories());
    $data['scripts'] = validatedScripts($data['scripts'] ?? []);
    $data['notes'] = validatedNotes($data['notes'] ?? []);
    if ($method === 'GET') {
        respond($data);
        return;
    }
    $limit = 20 * 1024 * 1024 + 1024;
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) {
        respond(['error' => 'El respaldo supera el límite de 20 MB.'], 413);
        return;
    }
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false || strlen($raw) > $limit) {
        respond(['error' => 'El respaldo supera el límite de 20 MB.'], 413);
        return;
    }
    $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input)) {
        throw new InvalidArgumentException('La solicitud no es válida.');
    }
    $action = $input['action'] ?? '';
    $requestLimit = in_array($action, ['script.create', 'script.update'], true) ? 1024 * 1024 : 32768;
    if (in_array($action, ['note.create', 'note.update'], true)) $requestLimit = 5 * 1024 * 1024;
    if ($action !== 'backup.import' && strlen($raw) > $requestLimit) {
        respond(['error' => 'La solicitud es demasiado grande.'], 413);
        return;
    }
    if ($action === 'backup.import') {
        $backup = $input['backup'] ?? null;
        if (($input['confirmed'] ?? false) !== true) {
            throw new InvalidArgumentException('Confirma el reemplazo de tus datos.');
        }
        if (!is_array($backup) || !isset($backup['profile'], $backup['tasks'])
            || !is_array($backup['profile']) || !is_array($backup['tasks'])
            || !array_is_list($backup['tasks']) || count($backup['tasks']) > 10000) {
            throw new InvalidArgumentException('El respaldo debe contener un perfil y una lista de hasta 10000 tareas.');
        }
        $imported = [
            'profile' => [
                'name' => field($backup['profile'], 'name', 100),
                'role' => field($backup['profile'], 'role', 100),
                'area' => field($backup['profile'], 'area', 100),
            ],
            'tasks' => [],
            'categories' => validatedCategories($backup['categories'] ?? defaultCategories()),
            'scripts' => validatedScripts(array_key_exists('scripts', $backup) ? $backup['scripts'] : $data['scripts']),
            'notes' => validatedNotes(array_key_exists('notes', $backup) ? $backup['notes'] : $data['notes']),
        ];
        $ids = [];
        foreach ($backup['tasks'] as $number => $item) {
            if (!is_array($item)) {
                throw new InvalidArgumentException('La tarea ' . ($number + 1) . ' no es válida.');
            }
            $id = field($item, 'id', 64);
            if (isset($ids[$id])) {
                throw new InvalidArgumentException('El respaldo contiene identificadores de tarea duplicados.');
            }
            $ids[$id] = true;
            $date = field($item, 'date', 10);
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '2000-01-01' || $date > '2100-12-31'
                || (int) $parsed->format('N') > 5) {
                throw new InvalidArgumentException('La tarea ' . ($number + 1) . ' debe tener una fecha válida de lunes a viernes entre 2000 y 2100.');
            }
            $category = field($item, 'category', 30);
            if (categoryIndex($imported['categories'], $category) === null) {
                throw new InvalidArgumentException('La tarea ' . ($number + 1) . ' tiene una categoría no válida.');
            }
            $imported['tasks'][] = [
                'id' => $id,
                'date' => $date,
                'title' => field($item, 'title', 600),
                'description' => field($item, 'description', 4000, false),
                'category' => $category,
            ];
        }
        $data = $imported;
    } elseif (in_array($action, ['note.create', 'note.update', 'note.delete'], true)) {
        $index = null;
        if ($action !== 'note.create') {
            $id = field($input, 'id', 64);
            foreach ($data['notes'] as $key => $note) {
                if ($note['id'] === $id) {
                    $index = $key;
                    break;
                }
            }
            if ($index === null) {
                respond(['error' => 'Esta nota ya no existe. Recarga la página.'], 404);
                return;
            }
        }
        if ($action === 'note.delete') {
            if (($input['confirmed'] ?? false) !== true) {
                throw new InvalidArgumentException('Confirma la eliminación de la nota.');
            }
            array_splice($data['notes'], $index, 1);
        } else {
            if ($action === 'note.create' && count($data['notes']) >= 1000) {
                throw new InvalidArgumentException('Se admite un máximo de 1000 notas.');
            }
            $note = [
                'id' => $action === 'note.create' ? bin2hex(random_bytes(12)) : $data['notes'][$index]['id'],
                ...validatedNote($input),
            ];
            if ($action === 'note.create') {
                $data['notes'][] = $note;
            } else {
                $data['notes'][$index] = $note;
            }
        }
    } elseif (in_array($action, ['script.create', 'script.update', 'script.delete', 'script.favorite'], true)) {
        $index = null;
        if ($action !== 'script.create') {
            $id = field($input, 'id', 64);
            foreach ($data['scripts'] as $key => $script) {
                if ($script['id'] === $id) {
                    $index = $key;
                    break;
                }
            }
            if ($index === null) {
                respond(['error' => 'Este script ya no existe. Recarga la página.'], 404);
                return;
            }
        }
        if ($action === 'script.delete') {
            if (($input['confirmed'] ?? false) !== true) {
                throw new InvalidArgumentException('Confirma la eliminación del script.');
            }
            array_splice($data['scripts'], $index, 1);
        } elseif ($action === 'script.favorite') {
            if (!isset($input['favorite']) || !is_bool($input['favorite'])) {
                throw new InvalidArgumentException('El favorito del script no es válido.');
            }
            $data['scripts'][$index]['favorite'] = $input['favorite'];
        } else {
            if ($action === 'script.create' && count($data['scripts']) >= 1000) {
                throw new InvalidArgumentException('Tu biblioteca admite hasta 1000 scripts.');
            }
            $script = [
                'id' => $action === 'script.create' ? bin2hex(random_bytes(12)) : $data['scripts'][$index]['id'],
                ...validatedScript($input),
            ];
            if ($action === 'script.create') {
                $data['scripts'][] = $script;
            } else {
                $data['scripts'][$index] = $script;
            }
        }
    } elseif ($action === 'category.create') {
        $data['categories'] = validatedCategories([
            ...$data['categories'],
            ['name' => field($input, 'name', 30), 'color' => field($input, 'color', 20)],
        ]);
    } elseif ($action === 'category.update') {
        $originalName = field($input, 'originalName', 30);
        $index = categoryIndex($data['categories'], $originalName);
        if ($index === null) {
            throw new InvalidArgumentException('La categoría ya no existe. Recarga la página.');
        }
        $name = field($input, 'name', 30);
        $data['categories'][$index] = ['name' => $name, 'color' => field($input, 'color', 20)];
        $data['categories'] = validatedCategories($data['categories']);
        foreach ($data['tasks'] as $key => $task) {
            if ($task['category'] === $originalName) $data['tasks'][$key]['category'] = $name;
        }
    } elseif ($action === 'category.delete') {
        if (($input['confirmed'] ?? false) !== true) {
            throw new InvalidArgumentException('Confirma la eliminación de la categoría.');
        }
        $name = field($input, 'name', 30);
        $index = categoryIndex($data['categories'], $name);
        if ($index === null) {
            throw new InvalidArgumentException('La categoría ya no existe. Recarga la página.');
        }
        if (count($data['categories']) < 2) {
            throw new InvalidArgumentException('Debe quedar al menos una categoría. Crea otra antes de eliminar esta.');
        }
        $used = false;
        foreach ($data['tasks'] as $task) {
            if ($task['category'] === $name) $used = true;
        }
        if ($used) {
            $replacement = field($input, 'replacement', 30);
            if ($replacement === $name || categoryIndex($data['categories'], $replacement) === null) {
                throw new InvalidArgumentException('Elige otra categoría para reasignar las tareas.');
            }
            foreach ($data['tasks'] as $key => $task) {
                if ($task['category'] === $name) $data['tasks'][$key]['category'] = $replacement;
            }
        }
        array_splice($data['categories'], $index, 1);
    } elseif ($action === 'profile.update') {
        $data['profile'] = [
            'name' => field($input, 'name', 100),
            'role' => field($input, 'role', 100),
            'area' => field($input, 'area', 100),
        ];
    } elseif (in_array($action, ['task.create', 'task.update', 'task.delete'], true)) {
        $index = null;
        if ($action !== 'task.create') {
            $id = field($input, 'id', 64);
            foreach ($data['tasks'] as $key => $task) {
                if ($task['id'] === $id) {
                    $index = $key;
                    break;
                }
            }
            if ($index === null) {
                respond(['error' => 'Esta tarea ya no existe. Recarga la página.'], 404);
                return;
            }
        }
        if ($action === 'task.delete') {
            array_splice($data['tasks'], $index, 1);
        } else {
            $date = field($input, 'date', 10);
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
            if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '2000-01-01' || $date > '2100-12-31') {
                throw new InvalidArgumentException('Selecciona una fecha válida entre 2000 y 2100.');
            }
            if ((int) $parsed->format('N') > 5) {
                throw new InvalidArgumentException('Selecciona un día hábil, de lunes a viernes.');
            }
            $category = field($input, 'category', 30);
            if (categoryIndex($data['categories'], $category) === null) {
                throw new InvalidArgumentException('Selecciona una categoría válida.');
            }
            $task = [
                'id' => $action === 'task.create' ? bin2hex(random_bytes(12)) : $data['tasks'][$index]['id'],
                'date' => $date,
                'title' => field($input, 'title', 600),
                'description' => field($input, 'description', 4000, false),
                'category' => $category,
            ];
            if ($action === 'task.create') {
                $data['tasks'][] = $task;
            } else {
                $data['tasks'][$index] = $task;
            }
        }
    } else {
        throw new InvalidArgumentException('Acción no válida.');
    }
    $data['updatedAt'] = gmdate('c');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
    if (in_array($action, ['note.create', 'note.update', 'backup.import'], true) && strlen($json) > 20 * 1024 * 1024) {
        throw new InvalidArgumentException('El JSON supera los 20 MB. Reduce las capturas o elimina notas que ya no necesites.');
    }
    $temporary = tempnam($directory, '.reportes-');
    if ($temporary === false || file_put_contents($temporary, $json) !== strlen($json) || !rename($temporary, $file)) {
        throw new RuntimeException('No se pudieron guardar los cambios.');
    }
    $temporary = null;
    respond($data);
} catch (InvalidArgumentException | JsonException $exception) {
    respond(['error' => 'Datos no válidos: ' . $exception->getMessage()], 422);
} catch (Throwable $exception) {
    error_log('Bitácora: ' . $exception->getMessage());
    respond(['error' => 'No se pudo leer o guardar el JSON. Revisa el archivo y los permisos de storage/.'], 500);
} finally {
    if ($temporary && is_file($temporary)) {
        unlink($temporary);
    }
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
