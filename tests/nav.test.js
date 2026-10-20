import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance,prepare,locate,bends,toGPX} from '../app/nav.js';
test('distance uses meters and rejects malformed route coordinates',()=>{
  assert.ok(Math.abs(distance({lat:0,lon:0},{lat:0,lon:1})-111195)<2);
  assert.throws(()=>prepare([{lat:NaN,lon:0},{lat:0,lon:1}]));
  assert.throws(()=>prepare([{lat:0,lon:0}]));
});
test('progress projects onto segments rather than snapping to route points',()=>{
  const r=prepare([{lat:35,lon:140},{lat:35.01,lon:140}]);
  const m=locate({lat:35.005,lon:140.0001},r);
  assert.ok(m.distance<10);assert.ok(Math.abs(m.s-r.at(-1).s/2)<1);
});
test('overlapping out-and-back route retains outbound progress',()=>{
  const r=prepare([{lat:35,lon:140},{lat:35.01,lon:140},{lat:35,lon:140}]);
  const outbound=locate({lat:35.005,lon:140},r,500,0);
  assert.equal(outbound.index,0);
  const inbound=locate({lat:35.005,lon:140},r,1600,180);
  assert.equal(inbound.index,1);
});
test('crossing route does not skip to a later leg',()=>{
  const r=prepare([{lat:35,lon:140},{lat:35.01,lon:140.01},{lat:35,lon:140.01},{lat:35.01,lon:140}]);
  const m=locate({lat:35.005,lon:140.005},r,600,40);
  assert.equal(m.index,0);
});
test('right and left bends are distinguished; straight roads produce none',()=>{
  const right=bends(prepare([{lat:35,lon:140},{lat:35.001,lon:140},{lat:35.001,lon:140.002}]));
  assert.ok(right[0].turn>0);
  const left=bends(prepare([{lat:35,lon:140},{lat:35.001,lon:140},{lat:35.001,lon:139.998}]));
  assert.ok(left[0].turn<0);
  assert.equal(bends(prepare([{lat:35,lon:140},{lat:35.001,lon:140},{lat:35.002,lon:140}])).length,0);
});
test('export retains timestamps and coordinates',()=>{
  const text=toGPX([{lat:35,lon:140,time:0},{lat:35.001,lon:140.001,time:1700000000000}]);
  assert.ok(text.includes('lat="35.001"'));assert.ok(text.includes('2023-11-14T22:13:20.000Z'));
});
