"""Valida React/Tiptap desde un ZIP completo, sin tocar el proyecto de trabajo.

Uso: python tools/verificacion/validar_frontend_en_copia.py RUTA_ZIP_COMPLETO
El paquete se extrae en un directorio temporal nuevo. npm escribe SOLO allí.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from zipfile import ZipFile


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python validar_frontend_en_copia.py RUTA_ZIP_COMPLETO", file=sys.stderr)
        return 2
    archive = Path(sys.argv[1]).expanduser().resolve()
    if not archive.is_file():
        print(f"No existe el ZIP: {archive}", file=sys.stderr)
        return 2
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("No se encontró npm en PATH.", file=sys.stderr)
        return 2
    workdir = Path(tempfile.mkdtemp(prefix="edumaster_v29_1_revision_"))
    print(f"Carpeta temporal de ensayo: {workdir}", flush=True)
    with ZipFile(archive) as pack:
        for member in pack.infolist():
            name = PurePosixPath(member.filename)
            if name.is_absolute() or ".." in name.parts or not name.parts:
                raise ValueError(f"Ruta insegura en el ZIP: {member.filename}")
            # No admitir enlaces simbólicos dentro del ZIP.
            if (member.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError(f"Enlace simbólico no permitido: {member.filename}")
        pack.extractall(workdir)
    web = workdir / "edumaster-ai" / "apps" / "web"
    if not (web / "package.json").exists():
        print("El ZIP no contiene apps/web/package.json", file=sys.stderr)
        return 2
    commands = [
        [npm, "install", "--no-audit", "--no-fund"],
        [npm, "run", "build"],
        [npm, "run", "test:editor"],
    ]
    for cmd in commands:
        print(f"\n>>> {' '.join(cmd)}", flush=True)
        completed = subprocess.run(cmd, cwd=web, check=False)
        if completed.returncode:
            print(f"\nFALLÓ (exit {completed.returncode}). La copia de prueba sigue en {workdir}")
            return completed.returncode
    print("\nBuild y tests React superados en copia aislada.")
    print(f"Si deseas conservar el lockfile para reproducibilidad: {web / 'package-lock.json'}")
    print("Ningún archivo de tu proyecto principal fue modificado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
