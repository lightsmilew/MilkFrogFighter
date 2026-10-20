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
OUT=ASSETS/'fighters'
OUT.mkdir(exist_ok=True)
IDS=['classic','green','red','purple','pink','blue']
COLORS=['edc973','b2c879','f47f6c','ba96d8','f6a6b8','8bc1f1']
HEIGHT=145.6
SIZE=256

def isolate(image,cols,rows,index,anchor=.5):
    width,height=image.width//cols,image.height//rows
    padding=round(max(width,height)*.18)
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

base_image=Image.open(ASSETS/'source/milkfrog-sprites.png')
advanced_image=Image.open(ASSETS/'source/milkfrog-advanced.png')
styles_image=Image.open(ASSETS/'source/milkfrog-styles.png')
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

def harmonize(image,character):
    rgba=np.asarray(image).copy();rgb=rgba[:,:,:3].astype(float)
    luma=rgb@np.array([.2126,.7152,.0722]);blend=skin_weights(rgb)*(rgba[:,:,3]>0)
    mapped=np.stack([np.interp(luma,source_knots,palettes[character][:,channel]) for channel in range(3)],axis=2)
    rgba[:,:,:3]=np.clip(rgb*(1-blend[:,:,None])+mapped*blend[:,:,None],0,255).astype('uint8')
    return Image.fromarray(rgba)

metadata={}
for column,character in enumerate(IDS):
    new=[isolate(styles_image,6,4,row*6+column) for row in range(4)]
    poses=base+advanced+new
    atlas=Image.new('RGBA',(SIZE*8,SIZE*3),(0,0,0,0))
    frames=[]
    for i,(image,anchor,body_height) in enumerate(poses):
        if i<20:image=harmonize(image,character)
        factor=min(240/image.width,232/image.height)
        target=image.resize((round(image.width*factor),round(image.height*factor)),Image.Resampling.LANCZOS)
        x=(SIZE-target.width)//2;y=248-target.height
        atlas.alpha_composite(target,(i%8*SIZE+x,i//8*SIZE+y))
        reference_height=base[0][2] if i<12 else advanced[5][2] if i<20 else new[0][2]
        frames.append({'anchor':{'x':round((x+anchor*factor)/SIZE,6),'y':248/SIZE},
            'scale':round(HEIGHT/(reference_height*factor/SIZE*175),6),
            'bounds':{'left':x,'top':y,'right':x+target.width-1,'bottom':247,'width':target.width,'height':target.height}})
    atlas.save(OUT/f'{character}.webp','WEBP',quality=72,method=6,alpha_quality=90)
    metadata[character]=frames
common=metadata['classic'][:20]
manifest='const COMMON='+json.dumps(common,separators=(',',':'))+';\nexport const FRAME_DATA={'
manifest+=','.join(json.dumps(k)+':[...COMMON,'+','.join(json.dumps(frame,separators=(',',':')) for frame in v[20:])+']' for k,v in metadata.items())+'};\n'
(OUT/'frames.js').write_text(manifest,encoding='utf-8')
portraits=Image.new('RGBA',(192*6,192),(0,0,0,0))
for column,character in enumerate(IDS):
    atlas=Image.open(OUT/f'{character}.webp')
    portrait=atlas.crop((4*SIZE,2*SIZE,5*SIZE,3*SIZE)).resize((192,192),Image.Resampling.LANCZOS)
    portraits.alpha_composite(portrait,(column*192,0))
portraits.save(OUT/'portraits.webp','WEBP',quality=74,method=6)

# Preserve full panorama dimensions; compress delivery copies and use tiny map
# thumbnails instead of downloading both panoramas for the selection buttons.
for name in ['milk-rooftops','milk-rain']:
    image=Image.open(ASSETS/'source'/f'{name}.png').convert('RGB')
    image.save(ASSETS/f'{name}.webp','WEBP',quality=62,method=6)
    image.thumbnail((384,154),Image.Resampling.LANCZOS)
    image.save(ASSETS/f'{name}-thumb.webp','WEBP',quality=64,method=6)
image=Image.open(ASSETS/'source/milk-street.png').convert('RGB')
image.thumbnail((768,432),Image.Resampling.LANCZOS)
image.save(ASSETS/'milk-lobby.webp','WEBP',quality=64,method=6)
for path in [*OUT.glob('*.webp'),*ASSETS.glob('*thumb.webp'),ASSETS/'milk-lobby.webp',ASSETS/'milk-rooftops.webp',ASSETS/'milk-rain.webp']:
    print(path.relative_to(ROOT),path.stat().st_size)
