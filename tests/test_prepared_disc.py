# SPDX-License-Identifier: GPL-3.0-or-later
"""File-backed sector reads and hostile index checks, using synthetic data."""
import hashlib
import json
from pathlib import Path
import random
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from prepared_disc import PreparedDisc


class PreparedDiscTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.raw=bytes(range(256))*5;self.records=[];cursor=0
        for i,size in enumerate((27,503,750)):
            data=self.raw[cursor:cursor+size];name=f'{i}.data';(self.root/name).write_bytes(data)
            self.records.append(dict(offset=cursor,size=size,file=name,sha256=hashlib.sha256(data).hexdigest()));cursor+=size
        self.write()

    def tearDown(self):self.temp.cleanup()

    def write(self):
        (self.root/'index.json').write_text(json.dumps(dict(schema=1,size=len(self.raw),segments=self.records)))

    def test_reads_match_flat_data_across_every_boundary(self):
        disc=PreparedDisc(self.root,verify=True);rng=random.Random(7)
        for _ in range(500):
            start=rng.randrange(len(self.raw));length=rng.randrange(len(self.raw)-start+1)
            self.assertEqual(disc.read(start,length),self.raw[start:start+length])
        self.assertEqual(disc.read(len(self.raw),0),b'')
        for offset,length in ((-1,1),(0,-1),(len(self.raw),1),(0,4*1024*1024+1)):
            with self.assertRaises(ValueError):disc.read(offset,length)

    def test_corruption_and_missing_files_are_rejected(self):
        (self.root/'0.data').write_bytes(b'x'*27)
        with self.assertRaises(ValueError):PreparedDisc(self.root,verify=True)
        (self.root/'0.data').unlink()
        with self.assertRaises(ValueError):PreparedDisc(self.root)

    def test_gaps_overlaps_and_escape_are_rejected(self):
        for value in (26,28):
            self.records[1]['offset']=value;self.write()
            with self.assertRaises(ValueError):PreparedDisc(self.root)
        self.records[1]['offset']=27;self.records[0]['file']='../outside.data';self.write()
        with self.assertRaises(ValueError):PreparedDisc(self.root)

    def test_truncation_after_open_is_rejected(self):
        disc=PreparedDisc(self.root);(self.root/'0.data').write_bytes(b'x')
        with self.assertRaises(ValueError):disc.read(0,27)

    def test_absolute_and_windows_paths_are_rejected(self):
        for name in ('/0.data','C:/0.data','files\\0.data','files/../0.data'):
            self.records[0]['file']=name;self.write()
            with self.subTest(name=name),self.assertRaises(ValueError):PreparedDisc(self.root)

    def test_file_symlink_is_rejected(self):
        path=self.root/'link.data'
        try:path.symlink_to(self.root/'0.data')
        except OSError:self.skipTest('OS does not permit this user to create symlinks')
        self.records[0]['file']='link.data';self.write()
        with self.assertRaises(ValueError):PreparedDisc(self.root)


if __name__=='__main__':unittest.main()
