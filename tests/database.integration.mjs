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
  /Choose your education level/,
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
  /Approved Safe Room responder permission/,
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
  /active account/i,
);
await assert.rejects(
  () => asUser(student, "select set_my_grade('Form 5')"),
  /active account/i,
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
assert.equal(
  (await asUser(student, "select answer_quiz(1,0) result")).rows[0].result
    .points,
  10,
);
await assert.rejects(
  () => asUser(student, "select answer_quiz(2,null)"),
  /Invalid question or answer/,
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
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into classrooms(owner_id,title,grade) values('${student}','Student denied room','Form 4')`,
    ),
  /row-level security/,
);
await db.query(`update profiles set role='teacher' where id='${student}'`);
const paid = (
  await asUser(
    student,
    `insert into classrooms(owner_id,title,grade,price_minor) values('${student}','Paid maths class','Form 4',100) returning *`,
  )
).rows[0];
await db.query(`update profiles set role='student' where id='${student}'`);
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
// Feature workflows: exercise real authorization boundaries, not only schema presence.
await db.exec("update profiles set suspended=false");
await asUser(
  student,
  "select update_my_profile('Test learner','Test','Learner','Zimbabwe','Private profile bio',false)",
);
assert.equal(
  (await asUser(student, "select role from profiles where id=auth.uid()"))
    .rows[0].role,
  "student",
);
await assert.rejects(
  () =>
    asUser(
      student,
      `select set_educator_role('${other}','teacher','self promotion')`,
    ),
  /Administrator/,
);
await asUser(
  admin,
  `select set_educator_role('${other}','creator','Staff verification completed')`,
);
await asUser(
  other,
  "select update_my_profile('Verified teacher','Test','Teacher','Zimbabwe','Science lessons',true)",
);
await db.exec("set role anon");
const directory = (await db.query("select * from educator_directory()")).rows;
assert.equal(directory.length, 1);
assert.equal(directory[0].display_name, "Verified teacher");
assert.equal("country" in directory[0], false);
await db.exec("reset role");
await asUser(student, `select follow_educator('${other}',true)`);
await asUser(student, `select follow_educator('${other}',true)`);
assert.equal(
  (await asUser(student, "select * from educator_follows")).rows.length,
  1,
);
assert.equal(
  (await asUser(other, "select * from educator_follows")).rows.length,
  0,
);
await asUser(
  student,
  "insert into language_reviews(user_id,unit_key) values(auth.uid(),'French:0')",
);
assert.equal(
  (await asUser(other, "select * from language_reviews")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `insert into language_reviews(user_id,unit_key) values('${student}','French:1')`,
    ),
  /row-level security/,
);
const revised = "99999999-1111-4111-8111-111111111111";
await asUser(
  student,
  `insert into entries(id,owner_id,kind,title,description,category,author,level) values('${revised}',auth.uid(),'book','Original title','A meaningful original description','Science','Test','Form 4')`,
);
await asUser(
  student,
  `select revise_submission('${revised}','Revised title','A meaningful revised description for review')`,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `select revise_submission('${revised}','Stolen title','A meaningful description from a different learner')`,
    ),
  /Only your/,
);
await asUser(
  student,
  `insert into reader_progress(user_id,entry_id,page) values(auth.uid(),'${revised}',12)`,
);
assert.equal(
  (await asUser(other, "select * from reader_progress")).rows.length,
  0,
);
await asUser(
  student,
  "insert into account_requests(user_id,kind,message) values(auth.uid(),'deletion','Please delete my account')",
);
assert.equal(
  (await asUser(other, "select * from account_requests")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      student,
      "insert into account_requests(user_id,kind,message) values(auth.uid(),'deletion','Duplicate request')",
    ),
  /duplicate key/,
);
const accountRequest = (
  await asUser(student, "select id from account_requests")
).rows[0].id;
await assert.rejects(
  () =>
    asUser(
      student,
      `select respond_account_request('${accountRequest}','pretend reply','answered')`,
    ),
  /Administrator/,
);
await asUser(
  admin,
  `select respond_account_request('${accountRequest}','We are reviewing this deletion request','processing')`,
);
const lessonId = "99999999-2222-4222-8222-222222222222";
await asUser(
  admin,
  `insert into lessons(id,language_id,title,level,content,active) select '${lessonId}',id,'French practice','beginner','{"body":"A real lesson with meaningful learning content","question":"Hello in French?","answer":"Bonjour"}',true from languages where name='French'`,
);
const paidPlan = (
  await asUser(
    admin,
    "select configure_plan(null,'Course access',500,'USD','[\"Language courses\"]',true,'Add test plan') id",
  )
).rows[0].id;
await asUser(
  admin,
  `select save_plan_product('${paidPlan}','test-course-plan','test-course-entitlement','Map verified product')`,
);
await asUser(
  admin,
  `select save_feature_access('language_courses','subscription','${paidPlan}',null,'Require verified plan')`,
);
assert.equal(
  (await asUser(student, `select * from lessons where id='${lessonId}'`)).rows
    .length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      student,
      "insert into purchase_access(user_id,product_id) values(auth.uid(),'test-course-plan')",
    ),
  /row-level security|permission denied/,
);
await db.exec(
  `select sync_purchase_access('${student}','[{"product_id":"test-course-plan","expires_at":null}]',now())`,
);
assert.equal(
  (await asUser(student, `select * from lessons where id='${lessonId}'`)).rows
    .length,
  1,
);
assert.equal(
  (await asUser(other, `select * from lessons where id='${lessonId}'`)).rows
    .length,
  0,
);
await asUser(
  admin,
  "select save_feature_access('language_courses','free',null,null,'Restore free access')",
);
await asUser(
  admin,
  `select save_store_product('test-course-plan','test-course-entitlement','${room.id}','Change product target')`,
);
assert.equal(
  (
    await db.query(
      "select plan_id from store_products where product_id='test-course-plan'",
    )
  ).rows[0].plan_id,
  null,
);
await db.query(
  `update profiles set account_type='teacher' where id='${student}'`,
);
await db.query(
  "insert into earnings_policies(role,view_rate,minimum_payout_minor,currency,active) values('teacher',99,1,'USD',true)",
);
await asUser(other, `select begin_content_usage('${book}')`);
assert.equal(
  Number(
    (
      await db.query(
        `select rate from content_usage where entry_id='${book}' and viewer_id='${other}'`,
      )
    ).rows[0].rate,
  ),
  0.025,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `select manage_funding('${aid}','agreement',500,'USD','Proposed terms','Unauthorised funding')`,
    ),
  /Administrator/,
);
const fundingCase = (
  await asUser(
    admin,
    `select manage_funding('${aid}','negotiation',500,'USD','Proposed support terms','Reviewed support need') id`,
  )
).rows[0].id;
await asUser(
  student,
  `insert into funding_messages(agreement_id,author_id,body) values('${fundingCase}',auth.uid(),'A private case update')`,
);
assert.equal(
  (await asUser(other, "select * from funding_messages")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `insert into funding_messages(agreement_id,author_id,body) values('${fundingCase}',auth.uid(),'Unrelated learner update')`,
    ),
  /row-level security/,
);
await asUser(
  admin,
  `select manage_funding('${aid}','completed',500,'USD','Proposed support terms','Case review completed')`,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into funding_messages(agreement_id,author_id,body) values('${fundingCase}',auth.uid(),'Closed case update')`,
    ),
  /row-level security/,
);
// Expanded requirements: international equivalence, communication and verified staff.
await asUser(student, "select set_my_education('GB','Year 12')");
assert.deepEqual(
  (
    await asUser(
      student,
      "select grade,education_ordinal from profiles where id=auth.uid()",
    )
  ).rows[0],
  { grade: "Form 5", education_ordinal: 12 },
);
await asUser(student, "select set_my_identity('quiz_learner',null)");
await assert.rejects(
  () => asUser(other, "select set_my_identity('QUIZ_LEARNER',null)"),
  /duplicate key/,
);
await assert.rejects(
  () =>
    asUser(
      other,
      `select set_my_identity('another_name','${student}/photo.png')`,
    ),
  /own profile picture/,
);
const dm = (
  await asUser(
    student,
    `insert into direct_messages(sender_id,recipient_id,body) values(auth.uid(),'${other}','Private test message') returning id`,
  )
).rows[0].id;
assert.equal(
  (await asUser(existingUser, "select * from direct_messages")).rows.length,
  0,
);
assert.equal(
  (await asUser(other, "select * from direct_messages")).rows.length,
  1,
);
await asUser(
  other,
  `insert into user_blocks(user_id,blocked_id) values(auth.uid(),'${student}')`,
);
await assert.rejects(
  () =>
    asUser(
      student,
      `insert into direct_messages(sender_id,recipient_id,body) values(auth.uid(),'${other}','Blocked message')`,
    ),
  /row-level security/,
);
await assert.rejects(
  () =>
    asUser(
      existingUser,
      `insert into chat_reports(reporter_id,direct_message,reason) values(auth.uid(),'${dm}','Cannot report an unread private conversation')`,
    ),
  /row-level security/,
);
await asUser(
  other,
  `insert into chat_reports(reporter_id,direct_message,reason) values(auth.uid(),'${dm}','Reported message for moderator review')`,
);
assert.equal(
  (await asUser(admin, "select * from reported_messages()")).rows.length,
  1,
);
await asUser(
  student,
  `insert into staff_applications(user_id,kind,subject,statement,id_path,video_path) values(auth.uid(),'teacher','Science','I have experience teaching science lessons','${student}/id.png','${student}/teaching.mp4')`,
);
const application = (
  await asUser(
    student,
    "select id from staff_applications where kind='teacher'",
  )
).rows[0].id;
await assert.rejects(
  () =>
    asUser(
      student,
      `select review_staff('${application}',true,'Approve myself')`,
    ),
  /Administrator/,
);
assert.equal(
  (await asUser(other, "select * from staff_applications")).rows.length,
  0,
);
await asUser(
  admin,
  `select review_staff('${application}',true,'Identity and teaching demonstration reviewed')`,
);
assert.equal(
  (await asUser(student, "select role from profiles where id=auth.uid()"))
    .rows[0].role,
  "teacher",
);
const verifiedPost = "99999999-3333-4333-8333-333333333333";
await asUser(
  student,
  `insert into entries(id,owner_id,kind,title,description,category,author,level) values('${verifiedPost}',auth.uid(),'course','Verified teacher post','An automatically published verified teacher lesson','Science','Forged author','Form 5')`,
);
assert.equal(
  (await db.query(`select status from entries where id='${verifiedPost}'`))
    .rows[0].status,
  "approved",
);
assert.notEqual(
  (await db.query(`select author from entries where id='${verifiedPost}'`))
    .rows[0].author,
  "Forged author",
);
await db.exec(`update profiles set role='student' where id='${student}'`);
// Harness broad grants are removed here to also exercise the production column grants.
await db.exec(
  "revoke all on quiz_sets,direct_messages from authenticated; grant select(id,user_id,group_id,category,month,cursor,score,correct_count,status,started_at,finished_at,elapsed_ms) on quiz_sets to authenticated; grant select,insert on direct_messages to authenticated; grant update(read_at) on direct_messages to authenticated",
);
await assert.rejects(
  () =>
    asUser(
      other,
      `update direct_messages set body='Tampered' where id='${dm}'`,
    ),
  /permission denied/,
);
assert.equal((await asUser(student, "select * from quiz_bank")).rows.length, 0);
const timedSet = (await asUser(student, "select start_quiz('hard') id")).rows[0]
  .id;
