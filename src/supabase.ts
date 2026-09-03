import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):({auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({error:new Error('أضف إعدادات Supabase في ملف .env.local')}),signUp:async()=>({error:new Error('أضف إعدادات Supabase في ملف .env.local')}),signOut:async()=>{}},from:()=>({select:()=>({eq:()=>({limit:()=>({maybeSingle:async()=>({data:null})})})})})} as any);
