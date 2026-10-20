import {WORLD} from './config.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function createCamera(){return {x:WORLD.spawnX-WORLD.width/2,y:0,scale:1};}

/** A shared camera leaves HUD coordinates fixed and keeps both fighters visible. */
export function updateCamera(camera,fighters,dt,snap=false){
  const left=Math.min(...fighters.map(f=>f.x))-135,right=Math.max(...fighters.map(f=>f.x))+135;
  const top=Math.min(...fighters.map(f=>f.y))-WORLD.standHeight-50;
  const bottom=Math.max(...fighters.map(f=>f.y))+12;
  // Reserve real screen pixels for the HUD, head tags and bottom controls.
  const safeTop=140,safeBottom=WORLD.height-75;
  const scale=clamp(Math.min(1,WORLD.width/(right-left),(safeBottom-safeTop)/(bottom-top)),.35,1);
  const viewW=WORLD.width/scale,viewH=WORLD.height/scale;
  const targetX=clamp((left+right)/2-viewW/2,0,Math.max(0,WORLD.arenaWidth-viewW));
  const targetY=Math.min(0,(top+bottom)/2-(safeTop+safeBottom)/2/scale);
  const blend=snap?1:1-Math.exp(-dt*7);
  // Zooming out responds promptly so a second jump cannot outrun the frame.
  camera.scale+=(scale-camera.scale)*(scale<camera.scale?Math.min(1,blend*2):blend);
  camera.scale=Math.min(camera.scale,scale);
  camera.x+=(targetX-camera.x)*blend;camera.y+=(targetY-camera.y)*blend;
  // Smooth following is bounded by the currently visible fighters so fast
  // second jumps or throws never hide a head behind the fixed HUD.
  camera.y=clamp(camera.y,bottom-safeBottom/camera.scale,top-safeTop/camera.scale);
  const actualViewW=WORLD.width/camera.scale;
  camera.x=clamp(camera.x,Math.max(0,right-actualViewW),Math.max(0,Math.min(left,WORLD.arenaWidth-actualViewW)));
  return camera;
}
