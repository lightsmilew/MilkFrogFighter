// Local previews use the verified public Pages address. Published forks and
// custom domains share their own current directory, without debug parameters.
export const PUBLIC_GAME_URL='https://lightsmilew.github.io/MilkFrogFighter/';
export function gameShareUrl(current){
  const url=new URL(current),host=url.hostname;
  if(host==='localhost'||host==='0.0.0.0'||host==='[::1]'||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.endsWith('.local'))return PUBLIC_GAME_URL;
  url.search='';url.hash='';url.pathname=url.pathname.replace(/index\.html$/,'');return url.href;
}

export async function shareGame(current,platform=navigator){
  const url=gameShareUrl(current),data={title:'奶蛙街头',text:'选只奶蛙，来街角切磋一局！',url};
  if(typeof platform.share==='function'){
    try{await platform.share(data);return {status:'shared',url};}
    catch(error){if(error.name==='AbortError')return {status:'cancelled',url};}
  }
  try{
    if(!platform.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await platform.clipboard.writeText(url);return {status:'copied',url};
  }catch{return {status:'manual',url};}
}