await assert.rejects(
  () =>
    asUser(student, `select snapshot from quiz_sets where id='${timedSet}'`),
  /permission denied/,
);
await assert.rejects(
  () => asUser(other, `select quiz_next('${timedSet}')`),
  /not found/,
);
const snapshot = (
  await db.query(`select snapshot from quiz_sets where id='${timedSet}'`)
).rows[0].snapshot;
assert.equal(snapshot.length, 10);
assert.equal(new Set(snapshot.map((q) => q.id)).size, 10);
for (let n = 0; n < 10; n++) {
  const issued = (await asUser(student, `select quiz_next('${timedSet}') q`))
    .rows[0].q;
  assert.equal(issued.position, n);
  assert.equal("correct" in issued, false);
  if (n === 0)
    await db.query(
      `update quiz_sets set issued_at=now()-interval '31 seconds' where id='${timedSet}'`,
    );
  const answer = (
    await asUser(
      student,
      `select submit_quiz_answer('${timedSet}',${n},${snapshot[n].correct}) r`,
    )
  ).rows[0].r;
  assert.equal(answer.points, n === 0 ? -3 : 10);
  if (n === 0)
    assert.deepEqual(
      (
        await asUser(
          student,
          `select submit_quiz_answer('${timedSet}',0,${snapshot[0].correct}) r`,
        )
      ).rows[0].r,
      answer,
    );
}
assert.equal(
  (await asUser(student, "select * from timed_quiz_leaderboard('hard')"))
    .rows[0].points,
  87,
);
const nextSet = (await asUser(student, "select start_quiz('hard') id")).rows[0]
  .id;
