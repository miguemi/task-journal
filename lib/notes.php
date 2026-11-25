<?php
declare(strict_types=1);

function validatedNote(array $input): array
{
    $status = field($input, 'status', 20);
    if (!in_array($status, ['pending', 'resolved'], true)) {
        throw new InvalidArgumentException('Selecciona un estado válido para la nota.');
    }
    $date = field($input, 'date', 10);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '2000-01-01' || $date > '2100-12-31') {
        throw new InvalidArgumentException('Selecciona una fecha válida entre 2000 y 2100.');
    }
    $steps = field($input, 'steps', 12000, false);
    $images = $input['images'] ?? [];
    if (!is_array($images) || !array_is_list($images) || count($images) > 3) {
        throw new InvalidArgumentException('Cada nota admite hasta 3 capturas.');
    }
    $attachments = [];
    foreach ($images as $image) {
        if (!is_array($image) || !isset($image['data']) || !is_string($image['data'])
            || strlen($image['data']) > 1400000
            || !preg_match('~^data:(image/(?:jpeg|png|webp));base64,~', $image['data'], $match)) {
            throw new InvalidArgumentException('Las capturas deben ser imágenes JPG, PNG o WebP de hasta 1 MB.');
        }
        $binary = base64_decode(substr($image['data'], strlen($match[0])), true);
        $size = $binary === false ? false : @getimagesizefromstring($binary);
        if ($binary === false || strlen($binary) > 1024 * 1024 || !$size
            || ($size['mime'] ?? '') !== $match[1] || $size[0] > 4096 || $size[1] > 4096) {
            throw new InvalidArgumentException('Una captura no es válida o supera el tamaño permitido.');
        }
        $attachments[] = ['name' => field($image, 'name', 120), 'data' => $image['data']];
    }
    return [
        'title' => field($input, 'title', 180),
        'commerce' => field($input, 'commerce', 120, false),
        'date' => $date,
        'details' => field($input, 'details', 6000),
        'steps' => $steps,
        'status' => $status,
        'tags' => field($input, 'tags', 200, false),
        'images' => $attachments,
    ];
}

function validatedNotes(mixed $notes): array
{
    if (!is_array($notes) || !array_is_list($notes) || count($notes) > 1000) {
        throw new InvalidArgumentException('Se admite una lista de hasta 1000 notas.');
    }
    $result = [];
    $ids = [];
    foreach ($notes as $item) {
        if (!is_array($item)) {
            throw new InvalidArgumentException('El respaldo contiene una nota no válida.');
        }
        $id = field($item, 'id', 64);
        if (isset($ids[$id])) {
            throw new InvalidArgumentException('El respaldo contiene identificadores de nota duplicados.');
        }
        $ids[$id] = true;
        $result[] = ['id' => $id, ...validatedNote($item)];
    }
    return $result;
}
