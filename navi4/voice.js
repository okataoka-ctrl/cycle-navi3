// Speech is output-only: no microphone or speech recognition is used.
export function createVoice({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,enabled=()=>true,visible=()=>true,settings=()=>({}),clock=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}={}){
  let current=null,queue=[],generation=0,timer=null;const recent=new Map();
  const available=!!synth&&typeof synth.speak==='function'&&typeof Utterance==='function';
  function cancel(){generation++;if(current?._key!==undefined&&current._key!==null)recent.delete(current._key);for(const q of queue)if(q.key!==null)recent.delete(q.key);current=null;queue=[];if(timer!==null)clearTimer(timer);timer=null;try{synth?.cancel();}catch{}onState('idle');}
  function pump(){
    if(current)return;
    if(!enabled()||!visible()){queue=[];return;}
    const now=clock();queue=queue.filter(q=>{const keep=now-q.created<=q.maxAge&&q.valid();if(!keep&&q.key!==null)recent.delete(q.key);return keep;});
    queue.sort((a,b)=>b.priority-a.priority||a.created-b.created);const item=queue.shift();if(!item)return;
    const token=++generation;let u;
    function finish(error){if(token!==generation||current!==u)return;if(timer!==null)clearTimer(timer);timer=null;current=null;
      if(error){if(item.key!==null)recent.delete(item.key);for(const q of queue)if(q.key!==null)recent.delete(q.key);generation++;queue=[];try{synth.cancel();}catch{}onState('error',error);return;}
      onState('idle');pump();
    }
    try{
      u=new Utterance(item.text);u.lang='ja-JP';const prefs=settings();u.rate=[0.8,1,1.2].includes(Number(prefs.rate))?Number(prefs.rate):1;u.volume=Math.max(0.1,Math.min(1,Number(prefs.volume)||1));
      const voices=synth.getVoices?.()||[];u.voice=voices.find(v=>/^ja(-|_)/i.test(v.lang))||voices.find(v=>/^ja/i.test(v.lang))||null;
      u._key=item.key;u.onstart=()=>{if(token===generation&&current===u)item.onStart();};u.onend=()=>finish();u.onerror=e=>finish(e.error||'synthesis-failed');current=u;
      if(synth.paused)synth.resume();
      timer=setTimer(()=>finish('timeout'),30000);synth.speak(u);if(current===u)onState('speaking',item.text);
    }catch{if(current===u)finish('synthesis-unavailable');else{queue=[];onState('error','synthesis-unavailable');}}
  }
  return {available,get busy(){return !!current;},cancel,reset(){cancel();recent.clear();},
    say(text,{key=null,priority=1,interrupt=false,cooldown=30000,maxAge=10000,valid=()=>true,onStart=()=>{}}={}){
      if(!enabled()||!visible()||!text||!valid())return false;
      if(!available){onState('error','unsupported');return false;}
      const now=clock();if(key!==null&&recent.has(key)&&now-recent.get(key)<cooldown)return false;
      if(interrupt)cancel();
      if(queue.length>=3)return false;
      if(key!==null){recent.set(key,now);if(recent.size>1500)recent.delete(recent.keys().next().value);}
      queue.push({text,key,priority,maxAge,valid,onStart,created:now});pump();return true;
    }
  };
}
export function turnVoice(distance,speed){
  if(!Number.isFinite(distance)||distance<=8)return null;
  const v=Number.isFinite(speed)&&speed>0?speed:0;
  if(distance<=Math.min(80,Math.max(25,v*6)))return 'near';
  if(distance<=Math.min(300,Math.max(120,v*20)))return 'ahead';
  return null;
}
