{
  description = "Bitácora de reportes semanales";

  inputs.nixpkgs.url = "https://flakehub.com/f/DeterminateSystems/nixpkgs-weekly/0.1";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forEachSystem (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          launcher = pkgs.writeShellScriptBin "run-migue" ''
            set -euo pipefail

            project_dir="''${MIGUE_DIR:-}"
            if [[ -z "$project_dir" ]]; then
              if [[ -f "$PWD/public/index.php" && -f "$PWD/storage/reportes.json" ]]; then
                project_dir="$PWD"
              else
                project_dir="$HOME/REPORTE-SEMANAL"
              fi
            fi

            if [[ ! -f "$project_dir/public/index.php" || ! -f "$project_dir/storage/reportes.json" ]]; then
              echo "No se encontró la app. Ejecuta run-migue desde REPORTE-SEMANAL o define MIGUE_DIR." >&2
              exit 1
            fi

            if (( $# > 1 )); then
              echo "Uso: run-migue [puerto]" >&2
              exit 1
            fi
            port="''${1:-8080}"
            if [[ ! "$port" =~ ^[0-9]{1,5}$ ]]; then
              echo "El puerto debe ser un número entre 1 y 65535." >&2
              exit 1
            fi
            if (( 10#$port < 1 || 10#$port > 65535 )); then
              echo "El puerto debe estar entre 1 y 65535." >&2
              exit 1
            fi
            port="$((10#$port))"

            echo "Bitácora → http://127.0.0.1:$port"
            echo "Ctrl+C para detener. Datos: $project_dir/storage/reportes.json"
            exec ${pkgs.php}/bin/php -S "127.0.0.1:$port" -t "$project_dir/public"
          '';
        in
        {
          default = launcher;
          run-migue = launcher;
        });

      devShells = forEachSystem (system:
        let pkgs = nixpkgs.legacyPackages.${system};
        in {
          default = pkgs.mkShell {
            packages = [ pkgs.php ];
            shellHook = ''
              export PATH="$PWD:$PATH"
            '';
          };
        });
    };
}
