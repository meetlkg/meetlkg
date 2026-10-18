"""Content helpers shared by the static publisher and private blog editor."""
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json, math, re
from urllib.parse import urljoin, urlsplit

ROOT=Path(__file__).resolve().parent.parent
SITE='https://gok03.com'
AUTHOR='Gokulavasan Murali'
NAV=[('Home','/'),('Technical','/technical/'),('Open Source Ventures','/ventures/'),('Blog','/blog/')]
KINDS={'paragraph','heading','list','quote','code','image','callout','table','divider'}
def now():return datetime.now(timezone.utc).isoformat(timespec='seconds')
def e(value):return escape(str(value),quote=True)
def slugify(value):return re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-')[:100]
def safe_url(value,images=False):
 value=str(value).strip()
 if re.search(r'[\x00-\x20\\]',value):return ''
 parsed=urlsplit(value)
 if value.startswith('//') or parsed.username or parsed.password:return ''
 if parsed.scheme in (['https','http'] if images else ['https','http','mailto','tel']):return value
 if not parsed.scheme and value.startswith(('/', '#')) and not any(p=='..' for p in parsed.path.split('/')):return value
 return ''
def absolute(value):return urljoin(SITE+'/',value)
def inline(text):
 # Literal HTML stays text. Only explicit links, emphasis and inline code render.
 parts=[];last=0
 pattern=r'`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*'
 for m in re.finditer(pattern,str(text)):
  parts.append(e(text[last:m.start()]))
  if m[1]:parts.append('<code>'+e(m[1])+'</code>')
  elif m[2]:
   url=safe_url(m[3]);parts.append(f'<a href="{e(url)}">{e(m[2])}</a>' if url else e(m[2]))
  else:parts.append('<strong>'+e(m[4])+'</strong>')
  last=m.end()
 parts.append(e(text[last:]));return ''.join(parts)
def read_minutes(post):
 words=' '.join(str(b.get('text',''))+' '+str(b.get('caption','')) for b in post.get('blocks',[]))
 return max(1,math.ceil(len(words.split())/220))
def date_label(value):
 try:return datetime.fromisoformat(value.replace('Z','+00:00')).strftime('%b %d, %Y').replace(' 0',' ')
 except (ValueError,AttributeError):return ''
def json_script(data):return json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
def validate_post(data):
 if not isinstance(data,dict):raise ValueError('An article must be an object.')
 result={}
 for key,limit in [('title',160),('slug',100),('excerpt',400),('summary',800),('category',60),('seoTitle',70),('seoDescription',180),('cover',500),('coverAlt',300),('canonical',500),('publishedAt',40)]:
  value=data.get(key,'')
  if not isinstance(value,str) or len(value)>limit:raise ValueError(f'Invalid {key}.')
  result[key]=value.strip()
 if not result['title']:raise ValueError('Give your article a title.')
 result['slug']=result['slug'] or slugify(result['title'])
 if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',result['slug']):raise ValueError('Use lowercase words separated by hyphens for the URL.')
 if result['slug'] in ['topics','index','feed','search']:raise ValueError('That URL is reserved. Choose another article slug.')
 result['category']=result['category'] or 'Field notes'
 for key in ['cover','canonical']:
  if result[key] and not safe_url(result[key],images=True):raise ValueError(f'Invalid {key} URL.')
 if result['cover'] and not result['coverAlt']:raise ValueError('Describe the cover image for readers using a screen reader.')
 if result['publishedAt']:
  try:
   parsed=datetime.fromisoformat(result['publishedAt'].replace('Z','+00:00'))
   if parsed.tzinfo is None:raise ValueError()
  except ValueError:raise ValueError('The publication date must include a timezone.')
 tags=data.get('tags',[])
 if not isinstance(tags,list) or len(tags)>12 or any(not isinstance(t,str) or not 1<=len(t)<=40 or not slugify(t) for t in tags):raise ValueError('Use up to 12 short tags with letters or numbers for their URLs.')
 result['tags']=list(dict.fromkeys(t.strip() for t in tags if t.strip()))
 blocks=data.get('blocks',[])
 if not isinstance(blocks,list) or len(blocks)>100:raise ValueError('Use up to 100 content blocks.')
 result['blocks']=[]
 for b in blocks:
  if not isinstance(b,dict) or b.get('type') not in KINDS:raise ValueError('Unknown content block.')
  block={'type':b['type']}
  for field in ['text','url','alt','caption','language']:
   value=b.get(field,'')
   if not isinstance(value,str) or len(value)>(20000 if field=='text' else 500):raise ValueError('A content block is too large.')
   block[field]=value
  if b['type']=='heading':block['level']=3 if b.get('level')==3 else 2
  if b['type']=='list':block['ordered']=bool(b.get('ordered',False))
  if b['type']=='image' and (not safe_url(block['url'],images=True) or not block['alt']):raise ValueError('An image needs a valid URL and alt text.')
  result['blocks'].append(block)
 for key in ['sources','related']:
  values=data.get(key,[])
  if not isinstance(values,list) or len(values)>20:raise ValueError('Too many links.')
  result[key]=[]
  for link in values:
   if not isinstance(link,dict) or not isinstance(link.get('label'),str) or not 1<=len(link['label'])<=200 or not safe_url(link.get('url','')):raise ValueError('Every source or related link needs a label and a valid URL.')
   result[key].append({'label':link['label'],'url':link['url']})
 faqs=data.get('faqs',[])
 if not isinstance(faqs,list) or len(faqs)>12:raise ValueError('Use up to 12 questions.')
 result['faqs']=[]
 for faq in faqs:
  if not isinstance(faq,dict) or not all(isinstance(faq.get(k),str) and 0<len(faq[k])<=1500 for k in ['question','answer']):raise ValueError('Each question needs an answer.')
  result['faqs'].append({'question':faq['question'],'answer':faq['answer']})
 return result

