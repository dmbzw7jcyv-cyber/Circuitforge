import {catalog,solve} from './model.js?v=bb2';
// A deliberately closed grammar: never eval user source.
function pythonToC(source){
 const lines=source.split('\n'),out=[],pins={},stack=[];let inLoop=false;
 for(let i=0;i<lines.length;i++){const raw=lines[i],s=raw.trim();if(!s||s.startsWith('#'))continue;const indent=raw.length-raw.trimStart().length;while(stack.length&&indent<=stack.at(-1)){out.push('}');stack.pop()}
 if(['from machine import Pin','from time import sleep','from time import sleep_ms'].includes(s))continue;
 let m;if((m=s.match(/^(\w+) = Pin\((\d+), Pin\.(OUT|IN)(?:, Pin\.(PULL_UP))?\)$/))){pins[m[1]]=Number(m[2]);out.push(`pinMode(${m[2]}, ${m[4]?'INPUT_PULLUP':m[3]==='OUT'?'OUTPUT':'INPUT'});`);continue}
 if(s==='while True:'){out.push('} void loop() {');inLoop=true;continue}
 if(!inLoop&&indent)throw Error(`MicroPython line ${i+1}: unsupported indentation`);
 let expr=s.replace(/(\w+)\.value\(\)/g,(_,v)=>{if(!(v in pins))throw Error('Unknown Pin '+v);return `digitalRead(${pins[v]})`}).replace(/\bnot\s+/g,'!');
 if((m=expr.match(/^if (.+):$/))){out.push(`if (${m[1]}) {`);stack.push(indent);continue}
 if((m=expr.match(/^(\w+)\.value\((.+)\)$/))&&m[1] in pins)out.push(`digitalWrite(${pins[m[1]]}, ${m[2]});`);
 else if((m=expr.match(/^sleep\((\d+(?:\.\d+)?)\)$/)))out.push(`delay(${Number(m[1])*1000});`);
 else if((m=expr.match(/^sleep_ms\((\d+)\)$/)))out.push(`delay(${m[1]});`);
 else if((m=expr.match(/^print\((.*)\)$/)))out.push(`Serial.println(${m[1]});`);
 else throw Error(`MicroPython line ${i+1}: unsupported feature: ${s}`);
 }while(stack.length){out.push('}');stack.pop()}if(!inLoop)throw Error('MicroPython subset requires while True:');return 'void setup() {\n'+out.join('\n')+'\n}';
}
export function compile(source,language='cpp'){
 if(language==='python')source=pythonToC(source);
 source=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const tokens=source.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|==|!=|<=|>=|&&|\|\||[^\s]/g)||[];let i=0;const peek=()=>tokens[i],take=()=>tokens[i++],expect=t=>{if(take()!==t)throw Error(`Expected ${t} near ${tokens.slice(Math.max(0,i-3),i+3).join(' ')}`)};
 const calls={pinMode:2,digitalWrite:2,digitalRead:1,analogWrite:2,analogRead:1,delay:1,'Serial.begin':1,'Serial.println':1,'Serial.print':1};
 function atom(){const t=take();if(t==='!'||t==='-')return {op:t==='!'?'not':'neg',a:atom()};if(t==='('){const a=expr();expect(')');return a}if(/^\d/.test(t||''))return {value:Number(t)};if(t?.startsWith('"')||t?.startsWith("'"))return {value:t.slice(1,-1)};if(/^[A-Za-z_]\w*(?:\.\w+)*$/.test(t||'')){if(peek()==='('){if(!(t in calls))throw Error('Not simulated: '+t);take();const args=[];if(peek()!==')'){do{args.push(expr());if(peek()!==',')break;take()}while(true)}expect(')');if(args.length!==calls[t])throw Error('Wrong argument count for '+t);return {call:t,args}}return {variable:t}}throw Error('Unsupported expression '+t)}
 const prec={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};function expr(min=0){let a=atom();while(prec[peek()]>=min){const op=take(),b=expr(prec[op]+1);a={op,a,b}}return a}
 function block(){expect('{');const a=[];while(peek()!=='}'){if(i>=tokens.length)throw Error('Unclosed block');a.push(stmt())}expect('}');return a}
 function stmt(){let t=peek();if(t==='if'){take();expect('(');const condition=expr();expect(')');const yes=peek()==='{'?block():[stmt()];let no=[];if(peek()==='else'){take();no=peek()==='{'?block():[stmt()]}return {if:condition,yes,no}}
 let declaration=false;if(t==='const'){take();t=peek()}if(['int','bool','float','unsigned','long'].includes(t)){take();if(t==='unsigned'&&peek()==='long')take();declaration=true}
 if(declaration||tokens[i+1]==='='){const name=take();if(!/^[A-Za-z_]\w*$/.test(name))throw Error('Invalid variable');expect('=');const value=expr();expect(';');return {set:name,value}}
 const value=expr();expect(';');return {value};}
 const globals=[],functions={};while(i<tokens.length){if(peek()==='void'){take();const name=take();if(!['setup','loop'].includes(name)||functions[name])throw Error('Only setup() and loop() are simulated');expect('(');expect(')');functions[name]=block()}else globals.push(stmt())}if(!functions.loop)throw Error('Add void loop() to run the simulation');return {setup:[...globals,...(functions.setup||[])],loop:functions.loop};
}
export class Simulator{
 constructor(project){this.project=project;this.program=compile(project.code,project.language);this.board=project.components.find(c=>catalog[c.type].board);if(!this.board)throw Error('Add a microcontroller');if(project.language==='python'&&!this.board.type.startsWith('pico'))throw Error('MicroPython is only simulated on Pico boards');this.outputs={};this.modes={};this.variables={HIGH:1,LOW:0,OUTPUT:'OUTPUT',INPUT:'INPUT',INPUT_PULLUP:'INPUT_PULLUP',LED_BUILTIN:13,true:1,false:0};for(let n=0;n<8;n++)this.variables['A'+n]='A'+n;this.pressed={};this.time=0;this.wake=0;this.logs=[];this.queue=[...this.program.setup];this.refresh()}
 pin(v){const pin=typeof v==='string'&&v.startsWith('A')?v:(this.board.type.startsWith('pico')?'GP':'D')+v;if(!catalog[this.board.type].pins.includes(pin))throw Error('Invalid GPIO '+pin);return pin}
 refresh(){this.net=solve(this.project,this.outputs,this.modes,this.pressed);if(this.net.warnings.length)throw Error(this.net.warnings[0])}
 evaluate(e){if('value'in e)return e.value;if(e.variable){if(!Object.hasOwn(this.variables,e.variable))throw Error('Undefined or unsupported symbol '+e.variable);return this.variables[e.variable]}if(e.op){const a=this.evaluate(e.a);if(e.op==='not')return +!a;if(e.op==='neg')return -a;const b=this.evaluate(e.b);switch(e.op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':if(!b)throw Error('Division by zero');return a/b;case '%':return a%b;case '==':return +(a===b);case '!=':return +(a!==b);case '<':return +(a<b);case '>':return +(a>b);case '<=':return +(a<=b);case '>=':return +(a>=b);case '&&':return +(a&&b);case '||':return +(a||b)}}
 const a=e.args.map(a=>this.evaluate(a));switch(e.call){case 'pinMode':if(!['OUTPUT','INPUT','INPUT_PULLUP'].includes(a[1]))throw Error('Invalid pin mode');this.modes[this.pin(a[0])]=a[1];this.refresh();return 0;
 case 'digitalWrite':case 'analogWrite':{const pin=this.pin(a[0]);if(this.modes[pin]!=='OUTPUT')throw Error(`Set ${pin} to OUTPUT first`);if(e.call==='analogWrite'&&!this.board.type.startsWith('pico')&&![3,5,6,9,10,11].includes(Number(a[0])))throw Error('PWM is not available on '+pin);if(!Number.isFinite(a[1])||a[1]<0||a[1]>(e.call==='analogWrite'?255:1))throw Error('Output value out of range');this.outputs[pin]=e.call==='analogWrite'?a[1]/255:a[1];this.refresh();return 0}
 case 'digitalRead':case 'analogRead':{const pin=this.pin(a[0]);if(e.call==='analogRead'&&!(pin.startsWith('A')||['GP26','GP27','GP28'].includes(pin)))throw Error('Not an analog input: '+pin);this.refresh();const v=this.net.states[this.board.id+':'+pin];if(v===null)throw Error('Floating input '+pin+': wire it or use INPUT_PULLUP');return e.call==='analogRead'?Math.round(v*1023):+(v>=0.5)}
 case 'delay':if(!Number.isFinite(a[0])||a[0]<0)throw Error('Invalid delay');this.wake=this.time+Math.max(1,a[0]);return 0;
 case 'Serial.begin':return 0;case 'Serial.print':case 'Serial.println':this.logs.push({time:this.time,text:String(a[0])});this.logs=this.logs.slice(-200);return 0;default:throw Error('Not simulated: '+e.call)}
 }
 tick(ms){const target=this.time+ms;let budget=10000;while(this.time<target){if(this.wake>this.time){this.time=Math.min(target,this.wake);if(this.time>=target)break}if(!this.queue.length){this.queue=[...this.program.loop];if(!this.queue.length){this.time=target;break}}if(--budget<=0)throw Error('Instruction budget exceeded; add delay() to loop');const s=this.queue.shift();if(s.if)this.queue.unshift(...(this.evaluate(s.if)?s.yes:s.no));else if(s.set)this.variables[s.set]=this.evaluate(s.value);else this.evaluate(s.value)}this.refresh();return this.net}
}