const nextSnapshot = (
  await db.query(`select snapshot from quiz_sets where id='${nextSet}'`)
).rows[0].snapshot;
assert.equal(
  nextSnapshot.some((q) => snapshot.some((old) => old.id === q.id)),
  false,
  "Hard questions cannot be farmed repeatedly in one month",
);
const prior = (
  await db.query(
    "select (date_trunc('month',now() at time zone 'UTC')-interval '1 month')::date::text as period",
  )
).rows[0].period;
await db.query(`update quiz_sets set month='${prior}' where id='${timedSet}'`);
await asUser(admin, `select close_quiz_month('${prior}')`);
await asUser(admin, `select close_quiz_month('${prior}')`);
const reward = (
  await db.query(`select * from quiz_monthly_rewards where month='${prior}'`)
).rows;
assert.equal(reward.length, 1);
assert.equal(reward[0].amount_minor, 1500);
await assert.rejects(
  () =>
    asUser(
      student,
      `select review_quiz_reward('${reward[0].id}',true,'Self credit attempt')`,
    ),
  /Administrator/,
);
await asUser(
  admin,
  `select review_quiz_reward('${reward[0].id}',true,'Competition results verified')`,
);
await assert.rejects(
  () =>
    asUser(
      admin,
      `select review_quiz_reward('${reward[0].id}',true,'Duplicate credit attempt')`,
    ),
  /Pending reward not found/,
);
assert.equal(
  (
    await db.query(
      `select count(*)::int count from creator_ledger where quiz_reward_id='${reward[0].id}'`,
    )
  ).rows[0].count,
  1,
);

