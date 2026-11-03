"""Share the requested runtime while continuing to reject credential files."""
import json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import check_sources

class GitTransferTests(unittest.TestCase):
 def test_needed_game_files_are_allowed(self):
  for name in ['private/game-data/index.json','private/game-data/files/00037.data','private/game-data/layout/00000.data','private/runtime/main.js','private/runtime/build/dhd_core.wasm','private/runtime/download-manifest.json','build/network/public/network-core.wasm']:
   with self.subTest(name=name):self.assertFalse(check_sources.private(name))
 def test_credentials_and_unrelated_files_stay_blocked(self):
  for name in ['private/cloudflared.token','private/runtime/credentials.json','private/game-data/.env','private/runtime/unknown.json','build/network/include/SDL3/SDL_mutex.h','.env.local','secrets.json','Downhill Domination.iso']:
   with self.subTest(name=name):self.assertTrue(check_sources.private(name))
 def test_host_accepts_public_settings_and_rejects_secrets(self):
  with tempfile.TemporaryDirectory() as directory,patch.object(check_sources,'ROOT',Path(directory)):
   path=Path(directory)/'host.json';value={'port':8095,'relay':'wss://relay.example','allowedEmails':[],'publicHostname':'jugar.example.com'}
   path.write_text(json.dumps(value));self.assertFalse(check_sources.private('host.json'))
   value['token']='test-only-secret';path.write_text(json.dumps(value));self.assertTrue(check_sources.private('host.json'))
 def test_host_rejects_credentials_in_relay_url(self):
  with tempfile.TemporaryDirectory() as directory,patch.object(check_sources,'ROOT',Path(directory)):
   (Path(directory)/'host.json').write_text(json.dumps({'relay':'wss://user:password@relay.example'}))
   self.assertTrue(check_sources.private('host.json'))

if __name__=='__main__':unittest.main()
