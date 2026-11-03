# SPDX-License-Identifier: GPL-3.0-or-later
import gzip
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from http_code_cache import CodeCache,accepts_gzip

class CodeCacheTest(unittest.TestCase):
    def test_compression_and_invalidation(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'code.js';file.write_bytes(b'const a=123;\n'*1000)
            cache=CodeCache();raw,zipped,etag=cache.get(file)
            self.assertEqual(gzip.decompress(zipped),raw);self.assertLess(len(zipped),len(raw))
            self.assertIs(cache.get(file)[0],raw)
            file.write_bytes(b'changed')
            self.assertNotEqual(cache.get(file)[2],etag)

    def test_bounds_and_encoding(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'large';file.write_bytes(b'x'*3000)
            cache=CodeCache(limit=100);cache.get(file);self.assertEqual(cache.bytes,0)
        self.assertTrue(accepts_gzip('br, gzip;q=0.5'))
        for value in ('gzip;q=0','gzip;q=bad','identity',''):
            self.assertFalse(accepts_gzip(value))
