import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpolate,sampleRoute,elevationURL,analyzeTerrain,gradeColor} from '../terrain.js';
test('resampling uses route distance, retains endpoints, and bounds API load',()=>{
  const route=[{lat:35,lon:140,s:0,ele:0},{lat:36,lon:141,s:200000,ele:100}];
  const p=sampleRoute(route);assert.equal(p.length,800);assert.equal(p[0].s,0);assert.equal(p.at(-1).s,200000);assert.equal(p.at(-1).ele,100);
  assert.deepEqual(interpolate(route,100000),{lat:35.5,lon:140.5,s:100000,ele:50});assert.throws(()=>sampleRoute([{s:0}]));
});
test('five percent ascent is detected and gains stay close to ground truth',()=>{
  const samples=Array.from({length:21},(_,i)=>({lat:35+i/1000,lon:140,s:i*100,ele:i*5}));
  const t=analyzeTerrain(samples);assert.ok(Math.abs(t.maxGrade-5)<0.01);assert.ok(t.ascent>90&&t.ascent<101);assert.equal(t.descent,0);assert.equal(t.climbs.length,1);assert.ok(Math.abs(t.climbs[0].average-5)<0.3);
});
test('level ground and descending courses do not create climbs',()=>{
  const flat=Array.from({length:20},(_,i)=>({lat:35,lon:140,s:i*100,ele:10}));assert.equal(analyzeTerrain(flat).climbs.length,0);assert.equal(analyzeTerrain(flat).ascent,0);
  const down=flat.map((p,i)=>({...p,ele:100-i*5}));assert.equal(analyzeTerrain(down).climbs.length,0);assert.equal(analyzeTerrain(down).ascent,0);assert.ok(analyzeTerrain(down).descent>80);
});
test('isolated altitude spikes are removed and missing values fail closed',()=>{
  const points=Array.from({length:15},(_,i)=>({lat:35,lon:140,s:i*100,ele:i===7?200:10}));assert.equal(analyzeTerrain(points).climbs.length,0);assert.equal(analyzeTerrain(points).maxGrade,0);
  assert.throws(()=>analyzeTerrain([{s:0,ele:10},{s:100,ele:null}]));
});
test('elevation request limits points and gradient colors preserve signs',()=>{
  assert.throws(()=>elevationURL(Array.from({length:101},()=>({lat:35,lon:140}))));
  const u=new URL(elevationURL([{lat:35,lon:140}]));assert.equal(u.searchParams.get('latitude'),'35.00000');assert.equal(gradeColor(-5),'#4485c6');assert.equal(gradeColor(9),'#ce5b4e');
});
test('long gentle climbs are detected even below two percent',()=>{
  const samples=Array.from({length:61},(_,i)=>({lat:35+i/10000,lon:140,s:i*100,ele:i}));
  const t=analyzeTerrain(samples);assert.equal(t.climbs.length,1);assert.ok(t.climbs[0].gain>=50);assert.ok(t.climbs[0].average<2);
});
test('a small descending interruption is kept inside one climb',()=>{
  const samples=Array.from({length:30},(_,i)=>({lat:35+i/10000,lon:140,s:i*100,ele:i<=15?i*5:i===16?72:72+(i-16)*5}));
  const t=analyzeTerrain(samples);assert.equal(t.climbs.length,1);assert.ok(t.climbs[0].gain>=100);
});
test('a short steep climb still qualifies when ascent exceeds 50m',()=>{
  const samples=[0,100,200].map(s=>({lat:35,lon:140,s,ele:s/2}));
  const t=analyzeTerrain(samples);assert.equal(t.climbs.length,1);assert.ok(t.climbs[0].length<300);assert.ok(t.climbs[0].gain>=50);
});
