"""Bake anatomically distinct FLAME speech poses for the existing 3D identity.

Keep the existing point order, torso, eye rig and beard attachment. Reconstruct
the exact native subdivision parents from the symmetric export samples. Only
mouth-local neural appearance corrections are allowed for the new speech poses.
"""
import os, sys
from pathlib import Path
sys.path.insert(0,os.environ.get('GOKUL_AVATAR_STUDIO','/home/gok03/codex/avatar-studio'))
import omg_bootstrap as B
import json, time, types, gzip, hashlib, inspect
from pathlib import Path
import numpy as np
import torch
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree
from scipy.interpolate import PchipInterpolator
from pytorch3d.structures import Meshes
from pytorch3d.ops import SubdivideMeshes
from core.libs.flame_model import FLAMEModel
from core.libs.utils_renderer import build_camera_matrices
from core.models.omg_model import OMGAvatar
from core.models.modules import StyleUNetLight
from omg_cpu32 import render as neural_features
from gaussian_quality_cpu import read, write, xyz, rgb, set_rgb, weights, render, image, project

OUT=Path(os.environ.get('GOKUL_SPEECH_BUILD',str(Path.home()/'.local/share/gokul-speech-v5/rig')));OUT.mkdir(parents=True,exist_ok=True)
BASE=Path(os.environ.get('GOKUL_AVATAR_BASE',str(Path.home()/'.local/share/gokul-speech-v5/previous')))
start=time.time()
def log(message,**values):print(message,{'seconds':round(time.time()-start,1),**values},flush=True)
PREVIOUS=Path.home()/'.local/share/gokul-speech-v4/previous'
meta=json.loads((PREVIOUS/'model.json').read_text())
data=read(BASE/'portrait.ply');points=xyz(data);base_colors=rgb(data)
camera=np.load(B.OUT/'browser-camera.npz');cam,K=camera['c2w'],camera['K'];linear,translation=camera['linear'],camera['translation']
norm=lambda p:(p@linear.T+translation).astype('float32')
track=torch.load(B.OUT/'source-track.pt',weights_only=True)
x=torch.load(B.OUT/'identity.pt',weights_only=True,map_location='cpu');gs=x['gs'];batch=x['batch'];offset=x['offset']
model=FLAMEModel(300,100,5.0,no_lmks=False).eval()
faces=model.faces_tensor[None]
helper=types.SimpleNamespace(flame_faces=faces,subdivider=SubdivideMeshes(Meshes(verts=model.v_template[None],faces=faces)))
nn=StyleUNetLight(in_size=512,in_dim=32,out_dim=3,out_size=512).eval()
nn.load_state_dict(torch.load(B.OUT/'neural-renderer.pt',weights_only=True))
view,_,_=build_camera_matrices(batch['t_transform'],12.,12.)

def native(exp,pose):
    with torch.inference_mode():
        verts,_=model(track['shapecode'][None],exp[None],pose[None],track['eyecode'][None],verts_offset=offset)
        return OMGAvatar.subdivide_mesh(helper,verts,2)[0]

base_native=norm(np.load(B.OUT/'native-states/neutral.npz')['head'])
native_start=meta['beardBinding']['nativeStart'];head_start=meta['headStart'];n=meta['headCount']
export_head=points[native_start:];original_count=len(base_native)
split_count=(len(export_head)-original_count)//3;keep_count=original_count-split_count
tree=cKDTree(base_native)
keep_error,keep_parent=tree.query(export_head[:keep_count])
child_groups=export_head[keep_count:].reshape(4,split_count,3)
child_error,child_parent=tree.query(child_groups.mean(axis=0))
assert max(keep_error.max(),child_error.max())<2e-7,'Native point order cannot be recovered exactly'
assert len(set(np.r_[keep_parent,child_parent]))==original_count
parents=np.r_[keep_parent,*([child_parent]*4)]
child_offsets=export_head-base_native[parents]
first_child={int(parent):int(i+native_start) for i,parent in reversed(list(enumerate(parents)))}

# Reconstruct all beard bindings using the same projected source-space anchors.
neutral_data=data.copy();uv,*_=project(neutral_data,cam,K,512)
native_data=data[:original_count].copy()
for k,name in enumerate(['x','y','z']):native_data[name]=base_native[:,k]
native_uv,*_=project(native_data,cam,K,512)
front=np.flatnonzero(base_native[:,2]>-.085)
distance,neighbors=cKDTree(native_uv[front]).query(uv[head_start:native_start],k=8)
neighbors=front[neighbors];binding=1/(distance**2+1);binding/=binding.sum(axis=1,keepdims=True)
beard_samples=[]
for j in np.linspace(0,native_start-head_start-1,7,dtype=int):
    beard_samples.append({'index':int(head_start+j),'drivers':[{'index':first_child[int(parent)],'weight':float(w)} for parent,w in zip(neighbors[j],binding[j])]})

