export const fields={monthly_income:'دخل الأسرة الشهري',monthly_rent:'الإيجار الشهري',household_size:'عدد أفراد المنزل',dependents:'عدد المعالين'};
export function reviewHousehold(profile){
 const facts=[],missing=[],questions=[];const numbers={};
 for(const [key,label] of Object.entries(fields)){const raw=profile?.[key];const n=raw===null||raw===undefined||raw===''?NaN:Number(raw);if(!Number.isFinite(n)||n<0||(key==='household_size'&&(!Number.isInteger(n)||n<1))||(key==='dependents'&&!Number.isInteger(n))){missing.push(label);continue}numbers[key]=n;facts.push({text:`${label}: ${n.toLocaleString('ar-SA')}`,sources:[key]})}
 const {monthly_income:income,monthly_rent:rent,household_size:size,dependents}=numbers;
 if(income!==undefined&&size){facts.push({text:`دخل الفرد الشهري: ${(income/size).toFixed(2)} ر.س`,sources:['monthly_income','household_size']})}
 if(income!==undefined&&rent!==undefined){facts.push({text:`المتبقي للأسرة بعد الإيجار: ${(income-rent).toFixed(2)} ر.س`,sources:['monthly_income','monthly_rent']});if(rent>income)questions.push({text:'الإيجار أكبر من الدخل المصرح به؛ ما مصادر تغطية الفرق؟',sources:['monthly_income','monthly_rent']})}
 if(dependents!==undefined&&size&&dependents>=size)questions.push({text:'راجع عدد المعالين مقارنة بإجمالي المقيمين شاملًا مقدم الطلب.',sources:['dependents','household_size']});
 if(income===0)questions.push({text:'هل توجد مساعدات دورية أو مصادر أخرى لمعيشة الأسرة؟',sources:['monthly_income']});
 questions.push({text:'ما الفترة التي تغطيها إفادة الدخل، وهل يوجد شاهد حديث يطابقها؟',sources:['monthly_income']});
 return {version:'household-review-v1',facts,missing,questions,numbers};
}
export const reviewSchema={type:'object',additionalProperties:false,required:['summary','questions','limitations'],properties:{summary:{type:'string'},questions:{type:'array',items:{type:'object',additionalProperties:false,required:['text','sources'],properties:{text:{type:'string'},sources:{type:'array',items:{type:'string',enum:Object.keys(fields)}}}}},limitations:{type:'array',items:{type:'string'}}}};
export function validModelReview(value){return value&&Object.keys(value).sort().join(',')==='limitations,questions,summary'&&typeof value.summary==='string'&&value.summary.length<=2000&&Array.isArray(value.questions)&&value.questions.length<=8&&value.questions.every(q=>typeof q.text==='string'&&q.text.length<=700&&Array.isArray(q.sources)&&q.sources.length>0&&q.sources.every(k=>k in fields))&&Array.isArray(value.limitations)&&value.limitations.length<=6&&value.limitations.every(x=>typeof x==='string'&&x.length<=700)}
