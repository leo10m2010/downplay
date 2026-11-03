#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check a local ISO against Downhill Revived's USA core; never upload or extract it.

This checks disc compatibility only, not build readiness or successful gameplay.
Expected identity: skuza-oss/downhill-revived, port/hle/game_data.c at
244cf4cef10da5492ca878e3b97ec74656dbc5e5 (GPL-3.0-or-later).
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = 'https://github.com/skuza-oss/downhill-revived'
REVISION = '244cf4cef10da5492ca878e3b97ec74656dbc5e5'
USA_ELF = 'SCUS_971.77'
USA_BYTES = 1691684
USA_SHA1 = '4e25a222ad8a475b5d26c2e928e90b5f2b7075eb'


def inspect_disc(path):
    import pycdlib
    disc = pycdlib.PyCdlib()
    try:
        disc.open(str(path))
        records = {}
        for record in disc.list_children(iso_path='/'):
            if record.is_dir():
                continue
            name = record.file_identifier().decode('ascii', errors='replace')
            records[name.split(';', 1)[0]] = (name, record.data_length)
        report = {'upstream': UPSTREAM, 'revision': REVISION,
                  'compatible': False, 'expectedExecutable': USA_ELF,
                  'expectedBytes': USA_BYTES, 'expectedSha1': USA_SHA1}
        if USA_ELF not in records:
            detected = sorted(n for n in records if n.startswith(('SLES_', 'SCPS_', 'SCUS_')))
            report.update(reason='unsupported-release', detectedExecutables=detected,
                          message=('Este núcleo necesita la edición USA SCUS-97177. '
                                   'El disco actual no contiene SCUS_971.77. '
                                   'Renombrar la ISO o el ejecutable no convierte la región.'))
            return report
        name, size = records[USA_ELF]
        report['executableBytes'] = size
        if size != USA_BYTES:
            report.update(reason='executable-size',
                          message='SCUS_971.77 tiene un tamaño distinto del original admitido.')
            return report  # reject unbounded/malformed sizes before reading the file
        buffer = io.BytesIO()
        disc.get_file_from_iso_fp(buffer, iso_path='/' + name)
        raw = buffer.getvalue()
        digest = hashlib.sha1(raw).hexdigest()
        report['executableSha1'] = digest
        if len(raw) != USA_BYTES or digest != USA_SHA1:
            report.update(reason='executable-checksum',
                          message='El ejecutable no coincide con el original USA admitido.')
            return report
        report.update(compatible=True, reason='supported-usa-disc',
                      message='Disco compatible con el núcleo USA; ejecución aún no comprobada.')
        return report
    finally:
        disc.close()


def main():
    from pycdlib.pycdlibexception import PyCdlibException
    from project_paths import DEFAULT_ISO
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('iso', nargs='?', type=Path, default=DEFAULT_ISO)
    parser.add_argument('--json', action='store_true', help='Print metadata only as JSON')
    args = parser.parse_args()
    try:
        report = inspect_disc(args.iso)
    except (OSError, PyCdlibException, ValueError) as exc:
        report = {'compatible': False, 'reason': 'unreadable-image',
                  'message': 'No se pudo leer una imagen ISO9660 válida: ' + str(exc)}
    print(json.dumps(report, indent=2, ensure_ascii=False) if args.json else report['message'])
    return 0 if report['compatible'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
