"""Validate private-host configuration without opening a public tunnel."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from run_linux_host import read_config,tunnel_command

class LinuxHostTests(unittest.TestCase):
    def config(self,value):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'host.json'
            path.write_text(json.dumps(value),encoding='utf-8')
            return read_config(path)

    def test_local_only_default(self):
        self.assertEqual(self.config({}),{'port':8095,'relay':'','allowedEmails':[]})

    def test_invalid_configuration(self):
        for value in ([],{'port':True},{'port':80},{'port':65536},{'relay':False},
                      {'relay':'https://relay.example'},{'relay':'wss://user:secret@relay.example'},
                      {'relay':'wss://relay.example/private'},{'relay':'wss://relay.example?token=secret'},
                      {'allowedEmails':['*@example.com']},{'allowedEmails':'owner@example.com'}):
            with self.subTest(value=value),self.assertRaises(ValueError):self.config(value)

    def test_public_relay_and_explicit_email(self):
        result=self.config({'relay':'wss://relay.example','allowedEmails':['owner@example.com']})
        self.assertEqual(result['relay'],'wss://relay.example')
        self.assertEqual(result['allowedEmails'],['owner@example.com'])

    def test_tunnel_requires_access_list(self):
        with self.assertRaises(ValueError):tunnel_command('cloudflared','http://127.0.0.1:8095',[])

    def test_tunnel_does_not_invoke_shell(self):
        self.assertEqual(tunnel_command('/opt/cloudflared','http://127.0.0.1:8095',['a@example.com','b@example.com']),
                         ['/opt/cloudflared','tunnel','--url','http://127.0.0.1:8095',
                          '--allowed-mail','a@example.com','--allowed-mail','b@example.com'])

if __name__=='__main__':unittest.main()
