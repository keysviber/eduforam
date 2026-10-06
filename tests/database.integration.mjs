// Run with: NODE_PATH=/tmp/education-forum-tools/node_modules node tests/database.integration.mjs
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;`);
const existingUser = "88888888-8888-4888-8888-888888888888";
await db.exec(
  `insert into auth.users(id,raw_user_meta_data) values('${existingUser}','{"grade":"Form 4","role":"owner"}')`,
);
await db.exec(
  await readFile(new URL("../supabase/SETUP.sql", import.meta.url), "utf8"),
);
assert.deepEqual(
  (await db.query(`select grade,role from profiles where id='${existingUser}'`))
    .rows[0],
  { grade: "Form 4", role: "student" },
);
await db.exec(
  `grant usage on schema public,auth,storage to anon,authenticated; grant select,insert,update,delete on all tables in schema public to anon,authenticated;grant select,insert on storage.objects to anon,authenticated;grant usage on all sequences in schema public to authenticated;`,
);
const student = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  book = "44444444-4444-4444-8444-444444444444",
  aid = "55555555-5555-4555-8555-555555555555";
await db.exec(
  `insert into auth.users(id) values('${student}'),('${other}'),('${admin}');update profiles set role='owner' where id='${admin}';`,
);
async function asUser(id, sql) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
const insert = (id, kind = "book", status = "pending") =>
  `insert into entries(id,owner_id,kind,title,description,category,author,level,status,file_path) values('${id}','${student}','${kind}','Test content','This is a sufficiently detailed description.','Science','Student','Form 4','${status}','${student}/${id}/file.pdf')`;
await assert.rejects(
  () => asUser(student, insert(book, "book", "approved")),
  /row-level security/,
);
await asUser(student, insert(book));
assert.equal((await asUser(other, "select * from entries")).rows.length, 0);
await assert.rejects(
  () =>
    asUser(
      student,
      `select review_entry('${book}','approved','Self approval')`,
    ),
  /Administrator permission/,
);
await asUser(student, `update profiles set role='owner' where id='${student}'`);
assert.equal(
  (await db.query(`select role from profiles where id='${student}'`)).rows[0]
    .role,
  "student",
);
await asUser(
  admin,
  `select review_entry('${book}','approved','Reviewed educational content')`,
);
assert.equal((await asUser(other, "select * from entries")).rows.length, 1);
assert.equal((await asUser(admin, "select * from audit_log")).rows.length, 1);
await asUser(
  student,
  `insert into storage.objects(bucket_id,name) values('submissions','${student}/${book}/file.pdf')`,
);
assert.equal(
  (await asUser(other, "select * from storage.objects")).rows.length,
  1,
);
await asUser(student, insert(aid, "assistance"));
await asUser(
  student,
  `insert into storage.objects(bucket_id,name) values('submissions','${student}/${aid}/file.pdf')`,
);
await asUser(
  admin,
  `select review_entry('${aid}','approved','Public description approved')`,
);
assert.equal(
  (await asUser(other, "select * from storage.objects")).rows.length,
  1,
  "Assistance evidence remains private",
);
await asUser(
  admin,
  `select review_entry('${book}','removed','Removed for review')`,
);
assert.equal(
  (await asUser(other, "select * from storage.objects")).rows.length,
  0,
  "Removed book no longer accessible",
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into transactions(user_id,purpose,amount_minor,currency,provider,idempotency_key) values('${student}','donation',100,'USD','fake','fake-1')`,
    ),
  /row-level security/,
);
await asUser(
  admin,
  `select configure_plan(null,'Premier',1000,'USD','["Library"]',true,'Launch plan')`,
);
assert.equal((await asUser(other, "select * from plans")).rows.length, 1);
await assert.rejects(
  () =>
    asUser(
      student,
      `select configure_platform('feature','{"feature_key":"library","access_mode":"free"}','Bypass')`,
    ),
  /Administrator permission/,
);
await asUser(
  admin,
  `select configure_platform('user','{"id":"${student}","suspended":true}','Abuse review')`,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into reports(entry_id,reporter_id,reason) values('${aid}','${student}','Report content')`,
    ),
  /row-level security/,
);

await db.exec(`update profiles set suspended=false where id='${student}'`);
await asUser(student, "select set_my_grade('Form 4')");
assert.equal(
  (await asUser(student, "select grade from profiles")).rows[0].grade,
  "Form 4",
);
await assert.rejects(
  () => asUser(student, "select set_my_grade('Grade 99')"),
  /check constraint/,
);
const signupUser = "77777777-7777-4777-8777-777777777777";
await db.exec(
  `insert into auth.users(id,raw_user_meta_data) values('${signupUser}','{"grade":"Form 3","role":"owner"}')`,
);
assert.deepEqual(
  (await db.query(`select grade,role from profiles where id='${signupUser}'`))
    .rows[0],
  { grade: "Form 3", role: "student" },
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into classrooms(owner_id,title,grade) values('${other}','My classroom','Form 4')`,
    ),
  /row-level security/,
);
const room = (
  await asUser(
    admin,
    `insert into classrooms(owner_id,title,grade) values('${admin}','Form 4 Science','Form 4') returning *`,
  )
).rows[0];
assert.equal(
  (await asUser(student, "select * from classrooms")).rows.length,
  0,
);
await assert.rejects(
  () => asUser(student, "select join_classroom('incorrect')"),
  /Invitation code/,
);
await asUser(student, `select join_classroom('${room.join_code}')`);
await asUser(student, `select join_classroom('${room.join_code}')`);
assert.equal(
  (await asUser(student, "select * from classrooms")).rows.length,
  1,
);
assert.equal(
  (await asUser(other, "select * from classroom_members")).rows.length,
  0,
);
await asUser(admin, `select review_entry('${book}','approved','Ready again')`);
await asUser(
  admin,
  `insert into classroom_lessons values('${room.id}','${book}')`,
);
assert.equal(
  (await asUser(student, "select * from classroom_lessons")).rows.length,
  1,
);
assert.equal(
  (await asUser(other, "select * from classroom_lessons")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `insert into classroom_members values('${room.id}','${other}')`,
    ),
  /row-level security/,
);
await asUser(
  student,
  `delete from classroom_members where classroom_id='${room.id}'`,
);
assert.equal(
  (await asUser(student, "select * from classrooms")).rows.length,
  0,
);
assert.equal(
  (await asUser(student, "select * from classroom_lessons")).rows.length,
  0,
);
const requestSql = `insert into support_requests(user_id,message) values('${student}','I need help with school stress') returning id`;
await assert.rejects(() => asUser(student, requestSql), /row-level security/);
await asUser(student, "update support_settings set enabled=true");
assert.equal(
  (await db.query("select enabled from support_settings")).rows[0].enabled,
  false,
);
await asUser(admin, "update support_settings set enabled=true");
const request = (await asUser(student, requestSql)).rows[0].id;
assert.equal(
  (await asUser(other, "select * from support_requests")).rows.length,
  0,
);
assert.equal(
  (await asUser(admin, "select * from support_requests")).rows.length,
  1,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `insert into support_requests(user_id,message) values('${student}','Impersonated support request')`,
    ),
  /row-level security/,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `select respond_to_support('${request}','Fake staff response','answered')`,
    ),
  /Administrator permission/,
);
await asUser(
  admin,
  `select respond_to_support('${request}','Please visit the school support office.','answered')`,
);
assert.equal(
  (await asUser(student, "select status from support_requests")).rows[0].status,
  "answered",
);
await db.exec(`update profiles set suspended=true where id='${student}'`);
await assert.rejects(
  () => asUser(student, `select join_classroom('${room.join_code}')`),
  /active account/,
);
await assert.rejects(
  () => asUser(student, "select set_my_grade('Form 5')"),
  /active account/,
);
assert.equal(
  (await asUser(student, "select * from support_requests")).rows.length,
  0,
);
await db.exec("set role anon");
assert.equal((await db.query("select * from support_requests")).rows.length, 0);
await db.exec("reset role");
await db.exec(
  "update profiles set suspended=false; revoke select on quiz_questions from authenticated; grant select(id,subject,prompt,choices) on quiz_questions to authenticated;",
);
await assert.rejects(
  () => asUser(student, "select answer from quiz_questions"),
  /permission denied/,
);
assert.equal(
  (await asUser(student, "select answer_quiz(1,1) result")).rows[0].result
    .points,
  10,
);
await assert.rejects(
  () => asUser(student, "select answer_quiz(1,1)"),
  /duplicate key/,
);
await assert.rejects(
  () => asUser(student, "insert into quiz_answers values(auth.uid(),2,1,9999)"),
  /row-level security/,
);
assert.equal(
  Number(
    (await asUser(student, "select * from quiz_leaderboard()")).rows[0].points,
  ),
  10,
);
await assert.rejects(
  () => asUser(student, `select set_moderator('${student}',true)`),
  /Administrator permission/,
);
await asUser(admin, `select set_moderator('${other}',true)`);
assert.equal(
  (await asUser(other, "select can_moderate() allowed")).rows[0].allowed,
  true,
);
assert.equal(
  (await asUser(other, "select is_admin() allowed")).rows[0].allowed,
  false,
);
const talent = "99999999-9999-4999-8999-999999999999";
await asUser(
  student,
  `insert into entries(id,owner_id,kind,title,description,category,author,level,file_path,video_format) values('${talent}','${student}','reel','Talent show','An original student talent performance','Music','Student','Form 4','${student}/talent.mp4','talent')`,
);
assert.equal(
  (await asUser(student, `select status from entries where id='${talent}'`))
    .rows[0].status,
  "approved",
);
await asUser(
  other,
  `select review_entry('${talent}','removed','Community review')`,
);
assert.equal(
  (
    await asUser(
      student,
      "select * from notifications where message like 'Talent show:%'",
    )
  ).rows.length,
  1,
);
assert.equal(
  (
    await asUser(
      other,
      "select * from notifications where message like 'Talent show:%'",
    )
  ).rows.length,
  0,
);
const paid = (
  await asUser(
    student,
    `insert into classrooms(owner_id,title,grade,price_minor) values('${student}','Paid maths class','Form 4',100) returning *`,
  )
).rows[0];
await assert.rejects(
  () => asUser(other, `select join_classroom('${paid.join_code}')`),
  /verified purchase/,
);
// Service privileges must never be granted by an ordinary client.
await assert.rejects(
  () => asUser(student, `select sync_purchase_access('${student}','[]',now())`),
  /permission denied/,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into purchase_access(user_id,product_id) values('${student}','remove_ads')`,
    ),
  /row-level security/,
);
await asUser(
  admin,
  `select save_store_product('class_test','classroom_test','${paid.id}','Configure tested product')`,
);
await db.query(
  `select sync_purchase_access('${other}','[{"product_id":"class_test","expires_at":null}]',now())`,
);
await asUser(other, `select join_classroom('${paid.join_code}')`);
assert.equal(
  (await asUser(other, `select in_classroom('${paid.id}') allowed`)).rows[0]
    .allowed,
  true,
);
await db.query(
  `select sync_purchase_access('${other}','[]',now()+interval '1 second')`,
);
assert.equal(
  (await asUser(other, `select in_classroom('${paid.id}') allowed`)).rows[0]
    .allowed,
  false,
);
await db.query(
  `select sync_purchase_access('${other}','[{"product_id":"class_test","expires_at":null}]',now()-interval '1 minute')`,
);
assert.equal(
  (await asUser(other, `select has_classroom_access('${paid.id}') allowed`))
    .rows[0].allowed,
  false,
);
await asUser(student, "select register_push('ExpoPushToken[test_token]')");
await db.query(
  `insert into notifications(user_id,message) values('${student}','Private test')`,
);
assert.equal(
  (await db.query("select * from claim_push_jobs()")).rows.length,
  1,
);
assert.equal(
  (await db.query("select * from claim_push_jobs()")).rows.length,
  0,
);
await asUser(other, "select register_push('ExpoPushToken[test_token]')");
await db.query("update push_jobs set next_attempt=now()-interval '1 minute'");
assert.equal(
  (await db.query("select * from claim_push_jobs()")).rows.length,
  0,
);
await assert.rejects(
  () => asUser(student, "select * from claim_push_jobs()"),
  /permission denied/,
);
// One timed viewing event is one pending credit; clients cannot approve their own earnings.
await db.exec(
  `update entries set status='approved' where id='${talent}'; update earnings_policies set active=false; insert into earnings_policies(role,view_rate,minimum_payout_minor,currency,active) values('student',0.025,1,'USD',true)`,
);
assert.equal(
  (await asUser(student, `select begin_content_usage('${talent}') id`)).rows[0]
    .id,
  null,
);
const activity = (
  await asUser(other, `select begin_content_usage('${talent}') id`)
).rows[0].id;
assert.equal(
  (await asUser(other, `select begin_content_usage('${talent}') id`)).rows[0]
    .id,
  activity,
);
await asUser(other, `select heartbeat_content_usage('${activity}')`);
assert.equal(
  (await db.query(`select seconds from content_usage where id='${activity}'`))
    .rows[0].seconds,
  0,
);
for (let i = 0; i < 3; i++) {
  await db.query(
    `update content_usage set last_seen=now()-interval '11 seconds' where id='${activity}'`,
  );
  await asUser(other, `select heartbeat_content_usage('${activity}')`);
}
await assert.rejects(
  () =>
    asUser(other, `select review_usage('${activity}',true,'Self approval')`),
  /Administrator permission/,
);
await asUser(
  admin,
  `select review_usage('${activity}',true,'Checked content activity')`,
);
await assert.rejects(
  () =>
    asUser(
      admin,
      `select review_usage('${activity}',true,'Duplicate approval')`,
    ),
  /Qualified activity not found/,
);
assert.equal(
  Number(
    (await asUser(student, "select * from creator_summary()")).rows[0].earned,
  ),
  0.025,
);
await db.query(
  `insert into payout_accounts(user_id,stripe_account) values('${student}','acct_test')`,
);
const payout = (
  await asUser(student, "select request_creator_payout('USD') id")
).rows[0].id;
assert.equal(
  Number(
    (
      await db.query(
        `select amount_minor from payout_requests where id='${payout}'`,
      )
    ).rows[0].amount_minor,
  ),
  2,
);
await assert.rejects(
  () => asUser(student, "select request_creator_payout('USD')"),
  /below the payout minimum/,
);
await assert.rejects(
  () => asUser(student, `select * from claim_payout('${payout}')`),
  /permission denied/,
);
await db.query(`select * from claim_payout('${payout}')`);
await db.query(
  `update payout_requests set attempted_at=now()-interval '24 hours' where id='${payout}'`,
);
assert.equal(
  (await db.query(`select * from claim_payout('${payout}')`)).rows.length,
  0,
);
await db.close();
console.log(
  "PASS: migrations, RLS, quiz integrity, moderation, private push queue, verified purchases/refunds, classroom access, reviewed earnings and payout reservation.",
);
