import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const scope='https://example.test/cycle-navi/app/';
function worker(overrides={}){
  const listeners={};const context={URL,Request,self:{registration:{scope},location:{origin:'https://example.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({addAll:async()=>{}})},...overrides};
  vm.runInNewContext(readFileSync(new URL('../app/sw.js',import.meta.url),'utf8'),context);
  return listeners;
}
test('PWA updates fetch every shell asset with reload cache mode',async()=>{
  let requests,waiting;const listeners=worker({caches:{open:async()=>({addAll:async values=>requests=values})}});
  listeners.install({waitUntil:p=>waiting=p});await waiting;
  assert.ok(requests.length>10);assert.ok(requests.every(r=>r.cache==='reload'));assert.ok(requests.some(r=>r.url===scope+'navigation.js'));
});
test('map tiles are not intercepted or cached by the service worker',()=>{
  let intercepted=false;const listeners=worker();
  listeners.fetch({request:new Request('https://tile.openstreetmap.org/15/1/1.png'),respondWith:()=>intercepted=true});
  assert.equal(intercepted,false);
});
test('activation removes only old caches from this app scope',async()=>{
  const removed=[];let waiting;const prefix='cycle-navi:'+scope+':';
  const listeners=worker({caches:{keys:async()=>[prefix+'v3',prefix+'v4-final','cycle-navi:https://example.test/other/:v3'],delete:async key=>removed.push(key)}});
  listeners.activate({waitUntil:p=>waiting=p});await waiting;assert.deepEqual(removed,[prefix+'v3']);
});
