# SPDX-License-Identifier: GPL-3.0-or-later
"""Allow the requested game transfer, while rejecting credentials and build junk."""
from pathlib import Path
import json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
def safe_host():
 try:
  from run_linux_host import read_config
  path=ROOT/'host.json';data=json.loads(path.read_text(encoding='utf-8'))
  if not isinstance(data,dict) or set(data)-{'port','relay','allowedEmails','publicHostname'}:return False
  read_config(path);return True
 except (OSError,ValueError,TypeError):return False

def transfer_file(name):
 if name=='host.json':return safe_host()
 if name in {'build/network/public/network-core.js','build/network/public/network-core.wasm','build/network/public/package.json'}:return True
 if re.fullmatch(r'private/game-data/(?:index\.json|(?:files|layout)/[0-9]{5}\.data)',name):return True
 if name.startswith('private/runtime/'):
  from serve_revived_pack import PUBLIC
  return name[len('private/runtime/'):] in PUBLIC|{'download-manifest.json'}
 return False

def private(name):
 if Path(name).name.lower() in {'cloudflared.token','credentials.json','secrets.json'}:return True
 if transfer_file(name):return False
 p=Path(name);parts={s.lower() for s in p.parts};suffix=p.suffix.lower()
 return bool(parts&{'private','vendor','out','build','node_modules','.updates','.run','.wrangler','.tools','.venv','logs','output','dist','dist-ui','.playwright-cli','iso_extract','unpacked'}) or p.parts[0].startswith('build-') or suffix in {'.iso','.bin','.cue','.img','.elf','.irx','.ngp','.nga','.ptr','.rtx','.tex','.pts','.rst','.rrs','.vpk','.orb','.rep','.skx','.ctl','.bmp','.png','.jpg','.wav','.wasm','.data','.mdl','.msh','.bnk','.vag','.pss','.p2s','.pem','.key','.zip','.gz','.tar'} or p.name.lower() in {'host.json','.env','cloudflared.token'} or p.name.lower().startswith('.env.')
if __name__=='__main__':
 command=['git','ls-files','-z'] if '--all' in sys.argv else ['git','diff','--cached','--name-only','--diff-filter=ACM','-z']
 raw=subprocess.check_output(command,cwd=ROOT).decode()
 bad=[name for name in raw.split('\0') if name and (ROOT/name).is_file() and private(name)]
 if bad:print('Credentials or unapproved generated files must not be committed:\n'+'\n'.join(bad));sys.exit(1)
 print('Repository check passed; prepared game files allowed, credentials excluded.')
