import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVoice,turnVoice} from '../voice.js';
function setup(extra={}){
 const spoken=[],events=[],timers=new Map();let id=0,enabled=true,visible=true,time=0;
 const synth={getVoices:()=>[{lang:'en-US'},{lang:'ja-JP',name:'日本語'}],speak:u=>spoken.push(u),cancel(){},...extra.synth};
 class Utterance{constructor(text){this.text=text;}}
 const voice=createVoice({synth,Utterance,enabled:()=>enabled,visible:()=>visible,clock:()=>time,setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:key=>timers.delete(key),onState:(...e)=>events.push(e),...extra});
 return {voice,spoken,events,timers,set enabled(v){enabled=v;},set visible(v){visible=v;},set time(v){time=v;}};
}
test('Japanese voice, rate and volume are applied; no recognition API needed',()=>{
 const s=setup({settings:()=>({rate:0.8,volume:0.4})});assert.equal(s.voice.say('テスト'),true);
 assert.equal(s.spoken[0].lang,'ja-JP');assert.equal(s.spoken[0].voice.name,'日本語');assert.equal(s.spoken[0].rate,0.8);assert.equal(s.spoken[0].volume,0.4);
 s.spoken[0].onend();assert.equal(s.voice.busy,false);assert.equal(s.timers.size,0);
});
test('mute or background suppress announcements; cancel clears pending guidance',()=>{
 const s=setup();s.enabled=false;assert.equal(s.voice.say('消音'),false);s.enabled=true;s.visible=false;assert.equal(s.voice.say('非表示'),false);
 s.visible=true;s.voice.say('開始');s.voice.say('曲がり角');s.voice.cancel();s.spoken[0].onend();assert.equal(s.spoken.length,1);assert.equal(s.voice.busy,false);
});
test('important events interrupt old guidance and ignore late onend callbacks',()=>{
 const s=setup();s.voice.say('坂');s.voice.say('曲がり角');s.voice.say('逸脱',{interrupt:true,priority:4});
 assert.equal(s.spoken.length,2);assert.equal(s.spoken[1].text,'逸脱');s.spoken[0].onend();assert.equal(s.voice.busy,true);s.spoken[1].onend();assert.equal(s.voice.busy,false);
});
test('duplicates are suppressed but a new ride resets announcement history',()=>{
 const s=setup();assert.equal(s.voice.say('右',{key:'turn',cooldown:Infinity}),true);assert.equal(s.voice.say('右',{key:'turn',cooldown:Infinity}),false);
 s.voice.reset();assert.equal(s.voice.say('右',{key:'turn',cooldown:Infinity}),true);
});
test('queued guidance expires or becomes invalid after passing a turn',()=>{
 const s=setup();let valid=true;s.voice.say('開始');s.voice.say('右',{valid:()=>valid});valid=false;s.spoken[0].onend();assert.equal(s.spoken.length,1);
 s.voice.say('別の案内');s.voice.say('期限切れ',{maxAge:1000});s.time=1001;s.spoken[1].onend();assert.equal(s.spoken.length,2);
});
test('queue chooses turn guidance ahead of a climb and bounds pending messages',()=>{
 const s=setup();s.voice.say('開始');s.voice.say('坂',{priority:1});s.voice.say('右',{priority:2});s.voice.say('終点',{priority:3});assert.equal(s.voice.say('追加'),false);
 s.spoken[0].onend();assert.equal(s.spoken[1].text,'終点');s.spoken[1].onend();assert.equal(s.spoken[2].text,'右');
});
test('unsupported speech, synthesis errors and a silent timeout are reported',()=>{
 const unsupported=setup({synth:null});assert.equal(unsupported.voice.say('テスト'),false);assert.equal(unsupported.events.at(-1)[1],'unsupported');
 const s=setup();s.voice.say('テスト');s.spoken[0].onerror({error:'not-allowed'});assert.deepEqual(s.events.at(-1),['error','not-allowed']);assert.equal(s.voice.busy,false);
 s.voice.say('再試行');[...s.timers.values()][0]();assert.deepEqual(s.events.at(-1),['error','timeout']);
});
test('throwing utterance constructor reports failure without blocking later attempts',()=>{
 const s=setup({Utterance:class {constructor(){throw Error('unavailable');}}});s.voice.say('テスト');assert.equal(s.voice.busy,false);assert.equal(s.events.at(-1)[0],'error');
});
test('turn guidance has an early and near stage and ignores invalid or passed turns',()=>{
 assert.equal(turnVoice(150,8),'ahead');assert.equal(turnVoice(29,5),'near');assert.equal(turnVoice(301,20),null);assert.equal(turnVoice(5,5),null);assert.equal(turnVoice(NaN,5),null);
 assert.equal(turnVoice(100,null),'ahead');assert.equal(turnVoice(20,null),'near');
});

test('a discarded queued notice can be retried and only actual start calls onStart',()=>{
 const s=setup();let starts=0,valid=true;s.voice.say('前の案内');s.voice.say('坂',{key:'climb',cooldown:Infinity,valid:()=>valid,onStart:()=>starts++});
 assert.equal(starts,0);valid=false;s.spoken[0].onend();valid=true;assert.equal(s.voice.say('坂',{key:'climb',cooldown:Infinity,onStart:()=>starts++}),true);
 s.spoken[1].onstart();assert.equal(starts,1);
});
