export const rad = n => n * Math.PI / 180;
export function distance(a,b) {
  const x=rad(b.lat-a.lat), y=rad(b.lon-a.lon);
  const h=Math.sin(x/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(y/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function bearing(a,b) {
  const y=Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat));
  const x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon));
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
export function prepare(points) {
  if(points.length<2 || points.length>50000) throw Error('2〜50,000点のコースを指定してください。');
  if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)) throw Error('座標が不正、または対応範囲外です。');
  let total=0;
  return points.map((p,i)=>({...p,s:i?(total+=distance(points[i-1],p)):0}));
}
export function project(p,a,b) {
  const k=111194.9, c=Math.cos(rad(p.lat));
  const ax=(a.lon-p.lon)*k*c, ay=(a.lat-p.lat)*k;
  const dx=(b.lon-a.lon)*k*c, dy=(b.lat-a.lat)*k;
  const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  return {distance:Math.hypot(ax+t*dx,ay+t*dy),t};
}
export function locate(p,route,previous=null,heading=null) {
  let best=null;
  for(let i=0;i<route.length-1;i++) {
    const q=project(p,route[i],route[i+1]);
    const s=route[i].s+q.t*(route[i+1].s-route[i].s);
    // Continuity limits accidental jumps at crossings and overlapping return legs.
    const jump=previous===null?0:Math.max(0,Math.abs(s-previous)-120)*0.6;
    const diff=heading===null?0:Math.abs(((bearing(route[i],route[i+1])-heading+540)%360)-180);
    const score=q.distance+jump+diff/6;
    if(!best||score<best.score) best={...q,s,index:i,score};
  }
  return best;
}
export function bends(route) {
  const out=[];
  for(let i=1;i<route.length-1;i++) {
    let a=i-1,b=i+1;
    while(a>0&&route[i].s-route[a].s<25)a--;
    while(b<route.length-1&&route[b].s-route[i].s<25)b++;
    const turn=((bearing(route[i],route[b])-bearing(route[a],route[i])+540)%360)-180;
    if(Math.abs(turn)>=40 && (!out.length||route[i].s-out.at(-1).s>70)) out.push({s:route[i].s,turn});
  }
  return out;
}
export function toGPX(points) {
  return '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Cycle Navi" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Cycle Navi ride</name><trkseg>'+points.map(p=>`<trkpt lat="${Number(p.lat)}" lon="${Number(p.lon)}">${p.time?`<time>${new Date(p.time).toISOString()}</time>`:''}</trkpt>`).join('')+'</trkseg></trk></gpx>';
}
