<?php
declare(strict_types=1);

function validatedReminder(array $input): array
{
    $date = field($input, 'date', 10, false);
    if ($date !== '') {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $date < '2000-01-01' || $date > '2100-12-31') {
            throw new InvalidArgumentException('Selecciona una fecha válida entre 2000 y 2100.');
        }
    }
    if (isset($input['completed']) && !is_bool($input['completed'])) {
        throw new InvalidArgumentException('El estado del recordatorio no es válido.');
    }
    return [
        'title' => field($input, 'title', 200),
        'description' => field($input, 'description', 2000, false),
        'date' => $date,
        'completed' => $input['completed'] ?? false,
    ];
}

function validatedReminders(mixed $reminders): array
{
    if (!is_array($reminders) || !array_is_list($reminders) || count($reminders) > 1000) {
        throw new InvalidArgumentException('El respaldo admite una lista de hasta 1000 recordatorios.');
    }
    $result = [];
    $ids = [];
    foreach ($reminders as $item) {
        if (!is_array($item)) {
            throw new InvalidArgumentException('El respaldo contiene un recordatorio no válido.');
        }
        $id = field($item, 'id', 64);
        if (isset($ids[$id])) {
            throw new InvalidArgumentException('El respaldo contiene identificadores de recordatorio duplicados.');
        }
        $ids[$id] = true;
        $result[] = ['id' => $id, ...validatedReminder($item)];
    }
    return $result;
}
