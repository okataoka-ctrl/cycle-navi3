import {rotateOffset} from './navigation.js';
// The rider anchor and tile rotation must use exactly the same origin.
export function mapFrame(width,height,angle=0,lookAhead=false){
  const anchor={x:width/2,y:height*(lookAhead?2/3:1/2)};
  const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>rotateOffset(x-anchor.x,y-anchor.y,-angle));
  return {anchor,minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))};
}
export function windPresentation(wind,angle=0,heading=null){
  const speed=wind?.wind_speed_10m,source=wind?.wind_direction_10m;
  if(!Number.isFinite(speed)||speed<0)return {speed:'—',rotation:null,relative:''};
  if(speed<0.3)return {speed:speed.toFixed(1),rotation:null,relative:'ほぼ無風'};
  if(!Number.isFinite(source))return {speed:speed.toFixed(1),rotation:null,relative:'風向不明'};
  const delta=Number.isFinite(heading)?((source-heading+540)%360)-180:null;
  const relative=delta===null?'':Math.abs(delta)<=45?'向かい風':Math.abs(delta)>=135?'追い風':delta>0?'右からの横風':'左からの横風';
  return {speed:speed.toFixed(1),rotation:((source+180-angle)%360+360)%360,relative};
}
