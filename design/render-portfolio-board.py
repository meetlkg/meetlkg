"""Render an editorial concept board; this is not a browser screenshot."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
ROOT=Path(__file__).resolve().parent.parent
PAPER='#f5f3ed';INK='#242623';BLUE='#3655bd';MUTED='#646d62';LINE='#d7d9d0'
board=Image.new('RGB',(1600,1200),'#e7e7df');draw=ImageDraw.Draw(board)
fontroot=Path('/usr/share/fonts/truetype/dejavu')
def font(size,style='sans'):
 name={'sans':'DejaVuSans.ttf','bold':'DejaVuSans-Bold.ttf','serif':'/usr/share/fonts/opentype/urw-base35/NimbusRoman-Italic.otf','mono':'DejaVuSansMono.ttf'}[style]
 return ImageFont.truetype(str(fontroot/name),size)
def text(x,y,t,size=14,color=INK,style='sans',anchor=None):draw.text((x,y),t,font=font(size,style),fill=color,anchor=anchor)
def rule(x,y,w,color=LINE):draw.line((x,y,x+w,y),fill=color,width=1)
# Left: the proposed first fold. Right: the editorial choices behind it.
draw.rectangle((40,40,1080,1160),fill=PAPER)
text(88,73,'gokul',32,style='bold');text(184,73,'.',32,BLUE,style='bold')
for x,t in [(665,'Work'),(735,'Journey'),(827,'The person'),(947,'Let’s talk ↗')]:text(x,88,t,10)
rule(88,124,944)
text(560,161,'GOKULAVASAN MURALI · APPLIED AI',10,MUTED,'mono','mm')
text(560,224,'I turn LLMs into',62,INK,anchor='mm')
text(560,297,'working systems.',69,BLUE,'serif','mm')
text(560,356,'I design LLM and vision-led agents, the context they work with,',13,MUTED,anchor='mm')
text(560,380,'and the evaluations that tell us how they behave.',13,MUTED,anchor='mm')
text(560,416,'Product at LaunchAI  /  Chennai, India',10,MUTED,anchor='mm')
portrait=Image.open(ROOT/'static/avatar3d/portrait-texture.png').convert('RGB').resize((390,390),Image.Resampling.LANCZOS)
# Match the page's multiply compositing over the warm paper; identity is unchanged.
portrait=ImageChops.multiply(portrait,Image.new('RGB',portrait.size,PAPER));board.paste(portrait,(365,447))
text(100,575,'MY FOCUS',8,MUTED,'mono');text(100,603,'Language models.',12,MUTED);text(100,626,'Agents.',12,MUTED);text(100,649,'Real products.',12,MUTED);rule(100,688,30)
text(849,575,'THE THROUGH LINE',8,MUTED,'mono');text(849,603,'From on-device ML',12,MUTED);text(849,626,'to systems that',12,MUTED);text(849,649,'can take action.',12,MUTED);rule(849,688,30)
text(365,853,'A digital introduction. Move your cursor.',9,MUTED);text(715,851,'↺   Ⅱ',16,MUTED)
draw.rectangle((385,891,590,935),fill=INK);text(405,904,'Explore my work   ↓',12,PAPER);text(624,906,'Say hello ↗',12);rule(624,929,78)
rule(88,976,944)
for x,value,label in [(88,'10+ years','Building products, from 0→1'),(400,'5 agents','Plena’s desktop sales platform'),(710,'3 months → 2 weeks','LaunchAI time to market')]:
 text(x,993,value,21);text(x,1027,label,9,MUTED)
rule(88,1058,944)
text(88,1086,'01 / SELECTED WORK',8,MUTED,'mono');text(88,1108,'The work behind the expertise.',24)
# Right: clearly a design board, rather than a claim of browser verification.
x=1120
text(x,62,'PERSONAL PORTFOLIO',10,MUTED,'mono');text(x,94,'Applied AI architect.',28)
text(x,137,'LLM systems + agents.',22,BLUE,'serif')
text(x,191,'A personal narrative, supported',14,MUTED);text(x,216,'by systems, decisions and outcomes.',14,MUTED)
rule(x,265,420)
text(x,292,'THE TECHNICAL THREAD',10,MUTED,'mono')
for y,a,b in [(332,'01  Edge ML & deep learning','The foundations behind the work.'),(406,'02  Language & knowledge systems','Retrieval, transformers, document AI.'),(480,'03  Agent architectures','Context, tools, orchestration, evals.'),(554,'04  Products & people','Ownership, engineering and delivery.')]:
 text(x,y,a,15);text(x+28,y+28,b,11,MUTED)
rule(x,626,420)
text(x,655,'THE PAGE',10,MUTED,'mono')
for i,t in enumerate(['Introduction & digital self','Selected agent case studies','How I think about systems','A timeline of skills through work','Public projects & the small-model talk','Hockey, community & the person','A direct invitation to talk']):text(x,694+i*29,f'{i+1:02}  {t}',12,MUTED)
rule(x,928,420)
text(x,955,'THE FEEL',10,MUTED,'mono')
for bx,c in [(x,PAPER),(x+48,INK),(x+96,BLUE)]:draw.rectangle((bx,993,bx+34,1027),fill=c)
text(x,1049,'Editorial type. Quiet motion.',13);text(x,1076,'A large centered portrait.',13);text(x,1103,'Technical depth when you want it.',13)
text(40,1180,'CONCEPT BOARD · 18 OCT 2026 · The interactive HTML preview contains the full page.',10,MUTED,'mono')
board.save(ROOT/'design/portfolio-concept.png')
