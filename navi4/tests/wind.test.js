import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWind,windTarget,freshWindFix} from '../wind.js';
const point={lat:35.8,lon:140.1};
const response={current:{time:100,wind_speed_10m:5,wind_direction_10m:0}};
test('wind requests are suppressed offline, hidden, and without a point',async()=>{
  let count=0;const w=createWind({request:async()=>{count++;return response;}});
  await w.update(null);await w.update(point,{online:false});await w.update(point,{visible:false});assert.equal(count,0);
});
test('wind refresh respects two minutes, ten minutes, and five km movement',async()=>{
  let time=0,count=0;const w=createWind({now:()=>time,request:async()=>{count++;return response;}});
  await w.update(point);assert.equal(count,1);
  time=119999;await w.update({lat:36,lon:140.1});assert.equal(count,1);
  time=120000;await w.update({lat:36,lon:140.1});assert.equal(count,2);
  time=719999;await w.update({lat:36,lon:140.1});assert.equal(count,2);
  time=720000;await w.update({lat:36,lon:140.1});assert.equal(count,3);
});
test('one in-flight request; reset rejects old replies and allows new course wind',async()=>{
  const resolvers=[];const w=createWind({request:()=>new Promise(resolve=>resolvers.push(resolve))});
  const old=w.update(point);await w.update(point);assert.equal(resolvers.length,1);
  w.reset();const current=w.update({lat:36,lon:140});assert.equal(resolvers.length,2);
  resolvers[0](response);await old;assert.equal(w.state.sample,null);assert.equal(w.state.loading,true);
  resolvers[1](response);await current;assert.equal(w.state.point.lat,36);assert.equal(w.state.loading,false);
});
test('failed update preserves known sample, marks failure, then retries after minimum interval',async()=>{
  let time=0,fail=false;const w=createWind({now:()=>time,request:async()=>{if(fail)throw Error('offline');return response;}});
  await w.update(point);time=600000;fail=true;await w.update(point);assert.equal(w.state.error,true);assert.equal(w.state.sample.wind_speed_10m,5);
  time+=120000;fail=false;await w.update(point);assert.equal(w.state.error,false);
});
test('missing wind values fail closed instead of showing zero wind',async()=>{
  const w=createWind({request:async()=>({current:{time:100,wind_speed_10m:null}})});await w.update(point);assert.equal(w.state.error,true);assert.equal(w.state.sample,null);
});
test('GPS interruption or a pause retains last wind location; relative wind requires fresh GPS',()=>{
  const start={lat:35,lon:140},last={lat:36,lon:140,time:100000};
  assert.equal(windTarget(last,start),last);assert.equal(windTarget(null,start),start);
  assert.equal(freshWindFix(last,{running:true,paused:false,now:119999}),true);
  assert.equal(freshWindFix(last,{running:true,paused:false,now:120000}),false);
  assert.equal(freshWindFix(last,{running:true,paused:true,now:100001}),false);
  assert.equal(freshWindFix(last,{running:false,paused:false,now:100001}),false);
});
