"""Reproduce licensed upstream snapshots and the pinned Ruffle player."""
from pathlib import Path
import base64,hashlib,io,json,re,shutil,subprocess,tarfile,tempfile,urllib.request
ROOT=Path(__file__).resolve().parents[1]/'projects/defaults'
SNAPSHOTS=json.loads("{\"tetris\":{\"repo\":\"jakesgordon/javascript-tetris\",\"commit\":\"e5c0c42f7dac0f3514a55eff656c6e22e95d68ed\"},\"breakout\":{\"repo\":\"jakesgordon/javascript-breakout\",\"commit\":\"eed59e2affa9423b93d2ac8ff93061bb88b33284\"},\"fluid\":{\"repo\":\"PavelDoGreat/WebGL-Fluid-Simulation\",\"commit\":\"a2d292931f19d9b3b9f564e23e6c32729d2121c3\"},\"astray\":{\"repo\":\"wwwtyro/Astray\",\"commit\":\"d3c4f61f2cbbe35752fbfa205f85a41d7f9fe0f0\"},\"0hh1\":{\"repo\":\"florisluiten/0hh1\",\"commit\":\"25910e580d6ea6bc1dfbfd29b2637e47844a96f9\"}}")
BRIDGE="<script>addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'rapidfire:escape'},'*')},true);</script>"
for name,entry in SNAPSHOTS.items():
    destination=ROOT/name
    marker=destination/'UPSTREAM_COMMIT.txt'
    if marker.exists() and marker.read_text().strip()==entry['commit']: continue
    with tempfile.TemporaryDirectory() as tmp:
        source=Path(tmp)/'repo'
        subprocess.run(['git','clone','--quiet','https://github.com/'+entry['repo']+'.git',str(source)],check=True)
        subprocess.run(['git','-C',str(source),'checkout','--quiet',entry['commit']],check=True)
        if destination.exists():shutil.rmtree(destination)
        shutil.copytree(source,destination,ignore=shutil.ignore_patterns('.git','.github','.DS_Store','packaged'))
    page=destination/'index.html'
    text=page.read_text()
    text=re.sub(r'<script>\s*window.ga=[\s\S]*?</script>','',text)
    text=re.sub(r'<script[^>]*src="https://www.google-analytics.com/analytics.js"[^>]*></script>','',text)
    if name=='astray':
        text=text.replace("loadTexture('/","loadTexture('")
        text=text.replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1">')
    if name=='fluid':
        js=destination/'script.js'
        code=js.read_text()
        code='\n'.join(line for line in code.splitlines() if not line.strip().startswith("ga('send'"))
        code=code.replace('let image = new Image();',"let image = new Image();image.crossOrigin='anonymous';")
        js.write_text(code+'\n')
    if name=='0hh1':
        js=destination/'js/game.js';js.write_text(js.read_text().replace('window.localStorage','rapidfireSessionStorage'))
        memory="<script>var rapidfireSessionStorage={values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=String(v)}};</script>"
        text=text.replace('<head>','<head>'+memory)
    if name=='tetris': text=text.replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1">')
    if name=='breakout': text=text.replace('content="width=device-width", initial-scale=1.0, user-scalable="no"','content="width=device-width, initial-scale=1.0"')
    page.write_text(text.replace('</head>',BRIDGE+'</head>'))
    marker.write_text(entry['commit']+'\n')
    (destination/'RAPIDFIRE-NOTICE.md').write_text('Integrated 2026-10-20. Added Escape-to-feed and viewport metadata where needed. Removed remote analytics. Astray texture paths are relative. Fluid uses anonymous CORS textures. 0h h1 stores scores only for this play session. Original source, assets and license notices are retained.\n')
ruffle=ROOT/'ruffle'
if not (ruffle/'ruffle.js').exists():
    url='https://registry.npmjs.org/@ruffle-rs/ruffle/-/ruffle-0.7.1.tgz'
    data=urllib.request.urlopen(url,timeout=90).read()
    if hashlib.sha1(data).hexdigest()!='f74252bea767b1f2e63a5438f1813c254e16a4e1':raise RuntimeError('Unexpected Ruffle package digest')
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        for member in archive.getmembers():
            if not member.isfile():continue
            relative=Path(member.name).relative_to('package')
            if '..' in relative.parts:raise RuntimeError('Unsafe archive path')
            target=ruffle/relative;target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
print('Prepared ten licensed embedded projects and Ruffle 0.7.1.')
