/** Keep the principal connected silhouette inside a sprite cell. Atlas gutters
 * can contain a neighbor's toes; a rectangle crop alone does not isolate it. */
export function isolateSilhouette(data, width, height) {
  const labels=new Int32Array(width*height),queue=new Int32Array(width*height);
  let label=0,best=0,bestSize=0;
  for(let start=0;start<labels.length;start++){
    if(labels[start]||data[start*4+3]<48)continue;
    label++;let head=0,tail=1;queue[0]=start;labels[start]=label;
    while(head<tail){
      const p=queue[head++],x=p%width,y=Math.floor(p/width);
      for(const next of [x>0?p-1:-1,x<width-1?p+1:-1,y>0?p-width:-1,y<height-1?p+width:-1]){
        if(next>=0&&!labels[next]&&data[next*4+3]>=48){labels[next]=label;queue[tail++]=next;}
      }
    }
    if(tail>bestSize){bestSize=tail;best=label;}
  }
  const keep=new Uint8Array(labels.length);
  let left=width,top=height,right=0,bottom=0;
  for(let p=0;p<labels.length;p++)if(best&&labels[p]===best){
    const x=p%width,y=Math.floor(p/width);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    // Two pixels retain the antialiased transparent fringe of this component.
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)keep[(y+dy)*width+x+dx]=1;
    }
  }
  for(let p=0;p<labels.length;p++)if(!keep[p])data[p*4+3]=0;
  return {left:bestSize?left:0,top:bestSize?top:0,right,bottom,width:bestSize?right-left+1:0,height:bestSize?bottom-top+1:0,pixels:bestSize};
}

export function extractFrames(image, columns, rows, anchors) {
  const width=Math.floor(image.width/columns),height=Math.floor(image.height/rows);
  const padding=Math.round(Math.max(width,height)*.18);
  return Array.from({length:columns*rows},(_,i)=>{
    const canvas=document.createElement('canvas');canvas.width=width+padding*2;canvas.height=height+padding*2;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    // Read a little past cell edges before segmenting: extended fists and KO
    // feet can cross a nominal grid line without belonging to the next sprite.
    ctx.drawImage(image,padding-i%columns*width,padding-Math.floor(i/columns)*height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),bounds=isolateSilhouette(pixels.data,canvas.width,canvas.height);
    ctx.putImageData(pixels,0,0);
    return {canvas,bounds,anchor:{x:((anchors[i]??.5)*width+padding)/canvas.width,y:(bounds.bottom+1)/canvas.height}};
  });
}
