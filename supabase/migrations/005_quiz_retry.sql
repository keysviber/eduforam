-- Network retries must return the original score, never award points twice.
create or replace function public.answer_quiz(question integer,selected integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q quiz_questions; earned integer; begin
 if not public.is_active() then raise exception 'Sign in to earn Guru Student points'; end if;
 select * into q from quiz_questions where id=question;
 if not found or selected is null or selected<0 or selected>=jsonb_array_length(q.choices) then
   raise exception 'Invalid question or answer';
 end if;
 earned:=case when q.answer=selected then 10 else 0 end;
 insert into quiz_answers values(auth.uid(),question,selected,earned) on conflict(user_id,question_id) do nothing;
 select points into earned from quiz_answers where user_id=auth.uid() and question_id=question;
 return jsonb_build_object('points',earned,'explanation',q.explanation);
end $$;
revoke all on function public.answer_quiz(integer,integer) from public,anon;
grant execute on function public.answer_quiz(integer,integer) to authenticated;
