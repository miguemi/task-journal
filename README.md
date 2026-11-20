# task-journal

Lightweight daily task tracker with weekly PDF reports, JSON storage, and AI-powered writing assistance.

Requires **PHP 8.1+**. No `npm install` or `composer install` needed.

## Install PHP

- **Windows:** download PHP from [windows.php.net](https://windows.php.net/download/), extract it to `C:\php`, add that folder to your user's **Path**, and reopen PowerShell. Follow the download page's runtime requirements.
- **Linux/macOS:** install PHP with your package manager, or use `nix shell nixpkgs#php` if you have Nix.

Check the installation with `php --version`.

## Getting started

1. Download or clone the project and open a terminal in its directory.
2. Create the `storage` folder and `storage/reportes.json` if they do not exist:

```json
{"profile":{"name":"Your name","role":"Your role","area":"Your department"},"tasks":[]}
```

3. From the project directory, run in PowerShell (Windows) or your terminal (Linux/macOS):

```sh
php -S 127.0.0.1:8080 -t public
```

Open http://127.0.0.1:8080. Press **Ctrl+C** to stop.

## Usage

The interface is currently in Spanish:

- Complete **Mi perfil** (My profile), record tasks, and manage **Categorías** (Categories).
- Browse previous weeks in **Historial** (History).
- **Generar reporte → Guardar como PDF**: choose A4, 100% scale, and disable browser headers and footers.
- **Respaldar mis datos / Importar respaldo**: export or restore your JSON data. Importing replaces existing data.

**Optional AI:** create the `config` folder and `config/ai.local.php` containing `<?php return ['api_key'=>'YOUR_KEY', 'model'=>'deepseek-flash'];`. Click **Mejorar redacción** (Improve wording), review the suggestion, and save. This sends the task text to DeepSeek and may incur charges. PHP needs HTTPS support with OpenSSL and valid CA certificates.
