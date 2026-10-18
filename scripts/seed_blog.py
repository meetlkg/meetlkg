"""One-time migration of existing portfolio material into editable articles."""
from site_content import *
from build_site import write

def block(kind,text,**extra):return {'type':kind,'text':text,**extra}
posts=[
 {'title':'Small Models, Big Impact: the talk and the resources','slug':'small-models-big-impact','category':'Talks & field notes','tags':['Small models','Agents','Open source'],'excerpt':'The starting point for my PyConf Hyderabad 2026 talk: local inference, task-specific models and the systems around them.','summary':'Small Models, Big Impact is my PyConf Hyderabad 2026 talk about small language models and local AI workflows. This page connects the talk, slides, example code and the model-discovery resource I’m building.','cover':'','blocks':[
 block('heading','A practical question about model choice'),
 block('paragraph','The talk starts with a question: how much model do you need for the task in front of you? Its focus is small language models and the surrounding application, from local inference to multi-agent pipelines.'),
 block('paragraph','The original session includes demos on Apple Silicon. The resources cover local inference with MLX and Ollama, structured extraction, vision OCR, code generation, reasoning modes, browser automation and an A2A multi-agent pipeline.'),
 block('heading','What the session covers'),
 block('table','Thread | What to explore\nLocal inference | MLX and Ollama runtimes\nStructured extraction | NuExtract examples\nDocument understanding | PaddleOCR-VL\nAgent workflows | A2A and browser automation\nModel selection | Capability and deployment trade-offs'),
 block('heading','Follow the examples'),
 block('paragraph','The talk page links to the slides and the source repository. Start there for the actual examples and their setup instructions. Repository requirements and model availability can change, so use the current project documentation when running a demo.'),
 block('callout','Local inference avoids a per-request hosted API charge, but it still uses hardware, memory, energy and engineering time. Model choice belongs in that wider cost picture.'),
 block('heading','Continue with the model directory'),
 block('paragraph','slm.expert is a related project: a directory of small open-weight models organized around use cases, with published benchmarks and license information. It can help narrow a shortlist before you test models in your own application.')],
 'related':[{'label':'Explore slm.expert','url':'/ventures/slm-expert/'},{'label':'Technical experience and evaluation work','url':'/technical/#career'}],'sources':[{'label':'Original talk page and slides','url':'/slm-talk/'},{'label':'Talk code and setup instructions','url':'https://github.com/gok03/slm-talk'},{'label':'slm.expert model directory','url':'https://slm.expert/'}],'faqs':[{'question':'Where are the slides and demo code?','answer':'The original talk page links to the slide deck and the gok03/slm-talk repository on GitHub.'},{'question':'Does an open-weight model automatically have an unrestricted license?','answer':'No. Check the license of each model and any relevant components before deciding how to use it.'}]}
]
for p in posts:
 path=ROOT/'content/posts'/f'{p["slug"]}.json'
 if path.exists():continue
 p.update(publishedAt=now(),updatedAt=now(),coverAlt='',seoTitle=p['title'][:70],seoDescription=p['excerpt'][:180],canonical='')
 validated=validate_post(p);validated['updatedAt']=p['updatedAt']
 write(path,json.dumps(validated,indent=2,ensure_ascii=False)+'\n')
 print('Migrated:',p['title'])
