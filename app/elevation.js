import {sampleRoute,elevationURL,analyzeTerrain,gradeColor,interpolate} from './terrain.js';
import {jsonRequest} from './services.js';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
export function mountElevation({getRoute,onChange,onInspect,onPersist}){
  let terrain=null,source='',version=0,busy=false,selected=0,progress=null;
  function updateNumbers(){
    $('ascent').textContent=terrain?Math.round(terrain.ascent)+' m':'—';$('descent').textContent=terrain?Math.round(terrain.descent)+' m':'—';$('max-grade').textContent=terrain?terrain.maxGrade.toFixed(1)+' %':'—';
    $('terrain-now').textContent=terrain&&progress!==null?`${nearest(progress).grade.toFixed(1)} %（コース推定）`:'ナビ開始後に表示';
  }
  function nearest(s){return terrain.profile.reduce((a,b)=>Math.abs(b.s-s)<Math.abs(a.s-s)?b:a);}
  function chart(){const svg=$('elevation-chart');svg.replaceChildren();if(!terrain)return;const p=terrain.profile,w=800,h=220,left=48,right=18,top=18,bottom=32,total=p.at(-1).s,min=Math.floor(Math.min(...p.map(q=>q.ele))/10)*10,max=Math.max(min+20,Math.ceil(Math.max(...p.map(q=>q.ele))/10)*10);
    const x=s=>left+s/total*(w-left-right),y=e=>h-bottom-(e-min)/(max-min)*(h-top-bottom);
    function shape(name,attrs){const e=document.createElementNS(svgNS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));svg.append(e);return e;}
    for(let i=0;i<4;i++){const e=min+(max-min)*i/3;shape('line',{x1:left,y1:y(e),x2:w-right,y2:y(e),stroke:'#e0e7dc'});shape('text',{x:4,y:y(e)+4,fill:'#6a7f70','font-size':12}).textContent=Math.round(e)+'m';}
    const area=`M ${x(0)} ${y(min)} `+p.map(q=>`L ${x(q.s)} ${y(q.ele)}`).join(' ')+` L ${x(total)} ${y(min)} Z`;shape('path',{d:area,fill:'#e7eedb'});
    for(let i=1;i<p.length;i++)shape('line',{x1:x(p[i-1].s),y1:y(p[i-1].ele),x2:x(p[i].s),y2:y(p[i].ele),stroke:gradeColor(p[i].grade),'stroke-width':3});
    for(let i=0;i<=4;i++)shape('text',{x:x(total*i/4),y:h-6,'text-anchor':i===0?'start':i===4?'end':'middle',fill:'#6a7f70','font-size':12}).textContent=(total*i/4/1000).toFixed(1)+'km';
    const q=nearest(selected);shape('line',{x1:x(q.s),y1:top,x2:x(q.s),y2:h-bottom,stroke:'#173e37','stroke-dasharray':'4 4'});shape('circle',{cx:x(q.s),cy:y(q.ele),r:5,fill:'#173e37'});
    if(progress!==null)shape('circle',{cx:x(Math.min(total,progress)),cy:y(nearest(progress).ele),r:6,fill:'#4076ce',stroke:'#fff','stroke-width':2});
    $('terrain-detail').textContent=`出発から ${(q.s/1000).toFixed(2)} km · 標高 約${Math.round(q.ele)} m · 勾配 ${q.grade>=0?'+':''}${q.grade.toFixed(1)} %（約${Math.round(terrain.window)}m区間の推定）`;
  }
  function render(){updateNumbers();chart();const list=$('climb-list');list.replaceChildren();if(!terrain){$('terrain-detail').textContent='コース作成後に標高を取得すると、坂の位置を確認できます。';return;}
    if(!terrain.climbs.length){list.append(text('p','判定条件を満たす登り坂はありません。短い坂や細かな起伏は含まれない場合があります。'));return;}
    terrain.climbs.forEach((c,i)=>{const b=text('button',`登り ${i+1} ｜ ${(c.start/1000).toFixed(1)}〜${(c.end/1000).toFixed(1)} km ｜ 距離 ${(c.length/1000).toFixed(2)} km ｜ 平均 ${c.average.toFixed(1)}% ｜ ＋${Math.round(c.gain)} m`);b.type='button';b.onclick=()=>{select(c.start);};list.append(b);});
  }
  function select(s){selected=s;$('terrain-position').value=String(Math.round(s));chart();const p=nearest(s);onInspect(p);}
  $('terrain-position').oninput=e=>{if(terrain)select(Number(e.target.value));};
  $('refresh-elevation').onclick=async()=>{
    if(busy)return;const route=getRoute();if(!route.length){$('elevation-status').textContent='先にコースを作成、またはGPXを読み込んでください。';return;}
    const currentVersion=version;busy=true;$('refresh-elevation').disabled=true;$('elevation-status').textContent='コースの標高を取得しています…';
    try{const samples=sampleRoute(route);const fromGPX=route.every(p=>Number.isFinite(p.ele));if(!fromGPX){for(let i=0;i<samples.length;i+=100){const part=samples.slice(i,i+100),data=await jsonRequest(elevationURL(part));if(currentVersion!==version)return;if(!Array.isArray(data.elevation)||data.elevation.length!==part.length||data.elevation.some(e=>!Number.isFinite(e)))throw Error('標高データが欠けています。');part.forEach((p,j)=>p.ele=data.elevation[j]);$('elevation-status').textContent=`標高取得 ${Math.min(i+100,samples.length)} / ${samples.length}点`;}}
      if(currentVersion!==version)return;terrain=analyzeTerrain(samples);source=fromGPX?'GPX標高':'Open-Meteo / Copernicus DEM';selected=0;$('terrain-position').max=String(Math.ceil(samples.at(-1).s));$('terrain-position').value='0';$('terrain-position').disabled=false;
      $('elevation-status').textContent=`${source} · ${samples.length}点・約${Math.round(terrain.spacing)}m間隔で解析。勾配は約${Math.round(terrain.window)}m区間から推定。`;
      render();onChange(terrain);onPersist({terrain,source});
    }catch(e){if(currentVersion===version){$('elevation-status').textContent=`標高を取得できませんでした。${e.message}${terrain?' 以前の解析を表示しています。':''}`;}}finally{busy=false;$('refresh-elevation').disabled=false;}
  };
  return {reset(saved=null){version++;terrain=saved?.terrain||null;source=saved?.source||'';selected=0;progress=null;$('terrain-position').disabled=!terrain;if(terrain){$('terrain-position').max=String(Math.ceil(terrain.profile.at(-1).s));$('elevation-status').textContent=`保存済みの${source}。約${Math.round(terrain.window)}m区間の勾配推定。`;}else $('elevation-status').textContent='標高を取得すると、地図とグラフを勾配で色分けします。';render();onChange(terrain);},progress(s){progress=s;updateNumbers();if(terrain)chart();}};
}
