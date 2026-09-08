export function publicItemPath(charityId:string,kind:'campaign'|'post',itemId:string){
 return `/charity/${encodeURIComponent(charityId)}/${kind}/${encodeURIComponent(itemId)}`;
}
export function promotionText(charityName:string,title:string,url:string,inKind=false){
 return `${title}\n${charityName}\n${inKind?'ساهم بتبرع عيني وتواصل مع الجمعية لتنسيق التسليم.':'تعرّف على المبادرة وطريقة المساهمة عبر الحساب البنكي للجمعية.'}\n${url}`;
}
export function safeHttps(value?:string|null){try{return value&&new URL(value).protocol==='https:'?value:undefined}catch{return undefined}}
