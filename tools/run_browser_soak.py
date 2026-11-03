#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Run browser scenarios and persist evidence every 20 seconds, surviving chat pauses."""
import argparse,csv,io,json,os,re,subprocess,time
from pathlib import Path
def result(output):
    if '### Error' in output:raise RuntimeError(output.split('### Error',1)[1].split('### Ran',1)[0].strip())
    if '### Result' not in output:raise RuntimeError('Browser did not return a result')
    return json.JSONDecoder().raw_decode(output.split('### Result',1)[1].lstrip())[0]
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cli',required=True,type=Path);p.add_argument('--session',required=True);p.add_argument('--scenario',required=True,type=Path);p.add_argument('--minutes',required=True,type=float);p.add_argument('--output',required=True,type=Path);args=p.parse_args();root=Path(__file__).resolve().parents[1]
    base=['node',str(args.cli),'-s='+args.session,'run-code']
    def run(tail,timeout=240):
        reply=subprocess.run(base+tail,cwd=root,capture_output=True,text=True,encoding='utf-8',timeout=timeout)
        if reply.returncode:raise RuntimeError(reply.stderr or reply.stdout)
        return result(reply.stdout)
    report={'complete':False,'targetMinutes':args.minutes,'scenario':args.scenario.name,'physicalClientPcs':1,'checkpoints':[]};args.output.parent.mkdir(parents=True,exist_ok=True)
    def save():
        temp=args.output.with_suffix('.tmp');temp.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');temp.replace(args.output)
    try:
        report['start']=run(['--filename',str(args.scenario)]);start=time.monotonic();report['startedUtc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save();print('Real game soak started: '+args.session,flush=True)
        code="async(page)=>{const output=[];for(const p of page.context().pages()){const value=await p.evaluate(()=>window.nativeSoakReport?.());if(value)output.push(value);}return output;}"
        while True:
            time.sleep(20);rows=run([code],timeout=45)
            if not rows:raise RuntimeError('Browser session was closed; no uninterrupted soak can be certified')
            elapsed=time.monotonic()-start
            checkpoint={'elapsedSeconds':elapsed,'clients':[]}
            if os.name=='nt':
                reply=subprocess.run(['tasklist','/FI','IMAGENAME eq chrome.exe','/FO','CSV','/NH'],capture_output=True,text=True)
                totals=[int(re.sub(r'[^0-9]','',r[-1]))*1024 for r in csv.reader(io.StringIO(reply.stdout)) if len(r)>=5 and re.search(r'[0-9]',r[-1])]
                checkpoint['allTestChromeWorkingSetBytes']=sum(totals)
            if len(rows)!=len(report['start'].get('states',[1])):raise RuntimeError('A client disappeared from the prolonged test')
            for row in rows:
                last=row['samples'][-1];game=last.get('game',last);field=game.get('field')
                if field is None:raise RuntimeError('Game status disappeared')
                if report['checkpoints']:
                    prior=report['checkpoints'][-1]['clients']
                    if len(prior)==len(rows) and field<=prior[len(checkpoint['clients'])]['field']:raise RuntimeError('Game fields stopped advancing')
                if last.get('logBytes',0)>65536:raise RuntimeError('Log limit exceeded')
                checkpoint['clients'].append({'field':field,'fps':game.get('fps'),'memoryBytes':game.get('memoryBytes'),'audio':last.get('audio'),'network':last.get('network'),'resource':last.get('resource'),'frameMetrics':game.get('frameMetrics'),'history':last.get('history'),'jsHeapBytes':last.get('jsHeapBytes'),'logBytes':last.get('logBytes')})
            report['checkpoints'].append(checkpoint);save()
            print(f'{args.session}: {elapsed/60:.1f}/{args.minutes:g} min; {len(rows)} game clients advancing',flush=True)
            if elapsed>=args.minutes*60:
                report['complete']=True;report['elapsedSeconds']=elapsed;save();print('Uninterrupted soak complete: '+str(args.output),flush=True);break
    except Exception as error:
        report['error']=str(error);save();raise
    finally:
        # Dedicated test sessions must not keep CPU/WebSocket rooms alive when
        # the chat pauses after the requested duration. Navigation releases the
        # game's workers, audio context, Web Locks and sockets together.
        try:
            report['stoppedAfterTest']=run(['async(page)=>{for(const p of page.context().pages())if(p!==page)await p.close();await page.goto("about:blank");return true;}'],timeout=45)
        except Exception as error:report['stopError']=str(error)
        save()
if __name__=='__main__':main()
