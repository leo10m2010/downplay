# SPDX-License-Identifier: GPL-3.0-or-later
"""Synthetic disc checks; never contain game executable bytes."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

import pycdlib
from pycdlib.pycdlibexception import PyCdlibException

SPEC = importlib.util.spec_from_file_location(
    'check_revived_disc', Path(__file__).resolve().parents[1] / 'tools/check_revived_disc.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RevivedDiscTest(unittest.TestCase):
    def check_image(self, name, content):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'renamed-USA.iso'
            disc = pycdlib.PyCdlib()
            disc.new(interchange_level=3)
            source = io.BytesIO(content)
            try:
                disc.add_fp(source, len(content), iso_path='/' + name + ';1')
                disc.write(str(image))
            finally:
                disc.close()
            return MODULE.inspect_disc(image)

    def test_region_comes_from_contents_not_iso_filename(self):
        result = self.check_image('SLES_522.02', b'synthetic PAL executable')
        self.assertFalse(result['compatible'])
        self.assertEqual(result['reason'], 'unsupported-release')
        self.assertEqual(result['detectedExecutables'], ['SLES_522.02'])

    def test_renamed_executable_does_not_bypass_size_check(self):
        result = self.check_image('SCUS_971.77', b'synthetic renamed executable')
        self.assertEqual(result['reason'], 'executable-size')
        self.assertNotIn('executableSha1', result)

    def test_correct_size_is_insufficient_without_retail_digest(self):
        result = self.check_image('SCUS_971.77', b'\0' * MODULE.USA_BYTES)
        self.assertFalse(result['compatible'])
        self.assertEqual(result['reason'], 'executable-checksum')
        self.assertNotEqual(result['executableSha1'], MODULE.USA_SHA1)

    def test_unrelated_iso_is_not_accepted(self):
        result = self.check_image('OTHER.TXT', b'not a game')
        self.assertEqual(result['reason'], 'unsupported-release')
        self.assertEqual(result['detectedExecutables'], [])

    def test_truncated_image_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'truncated.iso'
            image.write_bytes(b'not an ISO')
            with self.assertRaises((OSError, PyCdlibException, ValueError)):
                MODULE.inspect_disc(image)


if __name__ == '__main__':
    unittest.main()
