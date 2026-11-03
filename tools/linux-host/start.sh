#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
set -eu
task_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$task_dir"
exec python3 tools/run_linux_host.py "$@"
