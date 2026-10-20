/** Native fullscreen where available; fixed visual-viewport immersion otherwise.
 * iPhone and embedded browsers may omit or reject arbitrary-element fullscreen. */
export class FullscreenController {
  constructor(element,onChange=()=>{}){
    this.element=element;this.onChange=onChange;this.pseudo=false;this.scrollY=0;
    this.resize=()=>{
      if(!this.pseudo)return;
      const viewport=window.visualViewport;
      element.style.setProperty('--immersive-width',`${viewport?.width||innerWidth}px`);
      element.style.setProperty('--immersive-height',`${viewport?.height||innerHeight}px`);
      element.style.setProperty('--immersive-top',`${viewport?.offsetTop||0}px`);
      element.style.setProperty('--immersive-left',`${viewport?.offsetLeft||0}px`);
    };
    this.changed=()=>{if(this.native&&this.pseudo)this.exitPseudo();this.onChange(this.active);};
    document.addEventListener('fullscreenchange',this.changed);
    document.addEventListener('webkitfullscreenchange',this.changed);
    window.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('resize',this.resize);window.visualViewport?.addEventListener('scroll',this.resize);
  }
  get native(){return document.fullscreenElement||document.webkitFullscreenElement;}
  get active(){return Boolean(this.native||this.pseudo);}
  async toggle(){
    if(this.active){await this.exit();return;}
    const request=this.element.requestFullscreen||this.element.webkitRequestFullscreen;
    try{
      if(!request)throw new Error('Fullscreen API unavailable');
      await request.call(this.element);
      if(!this.native)this.enterPseudo();
    }catch{this.enterPseudo();}
    this.onChange(this.active);
  }
  enterPseudo(){
    if(this.pseudo)return;
    this.pseudo=true;this.scrollY=window.scrollY;
    this.previousBody={position:document.body.style.position,top:document.body.style.top,width:document.body.style.width,overflow:document.body.style.overflow};
    Object.assign(document.body.style,{position:'fixed',top:`-${this.scrollY}px`,width:'100%',overflow:'hidden'});
    document.body.classList.add('immersive-active');this.element.classList.add('is-immersive');this.resize();
  }
  exitPseudo(){
    if(!this.pseudo)return;
    this.pseudo=false;Object.assign(document.body.style,this.previousBody);
    document.body.classList.remove('immersive-active');this.element.classList.remove('is-immersive');
    window.scrollTo(0,this.scrollY);
  }
  async exit(){
    if(this.pseudo)this.exitPseudo();
    if(this.native){const exit=document.exitFullscreen||document.webkitExitFullscreen;try{await exit?.call(document);}catch{/* Keep the in-page exit control available. */}}
    this.onChange(this.active);
  }
}
