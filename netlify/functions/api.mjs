import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '@netlify/database';

const SESSION_COOKIE='sustainability2569_session';
const MAX_BODY_BYTES=2048;
function output(data,status=200,headers={}) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
}
function cookie(request,key) {
  const all=request.headers.get('cookie')||'';
  const segment=all.split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='));
  return segment?segment.slice(key.length+1):null;
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function equal(a,b) {
  const x=Buffer.from(String(a)),y=Buffer.from(String(b));
  return x.length===y.length&&timingSafeEqual(x,y);
}
function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if(!origin) return false;
  try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
async function bodyOf(request) {
  const declared=Number(request.headers.get('content-length')||0);
  if(declared>MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  const text=await request.text();
  if(Buffer.byteLength(text,'utf8')>MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
  return JSON.parse(text);
}
export default async function handler(request) {
  const action=new URL(request.url).pathname.split('/').pop();
  try {
    const db=getDatabase().pool;
    if(request.method==='GET'&&action==='stats'){
      const [scores,overview,state]=await Promise.all([
        db.query('SELECT t.topic_id,round(avg(v.necessity)::numeric,2) AS necessity_avg,round(avg(v.complexity)::numeric,2) AS complexity_avg,count(v.topic_id)::int AS vote_count FROM generate_series(1,10) AS t(topic_id) LEFT JOIN assessment_votes v ON v.topic_id=t.topic_id GROUP BY t.topic_id ORDER BY t.topic_id'),
        db.query('WITH person AS (SELECT participant_id,count(*) AS n FROM assessment_votes GROUP BY participant_id) SELECT count(*)::int AS total_participants,count(*) FILTER(WHERE n=10)::int AS completed_participants,coalesce(sum(n),0)::int AS total_votes FROM person'),
        db.query('SELECT is_open,reset_generation FROM assessment_state WHERE id=1')
      ]);
      return output({stats:scores.rows,overview:overview.rows[0],is_open:state.rows[0]?.is_open??false,reset_generation:Number(state.rows[0]?.reset_generation??0)});
    }
    if(request.method==='GET'&&action==='session'){
      let token=cookie(request,SESSION_COOKIE),person=null,header={};
      if(token&&/^[a-f0-9]{64}$/.test(token)){
        const existing=await db.query('SELECT id FROM assessment_participants WHERE session_hash=$1 LIMIT 1',[digest(token)]);
        person=existing.rows[0]??null;
      }
      if(!person) {
        token=randomBytes(32).toString('hex');
        const made=await db.query('INSERT INTO assessment_participants(session_hash) VALUES($1) RETURNING id',[digest(token)]);
        person=made.rows[0];
        header={'Set-Cookie':SESSION_COOKIE+'='+token+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000'};
      }
      const [result,epoch]=await Promise.all([db.query('SELECT topic_id,necessity,complexity FROM assessment_votes WHERE participant_id=$1 ORDER BY topic_id',[person.id]),db.query('SELECT reset_generation FROM assessment_state WHERE id=1')]);
      return output({votes:result.rows,reset_generation:Number(epoch.rows[0]?.reset_generation??0)},200,header);
    }
    if(request.method==='POST'&&action==='vote'){
      if(!sameOrigin(request)) return output({error:'คำขอจากเว็บไซต์อื่นไม่อนุญาต'},403);
      const token=cookie(request,SESSION_COOKIE);
      if(!token||!/^[a-f0-9]{64}$/.test(token)) return output({error:'ไม่พบเซสชัน กรุณาโหลดหน้าใหม่'},401);
      const person=await db.query('SELECT id FROM assessment_participants WHERE session_hash=$1 LIMIT 1',[digest(token)]);
      if(!person.rows.length)return output({error:'เซสชันไม่ถูกต้อง'},401);
      const b=await bodyOf(request);
      const topic=Number(b.topic_id),necessity=Number(b.necessity),complexity=Number(b.complexity);
      if(![topic,necessity,complexity].every(Number.isInteger)||topic<1||topic>10||necessity<1||necessity>5||complexity<1||complexity>5)
        return output({error:'กรุณาระบุคะแนน 1–5 ให้ครบทั้งสองด้าน'},422);
      // Hold a shared row lock until the vote commits. An administrator reset
      // takes an exclusive lock on this row, preventing late votes from leaking
      // into a newly reset (closed) session.
      const client=await db.connect();
      try {
        await client.query('BEGIN');
        const meeting=await client.query('SELECT is_open,reset_generation FROM assessment_state WHERE id=1 FOR SHARE');
        const active=meeting.rows[0];
        if(!active?.is_open){
          await client.query('ROLLBACK');
          return output({error:'ระบบปิดรับคะแนนแล้ว กรุณารอผู้ดูแลเปิดรอบใหม่'},409);
        }
        const generation=Number(active.reset_generation);
        if(!Number.isSafeInteger(b.reset_generation)||b.reset_generation!==generation){
          await client.query('ROLLBACK');
          return output({error:'รอบการประเมินมีการรีเซ็ต กรุณารอสักครู่แล้วให้คะแนนใหม่',reset_generation:generation},409);
        }
        const saved=await client.query(
          'INSERT INTO assessment_votes(participant_id,topic_id,necessity,complexity) VALUES ($1,$2,$3,$4) ON CONFLICT(participant_id,topic_id) DO UPDATE SET necessity=EXCLUDED.necessity,complexity=EXCLUDED.complexity,updated_at=now() RETURNING topic_id',
          [person.rows[0].id,topic,necessity,complexity]
        );
        await client.query('COMMIT');
        return output({saved:true,topic_id:saved.rows[0].topic_id,reset_generation:generation});
      }catch(error){
        await client.query('ROLLBACK').catch(()=>{});
        throw error;
      }finally{
        client.release();
      }
    }
    if(request.method==='POST'&&(action==='control'||action==='reset')){
      if(!sameOrigin(request))return output({error:'คำขอจากเว็บไซต์อื่นไม่อนุญาต'},403);
      const secret=Netlify.env.get('ASSESSMENT_ADMIN_CODE');
      if(!secret||secret.length<12)return output({error:'ยังไม่ได้ตั้งรหัสผู้ดูแลใน Netlify'},503);
      const b=await bodyOf(request);
      if(!equal(b.code??'',secret))return output({error:'รหัสผู้ดูแลไม่ถูกต้อง'},403);
      if(action==='reset'){
        if(b.confirmation!=='RESET 2569'){
          return output({error:'กรุณาพิมพ์ RESET 2569 เพื่อยืนยันการล้างคะแนนทั้งหมด'},422);
        }
        const client=await db.connect();
        try {
          await client.query('BEGIN');
          // Serialize concurrent submissions with the reset and close intake.
          await client.query('SELECT id FROM assessment_state WHERE id=1 FOR UPDATE');
          const participantCount=await client.query('SELECT count(DISTINCT participant_id)::int AS count FROM assessment_votes');
          const deleted=await client.query('DELETE FROM assessment_votes');
          const updated=await client.query('UPDATE assessment_state SET is_open=false,reset_generation=reset_generation+1,updated_at=now() WHERE id=1 RETURNING reset_generation,is_open');
          if(!updated.rows.length)throw new Error('Assessment state not initialized');
          await client.query('COMMIT');
          return output({
            reset:true,
            deleted_votes:deleted.rowCount,
            affected_participants:participantCount.rows[0]?.count??0,
            is_open:false,
            reset_generation:Number(updated.rows[0].reset_generation)
          });
        }catch(error){
          await client.query('ROLLBACK').catch(()=>{});
          throw error;
        }finally{client.release();}
      }
      if(!['open','close'].includes(b.action))return output({error:'คำสั่งไม่ถูกต้อง'},422);
      const next=b.action==='open';
      await db.query('UPDATE assessment_state SET is_open=$1,updated_at=now() WHERE id=1',[next]);
      return output({is_open:next});
    }
    return output({error:'ไม่พบ API'},404);
  } catch(error){
    if(error?.message==='BODY_TOO_LARGE')return output({error:'ข้อมูลใหญ่เกินกำหนด'},413);
    if(error instanceof SyntaxError)return output({error:'รูปแบบ JSON ไม่ถูกต้อง'},400);
    console.error('sustainability-api-error',{action,message:error?.message});
    return output({error:'ระบบฐานข้อมูลยังไม่พร้อม กรุณาติดต่อผู้ดูแล'},503);
  }
}
export const config={path:'/api/:action'};
