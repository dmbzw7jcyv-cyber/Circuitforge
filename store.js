import {DatabaseSync} from 'node:sqlite';
import {validate} from './public/model.js';
export class Store{
 constructor(path){this.db=new DatabaseSync(path);this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS projects (id TEXT NOT NULL, owner TEXT NOT NULL, document TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(id,owner));')}
 list(owner){return this.db.prepare('SELECT document FROM projects WHERE owner=? ORDER BY updated DESC').all(owner).map(r=>JSON.parse(r.document))}
 get(owner,id){const r=this.db.prepare('SELECT document FROM projects WHERE owner=? AND id=?').get(owner,id);return r?JSON.parse(r.document):null}
 save(owner,p){validate(p);if(typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(p.id))throw Error('Invalid project ID');const document={...p,updatedAt:new Date().toISOString()};this.db.prepare('INSERT INTO projects(id,owner,document,updated) VALUES(?,?,?,?) ON CONFLICT(id,owner) DO UPDATE SET document=excluded.document,updated=excluded.updated').run(p.id,owner,JSON.stringify(document),document.updatedAt);return document}
 delete(owner,id){this.db.prepare('DELETE FROM projects WHERE owner=? AND id=?').run(owner,id)}
 close(){this.db.close()}
}
