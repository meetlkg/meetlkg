"""Private single-owner CMS; public output is ordinary static HTML."""
import base64, hashlib, hmac, ipaddress, json, mimetypes, os, re, secrets, shutil, time
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from pathlib import Path
from threading import RLock, Event, Thread
from urllib.parse import urlsplit, unquote
from site_content import ROOT, now, validate_post, safe_url, read_minutes
from build_site import build, article, write

class Conflict(ValueError):pass
class Store:
 def __init__(self,root=ROOT,config=None,publisher=build):
  self.root=Path(root);self.private=self.root/'.cms';self.posts=self.private/'posts';self.assets=self.private/'assets';self.publisher=publisher;self.lock=RLock()
  self.config=Path(config) if config else Path.home()/'.config/gokul-portfolio-cms'/hashlib.sha256(str(self.root).encode()).hexdigest()[:12]
  self.config.mkdir(parents=True,exist_ok=True,mode=0o700);self.posts.mkdir(parents=True,exist_ok=True);self.assets.mkdir(parents=True,exist_ok=True)
  self.sessions={};self.failures={}
  if not (self.config/'auth.json').exists():
   password=secrets.token_urlsafe(24);self.password(password)
   secret=self.config/'initial-password.txt';secret.write_text(password+'\n');secret.chmod(0o600)
  # Existing published articles become editable, without changing their URLs.
  for path in (self.root/'content/posts').glob('*.json'):
   data=json.loads(path.read_text());identifier=hashlib.sha256(data['slug'].encode()).hexdigest()[:24]
   if not any((record.get('live') or {}).get('slug')==data['slug'] for record in self.all()) and not self.path(identifier).exists():self.save_record({'id':identifier,'version':1,'draft':data,'live':data,'scheduledAt':None,'archived':False,'revisions':[],'updatedAt':data.get('updatedAt') or now()})
 def password(self,password):
  if not isinstance(password,str) or len(password)<12 or len(password)>200:raise ValueError('Use a passphrase of 12–200 characters.')
  salt=secrets.token_hex(16);digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),310000).hex()
  write(self.config/'auth.json',json.dumps({'salt':salt,'hash':digest}));(self.config/'auth.json').chmod(0o600);self.sessions.clear()
 def verify(self,password):
  auth=json.loads((self.config/'auth.json').read_text())
  if not isinstance(password,str) or len(password)>200:return False
  digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(auth['salt']),310000).hex()
  return hmac.compare_digest(digest,auth['hash'])
 def path(self,identifier):
  if not re.fullmatch('[a-f0-9]{24}',identifier):raise ValueError('Invalid article ID.')
  return self.posts/(identifier+'.json')
 def get(self,identifier):
  path=self.path(identifier)
  if not path.exists():raise FileNotFoundError('Article not found.')
  return json.loads(path.read_text())
 def all(self):return sorted([json.loads(p.read_text()) for p in self.posts.glob('*.json')],key=lambda p:p['updatedAt'],reverse=True)
 def save_record(self,record):write(self.path(record['id']),json.dumps(record,ensure_ascii=False,indent=2))
 def remember(self,record):
  record['revisions'].append({'savedAt':record['updatedAt'],'draft':record['draft']});record['revisions']=record['revisions'][-30:]
 def unique_slug(self,slug,identifier):
  for record in self.all():
   if record['id']!=identifier and (record['draft']['slug']==slug or record.get('live',{} ) and record['live']['slug']==slug):raise Conflict('That URL belongs to another article. Choose a different slug.')
 def save(self,payload):
  with self.lock:
   draft=validate_post(payload.get('draft'));identifier=payload.get('id') or secrets.token_hex(12);path=self.path(identifier)
   if path.exists():
    record=self.get(identifier)
    if payload.get('version')!=record['version']:raise Conflict('This article changed in another session. Reload it before saving.')
    self.remember(record)
   else:record={'id':identifier,'version':0,'live':None,'scheduledAt':None,'archived':False,'revisions':[]}
   self.unique_slug(draft['slug'],identifier)
   # Once published, keep the URL stable so existing inbound links continue to work.
   if record.get('live') and draft['slug']!=record['live']['slug']:raise ValueError('A published article keeps its URL. Duplicate it to create a different URL.')
   record.update(draft=draft,version=record['version']+1,updatedAt=now());self.save_record(record);return record
 def publish(self,record):
  draft=validate_post(record['draft'])
  if not draft['excerpt'] or not draft['summary'] or not draft['blocks']:raise ValueError('Add an excerpt, a short answer and content before publishing.')
  self.unique_slug(draft['slug'],record['id'])
  pub=draft['publishedAt'] or (record.get('live') or {}).get('publishedAt') or now()
  if datetime.fromisoformat(pub.replace('Z','+00:00'))>datetime.now(timezone.utc):raise ValueError('Use Schedule for a future publication date.')
  draft.update(publishedAt=pub,updatedAt=now())
  urls=[draft.get('cover','')]+[b.get('url','') for b in draft['blocks'] if b['type']=='image']
  for url in urls:
   if url.startswith('/media/'):
    name=url.removeprefix('/media/')
    if not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|webp|gif)',name):raise ValueError('Use an uploaded image from the media library.')
    source=self.assets/name
    if source.exists():(self.root/'media').mkdir(exist_ok=True);shutil.copyfile(source,self.root/'media'/name)
    elif not (self.root/'media'/name).exists():raise ValueError('An article image is missing from the media library.')
  target=self.root/'content/posts'/(draft['slug']+'.json');old=target.read_text() if target.exists() else None
  write(target,json.dumps(draft,ensure_ascii=False,indent=2))
  try:self.publisher(self.root)
  except Exception:
   if old is None:target.unlink(missing_ok=True)
   else:write(target,old)
   self.publisher(self.root);raise
  record.update(live=draft,draft=draft,scheduledAt=None,archived=False);return record
 def action(self,identifier,action,version,when=None,revision=None):
  with self.lock:
   record=self.get(identifier)
   if record['version']!=version:raise Conflict('This article changed. Reload it and try again.')
   if action=='publish':self.remember(record);record=self.publish(record)
   elif action=='schedule':
    try:stamp=datetime.fromisoformat(when.replace('Z','+00:00'))
    except (ValueError,AttributeError):raise ValueError('Choose a publication date and time.')
    if stamp.tzinfo is None or stamp<=datetime.now(timezone.utc):raise ValueError('Choose a time in the future.')
    if not record['draft']['excerpt'] or not record['draft']['summary'] or not record['draft']['blocks']:raise ValueError('Complete the article before scheduling.')
    record['scheduledAt']=stamp.isoformat();record['archived']=False
   elif action=='cancel-schedule':record['scheduledAt']=None
   elif action in ['unpublish','archive']:
    if record.get('live'):
     target=self.root/'content/posts'/(record['live']['slug']+'.json');old=target.read_text();target.unlink()
     try:self.publisher(self.root)
     except Exception:write(target,old);self.publisher(self.root);raise
    record['live']=None;record['scheduledAt']=None;record['archived']=action=='archive'
   elif action=='restore':record['archived']=False
   elif action=='revision':
    if not isinstance(revision,int) or not 0<=revision<len(record['revisions']):raise ValueError('Choose a saved revision.')
    saved=record['revisions'][revision]['draft'].copy()
    if record.get('live'):saved['slug']=record['live']['slug']
    self.unique_slug(saved['slug'],record['id']);self.remember(record);record['draft']=saved
   else:raise ValueError('Unknown editorial action.')
   record.update(version=record['version']+1,updatedAt=now());record.pop('scheduleError',None);self.save_record(record);return record
 def due(self):
  with self.lock:
   for record in self.all():
    if record.get('scheduledAt') and datetime.fromisoformat(record['scheduledAt'])<=datetime.now(timezone.utc):
     try:
      record['draft']['publishedAt']=(record.get('live') or {}).get('publishedAt') or record['scheduledAt'];self.save_record(record);self.action(record['id'],'publish',record['version'])
     except Exception as error:
      record['scheduleError']=str(error);record['scheduledAt']=None;record['version']+=1;self.save_record(record)
 def upload(self,payload):
  try:data=base64.b64decode(payload.get('data',''),validate=True)
  except Exception:raise ValueError('Invalid image data.')
  if not 20<len(data)<=8*1024*1024:raise ValueError('Use an image smaller than 8 MB.')
  if data.startswith(b'\x89PNG\r\n\x1a\n'):ext='png'
  elif data.startswith(b'\xff\xd8\xff'):ext='jpg'
  elif data[:6] in [b'GIF87a',b'GIF89a']:ext='gif'
  elif data[:4]==b'RIFF' and data[8:12]==b'WEBP':ext='webp'
  else:raise ValueError('Use a PNG, JPEG, WebP or GIF image.')
  name=hashlib.sha256(data).hexdigest()[:32]+'.'+ext
  (self.assets/name).write_bytes(data)
  return {'url':'/media/'+name,'preview':'/api/cms/assets/'+name,'name':str(payload.get('name','Image'))[:150],'bytes':len(data)}