def render_blocks(blocks):
 out=[];toc=[];used={}
 for b in blocks:
  kind=b['type'];text=b.get('text','')
  if kind=='heading':
   base=slugify(text) or 'section';used[base]=used.get(base,0)+1;anchor=base+(f'-{used[base]}' if used[base]>1 else '')
   level=b.get('level',2);toc.append({'id':anchor,'text':text,'level':level});out.append(f'<h{level} id="{anchor}">{inline(text)}<a class="heading-anchor" href="#{anchor}" aria-label="Link to this section">#</a></h{level}>')
  elif kind=='paragraph':out.append('<p>'+inline(text).replace('\n','<br>')+'</p>')
  elif kind=='list':
   tag='ol' if b.get('ordered') else 'ul';out.append(f'<{tag}>'+''.join('<li>'+inline(line)+'</li>' for line in text.splitlines() if line.strip())+f'</{tag}>')
  elif kind=='code':out.append(f'<figure class="code-block"><figcaption>{e(b.get("language") or "Code")}</figcaption><pre><code>{e(text)}</code></pre></figure>')
  elif kind=='image':out.append(f'<figure><img src="{e(safe_url(b.get("url",""),True))}" alt="{e(b.get("alt",""))}" loading="lazy" decoding="async"><figcaption>{inline(b.get("caption",""))}</figcaption></figure>')
  elif kind=='quote':out.append('<blockquote><p>'+inline(text)+'</p><cite>'+inline(b.get('caption',''))+'</cite></blockquote>')
  elif kind=='callout':out.append('<aside class="article-callout"><strong>Worth keeping in mind</strong><p>'+inline(text)+'</p></aside>')
  elif kind=='table':
   rows=[line.strip().strip('|').split('|') for line in text.splitlines() if line.strip()]
   if rows:
    out.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th scope="col">'+inline(c.strip())+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c.strip())+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table></div>')
  elif kind=='divider':out.append('<hr>')
 return '\n'.join(out),toc

class Node:
 def __init__(self,tag='',attrs=None):self.tag=tag;self.attrs=dict(attrs or []);self.children=[]
 def all(self,predicate):
  result=[]
  for child in self.children:
   if isinstance(child,Node):
    if predicate(child):result.append(child)
    result.extend(child.all(predicate))
  return result
 def text(self):return ' '.join(' '.join(child.split()) if isinstance(child,str) else child.text() for child in self.children).strip()
class Tree(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root]
 def handle_starttag(self,tag,attrs):
  node=Node(tag,attrs);self.stack[-1].children.append(node)
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(node)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1].children.append(data)
def parse_file(path):
 tree=Tree();tree.feed(path.read_text());return tree.root

