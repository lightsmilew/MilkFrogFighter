const paths={
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m9 5 10 7-10 7Z"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5m0 8v5h-5M8 21H3v-5"/>',
  collapse:'<path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7"/>',
};
export function setScreenIcon(button,icon,label){
  if(button.dataset.icon!==icon){button.dataset.icon=icon;button.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[icon]}</svg>`;}
  button.setAttribute('aria-label',label);button.title=label;
}