def respond(handler,status,data,headers=None,content_type='application/json; charset=utf-8'):
 body=json.dumps(data,ensure_ascii=False).encode() if isinstance(data,(dict,list)) else data.encode() if isinstance(data,str) else data
 handler.send_response(status);handler.send_header('Content-Type',content_type);handler.send_header('Content-Length',str(len(body)));handler.send_header('Cache-Control','no-store');handler.send_header('X-Content-Type-Options','nosniff');handler.send_header('X-Robots-Tag','noindex, nofollow');handler.send_header('Referrer-Policy','same-origin')
 for key,value in (headers or {}).items():handler.send_header(key,value)
 handler.end_headers()
 if handler.command!='HEAD':handler.wfile.write(body)

def local_owner(handler):
 try:return ipaddress.ip_address(handler.client_address[0]).is_loopback and urlsplit('http://'+handler.headers.get('Host','')).hostname in ['localhost','127.0.0.1','::1']
 except ValueError:return False

def token(handler):
 cookie=SimpleCookie()
 try:cookie.load(handler.headers.get('Cookie',''));return cookie['gokul_cms'].value if 'gokul_cms' in cookie else ''
 except Exception:return ''

def handle(handler,store):
 path=unquote(urlsplit(handler.path).path);method=handler.command
 local=local_owner(handler);authenticated=local or store.sessions.get(token(handler),0)>time.time()
 if method in ['GET','HEAD'] and path=='/api/cms/session':return respond(handler,200,{'authenticated':authenticated,'localOwner':local,'site':'https://gok03.com','passwordConfigured':True})
 if method=='POST':
  origin=handler.headers.get('Origin')
  if not origin or urlsplit(origin).netloc!=handler.headers.get('Host') or urlsplit(origin).scheme not in ['http','https']:return respond(handler,403,{'error':'Open the editor on this server to make changes.'})
  if handler.headers.get('Content-Type','').split(';')[0]!='application/json':return respond(handler,415,{'error':'Expected JSON.'})
  try:length=int(handler.headers.get('Content-Length','0'))
  except ValueError:length=0
  if not 0<length<=12*1024*1024:return respond(handler,413,{'error':'The request is too large.'})
  try:payload=json.loads(handler.rfile.read(length))
  except (ValueError,UnicodeError):return respond(handler,400,{'error':'Invalid JSON.'})
  if not isinstance(payload,dict):return respond(handler,400,{'error':'Expected an object.'})
  if path=='/api/cms/login':
   address=handler.client_address[0];attempts=[t for t in store.failures.get(address,[]) if time.time()-t<900]
   if len(attempts)>=8:return respond(handler,429,{'error':'Too many attempts. Try again in 15 minutes.'})
   if not store.verify(payload.get('password')):
    store.failures[address]=attempts+[time.time()];return respond(handler,401,{'error':'That passphrase did not match.'})
   store.failures.pop(address,None);session=secrets.token_urlsafe(32);store.sessions[session]=time.time()+8*3600
   return respond(handler,200,{'authenticated':True},{'Set-Cookie':f'gokul_cms={session}; HttpOnly; SameSite=Strict; Path=/api/cms/; Max-Age=28800'})
 if not authenticated:return respond(handler,401,{'error':'Sign in to manage the blog.'})
 try:
  if method in ['GET','HEAD']:
   if path=='/api/cms/posts':return respond(handler,200,{'posts':store.all()})
   if path=='/api/cms/export':return respond(handler,200,{'exportedAt':now(),'posts':store.all()},{'Content-Disposition':'attachment; filename="gokul-blog-backup.json"'})
   if path=='/api/cms/assets':return respond(handler,200,{'assets':[{'url':'/media/'+f.name,'preview':'/api/cms/assets/'+f.name,'bytes':f.stat().st_size,'name':f.name} for f in sorted(store.assets.iterdir()) if f.is_file()]})
   if path.startswith('/api/cms/assets/'):
    name=path.rsplit('/',1)[-1]
    if not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|gif|webp)',name):raise FileNotFoundError()
    file=store.assets/name
    return respond(handler,200,file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0])
  if method=='POST':
   if path=='/api/cms/logout':
    store.sessions.pop(token(handler),None);return respond(handler,200,{'ok':True},{'Set-Cookie':'gokul_cms=; HttpOnly; SameSite=Strict; Path=/api/cms/; Max-Age=0'})
   if path=='/api/cms/password':
    store.password(payload.get('password'));(store.config/'initial-password.txt').unlink(missing_ok=True);return respond(handler,200,{'ok':True,'message':'Passphrase updated. Sign in again from other devices.'})
   if path=='/api/cms/save':return respond(handler,200,store.save(payload))
   if path=='/api/cms/action':return respond(handler,200,store.action(payload.get('id',''),payload.get('action'),payload.get('version'),payload.get('when'),payload.get('revision')))
   if path=='/api/cms/upload':return respond(handler,200,store.upload(payload))
   if path=='/api/cms/preview':
    draft=validate_post(payload.get('draft'))
    published=[json.loads(p.read_text()) for p in (store.root/'content/posts').glob('*.json')]
    html=article(draft,preview=True,others=published).replace('src="/media/','src="/api/cms/assets/')
    return respond(handler,200,{'html':html,'readingMinutes':read_minutes(draft)})
  return respond(handler,404,{'error':'Not found.'})
 except Conflict as error:return respond(handler,409,{'error':str(error)})
 except (ValueError,TypeError) as error:return respond(handler,400,{'error':str(error)})
 except FileNotFoundError:return respond(handler,404,{'error':'Not found.'})
 except Exception:
  import traceback;traceback.print_exc();return respond(handler,500,{'error':'The change could not be completed. Your last saved version is still available.'})

def scheduler(store,stop):
 while not stop.wait(30):
  try:store.due()
  except Exception:
   import traceback;traceback.print_exc()
