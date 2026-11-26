#!/usr/bin/env bash
# Ejecutar desde apps/web con Git Bash. No requiere API ni credenciales.
set -euo pipefail
mkdir -p public/images/landing
fetch() {
  local id="$1" name="$2" width="$3" dest="public/images/landing/$2.jpg"
  curl --fail --location --retry 2 --max-time 60 "https://images.pexels.com/photos/$id/pexels-photo-$id.jpeg?auto=compress&cs=tinysrgb&w=$width" -o "$dest.tmp"
  mv "$dest.tmp" "$dest"
}
fetch 8199761 hero-students 1400
fetch 5965540 student-learning 900
fetch 8419196 teacher-classroom 900
