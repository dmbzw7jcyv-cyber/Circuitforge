export const catalog = {
 uno:{name:'Arduino Uno',group:'Microcontrollers',pins:[...Array.from({length:14},(_,i)=>'D'+i),...Array.from({length:6},(_,i)=>'A'+i),'5V','GND'],board:true},
 nano:{name:'Arduino Nano',group:'Microcontrollers',pins:[...Array.from({length:14},(_,i)=>'D'+i),...Array.from({length:8},(_,i)=>'A'+i),'5V','GND'],board:true},
 pico:{name:'Raspberry Pi Pico',group:'Microcontrollers',pins:[...Array.from({length:23},(_,i)=>'GP'+i),'GP26','GP27','GP28','3V3','GND'],board:true},
 pico2:{name:'Raspberry Pi Pico 2',group:'Microcontrollers',pins:[...Array.from({length:23},(_,i)=>'GP'+i),'GP26','GP27','GP28','3V3','GND'],board:true},
 led:{name:'LED',group:'Output',pins:['A','K']},resistor:{name:'Resistor',group:'Passive',pins:['1','2']},button:{name:'Push button',group:'Input',pins:['1','2']},pot:{name:'Potentiometer',group:'Input',pins:['VCC','OUT','GND']},sensor:{name:'Analog sensor',group:'Input',pins:['VCC','OUT','GND']},breadboard:{name:'Mini breadboard',group:'Passive',pins:Array.from({length:30},(_,i)=>String(i+1))}
};
export const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function component(type,x=120,y=100){if(!catalog[type])throw Error('Unknown component');return {id:uid(),type,x,y,settings:{value:type==='resistor'?220:512}}}
export function validate(p){
 if(!p||p.version!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.code!=='string'||p.code.length>100000||!['cpp','python'].includes(p.language)||!Array.isArray(p.components)||!Array.isArray(p.wires)||p.components.length>100||p.wires.length>500)throw Error('Invalid project format or size');
 const ids=new Set();for(const c of p.components){if(!catalog[c.type]||typeof c.id!=='string'||ids.has(c.id)||!Number.isFinite(c.x)||!Number.isFinite(c.y)||!c.settings||!Number.isFinite(c.settings.value))throw Error('Invalid component');ids.add(c.id)}
 if(p.components.filter(c=>catalog[c.type].board).length>1)throw Error('One microcontroller per project is supported');
 const wid=new Set();for(const w of p.wires){if(typeof w.id!=='string'||wid.has(w.id))throw Error('Invalid wire ID');wid.add(w.id);for(const e of [w.from,w.to]){const c=p.components.find(c=>c.id===e?.id);if(!c||!catalog[c.type].pins.includes(e.pin))throw Error('Wire references an invalid pin')}if(w.from.id===w.to.id&&w.from.pin===w.to.pin)throw Error('A pin cannot connect to itself')}
 return p;
}
export function connect(p,from,to){const w={id:uid(),from,to};validate({...p,wires:[...p.wires,w]});if(p.wires.some(w=>[w.from,w.to].some(e=>e.id===from.id&&e.pin===from.pin)&&[w.from,w.to].some(e=>e.id===to.id&&e.pin===to.pin)))throw Error('These pins are already connected');return {...p,wires:[...p.wires,w]}}
export function removeComponent(p,id){return {...p,components:p.components.filter(c=>c.id!==id),wires:p.wires.filter(w=>w.from.id!==id&&w.to.id!==id)}}
export function example(kind='blink',language='cpp'){
 const board=component(language==='python'?'pico':'uno',120,110),led=component('led',530,150),r=component('resistor',350,130),button=component('button',360,320);
 const pin=language==='python'?'GP15':'D13';
 let p={version:1,id:uid(),name:kind==='button'?'Button-Controlled LED':'Blink',language,description:'A first experiment with digital signals.',components:[board,r,led,...(kind==='button'?[button]:[])],wires:[],code:language==='python'?`from machine import Pin\nfrom time import sleep\nled = Pin(15, Pin.OUT)\nwhile True:\n    led.value(1)\n    sleep(0.5)\n    led.value(0)\n    sleep(0.5)\n`:`void setup() {\n  pinMode(13, OUTPUT);\n${kind==='button'?'  pinMode(2, INPUT_PULLUP);\n':''}  Serial.begin(9600);\n}\n\nvoid loop() {\n${kind==='button'?'  digitalWrite(13, !digitalRead(2));\n  delay(20);':'  digitalWrite(13, HIGH);\n  Serial.println("LED on");\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);'}\n}\n`};
 for(const [a,ap,b,bp]of [[board,pin,r,'1'],[r,'2',led,'A'],[led,'K',board,'GND'],...(kind==='button'?[[board,'D2',button,'1'],[button,'2',board,'GND']]:[])])p=connect(p,{id:a.id,pin:ap},{id:b.id,pin:bp});return p;
}
// Connectivity is ideal digital logic. Resistors conduct but no current is calculated.
export function solve(p,outputs={},modes={},pressed={}){
 const parent=new Map(),key=(id,pin)=>id+':'+pin;function root(k){if(!parent.has(k))parent.set(k,k);if(parent.get(k)!==k)parent.set(k,root(parent.get(k)));return parent.get(k)}function join(a,b){parent.set(root(a),root(b))}
 for(const c of p.components)for(const pin of catalog[c.type].pins)root(key(c.id,pin));
 for(const w of p.wires)join(key(w.from.id,w.from.pin),key(w.to.id,w.to.pin));
 for(const c of p.components){if(c.type==='resistor'||(c.type==='button'&&pressed[c.id]))join(key(c.id,'1'),key(c.id,'2'));if(c.type==='breadboard')for(let i=1;i<=30;i+=5)for(let j=1;j<5;j++)join(key(c.id,''+i),key(c.id,''+(i+j)))}
 const sources=new Map(),weak=new Map(),warnings=[];function drive(k,v,isWeak=false){const m=isWeak?weak:sources,n=root(k);m.set(n,[...(m.get(n)||[]),v])}
 const board=p.components.find(c=>catalog[c.type].board);if(board){for(const pin of catalog[board.type].pins){const k=key(board.id,pin);if(pin==='GND')drive(k,0);else if(pin==='5V'||pin==='3V3')drive(k,1);else if(modes[pin]==='OUTPUT'&&outputs[pin]!==undefined)drive(k,outputs[pin]);else if(modes[pin]==='INPUT_PULLUP')drive(k,1,true)}}
 function read(k){const s=sources.get(root(k))||weak.get(root(k))||[];if(!s.length)return null;if(Math.max(...s)!==Math.min(...s)){return 'X'}return s[0]}
 for(const c of p.components)if(['pot','sensor'].includes(c.type)&&read(key(c.id,'VCC'))===1&&read(key(c.id,'GND'))===0)drive(key(c.id,'OUT'),Math.max(0,Math.min(1023,c.settings.value))/1023);
 const states={};for(const k of parent.keys()){states[k]=read(k);if(states[k]==='X'&&!warnings.includes('Conflicting driven signals: simulation halted.'))warnings.push('Conflicting driven signals: simulation halted.')}
 const leds={};for(const c of p.components)if(c.type==='led'){const a=states[key(c.id,'A')],k=states[key(c.id,'K')];leds[c.id]=typeof a==='number'&&k===0?a:0}
 return {states,leds,warnings};
}