def fit_control(jaw,width=1.,pucker=0.,lower_raise=0.,upper_raise=0.,closed=False,aperture=None,lower_retract=0.):
    pose=track['posecode'].clone();pose[3]+=jaw
    if closed:pose[3]=0
    with torch.inference_mode():
        _,p=model(track['shapecode'][None],track['expcode'][None],pose[None],track['eyecode'][None],verts_offset=offset)
        p=p[0].numpy()
        expressions=track['expcode'][None]+torch.eye(100)
        _,allp=model(track['shapecode'][None].expand(100,-1),expressions,pose[None].expand(100,-1),track['eyecode'][None].expand(100,-1),verts_offset=offset)
    J=(allp.numpy()-p).reshape(100,-1).T
    target=p.copy();center=(p[48,0]+p[54,0])*.5
    target[48:68,0]=center+(p[48:68,0]-center)*width
    target[48:68,2]+=pucker
    target[[49,50,51,52,53,61,62,63],1]+=upper_raise
    target[[55,56,57,58,59,65,66,67],1]+=lower_raise
    target[[55,56,57,58,59,65,66,67],2]-=lower_retract
    if aperture is not None:
        mid=(p[62,1]+p[66,1])*.5
        top=mid+aperture*.5;bottom=mid-aperture*.5
        target[[49,50,51,52,53,61,62,63],1]+=top-p[62,1]
        target[[55,56,57,58,59,65,66,67],1]+=bottom-p[66,1]
    if closed:
        for top,bottom in [(61,67),(62,66),(63,65)]:
            middle=(p[top]+p[bottom])*.5;target[top]=middle;target[bottom]=middle
    importance=np.ones((70,3))*3
    importance[17:48]=6;importance[48:68]=15
    A=J*importance.reshape(-1,1);b=((target-p)*importance).ravel()
    delta=np.linalg.solve(A.T@A+np.eye(100)*.00015,A.T@b).clip(-3.,3.)
    return track['expcode']+torch.tensor(delta,dtype=torch.float32),pose

# Explicit aperture and width targets prevent every sound degenerating into a
# smile. The baseline's inner lips overlap, so jaw rotation alone is insufficient.
controls={
 'speechAA':dict(jaw=.26,width=.94,aperture=.09),
 'speechEE':dict(jaw=.06,width=1.08,aperture=.028),
 'speechOO':dict(jaw=.19,width=.60,pucker=.035,aperture=.075),
 'speechUU':dict(jaw=.08,width=.50,pucker=.055,aperture=.032),
 'speechFF':dict(jaw=.045,width=.98,lower_raise=.012,upper_raise=.020,lower_retract=.018),
 'speechDD':dict(jaw=.085,width=.98,aperture=.035),
 'speechPP':dict(jaw=0,closed=True),
}
old=np.fromfile(PREVIOUS/'expressions.bin',dtype='<i2').reshape(len(meta['channels']),n,6)
report={};tiles=[]
# A soft boundary prevents speech from repainting hair, eyes, cheeks or clothes.
u,v=uv[:,0]/512,uv[:,1]/512
smooth=lambda x:np.clip(x,0,1)**2*(3-2*np.clip(x,0,1))
appearance=smooth((u-.34)/.045)*smooth((.67-u)/.045)*smooth((v-.565)/.035)*smooth((.755-v)/.05)
appearance[:native_start]=0
scales=np.array(meta['scales'])
with torch.inference_mode():
    _,baseline_landmarks=model(track['shapecode'][None],track['expcode'][None],track['posecode'][None],track['eyecode'][None],verts_offset=offset)
mouth_anchor_names={'left':48,'right':54,'upper':62,'lower':66}
mouth_anchors={name:first_child[int(tree.query(norm(baseline_landmarks[0].numpy())[index])[1])] for name,index in mouth_anchor_names.items()}
solver_fingerprint=hashlib.sha256(inspect.getsource(fit_control).encode()).hexdigest()

