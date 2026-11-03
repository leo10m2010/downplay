#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
set -eu
task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$task_dir"
if [ "$#" -ne 1 ]; then echo 'Uso: sh actualizar.sh archivo-actualizacion.zip'; exit 2; fi
python3 tools/apply_update.py --archive "$1" --verify-only
task_service_active=0
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet downhill-web.service; then
  task_service_active=1
  sudo systemctl stop downhill-web.service
fi
task_result=0
python3 tools/apply_update.py --archive "$1" || task_result=$?
if [ "$task_service_active" -eq 1 ]; then sudo systemctl start downhill-web.service; fi
exit "$task_result"
