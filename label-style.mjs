export const labelDefaults={color:'#362817',background:'#fff1d1',border:'#8c734f',backgroundOpacity:.85};
export function applyLabelStyle(element,options={}) {
  const color=key=>/^#[\da-f]{6}$/i.test(options[key] ?? '')?options[key]:labelDefaults[key];
  const background=color('background'),alpha=Number.isFinite(options.backgroundOpacity)?Math.max(0,Math.min(1,options.backgroundOpacity)):labelDefaults.backgroundOpacity;
  element.style.color=color('color');element.style.borderColor=color('border');
  element.style.backgroundColor='rgba('+[1,3,5].map(start=>parseInt(background.slice(start,start+2),16)).join(',')+','+alpha+')';
  element.style.setProperty('--nw-region-label-size',Math.max(10,Math.min(36,Number(options.size)||16))+'px');
}