// Admin signup never trusts role metadata; only an active owner may approve.
const applicant = "aaaabbbb-1111-4111-8111-111111111111";
const rejectedApplicant = "aaaabbbb-2222-4222-8222-222222222222";
await db.exec(`insert into auth.users(id,raw_user_meta_data) values
 ('${applicant}','{"account_type":"admin","role":"owner","username":"admin_candidate"}'),
 ('${rejectedApplicant}','{"account_type":"admin","username":"admin_rejected"}');`);
assert.equal(
  (await db.query(`select role from profiles where id='${applicant}'`)).rows[0]
    .role,
  "student",
);
assert.equal(
  (await asUser(applicant, "select * from admin_access_requests")).rows.length,
  1,
);
assert.equal(
  (await asUser(other, "select * from admin_access_requests")).rows.length,
  0,
);
await assert.rejects(
  () =>
    asUser(
      applicant,
      `select review_admin_access('${applicant}',true,'Self promotion')`,
    ),
  /Owner permission/,
);
await assert.rejects(
  () =>
    asUser(
      applicant,
      `insert into admin_access_requests(user_id,status) values('${other}','approved')`,
    ),
  /row-level security|permission denied/,
);
await asUser(
  applicant,
  `update admin_access_requests set status='approved' where user_id='${applicant}'`,
);
assert.equal(
  (
    await db.query(
      `select status from admin_access_requests where user_id='${applicant}'`,
    )
  ).rows[0].status,
  "pending",
);
await db.exec(`update profiles set suspended=false where id='${admin}';`);
await assert.rejects(
  () => asUser(admin, `select review_admin_access('${applicant}',true,'')`),
  /Explain your decision/,
);
await db.exec(`update profiles set suspended=true where id='${applicant}'`);
await assert.rejects(
  () =>
    asUser(
      admin,
      `select review_admin_access('${applicant}',true,'Reviewed applicant')`,
    ),
  /active non-administrative/,
);
await db.exec(`update profiles set suspended=false where id='${applicant}'`);
await asUser(
  admin,
  `select review_admin_access('${applicant}',true,'Verified staff identity')`,
);
assert.equal(
  (await asUser(applicant, "select is_admin() allowed")).rows[0].allowed,
  true,
);
await assert.rejects(
  () =>
    asUser(
      applicant,
      `select review_admin_access('${rejectedApplicant}',true,'Admin cannot grant access')`,
    ),
  /Owner permission/,
);
await assert.rejects(
  () =>
    asUser(
      admin,
      `select review_admin_access('${applicant}',true,'Duplicate approval')`,
    ),
  /Pending request/,
);
await asUser(
  admin,
  `select review_admin_access('${rejectedApplicant}',false,'Not authorised staff')`,
);
assert.equal(
  (await db.query(`select role from profiles where id='${rejectedApplicant}'`))
    .rows[0].role,
  "student",
);
assert.equal(
  (
    await db.query(
      `select count(*)::int n from audit_log where entity_id='${applicant}' and action='admin_access.approved'`,
    )
  ).rows[0].n,
  1,
);
console.log(
  "PASS: admin signup, isolation, owner-only review, suspension, rejection, audit and duplicate protection.",
);

