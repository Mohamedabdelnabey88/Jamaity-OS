export function publicItemPath(charityId:string,kind:'campaign'|'post',itemId:string){
 return kind==='campaign'?`/charity/${encodeURIComponent(charityId)}#campaign-${encodeURIComponent(itemId)}`:`/charity/${encodeURIComponent(charityId)}/post/${encodeURIComponent(itemId)}`;
}
export function promotionText(charityName:string,title:string,url:string,inKind=false,completed=false){
 return `${title}\n${charityName}\n${completed?'من سجل حملات الجمعية — تعرّف على تفاصيل الحملة المنتهية ونتائجها.':inKind?'ساهم بتبرع عيني وتواصل مع الجمعية لتنسيق التسليم.':'تعرّف على المبادرة وطريقة المساهمة عبر الحساب البنكي للجمعية.'}\n${url}`;
}
export function safeHttps(value?:string|null){try{return value&&new URL(value).protocol==='https:'?value:undefined}catch{return undefined}}
