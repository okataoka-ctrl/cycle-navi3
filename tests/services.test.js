import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchURL,searchResults,routeURL,routeResult,weatherURL,weatherAt,weatherLabel,windDirection,jsonRequest} from '../app/services.js';
test('search encodes Japanese and special characters as a query',()=>{
  const u=new URL(searchURL('千葉駅 & 南口'));assert.equal(u.searchParams.get('q'),'千葉駅 & 南口');
  const rows=searchResults({features:[{geometry:{coordinates:[140,35]},properties:{name:'駅',city:'千葉市'}},{geometry:{coordinates:[NaN,35]}}]});assert.equal(rows.length,1);assert.equal(rows[0].lat,35);assert.equal(rows[0].lon,140);
});
test('cycling route preserves start, intermediate, and destination order',()=>{
  const url=routeURL([{lat:35,lon:140},{lat:35.1,lon:140.1},{lat:35.2,lon:140.2}]);
  assert.ok(url.includes('/routed-bike/'));assert.ok(url.includes('140,35;140.1,35.1;140.2,35.2'));
  assert.throws(()=>routeURL([{lat:35,lon:140}]));
});
test('route failures never return a straight-line substitute',()=>{
  assert.throws(()=>routeResult({code:'NoRoute',routes:[]}));
  const r=routeResult({code:'Ok',routes:[{geometry:{coordinates:[[140,35],[140.1,35.1]]},distance:1200,duration:500}],waypoints:[]});
  assert.deepEqual(r.points,[{lat:35,lon:140},{lat:35.1,lon:140.1}]);
});
test('weather request uses meters per second, epoch timestamps, and all selected points',()=>{
  const u=new URL(weatherURL([{lat:35.123456,lon:140.23456},{lat:36,lon:141}]));
  assert.equal(u.searchParams.get('wind_speed_unit'),'ms');assert.equal(u.searchParams.get('timezone'),'Asia/Tokyo');assert.equal(u.searchParams.get('timeformat'),'unixtime');assert.equal(u.searchParams.get('latitude'),'35.1235,36.0000');
});
test('forecast selection handles missing values and does not invent current rain probability',()=>{
  const d={current:{weather_code:0,wind_speed_10m:null},hourly:{time:[100,200],temperature_2m:[12,null],precipitation_probability:[0,30]}};
  assert.equal(weatherAt(d).precipitation_probability,null);assert.equal(weatherAt(d,100).precipitation_probability,0);assert.equal(weatherAt(d,200).temperature_2m,null);assert.throws(()=>weatherAt(d,300));
  assert.equal(weatherLabel(null),'不明');assert.equal(weatherLabel(95),'雷雨');assert.equal(windDirection(360),'北');assert.equal(windDirection(90),'東');assert.equal(windDirection(null),'不明');
});
test('service HTTP failures and throttling are surfaced',async()=>{
  await assert.rejects(()=>jsonRequest('https://example.test',async()=>({ok:false,status:429})),/混み合/);
  await assert.rejects(()=>jsonRequest('https://example.test',async()=>({ok:false,status:503})),/503/);
  const r=await jsonRequest('https://example.test',async()=>({ok:true,json:async()=>({ok:true})}));assert.equal(r.ok,true);
});
