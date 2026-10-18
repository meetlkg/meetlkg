#!/usr/bin/env python3
"""Build crawlable portfolio pages and article indexes from owned content."""
from pathlib import Path
from datetime import datetime, timezone
from email.utils import format_datetime
import json, os, re, tempfile
from site_content import *


def write(path,text):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.publish-')
 try:
  with os.fdopen(fd,'w') as f:f.write(text)
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)

def icon(name,size=160):return f'<svg viewBox="0 0 {size} {size}" aria-hidden="true"><use href="/static/world-icons.svg#{e(name)}"/></svg>'
def links(items):return '<ul class="resource-links">'+''.join(f'<li><a href="{e(safe_url(i["url"]))}">{e(i["label"])} {ARROW}</a></li>' for i in items)+'</ul>'
def backlinks(posts,route):
 target=urlsplit(absolute(route))
 return [{'label':p['title'],'url':'/blog/'+p['slug']+'/'} for p in posts if any((urlsplit(absolute(r['url'])).netloc,urlsplit(absolute(r['url'])).path.rstrip('/'))==(target.netloc,target.path.rstrip('/')) for r in p.get('related',[])+p.get('sources',[]))]
def nav(active):
 return '<header class="site-head shell"><a class="wordmark" href="/" aria-label="Gokul home">gokul'+icon('spark',24)+'</a><nav class="primary-nav" aria-label="Main navigation">'+''.join(f'<a href="{url}"'+(' aria-current="page"' if label==active else '')+f'>{label}</a>' for label,url in NAV)+'</nav><a class="hello-link" href="/#contact-card">Say hello '+ARROW+'</a></header>'
def footer():return '<footer class="editorial-footer shell"><a class="wordmark" href="/">gokul'+icon('spark',24)+'</a><p>A curious mind. A builder at heart.</p><div>'+''.join(f'<a href="{url}">{label}</a>' for label,url in NAV)+'<a href="/blog/feed.xml">RSS</a><a href="https://github.com/gok03">GitHub '+ARROW+'</a></div><small>© '+str(datetime.now().year)+' '+AUTHOR+'</small></footer>'
def person():return {'@type':'Person','@id':SITE+'/#person','name':AUTHOR,'url':SITE+'/technical/','image':SITE+'/static/avatar-favicon.png','sameAs':['https://github.com/gok03','https://www.linkedin.com/in/gok03/']}
def page(title,description,path,body,active='Technical',schema=None,noindex=False,image='/static/social-card.png',canonical=None):
 canonical=canonical or absolute(path)
 data={'@context':'https://schema.org','@graph':[person(),{'@type':'WebSite','@id':SITE+'/#website','name':'Gokul — AI, agents & engineering','url':SITE+'/'},{'@type':'WebPage','@id':absolute(path)+'#page','url':absolute(path),'name':title,'description':description,'isPartOf':{'@id':SITE+'/#website'},'about':{'@id':SITE+'/#person'}}]+(schema or [])}
 return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — Gokul</title><meta name="description" content="{e(description)}"><link rel="canonical" href="{e(canonical)}"><meta name="robots" content="{'noindex, nofollow' if noindex else 'index, follow, max-image-preview:large'}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}"><meta property="og:url" content="{e(canonical)}"><meta property="og:type" content="{'article' if any(s.get('@type')=='BlogPosting' for s in schema or []) else 'website'}"><meta property="og:image" content="{e(absolute(image))}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#faf9f6">
