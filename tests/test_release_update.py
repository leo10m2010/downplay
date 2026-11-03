# SPDX-License-Identifier: GPL-3.0-or-later
import hashlib,json,sys,tempfile,unittest,zipfile
from pathlib import Path,PurePosixPath
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from apply_update import apply,inspect,rollback,recover,safe,update_lock
from install_linux_host import units
def digest(data):return hashlib.sha256(data).hexdigest()
class UpdateTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name).resolve();(self.root/'web-native').mkdir();(self.root/'web-native/ui.js').write_bytes(b'old');(self.root/'host.json').write_text('{"port":65431,"allowedEmails":["owner@example.com"]}');(self.root/'private/game-data').mkdir(parents=True);(self.root/'private/game-data/index.json').write_bytes(b'resources');(self.root/'private/game-data/keep.data').write_bytes(b'private game data')
  self.package=self.root/'update.zip';self.make()
 def tearDown(self):self.temp.cleanup()
 def make(self,files=None):
  files=files or {'web-native/ui.js':b'new','web-native/new.js':b'added'}
  changed=[{'path':name,'bytes':len(data),'sha256':digest(data),'kind':'app'} for name,data in files.items()]
  manifest={'format':'downhill-update-v1','appVersion':'1.0.0','changed':changed,'resourceIndexSha256':digest(b'resources'),'baseFiles':{'web-native/ui.js':digest(b'old')}}
  with zipfile.ZipFile(self.package,'w') as z:
   z.writestr('UPDATE.json',json.dumps(manifest));z.writestr('RELEASE-MANIFEST.json',json.dumps({'appVersion':'1.0.0','files':changed}))
   for name,data in files.items():z.writestr(name,data)
 def test_apply_and_rollback(self):
  state=apply(self.root,self.package);self.assertEqual(state['status'],'committed');self.assertEqual((self.root/'web-native/ui.js').read_bytes(),b'new');self.assertIn('owner@example.com',(self.root/'host.json').read_text());self.assertEqual((self.root/'private/game-data/keep.data').read_bytes(),b'private game data');rollback(self.root,state);self.assertEqual((self.root/'web-native/ui.js').read_bytes(),b'old');self.assertFalse((self.root/'web-native/new.js').exists())
 def test_failure_restores_existing_files(self):
  with self.assertRaises(OSError):apply(self.root,self.package,fail_after=1)
  self.assertEqual((self.root/'web-native/ui.js').read_bytes(),b'old');self.assertEqual(json.loads((self.root/'.updates/journal.json').read_text())['status'],'rolled-back')
 def test_no_overwrite_of_local_changes(self):
  (self.root/'web-native/ui.js').write_bytes(b'user changed this')
  with self.assertRaisesRegex(ValueError,'cambios locales'):apply(self.root,self.package)
 def test_resources_and_configuration_are_not_patchable(self):
  for name in ['host.json','private/game-data/keep.data','../outside.txt','/outside.txt','tools/../../outside.txt']:
   with self.subTest(name=name):
    self.make({name:b'bad'})
    with self.assertRaises(ValueError):inspect(self.root,self.package)
 def test_wrong_resources_rejected(self):
  (self.root/'private/game-data/index.json').write_bytes(b'other game')
  with self.assertRaisesRegex(ValueError,'recursos'):inspect(self.root,self.package)
 def test_exclusive_update_lock(self):
  with update_lock(self.root):
   with self.assertRaises(ValueError):apply(self.root,self.package)
 def test_legacy_resource_move_is_reverted_on_failure(self):
  (self.root/'out').mkdir();(self.root/'private/game-data').rename(self.root/'out/local-game-usa')
  with self.assertRaises(OSError):apply(self.root,self.package,fail_after=1)
  self.assertTrue((self.root/'out/local-game-usa/keep.data').is_file());self.assertFalse((self.root/'private/game-data').exists())
 def test_recovery_of_interrupted_update(self):
  state=apply(self.root,self.package);state['status']='applying';recover(self.root,state)
  self.assertEqual((self.root/'web-native/ui.js').read_bytes(),b'old');self.assertFalse((self.root/'web-native/new.js').exists())
 def test_recover_does_not_undo_committed_update(self):
  state=apply(self.root,self.package)
  with self.assertRaisesRegex(ValueError,'--rollback'):recover(self.root,state)
  self.assertEqual((self.root/'web-native/ui.js').read_bytes(),b'new')
 def test_only_one_managed_backup_is_retained(self):
  unknown=self.root/'.updates/123';unknown.mkdir(parents=True);(unknown/'mine').write_text('keep')
  state=apply(self.root,self.package);rollback(self.root,state);apply(self.root,self.package)
  managed=list((self.root/'.updates').glob('*/backup-owner.json'));self.assertEqual(len(managed),1);self.assertTrue((unknown/'mine').is_file())
 def test_linux_units_do_not_embed_tokens(self):
  result=units(PurePosixPath('/home/test/downhill'),'test')
  self.assertIn('LoadCredential=token:',result['downhill-tunnel.service']);self.assertIn('--token-file %d/token',result['downhill-tunnel.service']);self.assertIn('Restart=on-failure',result['downhill-web.service']);self.assertIn('User=test',result['downhill-web.service'])
  self.assertIn('WorkingDirectory=/home/test/downhill\n',result['downhill-web.service']);self.assertIn('LogNamespace=downhill-web',result['downhill-web.service'])
if __name__=='__main__':unittest.main()
