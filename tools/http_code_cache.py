# SPDX-License-Identifier: GPL-3.0-or-later
"""Bounded cache of byte-identical code representations, independent of game data."""
from collections import OrderedDict
import gzip
import hashlib
import threading

class CodeCache:
    def __init__(self,limit=64*1024*1024):
        self.limit=limit;self.bytes=0;self.items=OrderedDict();self.lock=threading.Lock()

    def get(self,path,transform=None):
        stat=path.stat();key=(str(path),stat.st_mtime_ns,stat.st_size,transform)
        with self.lock:
            if key in self.items:
                self.items.move_to_end(key);return self.items[key]
            raw=path.read_bytes()
            if transform:raw=transform(raw.decode('utf-8')).encode('utf-8')
            compressed=gzip.compress(raw,compresslevel=4,mtime=0) if len(raw)>1024 else raw
            if len(compressed)>=len(raw):compressed=raw
            item=(raw,compressed,'"'+hashlib.sha256(raw).hexdigest()+'"')
            weight=len(raw)+(len(compressed) if compressed is not raw else 0)
            while self.items and self.bytes+weight>self.limit:
                _,old=self.items.popitem(last=False)
                self.bytes-=len(old[0])+(len(old[1]) if old[1] is not old[0] else 0)
            if weight<=self.limit:self.items[key]=item;self.bytes+=weight
            return item

def accepts_gzip(header):
    for entry in header.lower().split(','):
        parts=[part.strip() for part in entry.split(';')]
        if parts[0]!='gzip':continue
        try:return all(float(part[2:])>0 for part in parts[1:] if part.startswith('q='))
        except ValueError:return False
    return False
