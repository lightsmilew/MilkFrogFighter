"""Offline atlas packing and delivery compression. Does not redraw source art.
Requires Pillow and NumPy only for asset maintenance, never for deployment.
"""
from pathlib import Path
import json
import colorsys
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parent.parent
ASSETS=ROOT/'assets'
SOURCE=ROOT/'art/source'
OUT=ASSETS/'fighters'
OUT.mkdir(exist_ok=True)
IDS=['classic','green','red','purple','pink','blue']
COLORS=['edc973','b2c879','f47f6c','ba96d8','f6a6b8','8bc1f1']
HEIGHT=145.6
SIZE=192
BASELINE=186
WALK_FRAMES=[1,24,25,26,2,27,28,29]
RUN_FRAMES=[19,30,31,32,33,34]
REACTION_SLOTS=[8,35,36,37,38,39,40,41,42,9,43,44,10,45,46,47]
REACTION_FRAMES={'head':[8,35,36],'body':[37,38,39],'heavy':[40,41,42],'launch':[9,43],'trip':[44,10],'down':[10],'getup':[45,46,47]}
FRAME_COUNT=48

def isolate(image,cols,rows,index,anchor=.5,margin=.18):
    width,height=image.width//cols,image.height//rows
    padding=round(max(width,height)*margin)
    x,y=index%cols*width,index//cols*height
    tile=image.crop((x-padding,y-padding,x+width+padding,y+height+padding)).convert('RGBA')
    rgba=np.asarray(tile).copy()
    mask=rgba[:,:,3]>=48
    visited=np.zeros(mask.shape,dtype=bool)
    largest=[]
    for flat in np.flatnonzero(mask):
        yy,xx=divmod(int(flat),mask.shape[1])
        if visited[yy,xx]:continue
        stack=[(yy,xx)];visited[yy,xx]=True;component=[]
        while stack:
            cy,cx=stack.pop();component.append((cy,cx))
            for ny,nx in [(cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)]:
                if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx]=True;stack.append((ny,nx))
        if len(component)>len(largest):largest=component
    assert largest,'empty sprite'
    keep=np.zeros(mask.shape,dtype=np.uint8)
    points=np.asarray(largest);keep[points[:,0],points[:,1]]=255
    keep=np.asarray(Image.fromarray(keep).filter(ImageFilter.MaxFilter(5)))>0
    rgba[:,:,3][~keep]=0
    box=(max(0,int(points[:,1].min())-2),max(0,int(points[:,0].min())-2),min(tile.width,int(points[:,1].max())+3),min(tile.height,int(points[:,0].max())+3))
    cropped=Image.fromarray(rgba).crop(box)
    return cropped,width*anchor+padding-box[0],int(points[:,0].max()-points[:,0].min()+1)

base_image=Image.open(SOURCE/'milkfrog-sprites.png')
advanced_image=Image.open(SOURCE/'milkfrog-advanced.png')
styles_image=Image.open(SOURCE/'milkfrog-styles.png')
base=[isolate(base_image,4,3,i,a) for i,a in enumerate([.5,.5,.5,.5,.5,.42,.35,.5,.43,.45,.5,.52])]
advanced=[isolate(advanced_image,4,2,i,a) for i,a in enumerate([.5,.43,.34,.48,.48,.43,.35,.52])]

def skin_weights(rgb):
    red,green,blue=[rgb[:,:,i] for i in range(3)]
    saturation=(rgb.max(2)-rgb.min(2))/np.maximum(1,rgb.max(2))
    return np.clip((saturation-.23)/.12,0,1)*np.clip((red-blue-42)/23,0,1)*np.clip((red-green-6)/14,0,1)*(green>blue)

