"""Compress the generated full-height paintings and rebuild the menu previews.

This is only format/thumbnail preparation; the actual artwork is imagegen output.
"""
from pathlib import Path
from PIL import Image

assets=Path(__file__).resolve().parents[1]/'assets'
for name in ['milk-rooftops','milk-rain']:
    image=Image.open(assets/'source'/f'{name}-tall.png').convert('RGB')
    image.save(assets/f'{name}-tall.webp','WEBP',quality=80,method=6)
    width,height=image.size
    preview=image.crop((0,int(height*.37),width,int(height*.81)))
    preview.thumbnail((320,150),Image.Resampling.LANCZOS)
    preview.save(assets/f'{name}-thumb.webp','WEBP',quality=74,method=6)
    print(name,image.size,(assets/f'{name}-tall.webp').stat().st_size)
