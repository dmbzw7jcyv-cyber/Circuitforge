// Functional top-view SVG component diagrams, not manufacturing pinouts.
import {catalog} from './model.js?v=cf2';
const rect=(x,y,w,h,fill,rx=2,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const text=(x,y,t,size=10,fill='#e5eeeb')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="ui-monospace,monospace" text-anchor="middle">${t}</text>`;
function chip(x,y,w,h,label){let s='';for(let i=5;i<h-2;i+=7)s+=rect(x-5,y+i,5,3,'#9eabb0')+rect(x+w,y+i,5,3,'#9eabb0');return s+rect(x,y,w,h,'#192024',3,'stroke="#454e53"')+circle(x+6,y+6,2,'#6d7578')+text(x+w/2,y+h/2+4,label,8,'#929e9f')}
function usb(x,y,w=32,h=25){return rect(x,y,w,h,'url(#metal)',3,'stroke="#d5dce0"')+rect(x+5,y+4,w-10,h-10,'#333b40',2)+rect(x+8,y+7,w-16,h-16,'#161b21',1)+rect(x+8,y+h-5,w-16,3,'#858f94',0)}
export const appearanceDefs=`<linearGradient id="metal" x2="0" y2="1"><stop stop-color="#e9eef0"/><stop offset=".4" stop-color="#9ca9b0"/><stop offset=".6" stop-color="#dfe5e8"/><stop offset="1" stop-color="#79858d"/></linearGradient><radialGradient id="led-red" cx=".35" cy=".25"><stop stop-color="#ffaaa4"/><stop offset=".35" stop-color="#e3413d"/><stop offset="1" stop-color="#751a22"/></radialGradient><radialGradient id="led-lit" cx=".35" cy=".25"><stop stop-color="#fff2c7"/><stop offset=".35" stop-color="#ff6651"/><stop offset="1" stop-color="#ed272c"/></radialGradient>`;
export function dimensions(c){if(c.type==='uno')return {w:220,h:265};if(c.type==='nano')return {w:156,h:278};if(c.type.startsWith('pico'))return {w:166,h:310};if(c.type==='breadboard')return {w:225,h:160};return {w:155,h:c.type==='pot'?146:120}}
export function pinPoint(c,pin){const d=dimensions(c),pins=catalog[c.type].pins,i=pins.indexOf(pin),half=Math.ceil(pins.length/2);let x,y,left=true,label;
 if(c.type==='breadboard'){const n=Number(pin)-1;x=34+(n%5)*25;y=53+Math.floor(n/5)*15+(n>=15?16:0);label=false}
 else if(catalog[c.type].board){left=i<half;x=left?10:d.w-10;y=64+(i%half)*16}
 else if(c.type==='led'){x=i===0?54:102;y=108;left=i===0}
 else if(c.type==='resistor'){x=i===0?7:148;y=69;left=i===0}
 else if(c.type==='button'){x=i===0?25:130;y=80;left=i===0}
 else {x=38+i*40;y=d.h-13;left=i===0}
 return {x:c.x+x,y:c.y+y,left,label,labelX:label===false?0:c.type==='led'||['pot','sensor'].includes(c.type)?c.x+x:c.x+x+(left?13:-13),labelY:c.y+y+(c.type==='led'||['pot','sensor'].includes(c.type)?17:4),anchor:c.type==='led'||['pot','sensor'].includes(c.type)?'middle':left?'start':'end'}
}
export function renderHardware(c,{brightness=0,pressed=false}={}){const d=dimensions(c);let s='';
 if(catalog[c.type].board){const uno=c.type==='uno',nano=c.type==='nano',fill=uno?'#147b89':nano?'#226895':'#25855c';s+=rect(0,32,d.w,d.h-32,fill,uno?12:5,'stroke="#80a99b" stroke-width="1.5"');
 for(const [x,y]of [[24,45],[d.w-24,45],[24,d.h-12],[d.w-24,d.h-12]])s+=circle(x,y,5,'#c6b878')+circle(x,y,2.5,'#152128');
 // Copper traces and header housings remain behind the interactive contacts.
 for(let y=90;y<d.h-40;y+=27)s+=`<path d="M 26 ${y} H 48 L 60 ${y+12} H ${d.w-35}" stroke="#b4d3b2" stroke-opacity=".13" fill="none"/>`;
 const half=Math.ceil(catalog[c.type].pins.length/2);for(const x of [2,d.w-18])s+=rect(x,55,16,half*16+2,'#182729',2);
 s+=usb(uno?28:d.w/2-16,31,uno?40:32,uno?40:27);
 if(uno){s+=rect(30,85,29,42,'#202c32',4)+circle(44,88,9,'#333d40')+circle(44,88,5,'#11191f');s+=chip(94,131,40,90,'328P');s+=chip(88,69,28,26,'USB');s+=rect(46,157,18,37,'url(#metal)',9)+rect(45,172,20,3,'#505c64');s+=text(155,105,'UNO',22)+text(155,120,'DIGITAL LAB',7)}
 else {s+=chip(d.w/2-23,nano?127:133,46,46,nano?'328P':c.type==='pico2'?'RP2350':'RP2040');s+=chip(d.w/2-12,80,24,25,nano?'USB':'FLASH');s+=rect(d.w/2-10,195,20,10,'url(#metal)',3);s+=text(d.w/2,d.h-39,nano?'NANO':c.type==='pico2'?'PICO 2':'PICO',15);s+=rect(d.w/2+18,66,17,12,'#d3d6cc',2)+circle(d.w/2+26,72,4,'#e4e8e1')}
 for(let i=0;i<5;i++)s+=rect(d.w/2+35,135+i*13,8,4,'#d2c2a1',1)+rect(d.w/2+37,134+i*13,4,6,'#a9966f',1);
 s+=rect(d.w/2-30,d.h-35,7,4,'#b6ef7d',1)+text(d.w/2-27,d.h-22,'ON',6);s+=text(d.w/2,d.h-7,'GPIO MODEL',6,'#bbd7c7');
 }else if(c.type==='led'){
 s+=`<path d="M 67 70 V 91 L 54 100 V 108 M 87 70 V 91 L 102 100 V 108" fill="none" stroke="url(#metal)" stroke-width="5"/>`;
 s+=rect(54,76,47,8,'#8a2430',4)+`<path d="M 57 77 V 58 A 20 20 0 0 1 97 58 V 77 Z" fill="url(#${brightness>0?'led-lit':'led-red'})" stroke="#f88179" stroke-opacity=".6" ${brightness>0?'style="filter:drop-shadow(0 0 '+(4+brightness*10)+'px #fa493e)"':''}/>`;
 s+=`<path d="M 64 66 V 59 Q 64 46 76 45" fill="none" stroke="#ffe9e1" stroke-width="4" stroke-linecap="round" opacity=".5"/>`;
 }else if(c.type==='resistor'){
 s+=`<path d="M 7 69 H 149" stroke="url(#metal)" stroke-width="4"/>`+`<path d="M 39 54 Q 30 69 39 84 L 49 84 Q 56 80 61 81 H 95 Q 102 80 108 84 H 117 Q 126 69 117 54 H 108 Q 101 58 95 57 H 61 Q 53 58 49 54 Z" fill="#d3c394" stroke="#988956"/>`;
 const colors=['#17191c','#713923','#d73535','#e78b22','#e8ca36','#579659','#438ac6','#915cc1','#9b9da3','#f4f2e8'];const value=Math.max(1,c.settings.value),exp=Math.floor(Math.log10(value))-1,digits=Math.round(value/10**exp);const bands=[colors[Math.floor(digits/10)%10],colors[digits%10],exp<0?'#c1a451':colors[exp%10],'#c1a451'];[45,62,79,109].forEach((x,i)=>s+=rect(x,55,6,28,bands[i],1));s+=text(78,105,c.settings.value+' Ω',12,'#c7c6b9');
 }else if(c.type==='button'){
 s+=`<path d="M 25 80 H 48 M 106 80 H 130" stroke="url(#metal)" stroke-width="5"/>`+rect(44,43,66,66,'#1a2025',5)+rect(49,48,56,56,'url(#metal)',4);for(const x of [54,99])for(const y of [53,99])s+=circle(x,y,3,'#5a6063');s+=circle(77,76,21,'#22272d')+circle(77,pressed?78:74,17,pressed?'#525b52':'#353c43',`data-press="${c.id}" class="tactile-button" stroke="#747b7c" stroke-width="2"`)+text(77,79,'PUSH',8);
 }else if(c.type==='pot'){
 s+=rect(42,103,70,20,'#1b776f',3);for(const x of [38,78,118])s+=rect(x-3,116,6,17,'url(#metal)',1);s+=circle(78,76,37,'url(#metal)')+circle(78,76,29,'#232a30')+circle(78,76,22,'#394249');for(let a=0;a<360;a+=30){const r=a*Math.PI/180;s+=`<path d="M ${78+Math.cos(r)*23} ${76+Math.sin(r)*23} L ${78+Math.cos(r)*28} ${76+Math.sin(r)*28}" stroke="#7d888f" stroke-width="2"/>`}const a=(-135+c.settings.value/1023*270)*Math.PI/180;s+=`<path d="M 78 76 L ${78+Math.sin(a)*20} ${76-Math.cos(a)*20}" stroke="#eef1e8" stroke-width="4" stroke-linecap="round"/>`;
 }else if(c.type==='sensor'){
 s+=rect(21,35,116,62,'#1a6a62',5,'stroke="#479888"');s+=circle(33,47,5,'#cab66a')+circle(33,47,2,'#151d20');s+=circle(119,47,5,'#cab66a')+circle(119,47,2,'#151d20');s+=circle(63,65,20,'#bc9864')+circle(63,65,16,'#e6c88f')+`<path d="M 52 55 H 70 V 61 H 54 V 67 H 71 V 74 H 54" fill="none" stroke="#a65046" stroke-width="3"/>`+chip(99,61,18,18,'');for(const x of [38,78,118])s+=rect(x-3,95,6,12,'url(#metal)',0);s+=text(79,91,'ANALOG INPUT',6);
 }else if(c.type==='breadboard'){
 s+=rect(0,32,d.w,d.h-32,'#dddcd3',8,'stroke="#aaa99f" stroke-width="2"');s+=rect(13,87,199,13,'#9c9f97',2)+rect(15,88,195,9,'#bfc1b8',1);for(let i=1;i<=30;i++){const p=pinPoint({...c,x:0,y:0},String(i));s+=rect(p.x-5,p.y-5,10,10,'#8d908b',2)+rect(p.x-2.5,p.y-2.5,5,5,'#293332',1)}for(let row=0;row<6;row++)s+=text(16,56+row*15+(row>=3?16:0),String(row+1),8,'#525b55');s+=text(113,153,'30 TIE POINTS · GROUPS OF 5',7,'#59655d');
 }
 return `<g transform="translate(${c.x} ${c.y})" pointer-events="none">${s}</g>`;
}
