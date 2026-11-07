import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapFrame,windPresentation} from '../viewport.js';
import {rotateOffset} from '../navigation.js';
test('heading-up rider is exactly two thirds down; inspection stays centered',()=>{
  for(const [w,h] of [[294,440],[390,523],[520,740],[320,180]]){
    const f=mapFrame(w,h,37,true);assert.equal(f.anchor.x,w/2);assert.ok(Math.abs(f.anchor.y-h*2/3)<1e-8);
    assert.equal(mapFrame(w,h,37,false).anchor.y,h/2);
  }
});
test('asymmetric rotated viewport bounds cover every corner and share the rider origin',()=>{
  for(const angle of [0,45,90,135,180,270,359]){
    const {anchor,minX,maxX,minY,maxY}=mapFrame(390,620,angle,true);
    for(const [x,y] of [[0,0],[390,0],[0,620],[390,620]]){
      const world=rotateOffset(x-anchor.x,y-anchor.y,-angle);
      assert.ok(world.x>=minX-1e-8&&world.x<=maxX+1e-8&&world.y>=minY-1e-8&&world.y<=maxY+1e-8);
      const screen=rotateOffset(world.x,world.y,angle);assert.ok(Math.abs(screen.x+anchor.x-x)<1e-8&&Math.abs(screen.y+anchor.y-y)<1e-8);
    }
  }
});
test('wind flow rotates with map while from-direction determines relative wind',()=>{
  const north={wind_speed_10m:5,wind_direction_10m:0};
  assert.deepEqual(windPresentation(north,0,0),{speed:'5.0',rotation:180,relative:'向かい風'});
  assert.deepEqual(windPresentation(north,90,90),{speed:'5.0',rotation:90,relative:'左からの横風'});
  assert.equal(windPresentation(north,180,180).relative,'追い風');
  assert.equal(windPresentation(north,270,270).relative,'右からの横風');
  assert.equal(windPresentation(north,0,null).relative,'');
});
test('calm and missing wind never imply a reliable arrow',()=>{
  assert.equal(windPresentation({wind_speed_10m:0,wind_direction_10m:270}).rotation,null);
  assert.equal(windPresentation({wind_speed_10m:3,wind_direction_10m:null}).relative,'風向不明');
  assert.equal(windPresentation({wind_speed_10m:null}).speed,'—');
  assert.equal(windPresentation({wind_speed_10m:-1}).speed,'—');
});
