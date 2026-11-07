import {distance} from './nav.js';
import {jsonRequest,weatherURL,weatherAt} from './services.js';
export function createWind({request=p=>jsonRequest(weatherURL([p])),now=()=>Date.now(),onChange=()=>{}}={}){
  let state={sample:null,point:null,fetchedAt:0,loading:false,error:false},generation=0,lastAttempt=-Infinity,attemptPoint=null;
  function emit(){onChange({...state});}
  return {
    get state(){return {...state};},
    reset(){generation++;lastAttempt=-Infinity;attemptPoint=null;state={sample:null,point:null,fetchedAt:0,loading:false,error:false};emit();},
    async update(point,{online=true,visible=true}={}){
      if(!point||!online||!visible||state.loading)return;
      const elapsed=now()-lastAttempt,moved=attemptPoint?distance(attemptPoint,point):Infinity;
      if(elapsed<120000||(!state.error&&elapsed<600000&&moved<5000))return;
      lastAttempt=now();attemptPoint={lat:point.lat,lon:point.lon};const ticket=++generation,target={...attemptPoint};state.loading=true;emit();
      try{const data=await request(target);if(ticket!==generation)return;const sample=weatherAt(Array.isArray(data)?data[0]:data);if(!Number.isFinite(sample.wind_speed_10m)||sample.wind_speed_10m<0||!Number.isFinite(sample.time))throw Error('Missing wind');state={sample,point:target,fetchedAt:now(),loading:false,error:false};}
      catch{if(ticket!==generation)return;state={...state,loading:false,error:true};}
      emit();
    }
  };
}

export function windTarget(lastFix,start){return lastFix||start;}
export function freshWindFix(fix,{running,paused,now=Date.now()}){return !!fix&&running&&!paused&&now-fix.time>=0&&now-fix.time<20000;}
