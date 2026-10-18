"""Create a concept board for the Graphite direction, not a browser screenshot."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
BG='#101517';INK='#edf0e9';MUTED='#a0ada5';LINE='#343f3d';LIME='#d1f18b'
im=Image.new('RGB',(1600,1200),'#080c0d');d=ImageDraw.Draw(im);fonts=Path('/usr/share/fonts/truetype/dejavu')
def f(size,bold=False,mono=False):return ImageFont.truetype(str(fonts/('DejaVuSansMono.ttf' if mono else 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')),size)
def t(x,y,s,size=14,color=INK,bold=False,mono=False):d.text((x,y),s,font=f(size,bold,mono),fill=color)
def line(x,y,x2,y2,color=LINE,width=1):d.line((x,y,x2,y2),fill=color,width=width)
d.rectangle((40,40,1140,1160),fill=BG);line(238,40,238,1160)
t(70,74,'g/m',38,bold=True);t(162,76,'↗',20,LIME)
t(70,174,'Gokulavasan',15);t(70,197,'Murali',15);t(70,238,'Product & engineering',9,MUTED);t(70,258,'LLM systems / agents',9,MUTED)
for y,num,name in [(337,'01','Focus'),(375,'02','Selected systems'),(413,'03','In public'),(451,'04','Meet Gokul'),(489,'05','Contact')]:t(70,y,num,9,LIME if num=='01' else MUTED,mono=True);t(100,y,name,11,LIME if num=='01' else MUTED)
t(70,1015,'Chennai, India',10,MUTED);t(70,1036,'Product at LaunchAI ↗',10);t(70,1081,'LinkedIn ↗   GitHub ↗',9,MUTED)
t(285,75,'PERSONAL PORTFOLIO / 2026',9,MUTED,mono=True);t(820,75,'LLM SYSTEMS × AGENTS',9,MUTED,mono=True);line(285,110,1094,110)
t(282,156,'Gokulavasan',72,bold=True);t(282,234,'Murali',72,bold=True);t(526,234,'.',72,LIME,bold=True)
t(285,349,'I build the system',31);t(285,390,'around the model.',31,LIME)
t(285,457,'Product and engineering architect with 10+ years',11,MUTED);t(285,479,'building products. Language models, vision, tools',11,MUTED);t(285,501,'and evaluation, connected to real workflows.',11,MUTED)
d.rectangle((285,548,482,590),fill=LIME);t(302,562,'Explore the work   ↓',11,BG);t(511,563,'Meet Gokul ↗',11);line(511,585,595,585)
# Conceptual system map, echoing the actual inline SVG.
for x in range(835,1098,20):
 for y in range(190,531,20):d.ellipse((x,y,x+1,y+1),fill='#34413b')
cx=958
line(cx,232,cx,285,'#748b63');line(cx,380,cx,414,'#748b63');line(cx,449,cx,488,'#748b63')
d.rectangle((909,198,1007,236),fill='#1d2a21',outline='#7d9668');t(926,211,'CONTEXT',9,MUTED,mono=True)
d.polygon([(958,270),(1014,301),(1014,349),(958,380),(902,349),(902,301)],fill='#2e3b2c',outline=LIME)
line(902,301,958,331,'#91aa73');line(958,331,1014,301,'#91aa73');line(958,331,958,380,'#91aa73');t(936,304,'MODEL',9,LIME,mono=True)
d.rectangle((909,414,1007,451),fill='#1d2a21',outline='#7d9668');t(937,427,'TOOLS',9,MUTED,mono=True)
d.rectangle((896,488,1020,525),fill='#1d2a21',outline='#7d9668');t(919,501,'EVALUATION',9,MUTED,mono=True)
line(896,507,862,507,'#748b63');line(862,507,862,326,'#748b63');line(862,326,902,326,'#748b63')
t(849,554,'THE SYSTEM AROUND THE MODEL',7,MUTED,mono=True)
line(285,639,1094,639);line(285,718,1094,718)
for x,n,s in [(285,'01 /','LLM systems'),(557,'02 /','Agent architecture'),(831,'03 /','Evaluation & delivery')]:t(x,655,n,9,MUTED,mono=True);t(x,681,s,16,LIME if n=='01 /' else INK)
line(285,717,534,717,LIME,2);line(542,639,542,718);line(816,639,816,718)
t(285,739,'Model choices, retrieval, context and the surrounding product architecture.',11,MUTED);t(285,762,'See the language systems work ↗',10,LIME)
line(285,814,1094,814);t(285,846,'02 / SELECTED SYSTEMS',9,MUTED,mono=True);t(285,875,'The work.',39);t(285,925,'The decisions behind it.',39,'#8da08c')
line(285,995,1094,995);t(285,1024,'A.',15,LIME,mono=True);t(335,1017,'LAUNCHAI / 2025–PRESENT',9,MUTED,mono=True);t(335,1042,'Enterprise agents that can take action.',24);t(1064,1039,'+',24,LIME)
line(285,1090,1094,1090);t(285,1111,'B.',15,LIME,mono=True);t(335,1106,'PLENA DATA / 2023–2025',9,MUTED,mono=True);t(335,1128,'Five agents. One continuous workflow.',19);t(1064,1119,'+',24,LIME)
# Direction notes are separated from the site mockup.
x=1182
t(x,64,'DIRECTION 02',10,MUTED,mono=True);t(x,102,'GRAPHITE',35,LIME,bold=True);t(x,161,'Systems first.',27);t(x,199,'Personal by design.',27)
line(x,266,1555,266)
t(x,295,'A DIFFERENT STRUCTURE',10,MUTED,mono=True)
for y,n,title,sub in [(337,'01','Focus','Choose a technical thread.'),(430,'02','Selected systems','Open the work and its decisions.'),(523,'03','In public','A talk, tools and public projects.'),(616,'04','Meet Gokul','The avatar and the personal story.'),(709,'05','Contact','Start a direct conversation.')]:
 t(x,y,n,10,LIME,mono=True);t(x+36,y-4,title,18);t(x+36,y+28,sub,11,MUTED)
line(x,799,1555,799);t(x,828,'THE DESIGN LANGUAGE',10,MUTED,mono=True)
for bx,c in [(x,BG),(x+49,INK),(x+98,LIME)]:d.rectangle((bx,870,bx+34,904),fill=c,outline=LINE)
t(x,938,'A persistent identity rail.',14);t(x,970,'Bold type and a work index.',14);t(x,1002,'The portrait gets its own chapter.',14);t(x,1034,'Small motion. Strong hierarchy.',14)
t(x,1092,'A separate interactive preview:',10,MUTED);t(x,1118,'/systems-portfolio.html',12,LIME,mono=True)
t(40,1180,'CONCEPT BOARD · 18 OCT 2026 · The HTML preview contains the complete page and centered 3D portrait.',9,MUTED,mono=True)
im.save(ROOT/'design/systems-concept.png')