# FLAME has a lip boundary, but no opaque oral cavity. The neural image decoder
# can infer it; an RGB-only browser renderer instead exposes unrelated rear
# surfaces through that hole. Add a small recessed, curved 3D interior attached to the
# native upper/lower lip contours. It rotates and deforms with the head, not the
# screen. Its colours below are inferred by the same released neural decoder.
cu,cv=np.meshgrid(np.linspace(-1,1,56),np.linspace(0,1,28));cu=cu.ravel();cv=cv.ravel()
def cavity(landmarks):
    u=np.array([-1.,-.38,0.,.38,1.])
    upper=PchipInterpolator(u,landmarks[[60,61,62,63,64]],axis=0)(cu)
    lower=PchipInterpolator(u,landmarks[[60,67,66,65,64]],axis=0)(cu)
    mid=(upper[:,1]+lower[:,1])*.5
    gap=np.maximum(upper[:,1]-lower[:,1],.004*(1-cu**2))
    upper[:,1]=mid+gap*.5;lower[:,1]=mid-gap*.5
    surface=upper*(1-cv[:,None])+lower*cv[:,None]
    surface[:,2]-=.025+.035*(1-cu**2)*np.sin(np.pi*cv)
    return norm(surface)
baseline_lm=baseline_landmarks[0].numpy();cavity_base=cavity(baseline_lm)
cavity_start=len(data);cavity_count=len(cavity_base)
interior=np.zeros(cavity_count,dtype=data.dtype)
for k,key in enumerate(['x','y','z']):interior[key]=cavity_base[:,k]
for k in range(3):interior[f'scale_{k}']=np.log(.0008)
interior['rot_0']=1;interior['opacity']=np.log(.88/.12)
set_rgb(interior,np.tile([.075,.018,.026],(cavity_count,1)))
data=np.concatenate([data,interior]);points=xyz(data);base_colors=rgb(data)
appearance=np.r_[appearance,np.ones(cavity_count)]
active=np.flatnonzero(appearance>.001)
# Retain all existing expression fields and drive the added cavity by the
# exact same native surface correspondences for blink, hover and older poses.
landmark_native=tree.query(norm(baseline_lm))[1]
landmark_export=np.array([first_child[int(i)] for i in landmark_native])
old_extended=np.zeros((len(meta['channels']),n+cavity_count,6),dtype='<i2');old_extended[:,:n]=old
for c in range(len(meta['channels'])):
    displacement=old[c,landmark_export-head_start,:3]/32767*scales[:3]
    moved=baseline_lm+displacement@np.linalg.inv(linear).T
    old_extended[c,n:,:3]=np.round((cavity(moved)-cavity_base)/scales[:3]*32767).astype('<i2')
fields=[old_extended]

def fit_appearance(W,trans,target):
    # Include the actual white compositing background. Unbounded least squares
    # followed by clipping used to leave washed-out teeth and grey mouth bands.
    A=W[:,active].multiply(appearance[active][None,:]).tocsr()
    rows=np.flatnonzero(np.asarray(A.sum(axis=1)).ravel()>1e-6);A=A[rows].tocsr()
    initial=base_colors[active].astype('float64')
    fixed=(W@base_colors)[rows]-A@initial
    goal=target.reshape(-1,3)[rows]-trans.ravel()[rows,None]-fixed
    damp=.0015;L=float(np.max(np.asarray(A.T@np.asarray(A.sum(axis=1))).ravel()))+damp
    color=initial.copy();accelerated=color.copy();momentum=1.
    for _ in range(180):
        gradient=A.T@(A@accelerated-goal)+damp*(accelerated-initial)
        updated=np.clip(accelerated-gradient/L,0,1)
        next_momentum=(1+np.sqrt(1+4*momentum**2))*.5
        accelerated=updated+(momentum-1)/next_momentum*(updated-color)
        color=updated;momentum=next_momentum
    result=base_colors.copy();result[active]+=((color-initial)*appearance[active,None]).astype('float32')
    return result

