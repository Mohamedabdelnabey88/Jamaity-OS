/** Bound all Supabase fetches, including auth and Storage, without retrying mutations. */
export async function boundedFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response> {
 const controller=new AbortController();
 const upstream=init?.signal||(input instanceof Request?input.signal:null);
 const abort=()=>controller.abort(upstream?.reason);
 if(upstream?.aborted)abort();else upstream?.addEventListener('abort',abort,{once:true});
 const upload=String(input).includes('/storage/v1/');
 const timer=setTimeout(()=>controller.abort(new DOMException('انتهت مهلة الاتصال. أعد المحاولة.','TimeoutError')),upload?120000:20000);
 try{return await fetch(input,{...init,signal:controller.signal});}
 finally{clearTimeout(timer);upstream?.removeEventListener('abort',abort);}
}
export function friendlyError(error:unknown):string {
 const message=error&&typeof error==='object'&&'message' in error?String(error.message):String(error);
 const known:Record<string,string>={invalid_account_code:'استخدم كودًا من ٢ إلى ٢٠ حرفًا لاتينيًا أو رقمًا أو نقطة أو شرطة.',invalid_account_name:'أدخل اسم حساب صحيحًا لا يتجاوز ٢٠٠ حرف.',account_identity_locked:'لا يمكن تغيير كود الحساب أو تصنيفه بعد إنشائه.',accounting_period_closed:'الفترة المالية مقفلة. اختر فترة مفتوحة أو أعد فتحها بصلاحية مناسبة.',journal_not_balanced:'إجمالي المدين لا يساوي إجمالي الدائن.',already_reversed:'تم عكس هذا القيد بالفعل.',account_not_found:'الحساب غير متاح أو غير نشط في جمعيتك.',invalid_journal_line:'راجع بنود القيد: مبلغ موجب في طرف واحد لكل بند.',period_not_found:'الفترة المالية غير متاحة.',budget_not_found_or_not_draft:'الموازنة غير متاحة أو سبق اعتمادها.',posted_entry_immutable:'لا يمكن تعديل قيد مرحّل. استخدم العكس لتصحيحه.',charity_code_mismatch:'كود الجمعية لا يطابق الدعوة.',invitation_email_mismatch_or_unconfirmed:'استخدم بريد الدعوة وفعّل البريد الإلكتروني أولًا.',account_already_linked:'هذا الحساب مرتبط بجمعية بالفعل. تواصل مع إدارة المنصة.',platform_account_cannot_join_charity:'حساب إدارة المنصة مستقل ولا يمكن ضمه لجمعية.',invitation_expired_or_invalid:'الدعوة منتهية أو مستخدمة أو أُلغيت. اطلب دعوة جديدة.',charity_unavailable:'الجمعية غير مفعلة حاليًا.',forbidden:'لا تملك صلاحية تنفيذ هذا الإجراء.',active_invitation_exists:'توجد دعوة سارية لهذا البريد. يمكنك إلغاء السابقة أولًا.'};
 return (/duplicate key.*accounting_accounts/i.test(message)?'كود الحساب مستخدم بالفعل. اختر كودًا مختلفًا.':known[message])||(/fetch|abort|timeout|network/i.test(message)?'تعذر الاتصال بالخدمة. تحقق من الإنترنت وأعد المحاولة.':message);
}