<link rel="icon" href="/static/favicon.ico?v=monogram-2" sizes="16x16 32x32 48x48"><link rel="icon" href="/static/mark.svg?v=monogram-2" type="image/svg+xml"><link rel="icon" href="/static/favicon-192.png?v=monogram-2" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/static/site-touch-icon.png?v=monogram-2"><link rel="alternate" type="application/rss+xml" title="Gokul’s field notes" href="/blog/feed.xml"><link rel="stylesheet" href="/static/editorial.css?v=mobile-icons-20261018-1"><link rel="preload" as="font" href="/static/fonts/bricolage-700.ttf" type="font/ttf" crossorigin>
<script type="application/ld+json">{json_script(data)}</script><script type="module" src="/static/editorial.js?v=mobile-icons-20261018-1"></script></head><body><a class="skip" href="#main">Skip to content</a>{nav(active)}<main id="main">{body}</main>{footer()}</body></html>'''

def breadcrumb(items):return '<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a>'+''.join(' <span aria-hidden="true">/</span> '+(f'<a href="{e(url)}">{e(label)}</a>' if url else f'<span aria-current="page">{e(label)}</span>') for label,url in items)+'</nav>'
def crumb_schema(items):return {'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':i+1,'name':label,'item':absolute(url)} for i,(label,url) in enumerate([('Home','/')]+items)]}
def hero(kicker,title,description,art='brain',tone='lilac',extra=''):
 return f'<section class="page-hero shell"><div><p class="eyebrow">{e(kicker)}</p><h1>{title}</h1><p class="hero-dek">{e(description)}</p>{extra}</div><div class="hero-illustration {tone}">{icon(art)}<span class="hand-note">one curiosity<br>leads to another</span></div></section>'
def project_card(p):return f'<a class="archive-card" data-search="{e(p["title"]+" "+p["description"])}" data-category="{e(p["category"])}" href="/technical/{p["slug"]}/"><span class="eyebrow">{e(p["category"])}</span><h3>{e(p["title"])}</h3><p>{e(p["description"])}</p><span class="text-link">Explore the work {ARROW}</span></a>'
def post_card(p,featured=False):
 return f'<article class="post-card {"featured-post" if featured else ""}" data-search="{e(p["title"]+" "+p.get("excerpt","")+" "+" ".join(p.get("tags",[])))}" data-category="{e(p["category"])}"><a class="post-art {"lilac" if featured else "mint"}" href="/blog/{p["slug"]}/" tabindex="-1" aria-hidden="true">'+(f'<img src="{e(p["cover"])}" alt="" loading="lazy">' if p.get('cover') else icon('models' if 'model' in p['title'].lower() else 'brain'))+f'</a><div><p class="eyebrow">{e(p["category"])} <span>· {read_minutes(p)} min read</span></p><h2><a href="/blog/{p["slug"]}/">{e(p["title"])}</a></h2><p>{e(p.get("excerpt",""))}</p><div class="post-meta"><img src="/static/avatar-favicon.png" alt="" width="30" height="30"><span>Gokul <span aria-hidden="true">·</span> <time datetime="{e(p.get("publishedAt",""))}">{date_label(p.get("publishedAt",""))}</time></span></div></div></article>'
def search_bar(label,categories):return f'<div class="filter-bar"><label><span class="sr-only">{e(label)}</span><input type="search" data-filter-search placeholder="{e(label)}"></label><label><span class="sr-only">Filter by topic</span><select data-filter-category><option value="">Every curiosity</option>'+''.join(f'<option>{e(c)}</option>' for c in sorted(set(categories)))+'</select></label><span data-filter-count role="status"></span></div>'

def connection_key(url):
 parsed=urlsplit(absolute(url))
 return (parsed.netloc.lower(),parsed.path.rstrip('/'),parsed.query)

def related_reading(post,others):
 # References substantiate the article; connections take readers to distinct work.
 seen={connection_key('/blog/'+post['slug']+'/')}|{connection_key(r['url']) for r in post.get('sources',[])}
 candidates=list(post.get('related',[]))
 for other in others:
  if other['slug']!=post['slug'] and set(other.get('tags',[]))&set(post.get('tags',[])):
   candidates.append({'label':other['title'],'url':'/blog/'+other['slug']+'/'})
 catalog={connection_key('/blog/'+p['slug']+'/'):(p['category'],p.get('excerpt',''), 'models',str(read_minutes(p))+' min read') for p in others}
 catalog[connection_key('/technical/')]=('Technical journey','The projects, experience and experiments behind my work in ML and agents.','brain','Explore the work')
 catalog[connection_key('/ventures/')]=('Open source','Independent products and ideas, with architecture notes and code to explore.','robot','Explore the projects')
 catalog[connection_key('/slm-talk/')]=('Talk & demos','Slides, example code and practical experiments with small language models.','models','Explore the session')
 venture_file=ROOT/'content/ventures.json'
 if venture_file.exists():
  for v in json.loads(venture_file.read_text()):
   catalog[connection_key('/ventures/'+v['slug']+'/')]=('Open-source venture',v['description'],v['icon'],'Explore the project')
 cards=[]
 for item in candidates:
  key=connection_key(item['url'])
  if key in seen:continue
  seen.add(key)
  label,description,art,action=catalog.get(key,('Related resource','Follow this connection for another perspective on the work.','spark','Take a look'))
  tone=['lilac','mint','peach'][len(cards)%3]
  cards.append(f'<a class="connection-card" href="{e(safe_url(item["url"]))}"><span class="connection-icon {tone}">{icon(art)}</span><span class="eyebrow">{e(label)}</span><h3>{e(item["label"])}</h3><p>{e(description)}</p><span class="connection-action">{e(action)}{ARROW}</span></a>')
  if len(cards)==6:break
 if not cards:return ''
 return '<section class="related-reading" aria-labelledby="related-reading-title"><div class="shell"><div class="connection-heading"><div><p class="eyebrow">A FEW PATHS FROM HERE</p><h2 id="related-reading-title">Keep connecting<br>the dots.</h2></div><p>One idea leads to another. Explore the projects and notes connected to this story.</p></div><div class="connection-grid">'+''.join(cards)+'</div></div></section>'

def article(post,preview=False,others=None):
 body,toc=render_blocks(post['blocks']);url='/blog/'+post['slug']+'/'
 cover=f'<figure class="article-cover"><img src="{e(post["cover"])}" alt="{e(post["coverAlt"])}" fetchpriority="high"></figure>' if post.get('cover') else ''
 faqs='<section class="article-faq"><h2 id="questions">A few useful questions</h2>'+''.join('<details><summary>'+e(f['question'])+'</summary><p>'+inline(f['answer'])+'</p></details>' for f in post.get('faqs',[]))+'</section>' if post.get('faqs') else ''
 connections=related_reading(post,others or [])
 html=f'<div class="shell">{breadcrumb([("Blog","/blog/"),(post["title"],None)])}</div>'+('<div class="preview-banner">Private draft preview · not indexed or published</div>' if preview else '')+f'<header class="article-header shell"><p class="eyebrow">{e(post["category"])}</p><h1>{e(post["title"])}</h1><p class="hero-dek">{e(post.get("excerpt",""))}</p><div class="byline"><img src="/static/avatar-favicon.png" alt="" width="42" height="42"><div><a href="/technical/">{AUTHOR}</a><span><time datetime="{e(post.get("publishedAt",""))}">{date_label(post.get("publishedAt","")) or "Unpublished draft"}</time> · {read_minutes(post)} min read'+(f' · Updated {date_label(post["updatedAt"])}' if post.get('updatedAt') and post.get('updatedAt','')[:10]!=post.get('publishedAt','')[:10] else '')+'</span></div><button class="copy-link" data-copy-link><span data-copy-label>Copy link</span>'+ARROW+'</button></div></header>'+cover+'<div class="article-layout shell"><aside class="article-toc"><p class="eyebrow">ON THIS PAGE</p>'+''.join(f'<a class="toc-level-{t["level"]}" href="#{t["id"]}">{e(t["text"])}</a>' for t in toc)+'</aside><article class="article-body">'+('<aside class="quick-answer"><span class="eyebrow">THE SHORT VERSION</span><p>'+inline(post['summary'])+'</p></aside>' if post.get('summary') else '')+body+faqs+('<section class="article-sources"><h2 id="sources">Sources & further reading</h2>'+links(post['sources'])+'</section>' if post.get('sources') else '')+'<p class="article-tags">'+''.join(f'<a href="/blog/topics/{slugify(t)}/">{e(t)}</a>' for t in post.get('tags',[]))+'</p></article></div>'+connections
 schema=[{'@type':'BlogPosting','headline':post['title'],'description':post.get('seoDescription') or post.get('excerpt',''),'image':[absolute(post.get('cover') or '/static/social-card.png')],'author':{'@id':SITE+'/#person'},'publisher':{'@id':SITE+'/#person'},'mainEntityOfPage':absolute(url),'datePublished':post.get('publishedAt') or now(),'dateModified':post.get('updatedAt') or post.get('publishedAt') or now(),'timeRequired':f'PT{read_minutes(post)}M','keywords':post.get('tags',[]),'articleSection':post['category']},crumb_schema([('Blog','/blog/'),(post['title'],url)])]
 return page(post.get('seoTitle') or post['title'],post.get('seoDescription') or post.get('excerpt',''),url,html,'Blog',schema,preview,post.get('cover') or '/static/social-card.png',post.get('canonical') or None)

def build(root=ROOT):
 root=Path(root);paths=[]
 def emit(route,html):write(root/route.lstrip('/')/'index.html',html);paths.append(route)
 facts=json.loads((root/'static/profile.json').read_text());legacy=legacy_data()
 venture_file=root/'content/ventures.json';ventures=json.loads(venture_file.read_text()) if venture_file.exists() else []
 posts=[]
 for f in (root/'content/posts').glob('*.json'):
  p=json.loads(f.read_text());validate_post(p);posts.append(p)
 posts.sort(key=lambda p:p.get('publishedAt',''),reverse=True)
 skills=''.join(f'<article class="career-row"><span class="career-year">{e(c["year"])}</span><div><p class="eyebrow">{e(c["role"])}</p><h3>{e(c["company"])}</h3><p>{e(c["summary"])}</p><ul>'+''.join('<li>'+e(d)+'</li>' for d in c['details'])+'</ul><div class="tag-row">'+''.join('<span>'+e(t)+'</span>' for t in c['skills'])+'</div></div></article>' for c in reversed(facts['chapters']))
 tabs='<nav class="section-nav shell" aria-label="Technical sections"><a href="#career">Experience</a><a href="#archive">Project archive</a><a href="#skills">Skills</a><a href="#publication">Publications</a><a href="#community">Community</a><a href="#awards">Recognition</a></nav>'
 body=hero('THE ENGINEERING SIDE','Built over time.<br><em>Still curious.</em>','From autonomous robots and tiny-device ML to language models and agents. The work, experiments and lessons behind my technical journey.','brain','lilac','<div class="hero-facts"><span><b>10+</b> years building</span><span><b>'+str(len(legacy['projects']))+'</b> archive projects</span><span><b>5</b> career chapters</span></div>')+tabs+'<section class="shell editorial-section" id="career"><div class="section-title"><span class="eyebrow">01 / THE THROUGH-LINE</span><h2>From first principles<br>to working products.</h2></div>'+skills+'</section><section class="paper-section" id="archive"><div class="shell"><div class="section-title"><span class="eyebrow">02 / THE PROJECT NOTEBOOK</span><h2>Every build taught me something.</h2><p>Earlier experiments, prototypes and shipped work, brought forward from my original portfolio.</p></div>'+search_bar('Search the project archive',[p['category'] for p in legacy['projects']])+'<div class="archive-grid" data-filter-grid>'+''.join(project_card(p) for p in legacy['projects'])+'</div><p data-filter-empty hidden>No matching projects. Try another curiosity.</p></div></section><div class="shell technical-records">'+''.join(f'<section class="legacy-record" id="{s["id"]}"><div class="section-title"><p class="eyebrow">FROM THE ORIGINAL PORTFOLIO</p><h2>{e(s["title"])}</h2></div><div class="legacy-copy">{s["body"]}</div></section>' for s in legacy['sections'])+'</div><section class="shell editorial-section"><h2>The earlier timeline</h2><p class="section-dek">Detailed notes from the original site. Historical roles and descriptions are preserved here; the current career timeline appears above.</p><div class="historical-timeline">'+''.join('<details><summary>'+e(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',t)).strip()[:125])+'</summary><div class="legacy-copy">'+t+'</div></details>' for t in legacy['timeline'])+'</div></section>'
 if backlinks(posts,'/technical/'):body+='<section class="shell related-strip"><h2>Notes from this journey</h2>'+links(backlinks(posts,'/technical/'))+'</section>'
 emit('/technical/',page('Technical — ML, agents & engineering','Gokul’s engineering experience, 31 archived projects, skills, publications, community contributions and awards.','/technical/',body,schema=[{'@type':'ProfilePage','mainEntity':{'@id':SITE+'/#person'}}]))
 for p in legacy['projects']:
  url='/technical/'+p['slug']+'/'
  body='<div class="shell">'+breadcrumb([('Technical','/technical/'),(p['title'],None)])+'</div>'+hero(p['category'],e(p['title']),'A project from my earlier engineering notebook. Original descriptions, resources and demonstrations are preserved below.','vision','peach')+'<div class="shell narrow legacy-copy">'+p['body']+'</div><div class="shell narrow related-strip"><h2>More from the notebook</h2>'+links([{'label':'All technical projects','url':'/technical/#archive'},{'label':'Current open-source ventures','url':'/ventures/'}])+'</div>'
  if backlinks(posts,url):body+='<section class="shell narrow related-strip"><h2>Notes on this work</h2>'+links(backlinks(posts,url))+'</section>'
  emit(url,page(p['title'],p['description'],url,body,schema=[crumb_schema([('Technical','/technical/'),(p['title'],url)])]))
 cards=''
 for i,v in enumerate(ventures):
  cards+=f'<article class="venture-row {v["color"]}"><div class="venture-art">{icon(v["icon"])}</div><div><p class="eyebrow">0{i+1} / {e(v["eyebrow"])}</p><h2><a href="/ventures/{v["slug"]}/">{e(v["name"])}</a></h2><p>{e(v["description"])}</p><div class="tag-row">'+''.join('<span>'+e(t)+'</span>' for t in v['tags'])+f'</div><a class="text-link" href="/ventures/{v["slug"]}/">The idea, the architecture & the code {ARROW}</a></div></article>'
 emit('/ventures/',page('Open Source Ventures','Independent products and open-source work by Gokul: Refuse.dev, slm.expert and Agentend.ai.','/ventures/',hero('BUILDING IN THE OPEN','Ideas worth<br><em>putting out there.</em>','Open-source products, useful resources and experiments in how AI systems should work. Built to be explored, questioned and improved.','robot','mint')+'<section class="shell venture-list">'+cards+'</section><section class="shell invitation"><span class="eyebrow">BETTER, TOGETHER</span><h2>Something you’d like to build on?</h2><p>Explore the repositories, open a thoughtful issue, or get in touch.</p><a class="pill-button" href="/#contact-card">Let’s talk '+ARROW+'</a></section>','Open Source Ventures'))
 for v in ventures:
  url='/ventures/'+v['slug']+'/'
  actions=links([{'label':'Visit '+v['name'],'url':v['url']}]+([{'label':'Explore the source','url':v['repo']}] if v['repo'] else []))
  backlinked=backlinks(posts,url)
  body='<div class="shell">'+breadcrumb([('Open Source Ventures','/ventures/'),(v['name'],None)])+'</div>'+hero(v['eyebrow'],e(v['name']),v['description'],v['icon'],v['color'],actions)+f'<div class="venture-detail shell"><aside><p class="eyebrow">{e(v["status"])}</p><p>{e(v["license"])}</p><div class="tag-row">'+''.join('<span>'+e(t)+'</span>' for t in v['tags'])+'</div></aside><article class="article-body"><h2>'+e(v['title'])+'</h2><p>'+e(v['problem'])+'</p><h2>The approach</h2><p>'+e(v['approach'])+'</p><ol class="flow-diagram">'+''.join('<li><span>'+str(i+1)+'</span>'+e(t)+'</li>' for i,t in enumerate(v['steps']))+'</ol><ul>'+''.join('<li>'+e(d)+'</li>' for d in v['details'])+'</ul><h2>Explore & contribute</h2><p>'+e(v['contribute'])+'</p>'+links(v['sources'])+('<h2>From my notebook</h2>'+links(backlinked) if backlinked else '')+'</article></div>'
  emit(url,page(v['name']+' — '+v['eyebrow'].title(),v['description'],url,body,'Open Source Ventures',schema=[crumb_schema([('Open Source Ventures','/ventures/'),(v['name'],url)])]))
 blog_intro=hero('FIELD NOTES / GOKUL’S BLOG','Things I’m learning.<br><em>Things I’m building.</em>','Notes on language models, agents and the engineering around them. Connected to real projects, with sources you can follow.','models','peach','<a class="text-link" href="/blog/feed.xml">Follow along with RSS '+ARROW+'</a>')
 listing=search_bar('Find a note, idea or topic',[p['category'] for p in posts])+'<div class="post-grid" data-filter-grid>'+''.join(post_card(p,i==0) for i,p in enumerate(posts))+'</div><p data-filter-empty hidden>No notes match that search.</p>'
 emit('/blog/',page('Blog — field notes on AI & engineering','Gokul’s articles on language models, agent systems, open-source products and applied engineering.','/blog/',blog_intro+'<section class="shell editorial-section">'+listing+'</section>','Blog',schema=[{'@type':'Blog','name':'Gokul’s field notes','url':SITE+'/blog/','author':{'@id':SITE+'/#person'}}]))
 current=set()
 for p in posts:
  route='/blog/'+p['slug']+'/';current.add(p['slug']);emit(route,article(p,others=posts))
 # Only generated article/topic files are removed; other site assets stay intact.
 marker=root/'content/generated-blog.json';previous=json.loads(marker.read_text()) if marker.exists() else []
 topics=sorted({slugify(t):t for p in posts for t in p.get('tags',[])}.values())
 current_routes=['/blog/'+s+'/' for s in current]
 for tag in topics:
  route='/blog/topics/'+slugify(tag)+'/';current_routes.append(route)
  emit(route,page(tag+' articles','Notes by Gokul about '+tag+'.',route,hero('THE NOTEBOOK / TOPICS',e(tag),'Follow one thread through the work.','brain')+'<section class="shell post-grid">'+''.join(post_card(p) for p in posts if slugify(tag) in [slugify(t) for t in p.get('tags',[])])+'</section>','Blog'))
 for route in previous:
  if route not in current_routes and re.fullmatch(r'/blog/(?:topics/)?[a-z0-9-]+/',route):
   target=root/route.lstrip('/')/'index.html'
   if target.exists():target.unlink()
 write(marker,json.dumps(current_routes))
 indexes=[{'title':p['title'],'excerpt':p.get('excerpt',''),'url':'/blog/'+p['slug']+'/','category':p['category'],'tags':p['tags'],'publishedAt':p['publishedAt'],'readingMinutes':read_minutes(p)} for p in posts]
 write(root/'blog/search.json',json.dumps(indexes,ensure_ascii=False))
 items=''.join('<item><title>'+e(p['title'])+'</title><link>'+absolute('/blog/'+p['slug']+'/')+'</link><guid>'+absolute('/blog/'+p['slug']+'/')+'</guid><description>'+e(p['excerpt'])+'</description><pubDate>'+format_datetime(datetime.fromisoformat(p['publishedAt'].replace('Z','+00:00')))+'</pubDate></item>' for p in posts)
 write(root/'blog/feed.xml','<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Gokul’s field notes</title><link>'+SITE+'/blog/</link><description>AI, agents and engineering.</description><language>en</language><atom:link href="'+SITE+'/blog/feed.xml" rel="self" type="application/rss+xml"/>'+items+'</channel></rss>')
 urls=['/']+paths+['/slm-talk/']
 modified={'/blog/'+p['slug']+'/':p.get('updatedAt') or p['publishedAt'] for p in posts}
 write(root/'sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+e(absolute(u))+'</loc>'+('<lastmod>'+e(modified[u])+'</lastmod>' if u in modified else '')+'</url>' for u in urls)+'</urlset>')
 write(root/'robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /.cms/\nDisallow: /avatar-check.html\nSitemap: '+SITE+'/sitemap.xml\n')
 return {'pages':len(paths),'articles':len(posts),'projects':len(legacy['projects'])}
if __name__=='__main__':print(json.dumps(build()))
