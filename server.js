import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {Store} from './store.js';
import {fileURLToPath} from 'node:url';
const listenPort=Number(process.env.PORT||(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:3000));
const data=process.env.DATA_DIR||'./data';mkdirSync(data,{recursive:true});
const secret=process.env.SESSION_SECRET;if(process.env.NODE_ENV==='production'&&!secret)throw Error('SESSION_SECRET must be configured');
const signingKey=secret||'local-development-only';
export function createApp(store){return http.createServer(async(req,res)=>{try{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'");
 const sign=id=>createHmac('sha256',signingKey).update(id).digest('hex');let cookie=/(?:^|; )cf_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];let [owner,sig]=String(cookie||'').split('.');if(!owner||!sig||sig.length!==64||!/^[a-f0-9]{48}$/.test(owner)||!timingSafeEqual(Buffer.from(sig),Buffer.from(sign(owner)))){owner=randomBytes(24).toString('hex');res.setHeader('Set-Cookie',`cf_session=${owner}.${sign(owner)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${process.env.NODE_ENV==='production'?'; Secure':''}`)}
 const url=new URL(req.url,'http://localhost');const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
 if(url.pathname==='/api/health')return send(200,{ok:true});
 if(url.pathname.startsWith('/api/')){
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Cross-origin writes are not allowed'});
 if(url.pathname==='/api/projects'&&req.method==='GET')return send(200,store.list(owner));
 const m=url.pathname.match(/^\/api\/projects\/([a-zA-Z0-9-]{1,80})$/);if(!m)return send(404,{error:'Not found'});
 if(req.method==='GET'){const p=store.get(owner,m[1]);return send(p?200:404,p||{error:'Project not found'})}
 if(req.method==='DELETE'){store.delete(owner,m[1]);return send(200,{ok:true})}
 if(req.method==='PUT'){let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)return send(413,{error:'Project too large'})}const p=JSON.parse(body);if(p.id!==m[1])return send(400,{error:'ID mismatch'});return send(200,store.save(owner,p))}return send(405,{error:'Method not allowed'});
 }
 const files={'/':'index.html','/appearance.js':'appearance.js','/app.js':'app.js','/model.js':'model.js','/simulator.js':'simulator.js','/style.css':'style.css'};const name=files[url.pathname];if(!name){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(new URL('./public/'+name,import.meta.url)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}})}
if(process.argv[1]===fileURLToPath(import.meta.url)){const store=new Store(data+'/circuitforge.sqlite');createApp(store).listen(listenPort,'0.0.0.0',()=>console.log('CircuitForge listening on '+listenPort))}
