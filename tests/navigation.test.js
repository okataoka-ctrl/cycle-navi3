import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from '../app/nav.js';
import {smoothHeading,rotateOffset,movementHeading,createStops,visitStops,reroutePlan,assembleReroute,createRerouter,climbGuidance} from '../app/navigation.js';
const route=()=>prepare([{lat:0,lon:0},{lat:0.01,lon:0},{lat:0.02,lon:0}]);
function state(){const r=route();return {active:true,online:true,offRoute:true,offFor:9000,point:{lat:0.002,lon:0.001,accuracy:8,time:100000},route:r,progress:200,heading:0,revision:1,plan:{preferCycleways:true,stops:createStops(r,r,[0,1,2])}};}
const response=points=>({points:points.map(p=>({lat:p.lat,lon:p.lon})),stopIndices:points.map((_,i)=>i)});
test('heading crosses north smoothly and east-up rotation sends east to top',()=>{
  const h=smoothHeading(359,1);assert.ok(h>359&&h<360);const q=rotateOffset(100,0,90);assert.ok(Math.abs(q.x)<1e-9);assert.equal(q.y,-100);
  const original=rotateOffset(q.x,q.y,-90);assert.ok(Math.abs(original.x-100)<1e-9);assert.ok(Math.abs(original.y)<1e-9);
  assert.equal(movementHeading(null,{time:10,accuracy:5},null,0),null);
  assert.equal(movementHeading(null,{time:10,accuracy:5},90,5),90);
});
test('passing a stop requires both route progress and proximity, in order',()=>{
  const s=state();visitStops(s.plan.stops,{...s.route[2],accuracy:5},s.route[2].s);assert.equal(s.plan.stops[0].visited,false);
  visitStops(s.plan.stops,{...s.route[1],accuracy:5},s.route[1].s);assert.equal(s.plan.stops[0].visited,true);assert.equal(s.plan.stops[1].visited,false);
  const plan=reroutePlan(s.point,s.route,s.progress,s.plan,90);assert.equal(plan.points.length,2);assert.equal(plan.points[1].lat,0.02);assert.equal(plan.options.preferCycleways,true);
});
test('GPX rerouting rejoins ahead and retains the original tail',()=>{
  const s=state(),p=reroutePlan(s.point,s.route,200,{stops:[],preferCycleways:true},0);assert.equal(p.kind,'gpx');assert.ok(p.join.s>200);
  const result=assembleReroute(response(p.points),p);assert.equal(result.route.at(-1).lat,s.route.at(-1).lat);
  assert.throws(()=>assembleReroute({points:[s.point,{lat:1,lon:1}]},p),/接続/);
});
test('short deviations, poor GPS, offline, and paused navigation do not request routes',async()=>{
  for(const patch of [{offFor:7000},{point:{accuracy:80}},{online:false},{active:false},{offRoute:false}]){
    const s={...state(),...patch};let calls=0;const c=createRerouter({getState:()=>s,request:async()=>{calls++;},apply:()=>{},report:()=>{},clock:()=>100000});
    assert.equal(await c.consider(),false);assert.equal(calls,0);
  }
});
test('confirmed deviation applies one route, retains pending stops, and throttles retries',async()=>{
  const s=state();let count=0,applied=null;const c=createRerouter({getState:()=>s,request:async points=>{count++;assert.equal(points.length,3);return response(points);},apply:r=>applied=r,report:()=>{},clock:()=>100000});
  assert.equal(await c.consider(),true);assert.equal(applied.plan.stops.length,2);assert.equal(applied.plan.stops[0].point.lat,0.01);assert.equal(await c.consider(),false);assert.equal(count,1);
});
test('a failed reroute preserves the original route and does not retry immediately',async()=>{
  const s=state();let applied=0,message='';const c=createRerouter({getState:()=>s,request:async()=>{throw Error('圏外');},apply:()=>applied++,report:s=>message=s,clock:()=>100000});
  assert.equal(await c.consider(),false);assert.equal(applied,0);assert.match(message,/元のコース/);assert.equal(await c.consider(),false);
});
test('late results are ignored after cancellation, return to course, pause, or route replacement',async()=>{
  for(const reason of ['cancel','course','pause','revision']){
    const s=state();let resolve,applied=0;const wait=new Promise(r=>resolve=r);const c=createRerouter({getState:()=>({...s}),request:()=>wait,apply:()=>applied++,report:()=>{},clock:()=>100000});
    const pending=c.consider();assert.equal(c.busy,true);assert.equal(await c.consider(),false);
    if(reason==='cancel')c.cancel();if(reason==='course')s.offRoute=false;if(reason==='pause')s.active=false;if(reason==='revision')s.revision++;
    resolve(response([s.point,...s.plan.stops.map(x=>x.point)]));assert.equal(await pending,false);assert.equal(applied,0);
  }
});
test('climbs of at least 50m are announced before start once, including distance and gain',()=>{
  const c={start:1000,end:3000,length:2000,gain:60},seen=new Set();const notice=climbGuidance([c],750,5,seen);assert.equal(notice.due,true);assert.match(notice.spoken,/60メートル/);assert.match(notice.spoken,/2.0キロ/);seen.add(notice.id);assert.equal(climbGuidance([c],800,5,seen).due,false);
  assert.equal(climbGuidance([{...c,gain:49}],750,5),null);assert.equal(climbGuidance([c],3100,5),null);assert.equal(climbGuidance([c],1100,5).due,false);
});
