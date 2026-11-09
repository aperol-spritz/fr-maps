function inside(p,polygon){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d){return Math.max(a[0],b[0])>=Math.min(c[0],d[0]) && Math.max(c[0],d[0])>=Math.min(a[0],b[0]) && Math.max(a[1],b[1])>=Math.min(c[1],d[1]) && Math.max(c[1],d[1])>=Math.min(a[1],b[1]) && cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0;}
export function inViewport(place,stage,viewport){
  const s=stage.getBoundingClientRect(),v=viewport.getBoundingClientRect();if(!s.width || !s.height)return true;
  const x0=(v.left-s.left)/s.width*100,y0=(v.top-s.top)/s.height*100,x1=(v.left+viewport.clientWidth-s.left)/s.width*100,y1=(v.top+viewport.clientHeight-s.top)/s.height*100;
  const polygon=place.shape?.hidden?null:place.shape?.points;
  if(polygon?.length>=3){const box=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];return polygon.some(p=>p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1)||box.some(p=>inside(p,polygon))||polygon.some((p,i)=>box.some((b,j)=>intersects(p,polygon[(i+1)%polygon.length],b,box[(j+1)%4])));}
  const size=stage.querySelector('[data-place="'+place.id+'"]')?.offsetWidth || 0,dx=size/s.width*50,dy=size/s.height*50;
  return place.x+dx>=x0 && place.x-dx<=x1 && place.y+dy>=y0 && place.y-dy<=y1;
}