// Study AI quota is service-only; owner settings and usage rows stay protected.
const aiStudent = "aaaabbbb-3333-4333-8333-333333333333";
await db.exec(`insert into auth.users(id) values('${aiStudent}');`);
async function reserveAI(id) {
  await db.exec("set role service_role");
  try {
    return await db.query(`select reserve_study_ai('${id}') remaining`);
  } finally {
    await db.exec("reset role");
  }
}
await assert.rejects(
  () => asUser(aiStudent, `select reserve_study_ai('${aiStudent}')`),
  /permission denied/,
);
await assert.rejects(
  () => asUser(aiStudent, "select configure_study_ai(true,2,3)"),
  /Owner permission/,
);
await assert.rejects(() => reserveAI(aiStudent), /AI_DISABLED/);
await asUser(admin, "select configure_study_ai(true,2,3)");
assert.equal((await reserveAI(aiStudent)).rows[0].remaining, 1);
await assert.rejects(() => reserveAI(aiStudent), /AI_TOO_FAST/);
assert.equal(
  (await asUser(aiStudent, "select * from study_ai_usage")).rows.length,
  1,
);
assert.equal(
  (await asUser(other, "select * from study_ai_usage")).rows.length,
  0,
);
await asUser(aiStudent, "update study_ai_usage set requests=1");
await asUser(aiStudent, "update study_ai_settings set daily_user_limit=50");
assert.equal(
  (await db.query("select daily_user_limit from study_ai_settings")).rows[0]
    .daily_user_limit,
  2,
);
await db.exec(
  `update study_ai_usage set last_request_at=now()-interval '20 seconds' where user_id='${aiStudent}'`,
);
assert.equal((await reserveAI(aiStudent)).rows[0].remaining, 0);
await db.exec(
  `update study_ai_usage set last_request_at=now()-interval '20 seconds' where user_id='${aiStudent}'`,
);
await assert.rejects(() => reserveAI(aiStudent), /AI_DAILY_LIMIT/);
await reserveAI(rejectedApplicant);
await assert.rejects(() => reserveAI(admin), /AI_DAILY_LIMIT/);
await db.exec(`update profiles set suspended=true where id='${aiStudent}'`);
await assert.rejects(() => reserveAI(aiStudent), /AI_ACCOUNT_INACTIVE/);
await asUser(admin, "select configure_study_ai(false,10,100)");
await assert.rejects(() => reserveAI(admin), /AI_DISABLED/);
console.log(
  "PASS: AI disabled default, owner configuration, service-only atomic quotas, isolation, cooldown, daily caps and suspended accounts.",
);
await db.close();
console.log(
  "PASS: migrations, RLS, quiz integrity, moderation, private push queue, verified purchases/refunds, classroom access, reviewed earnings and payout reservation.",
);