def clean_legacy(node,source):
 if isinstance(node,str):return e(node)
 tag=node.tag
 if tag in ['script','style','noscript']:return ''
 inner=''.join(clean_legacy(c,source) for c in node.children)
 if tag=='a':
  href=safe_url(urljoin('/'+source,node.attrs.get('href','')))
  if href.startswith('/projects/') and href.endswith('.html'):href='/technical/'+Path(href).stem.replace('_','-')+'/'
  return '<a href="'+e(href)+'">'+inner+'</a>' if href else inner
 if tag=='img':
  src=safe_url(urljoin('/'+source,node.attrs.get('src','')),True)
  if src.startswith('/') and not (ROOT/src.lstrip('/')).is_file():return ''
  return f'<img src="{e(src)}" alt="{e(node.attrs.get("alt") or "Project image from Gokul’s archive")}" loading="lazy" decoding="async">' if src else ''
 if tag=='iframe':
  src=safe_url(node.attrs.get('src',''),True)
  return f'<p><a href="{e(src)}">Watch the original demo or presentation ↗</a></p>' if src else ''
 if tag in ['h1','h2','h3','h4','h5','h6']:tag='h3'
 if tag in ['p','h3','strong','b','em','i','ul','ol','li','code','pre','blockquote','table','thead','tbody','tr','th','td']:return f'<{tag}>'+inner+f'</{tag}>'
 if tag in ['br','hr']:return '<'+tag+'>'
 return inner

def legacy_data():
 projects=[]
 for path in sorted((ROOT/'projects').glob('*.html')):
  tree=parse_file(path);bodies=tree.all(lambda n:'pw_about_content' in n.attrs.get('class','').split())
  if not bodies:continue
  content=bodies[0];heads=content.all(lambda n:n.tag=='h2');title=heads[0].text() if heads else path.stem.replace('_',' ').title()
  # The page's own first heading becomes the new page h1.
  body=''.join(clean_legacy(c,'projects/'+path.name) for c in content.children if c not in heads)
  media=tree.all(lambda n:'pw_about_single_img' in n.attrs.get('class','').split())
  body+=''.join(clean_legacy(n,'projects/'+path.name) for n in media)
  paragraphs=content.all(lambda n:n.tag=='p')
  plain=' '.join(' '.join(n.text().split()) for n in paragraphs).strip()
  summary=plain if len(plain)<=220 else plain[:220].rsplit(' ',1)[0]+'…'
  if path.stem=='iarus':title='IARUS — vehicle safety prototype'
  if path.stem=='final_year':title='Defence personnel transfer — undergraduate thesis'
  if path.stem=='inbrowser_mouse':
   summary='An unfinished browser mouse-movement experiment from the original project archive.'
   body='<p>This archived entry was never documented: its original page contains a reused Flytta description. Technical implementation details are not available in the source record.</p><p><a href="/projects/inbrowser_mouse.html">View the original archived entry ↗</a></p>'
  category='Software & products'
  name=path.stem
  if name in ['hmrt_v1','hmrt_v2','poseidon','panoptes','medivisor','tollmate','iarus','sense_me','screen_opening']:category='Robotics & systems'
  if name in ['edge_deep_learning','bias_indian_media','pydl','house_hold','logistic_loading','damage_reduction','diseases_predictor','final_year','inbrowser_mouse']:category='ML & deep learning'
  if name in ['chennai_water_monitor','cityscope_for_world']:category='Geospatial & data'
  projects.append({'slug':name.replace('_','-'),'title':title,'description':summary or 'An experiment from my earlier engineering work.','category':category,'body':body,'source':'/projects/'+path.name})
 tree=parse_file(ROOT/'archive.html');sections=[]
 historical=tree.all(lambda n:'timeline-item' in n.attrs.get('class','').split())
 if historical:sections.append({'id':'earlier-experience','title':'Earlier experience, in detail','body':'<p>Role descriptions from the original portfolio. The current timeline above reflects my latest résumé.</p>'+''.join('<div class="historical-role">'+clean_legacy(n,'archive.html').removeprefix('<li>').removesuffix('</li>')+'</div>' for n in historical)})
 for key,label in [('education','Education'),('skills','Technical foundations'),('publication','Publications'),('community','Community'),('awards','Awards'),('Media','In the press')]:
  found=tree.all(lambda n:n.attrs.get('id')==key)
  if found:sections.append({'id':key,'title':label,'body':clean_legacy(found[0],'archive.html')})
 # Keep the detailed early timeline as a separate redesigned record.
 timeline=parse_file(ROOT/'experience.html').all(lambda n:n.tag=='li' and bool(n.all(lambda c:'timeline-panel' in c.attrs.get('class','').split())))
 return {'projects':projects,'sections':sections,'timeline':[clean_legacy(n,'experience.html').removeprefix('<li>').removesuffix('</li>') for n in timeline]}
