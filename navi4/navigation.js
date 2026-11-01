import {distance,locate,prepare,bearing} from './nav.js';
import {interpolate} from './terrain.js';
export function smoothHeading(previous,next,alpha=0.35){
  if(!Number.isFinite(next))return previous;
  if(!Number.isFinite(previous))return (next+360)%360;
  return (previous+(((next-previous+540)%360)-180)*alpha+360)%360;
}
export function rotateOffset(x,y,heading){const a=-heading*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};}
export function movementHeading(previous,current,gpsHeading,speed){
  if(speed>=1.5&&Number.isFinite(gpsHeading))return (gpsHeading+360)%360;
  if(previous&&current.time>previous.time&&current.time-previous.time<20000&&distance(previous,current)>=10&&current.accuracy<=30)return bearing(previous,current);
  return null;
}
export function createStops(route,points,indices){return points.slice(1).map((point,i)=>{const index=indices[i+1];if(!route[index])throw Error('中継地点と経路が一致しません。');return {point:{...point},snap:route[index],s:route[index].s,visited:false};});}
export function visitStops(stops,point,progress){
  const next=stops.find(s=>!s.visited);if(!next||!Number.isFinite(progress))return;
  if(Math.abs(progress-next.s)<=100&&distance(point,next.snap)<=Math.max(60,point.accuracy*2))next.visited=true;
}
export function reroutePlan(point,route,progress,plan,heading){
  const preferCycleways=plan?.preferCycleways!==false;
  if(plan?.stops?.length){const remaining=plan.stops.filter(s=>!s.visited).map(s=>s.point);if(!remaining.length)return null;return {points:[point,...remaining],options:{preferCycleways,heading},kind:'planned'};}
  const m=locate(point,route,progress,heading),ahead=Math.max(300,Math.min(2000,m.distance*1.2));
  const s=Math.min(route.at(-1).s,(progress??m.s)+ahead),join=interpolate(route,s);
  return {points:[point,join],options:{preferCycleways,heading},kind:'gpx',join,tail:route.filter(p=>p.s>s)};
}
export function assembleReroute(data,plan){
  if(plan.kind==='planned'){const route=prepare(data.points);return {route,plan:{preferCycleways:plan.options.preferCycleways,stops:createStops(route,plan.points,data.stopIndices)}};}
  if(distance(data.points.at(-1),plan.join)>35)throw Error('元のコースへ接続できません。停車して確認してください。');
  return {route:prepare([...data.points,...plan.tail]),plan:{preferCycleways:plan.options.preferCycleways,stops:[]}};
}
export function createRerouter({request,getState,apply,report,clock=()=>Date.now()}){
  let busy=false,lastAttempt=-Infinity,generation=0;
  return {get busy(){return busy;},cancel(){generation++;},async consider(){
    const s=getState(),now=clock();
    if(busy||!s.active||!s.online||!s.offRoute||s.offFor<8000||s.point.accuracy>35||now-lastAttempt<60000)return false;
    const target=reroutePlan(s.point,s.route,s.progress,s.plan,s.heading);if(!target)return false;
    busy=true;lastAttempt=now;const token=generation;report('リルート中…');
    try{const data=await request(target.points,target.options),latest=getState();
      if(token!==generation||latest.revision!==s.revision||!latest.active||!latest.offRoute||latest.point.accuracy>35||clock()-latest.point.time>20000)return false;
      if(distance(latest.point,s.point)>200)throw Error('取得中に現在地が移動しました。次の更新を待っています。');
      const result=assembleReroute(data,target);if(distance(latest.point,result.route[0])>200)throw Error('現在地から経路へ接続できません。');
      apply(result);report('リルートしました。未通過の経由地・コースを維持します。');return true;
    }catch(e){if(token===generation&&getState().revision===s.revision&&getState().active)report(`リルートできません：${e.message} 元のコースを表示し、60秒以上あけて再試行します。`);return false;}
    finally{busy=false;}
  }};
}
export function climbGuidance(climbs,progress,speed,announced=new Set()){
  if(!Number.isFinite(progress))return null;
  const climb=climbs.find(c=>c.gain>=50&&c.end>progress&&c.start-progress<=2000);if(!climb)return null;
  const ahead=climb.start-progress,id=`${climb.start.toFixed(1)}:${climb.end.toFixed(1)}`;
  const description=`獲得標高 約${Math.round(climb.gain)}m・距離 ${(climb.length/1000).toFixed(2)}km`;
  return {id,climb,ahead,description,due:!announced.has(id)&&ahead>=-30&&ahead<=Math.max(300,(speed||0)*30),text:ahead>0?`約${Math.round(ahead)}m先から登り坂。${description}`:`登り坂の途中です。${description}`,spoken:`まもなく登り坂です。獲得標高は約${Math.round(climb.gain)}メートル、距離は${(climb.length/1000).toFixed(1)}キロメートルです。`};
}