for name,params in controls.items():
    cached=OUT/(name+'.npz')
    exp,pose=fit_control(**params)
    fingerprint=hashlib.sha256(json.dumps({'params':params,'solver':solver_fingerprint,'identity':meta['sourceSha256']},sort_keys=True).encode()).hexdigest()
    if cached.exists() and str(np.load(cached).get('fingerprint',''))==fingerprint:
        saved=np.load(cached);native_points=saved['head'];target_rgb=saved['rgb']
    else:
        log('Render native speech pose',pose=name)
        pts=native(exp,pose)
        state={k:v.clone() if k=='xyz' else v for k,v in gs.items()};state['xyz'][:,-pts.shape[1]:]=pts
        features,_=neural_features(state,view)
        with torch.inference_mode():target_rgb=nn(torch.from_numpy(features)[None])[0].clamp(0,1).permute(1,2,0).numpy()
        native_points=norm(pts[0].numpy())
        np.savez_compressed(cached,head=native_points,rgb=target_rgb,fingerprint=fingerprint)
    image(target_rgb,OUT/(name+'-neural.png'))
    posed=data.copy();positions=points.copy()
    positions[native_start:cavity_start]=native_points[parents]+child_offsets
    positions[head_start:native_start]+=np.sum((native_points-base_native)[neighbors]*binding[...,None],axis=1)
    with torch.inference_mode():
        _,landmarks=model(track['shapecode'][None],exp[None],pose[None],track['eyecode'][None],verts_offset=offset)
    positions[cavity_start:]=cavity(landmarks[0].numpy())
    for k,key in enumerate(['x','y','z']):posed[key]=positions[:,k]
    W,trans=weights(posed,cam,K,512)
    fitted=fit_appearance(W,trans,target_rgb)
    values=np.c_[positions[head_start:]-points[head_start:],fitted[head_start:]-base_colors[head_start:]]
    assert np.max(np.abs(values[:,:3]))<.05
    fields.append(np.round(np.clip(values/scales,-1,1)*32767).astype('<i2')[None])
    set_rgb(posed,fitted);rendered=render(posed,cam,K,512);image(rendered,OUT/(name+'.png'))
    tile=Image.fromarray((np.clip(rendered,0,1)*255).astype('uint8'));tiles.append((name,tile))
    report[name]={'jawRadiansFromSource':params['jaw'],'maxDisplacement':float(np.linalg.norm(values[:,:3],axis=1).max()),'appearanceSamples':int(len(active)),'expression':exp.tolist(),'pose':pose.tolist()}
    log('Baked speech pose',pose=name)

new=np.concatenate(fields,axis=0);new.tofile(OUT/'expressions.bin')
write(OUT/'portrait.ply',data)
attachment=np.r_[np.fromfile(BASE/'attachment.bin',dtype='<f4'),np.ones(cavity_count,dtype='<f4')].astype('<f4')
attachment.tofile(OUT/'attachment.bin')
for filename in ['portrait.ply','attachment.bin']:
    (OUT/(filename+'.gz')).write_bytes(gzip.compress((OUT/filename).read_bytes(),compresslevel=9,mtime=0))
    meta['downloadBytes'][filename]=(OUT/(filename+'.gz')).stat().st_size
meta['count']+=cavity_count;meta['headCount']+=cavity_count
meta['sourceSha256']=hashlib.sha256((OUT/'portrait.ply').read_bytes()).hexdigest()
meta['neckAttachment']['sha256']=hashlib.sha256(attachment.tobytes()).hexdigest()
(OUT/'expressions.bin.gz').write_bytes(gzip.compress(new.tobytes(),compresslevel=9,mtime=0))
meta['channels']+=list(controls)
meta['beardBinding']['channels']+=list(controls)
# Original seven sample bindings are retained; exact anchor reconstruction is
# checked below against them so existing regression checks remain meaningful.
for previous,reconstructed in zip(meta['beardBinding']['samples'],beard_samples):
    assert previous['index']==reconstructed['index']
    assert [p['index'] for p in previous['drivers']]==[p['index'] for p in reconstructed['drivers']]
    assert max(abs(a['weight']-b['weight']) for a,b in zip(previous['drivers'],reconstructed['drivers']))<1e-4
meta['downloadBytes']['expressions.bin']=(OUT/'expressions.bin.gz').stat().st_size
meta['speechRig']={'version':5,'channels':list(controls),'mouthAnchors':mouth_anchors,'controls':controls,'cavity':{'start':cavity_start,'count':cavity_count,'method':'Recessed curved 3D surface following native inner lip contours; inferred oral appearance'},'method':'FLAME lip aperture, width, protrusion and lip-teeth targets with mouth-local neural appearance; temporally filtered audio-driven coarticulation','appearanceRegion':'Lips and mouth interior only; hair/eyes/torso pigment fixed','source':'Owner-approved existing identity; no new anatomy capture'}
meta['limitations'][0]='Seventeen exported control bases including seven dedicated speech poses; not the complete offline model'
(OUT/'model.json').write_text(json.dumps(meta,indent=2))
(OUT/'build-report.json').write_text(json.dumps({'states':report,'seconds':time.time()-start},indent=2))
sheet=Image.new('RGB',(4*320,2*350),'#f4f2ee');draw=ImageDraw.Draw(sheet)
for i,(name,tile) in enumerate(tiles):
    px=(i%4)*320;py=(i//4)*350;sheet.paste(tile.resize((320,320)),(px,py));draw.text((px+12,py+327),name,fill='#252529')
sheet.save(OUT/'speech-poses.jpg',quality=94)
log('Speech rig staged',channels=len(meta['channels']),compressedMB=meta['downloadBytes']['expressions.bin']/1e6)
