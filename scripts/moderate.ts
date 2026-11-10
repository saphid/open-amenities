import 'dotenv/config';
import { resolve } from 'node:path';
import { Store } from '../server/store.ts';
const store=new Store(process.env.DATABASE_PATH ?? resolve('data/amenities.sqlite'));
try {
  const [command,id,...words]=process.argv.slice(2);
  if(command==='list')console.log(JSON.stringify(store.pending(),null,2));
  else if((command==='approve'||command==='reject') && id && words.join(' ').trim().length>=10){store.moderate(id,command==='approve'?'approved':'rejected',words.join(' '));console.log(`Report ${id} ${command==='approve'?'approved':'rejected'}.`);}
  else if(command==='prune'){store.prune();console.log('Retention rules applied.');}
  else {console.error('Usage: npm run moderate -- list | approve <id> <review reason, 10+ chars> | reject <id> <reason> | prune');process.exitCode=1;}
}finally{store.db.close();}
