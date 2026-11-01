import {distance} from './nav.js';
export const SERVICES={search:'https://photon.komoot.io/api/',route:'https://valhalla1.openstreetmap.de/route',weather:'https://api.open-meteo.com/v1/forecast'};
export async function jsonRequest(url,fetcher=fetch,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{const r=await fetcher(url,{...options,signal:controller.signal});if(!r.ok)throw Error(r.status===429?'混み合っています。時間をおいて再度お試しください。':`取得に失敗しました（HTTP ${r.status}）。`);return await r.json();}
  catch(e){if(e.name==='AbortError')throw Error('通信がタイムアウトしました。再度お試しください。');throw e;}finally{clearTimeout(timer);}
}
export function coordinate(value){return value&&Number.isFinite(value.lat)&&Number.isFinite(value.lon)&&Math.abs(value.lat)<=85&&Math.abs(value.lon)<=180;}
export function searchURL(query){const u=new URL(SERVICES.search);u.search=new URLSearchParams({q:query,limit:'6'});return u.href;}
export function searchResults(data){return (data.features||[]).filter(f=>Array.isArray(f.geometry?.coordinates)).map(f=>{const p=f.properties||{},[lon,lat]=f.geometry.coordinates;return {lat,lon,name:p.name||p.street||'名称なし',address:[p.country,p.state,p.city,p.district,p.street,p.housenumber].filter(Boolean).join(' ')};}).filter(coordinate);}
export function routeURL(points,{preferCycleways=true,heading=null}={}){
  if(points.length<2||points.length>7||!points.every(coordinate))throw Error('出発地点・到着地点を設定してください。');
  const locations=points.map(p=>({lat:p.lat,lon:p.lon,type:'break'}));
  if(Number.isFinite(heading)){locations[0].heading=(heading+360)%360;locations[0].heading_tolerance=90;}
  const payload={locations,costing:'bicycle',costing_options:{bicycle:{bicycle_type:'road',use_roads:preferCycleways?0:0.5,avoid_bad_surfaces:0.9,steps_factor:1000,use_hills:0.5}},units:'kilometers',shape_format:'polyline6'};
  return SERVICES.route+'?json='+encodeURIComponent(JSON.stringify(payload));
}
export function decodePolyline(encoded){
  if(typeof encoded!=='string'||!encoded.length)throw Error('経路形状がありません。');
  let i=0,lat=0,lon=0;const points=[];
  function delta(){let value=0,shift=0,b;do{if(i>=encoded.length||shift>30)throw Error('経路形状を読み取れません。');b=encoded.charCodeAt(i++)-63;if(b<0||b>63)throw Error('不正な経路形状です。');value+=(b&31)*2**shift;shift+=5;}while(b>=32);return value%2?-(value+1)/2:value/2;}
  while(i<encoded.length){lat+=delta();lon+=delta();const p={lat:lat/1e6,lon:lon/1e6};if(!coordinate(p)||points.length>=50000)throw Error('経路が不正、または長すぎます。');points.push(p);}return points;
}
export function routeResult(data,requested=[]){
  const trip=data.trip;if(trip?.status!==0||!trip.legs?.length)throw Error(data.error||'自転車用の経路が見つかりません。地点を変更してください。');
  const points=[],stopIndices=[0];
  for(const leg of trip.legs){const shape=decodePolyline(leg.shape);if(shape.length<2)throw Error('経路形状が不足しています。');if(points.length&&distance(points.at(-1),shape[0])>5)throw Error('経路の区間がつながっていません。');points.push(...(points.length?shape.slice(1):shape));stopIndices.push(points.length-1);}
  if(points.length>50000)throw Error('経路が長すぎます。');
  const waypoints=stopIndices.map((index,i)=>({...points[index],distance:requested[i]?distance(requested[i],points[index]):0}));
  return {points,stopIndices,waypoints,distance:trip.summary.length*1000,duration:trip.summary.time};
}
let routingBusy=false,lastRouteRequest=-Infinity;
export async function requestRoute(points,options={}){
  if(routingBusy||Date.now()-lastRouteRequest<1500)throw Error('経路取得中です。少し待って再度お試しください。');
  routingBusy=true;lastRouteRequest=Date.now();
  try{return routeResult(await jsonRequest(routeURL(points,options),fetch,{headers:{'X-Client-Id':'okataoka-ctrl.github.io/cycle-navi3'}}),points);}finally{routingBusy=false;}
}
export function getCurrentPoint(geolocation=globalThis.navigator?.geolocation){
  return new Promise((resolve,reject)=>{if(!geolocation){reject(Error('現在地を利用できません。HTTPSと位置情報の設定を確認してください。'));return;}
    geolocation.getCurrentPosition(p=>{if(!Number.isFinite(p.coords.accuracy)||p.coords.accuracy>100){reject(Error('現在地の精度が低いため設定できません。屋外で再度お試しください。'));return;}resolve({lat:p.coords.latitude,lon:p.coords.longitude,name:'現在地',accuracy:p.coords.accuracy,capturedAt:p.timestamp});},e=>reject(Error(e.code===1?'位置情報が許可されていません。ブラウザの設定を確認してください。':e.code===3?'現在地の取得がタイムアウトしました。':'現在地を取得できません。屋外で再度お試しください。')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  });
}
export function weatherURL(points){if(!points.length||!points.every(coordinate))throw Error('天気を確認する地点を設定してください。');const u=new URL(SERVICES.weather);u.search=new URLSearchParams({latitude:points.map(p=>p.lat.toFixed(4)).join(','),longitude:points.map(p=>p.lon.toFixed(4)).join(','),current:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',hourly:'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'ms',timezone:'Asia/Tokyo',timeformat:'unixtime',forecast_days:'2'});return u.href;}
export function weatherLabel(code){if(!Number.isFinite(code))return '不明';if(code===0)return '快晴';if(code<=3)return ['','晴れ','薄曇り','曇り'][code];if([45,48].includes(code))return '霧';if(code>=51&&code<=57)return '霧雨';if(code>=61&&code<=67)return '雨';if(code>=71&&code<=77)return '雪';if(code>=80&&code<=82)return 'にわか雨';if([85,86].includes(code))return 'にわか雪';if(code>=95)return '雷雨';return '不明';}
export function windDirection(degrees){if(!Number.isFinite(degrees))return '不明';return ['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'][Math.round(((degrees%360)+360)%360/22.5)%16];}
export function weatherAt(data,time=null){if(time===null){if(!data.current)throw Error('現在の気象データがありません。');return {...data.current,precipitation_probability:null};}const i=data.hourly?.time?.indexOf(time)??-1;if(i<0)throw Error('指定時刻の予報がありません。');return Object.fromEntries(['time','temperature_2m','weather_code','precipitation_probability','wind_speed_10m','wind_direction_10m','wind_gusts_10m'].map(k=>[k,data.hourly[k]?.[i]??null]));}
