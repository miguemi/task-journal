<?php
declare(strict_types=1);

function validatedScript(array $input): array
{
    $language = field($input, 'language', 20);
    if (!in_array($language, ['bash', 'powershell', 'python', 'javascript', 'typescript', 'php', 'kotlin', 'json', 'sql', 'other'], true)) {
        throw new InvalidArgumentException('Selecciona un lenguaje válido para el script.');
    }
    $code = $input['code'] ?? null;
    if (!is_string($code) || preg_match('//u', $code) !== 1 || trim($code) === ''
        || preg_match_all('/./us', $code) > 100000) {
        throw new InvalidArgumentException('El código es obligatorio y admite hasta 100000 caracteres.');
    }
    if (isset($input['favorite']) && !is_bool($input['favorite'])) {
        throw new InvalidArgumentException('El favorito del script no es válido.');
    }
    return [
        'title' => field($input, 'title', 120),
        'description' => field($input, 'description', 2000, false),
        'language' => $language,
        'tags' => field($input, 'tags', 200, false),
        'code' => $code,
        'favorite' => $input['favorite'] ?? false,
    ];
}

function validatedScripts(mixed $scripts): array
{
    if (!is_array($scripts) || !array_is_list($scripts) || count($scripts) > 1000) {
        throw new InvalidArgumentException('El respaldo admite una lista de hasta 1000 scripts.');
    }
    $result = [];
    $ids = [];
    foreach ($scripts as $item) {
        if (!is_array($item)) {
            throw new InvalidArgumentException('El respaldo contiene un script no válido.');
        }
        $id = field($item, 'id', 64);
        if (isset($ids[$id])) {
            throw new InvalidArgumentException('El respaldo contiene identificadores de script duplicados.');
        }
        $ids[$id] = true;
        $result[] = ['id' => $id, ...validatedScript($item)];
    }
    return $result;
}
