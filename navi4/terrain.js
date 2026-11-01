export function interpolate(route,s){
  if(!route.length)throw Error('コースがありません。');
  s=Math.max(0,Math.min(route.at(-1).s,s));
  let lo=0,hi=route.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(route[mid].s<s)lo=mid+1;else hi=mid;}
  const b=route[lo],a=route[Math.max(0,lo-1)],t=(s-a.s)/(b.s-a.s||1);
  return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,s,ele:Number.isFinite(a.ele)&&Number.isFinite(b.ele)?a.ele+(b.ele-a.ele)*t:null};
}
export function sampleRoute(route,maxPoints=800){
  const total=route.at(-1)?.s;if(!Number.isFinite(total)||total<=0)throw Error('距離のあるコースを設定してください。');
  const steps=Math.min(maxPoints-1,Math.max(1,Math.ceil(total/100)));
  return Array.from({length:steps+1},(_,i)=>interpolate(route,total*i/steps));
}
export function elevationURL(points){if(!points.length||points.length>100)throw Error('標高取得は1回100地点までです。');const u=new URL('https://api.open-meteo.com/v1/elevation');u.search=new URLSearchParams({latitude:points.map(p=>p.lat.toFixed(5)).join(','),longitude:points.map(p=>p.lon.toFixed(5)).join(',')});return u.href;}
export function gradeColor(grade){return grade<=-2?'#4485c6':grade<2?'#279278':grade<5?'#a4b844':grade<8?'#db9337':'#ce5b4e';}
export function analyzeTerrain(samples){
  if(samples.length<2||samples.some(p=>!Number.isFinite(p.ele)))throw Error('標高が欠けているため解析できません。');
  // Median removes isolated spikes; averaging operates over distance, not GPX point density.
  const median=samples.map((p,i)=>{const v=samples.slice(Math.max(0,i-1),Math.min(samples.length,i+2)).map(q=>q.ele).sort((a,b)=>a-b);return v.length===3?v[1]:p.ele;});
  const spacing=samples.at(-1).s/(samples.length-1),radius=Math.max(100,spacing);
  const profile=samples.map((p,i)=>{let sum=0,weight=0;for(let j=Math.max(0,i-2);j<=Math.min(samples.length-1,i+2);j++){const d=Math.abs(samples[j].s-p.s);if(d<=radius+0.01){const w=d<1?2:1;sum+=median[j]*w;weight+=w;}}return {...p,ele:sum/weight};});
  const window=Math.max(200,spacing*2);
  for(const p of profile){const a=interpolate(profile,p.s-window/2),b=interpolate(profile,p.s+window/2);p.grade=(b.ele-a.ele)/(b.s-a.s||1)*100;}
  let ascent=0,descent=0,anchor=profile[0].ele;for(const p of profile){const d=p.ele-anchor;if(Math.abs(d)>=3){if(d>0)ascent+=d;else descent-=d;anchor=p.ele;}}
  const climbs=[];let begin=0,peak=0;
  function finish(end){const a=profile[begin],b=profile[end],length=b.s-a.s,rise=b.ele-a.ele;let gain=0,reference=a.ele;for(const q of profile.slice(begin+1,end+1)){const d=q.ele-reference;if(Math.abs(d)>=3){if(d>0)gain+=d;reference=q.ele;}}if(b.ele>reference)gain+=b.ele-reference;
    if(length>0&&rise>0&&((length>=300&&gain>=15)||gain>=50))climbs.push({start:a.s,end:b.s,length,gain,rise,average:rise/length*100,max:Math.max(...profile.slice(begin,end+1).map(p=>p.grade)),point:a});}
  for(let i=1;i<profile.length;i++){
    if(profile[i].ele>profile[peak].ele+0.2)peak=i;
    if(profile[i].ele<profile[begin].ele&&peak===begin){begin=i;peak=i;continue;}
    const drop=profile[peak].ele-profile[i].ele,flat=profile[i].s-profile[peak].s;
    if(drop>=8||flat>=300){finish(peak);begin=i;peak=i;}
  }
  finish(peak);
  return {profile,ascent,descent,climbs,maxGrade:Math.max(0,...profile.map(p=>p.grade)),window,spacing};
}
