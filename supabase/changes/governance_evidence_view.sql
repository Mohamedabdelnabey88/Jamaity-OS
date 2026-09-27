CREATE OR REPLACE FUNCTION public.governance_center()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid; items jsonb; total int; ready_count int; overdue_count int;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 c:=private.current_charity_id();
 if c is null or not (private.has_permission('governance.view') or private.has_permission('governance.manage')) then raise exception 'forbidden'; end if;
 perform private.ensure_governance_requirements(c);
 select count(*),count(*) filter(where status='ready'),count(*) filter(where due_date<current_date and status not in ('ready','not_applicable')) into total,ready_count,overdue_count from public.governance_requirements where charity_id=c and status<>'not_applicable';
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'code',g.code,'category',g.category,'title_ar',g.title_ar,'description_ar',g.description_ar,'status',g.status,'due_date',g.due_date,'completed_at',g.completed_at,'evidence_count',(select count(*) from public.governance_evidence e where e.requirement_id=g.id and e.charity_id=c),'evidence',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title_ar',e.title_ar,'object_path',e.object_path,'expires_at',e.expires_at,'created_at',e.created_at) order by e.created_at desc),'[]'::jsonb) from public.governance_evidence e where e.requirement_id=g.id and e.charity_id=c)) order by g.category,g.title_ar),'[]'::jsonb) into items from public.governance_requirements g where g.charity_id=c;
 return jsonb_build_object('score',case when total=0 then 100 else round((ready_count::numeric/total)*100) end,'ready',ready_count,'total',total,'overdue',overdue_count,'items',items);
end $function$;
