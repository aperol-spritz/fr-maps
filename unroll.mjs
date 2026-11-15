// Reveal the existing window without scaling its map, text or saved geometry.
export const UNROLL_DURATION=1800;
export function unrollAtlas(element){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const rolls=['left','right'].map(side=>{
    const roll=document.createElement('span');roll.className='nw-unroll-roll';roll.dataset.side=side;roll.setAttribute('aria-hidden','true');element.append(roll);return roll;
  });
  element.classList.add('nw-unrolling');
  const timing={duration:UNROLL_DURATION,easing:'cubic-bezier(.35,.05,.25,1)',fill:'both'};
  const animations=[element.animate([
    {clipPath:'inset(0 46.8% 0 46.8%)',offset:0},
    {clipPath:'inset(0 46.8% 0 46.8%)',offset:.06},
    {clipPath:'inset(0 0% 0 0%)',offset:.88},
    {clipPath:'inset(0 0% 0 0%)',offset:1}
  ],timing),...rolls.map((roll,index)=>roll.animate([
    {left:index?'50%':'46.8%',transform:'scaleX(1)',opacity:1,offset:0},
    {left:index?'50%':'46.8%',transform:'scaleX(1)',opacity:1,offset:.06},
    {left:index?'96.8%':'0%',transform:'scaleX(.7)',opacity:1,offset:.88},
    {left:index?'96.8%':'0%',transform:'scaleX(.08)',opacity:0,offset:1}
  ],timing))];
  let stopped=false;
  function finish(){
    if(stopped)return;stopped=true;
    animations.forEach(animation=>animation.cancel());rolls.forEach(roll=>roll.remove());element.classList.remove('nw-unrolling');
    element.removeEventListener('close',finish);element.removeEventListener('pointerdown',finish,true);element.removeEventListener('keydown',finish,true);
  }
  // Closing early or interacting with an exposed control ends the reveal cleanly.
  element.addEventListener('close',finish,{once:true});element.addEventListener('pointerdown',finish,true);element.addEventListener('keydown',finish,true);
  Promise.all(animations.map(animation=>animation.finished)).then(finish,finish);
  return finish;
}
