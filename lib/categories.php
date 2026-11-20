<?php
declare(strict_types=1);

function defaultCategories(): array
{
    return [
        ['name' => 'Desarrollo', 'color' => 'info'],
        ['name' => 'Corrección', 'color' => 'error'],
        ['name' => 'Soporte', 'color' => 'warning'],
        ['name' => 'Despliegue', 'color' => 'success'],
        ['name' => 'Monitoreo', 'color' => 'secondary'],
        ['name' => 'Otros', 'color' => 'accent'],
    ];
}

function validatedCategories(mixed $categories): array
{
    if (!is_array($categories) || !array_is_list($categories) || count($categories) < 1 || count($categories) > 50) {
        throw new InvalidArgumentException('Debe haber entre 1 y 50 categorías.');
    }
    $result = [];
    foreach ($categories as $category) {
        if (!is_array($category) || !is_string($category['name'] ?? null) || !is_string($category['color'] ?? null)) {
            throw new InvalidArgumentException('La categoría debe tener nombre y color.');
        }
        $name = trim($category['name']);
        if ($name === '' || preg_match('//u', $name) !== 1 || preg_match_all('/./us', $name) > 30
            || preg_match('/[\x00-\x1F\x7F]/u', $name) || preg_match('/\ATodas\z/iu', $name)) {
            throw new InvalidArgumentException('Usa un nombre de categoría de 1 a 30 caracteres, diferente de «Todas».');
        }
        if (!in_array($category['color'], ['neutral', 'info', 'error', 'warning', 'success', 'secondary', 'accent'], true)) {
            throw new InvalidArgumentException('Selecciona un color de categoría válido.');
        }
        foreach ($result as $existing) {
            if (preg_match('/\A' . preg_quote($name, '/') . '\z/iu', $existing['name'])) {
                throw new InvalidArgumentException('Ya existe una categoría con ese nombre.');
            }
        }
        $result[] = ['name' => $name, 'color' => $category['color']];
    }
    return $result;
}

function categoryIndex(array $categories, string $name): ?int
{
    foreach ($categories as $index => $category) {
        if ($category['name'] === $name) return $index;
    }
    return null;
}