# Match the OLD animation skin to the NEW generated sheet, including yellow.
# Five material stops preserve shaded volume. Eye, ivory and glove pixels are
# excluded, rather than multiplying every yellow/brown pixel by a flat tint.
source_rgb=np.asarray(base[0][0])[:,:,:3].astype(float)
source_luma=source_rgb@np.array([.2126,.7152,.0722])
source_knots=np.quantile(source_luma[skin_weights(source_rgb)>.9],[.03,.25,.5,.75,.97])
palettes={}
for column,character in enumerate(IDS):
    sample=styles_image.crop((column*256,0,(column+1)*256,styles_image.height))
    rgba=np.asarray(sample);hsv=np.asarray(sample.convert('HSV')).astype(float)/255
    target=tuple(int(COLORS[column][i:i+2],16)/255 for i in (0,2,4))
    hue=colorsys.rgb_to_hsv(*target)[0]
    hue_diff=np.minimum(abs(hsv[:,:,0]-hue),1-abs(hsv[:,:,0]-hue))
    mask=(hue_diff<.045)&(hsv[:,:,1]>.25)&(hsv[:,:,2]>.32)&(rgba[:,:,3]>220)
    rgb=rgba[:,:,:3][mask].astype(float);luma=rgb@np.array([.2126,.7152,.0722])
    stops=np.quantile(luma,[.03,.25,.5,.75,.97]);palette=[]
    for value in stops:
        nearest=np.argsort(abs(luma-value))[:max(20,len(luma)//60)]
        palette.append(np.mean(rgb[nearest],axis=0))
    palettes[character]=np.asarray(palette)

def harmonize(image,character,knots=source_knots):
    rgba=np.asarray(image).copy();rgb=rgba[:,:,:3].astype(float)
    luma=rgb@np.array([.2126,.7152,.0722]);blend=skin_weights(rgb)*(rgba[:,:,3]>0)
    mapped=np.stack([np.interp(luma,knots,palettes[character][:,channel]) for channel in range(3)],axis=2)
    rgba[:,:,:3]=np.clip(rgb*(1-blend[:,:,None])+mapped*blend[:,:,None],0,255).astype('uint8')
    return Image.fromarray(rgba)

def gait_source(name,cols,rows,count):
    poses=[isolate(Image.open(SOURCE/name),cols,rows,i) for i in range(count)]
    pixels=np.concatenate([np.asarray(item[0])[:,:,:3].reshape(-1,3) for item in poses]).astype(float)
    luma=pixels@np.array([.2126,.7152,.0722])
    knots=np.quantile(luma[skin_weights(pixels.reshape(1,-1,3)).reshape(-1)>.9],[.03,.25,.5,.75,.97])
    return poses,knots,float(np.median([item[2] for item in poses]))

walk,walk_knots,walk_height=gait_source('milkfrog-walk.png',4,2,8)
run,run_knots,run_height=gait_source('milkfrog-run.png',3,2,6)
reaction_image=Image.open(SOURCE/'milkfrog-reactions.png')
reactions=[isolate(reaction_image,4,4,i,margin=.4) for i in range(16)]
reaction_pixels=np.concatenate([np.asarray(item[0])[:,:,:3].reshape(-1,3) for item in reactions]).astype(float)
reaction_luma=reaction_pixels@np.array([.2126,.7152,.0722])
reaction_knots=np.quantile(reaction_luma[skin_weights(reaction_pixels.reshape(1,-1,3)).reshape(-1)>.9],[.03,.25,.5,.75,.97])
reaction_height=float(np.median([reactions[i][2] for i in [0,1,2,6,7,8]]))

def prepare(image,anchor,reference_height,flight=0):
    factor=min((SIZE-12)/image.width,(SIZE-16)/image.height)
    target=image.resize((round(image.width*factor),round(image.height*factor)),Image.Resampling.LANCZOS)
    x=(SIZE-target.width)//2;y=BASELINE-target.height-flight
    return target,{'anchor':{'x':round((x+anchor*factor)/SIZE,6),'y':BASELINE/SIZE},
        'scale':round(HEIGHT/(reference_height*factor/SIZE*175),6),
        'bounds':{'left':x,'top':y,'right':x+target.width-1,'bottom':y+target.height-1,'width':target.width,'height':target.height}}

# Reuse the old logical movement slots instead of retaining duplicate sprites:
# 1/2 are now actual walk-cycle frames, and 19 is the first real sprint frame.
prepared={}
for column,character in enumerate(IDS):
    new=[isolate(styles_image,6,4,row*6+column) for row in range(4)]
    poses=[]
    for i,(image,anchor,_) in enumerate(base+advanced+new):
        reference=base[0][2] if i<12 else advanced[5][2] if i<20 else new[0][2]
        poses.append(prepare(harmonize(image,character) if i<20 else image,anchor,reference))
    poses.extend([None]*(FRAME_COUNT-len(poses)))
    for source,knots,height,slots in [(walk,walk_knots,walk_height,WALK_FRAMES),(run,run_knots,run_height,RUN_FRAMES)]:
        for phase,(slot,(image,_,_)) in enumerate(zip(slots,source)):
            head=np.asarray(image)[:max(1,round(image.height*.30)),:,3]
            columns=np.flatnonzero((head>128).any(axis=0));anchor=(columns.min()+columns.max())/2
            poses[slot]=prepare(harmonize(image,character,knots),anchor,height,8 if slots is RUN_FRAMES and phase in [2,5] else 0)
    for slot,(image,_,_) in zip(REACTION_SLOTS,reactions):
        alpha=np.asarray(image)[:,:,3];feet=alpha[round(image.height*.84):]>128
        columns=np.flatnonzero(feet.any(axis=0));anchor=(columns.min()+columns.max())/2
        poses[slot]=prepare(harmonize(image,character,reaction_knots),anchor,reaction_height)
    assert len(poses)==FRAME_COUNT and all(poses)
    prepared[character]=poses

# Pack only non-empty sprite rectangles, with a four-pixel transparent gutter.
# Shared slots retain identical rectangles and anchors for every skin.
boxes=[(max(prepared[c][i][0].width for c in IDS)+4,max(prepared[c][i][0].height for c in IDS)+4,i) for i in range(FRAME_COUNT)]
def layout(width):
    x=y=row_height=0;rects={}
    for w,h,i in sorted(boxes,key=lambda box:(-box[1],-box[0],box[2])):
        if x+w>width:x=0;y+=row_height;row_height=0
        rects[i]=(x+2,y+2);x+=w;row_height=max(row_height,h)
    return width,y+row_height,rects
atlas_width,atlas_height,positions=min((layout(width) for width in [768,896,1024,1152,1280]),key=lambda item:item[0]*item[1])
metadata={};portraits=Image.new('RGBA',(SIZE*6,SIZE),(0,0,0,0))
for column,character in enumerate(IDS):
    atlas=Image.new('RGBA',(atlas_width,atlas_height),(0,0,0,0));frames=[]
    for i,(image,data) in enumerate(prepared[character]):
        x,y=positions[i];atlas.alpha_composite(image,(x,y))
        frames.append({**data,'rect':{'x':x,'y':y,'w':image.width,'h':image.height}})
        if i==20:portraits.alpha_composite(image,(column*SIZE+data['bounds']['left'],data['bounds']['top']))
    atlas.save(OUT/f'{character}.webp','WEBP',quality=72,method=6,alpha_quality=90)
    metadata[character]=frames
portraits.save(OUT/'portraits.webp','WEBP',quality=74,method=6)
common=metadata['classic']
manifest='export const ATLAS_FRAME_SIZE='+str(SIZE)+';\nconst COMMON='+json.dumps(common,separators=(',',':'))+';\nexport const FRAME_DATA={classic:COMMON,'
manifest+=','.join(json.dumps(k)+':[...COMMON.slice(0,20),'+','.join(json.dumps(frame,separators=(',',':')) for frame in v[20:24])+',...COMMON.slice(24)]' for k,v in metadata.items() if k!='classic')+'};\n'
manifest+='export const ANIMATION_FRAMES='+json.dumps({'walk':WALK_FRAMES,'run':RUN_FRAMES,'reactions':REACTION_FRAMES},separators=(',',':'))+';\n'
(OUT/'frames.js').write_text(manifest,encoding='utf-8')
# Remove only known obsolete movement packs after all combined atlases succeed.
for character in IDS:
    for suffix in ['walk','run']:(OUT/f'{character}-{suffix}.webp').unlink(missing_ok=True)
print('Unified atlas:',atlas_width,atlas_height,FRAME_COUNT,'unique frames per character')

# The two obsolete short panoramas are no longer generated. Full-height art
# and the lobby are the only background delivery copies.
image=Image.open(SOURCE/'milk-street.png').convert('RGB')
image.thumbnail((768,432),Image.Resampling.LANCZOS)
image.save(ASSETS/'milk-lobby.webp','WEBP',quality=64,method=6)
for path in [*OUT.glob('*.webp'),ASSETS/'milk-lobby.webp']:
    print(path.relative_to(ROOT),path.stat().st_size)

if all((SOURCE/f'{name}-tall.png').exists() for name in ['milk-rooftops','milk-rain']):
    import runpy
    runpy.run_path(str(ROOT/'scripts'/'prepare-stages.py'))
