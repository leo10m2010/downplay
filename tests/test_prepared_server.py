# SPDX-License-Identifier: GPL-3.0-or-later
"""Only bounded ranges and allowlisted code may leave the loopback server."""
import functools
import gzip
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request,urlopen

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from serve_revived_pack import Handler


class SyntheticResources:
    size=256
    sha256='a'*64
    files_sha256='b'*64
    def read(self,offset,length):return bytes(range(256))[offset:offset+length]


class PreparedServerTest(unittest.TestCase):
    def setUp(self):
        self.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,disc=SyntheticResources()))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join()

    def test_metadata_and_cross_origin_isolation(self):
        with urlopen(Request(self.url+'/game-data',method='HEAD')) as r:
            self.assertEqual(r.headers['Content-Length'],'256')
            self.assertEqual(r.headers['Cross-Origin-Opener-Policy'],'same-origin')
            self.assertEqual(r.headers['Cross-Origin-Embedder-Policy'],'require-corp')

    def test_bounded_range_matches_prepared_resources(self):
        with urlopen(Request(self.url+'/game-data',headers={'Range':'bytes=17-99'})) as r:
            self.assertEqual(r.status,206)
            self.assertEqual(r.headers['Content-Range'],'bytes 17-99/256')
            self.assertEqual(r.read(),bytes(range(17,100)))
    def test_resource_version_and_identity(self):
        import json,hashlib
        with urlopen(self.url+'/game-identity.json') as response:self.assertEqual(json.load(response)['resourceSha256'],'a'*64)
        with urlopen(Request(self.url+'/game-data?version='+'a'*64,headers={'Range':'bytes=17-99'})) as response:
            self.assertEqual(response.headers['X-Content-SHA256'],hashlib.sha256(bytes(range(17,100))).hexdigest())
        for method in ('GET','HEAD'):
            with self.assertRaises(HTTPError) as error:urlopen(Request(self.url+'/game-data?version='+'c'*64,method=method,headers={'Range':'bytes=0-1'}))
            self.assertEqual(error.exception.code,412)

    def test_iso_and_private_index_are_not_served(self):
        for path in ('/test-iso','/Downhill%20Domination%20(USA).iso','/index.json','/../index.json','/%2e%2e/index.json','/files/00001.data'):
            with self.subTest(path=path),self.assertRaises(HTTPError) as error:urlopen(self.url+path)
            self.assertEqual(error.exception.code,404)
        for header in ({},{'Range':'bytes=0-'},{'Range':'bytes=10-9'},{'Range':'bytes=0-256'},{'Range':'bytes=0-999999999'}):
            with self.subTest(header=header),self.assertRaises(HTTPError) as error:urlopen(Request(self.url+'/game-data',headers=header))
            self.assertEqual(error.exception.code,416)

    def test_public_shell_and_keyboard_are_available(self):
        with urlopen(self.url+'/') as r:
            html=r.read().decode()
            self.assertIn('keyboard-bindings',html)
            self.assertIn('network-slot',html)
        with urlopen(self.url+'/shell.css') as r:
            self.assertIn('text/css',r.headers['Content-Type'])
        with urlopen(self.url+'/keyboard.js') as r:
            self.assertIn(b'installKeyboard',r.read())

    def test_code_compression_and_conditional_cache(self):
        with urlopen(Request(self.url+'/keyboard.js',headers={'Accept-Encoding':'gzip'})) as r:
            self.assertEqual(r.headers['Content-Encoding'],'gzip')
            data=gzip.decompress(r.read());self.assertIn(b'installKeyboard',data)
            self.assertEqual(int(r.headers['X-Uncompressed-Length']),len(data));etag=r.headers['ETag']
        with self.assertRaises(HTTPError) as cached:
            urlopen(Request(self.url+'/keyboard.js',headers={'Accept-Encoding':'gzip','If-None-Match':etag}))
        self.assertEqual(cached.exception.code,304)
        with urlopen(Request(self.url+'/keyboard.js',headers={'Accept-Encoding':'gzip;q=0'})) as r:
            self.assertIsNone(r.headers.get('Content-Encoding'))
            self.assertNotEqual(r.headers['ETag'],etag)


if __name__=='__main__':unittest.main()
