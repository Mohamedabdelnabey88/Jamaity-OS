
export type VoucherProfile={name_ar:string;name_en?:string|null;charity_code?:string|null;city?:string|null;region?:string|null;logo_url?:string|null};
export type VoucherDocument={voucher_no:string;voucher_type:string;transaction_date:string;amount:number;party_name?:string|null;description:string;payment_method:string;external_reference?:string|null;debit_code?:string|null;debit_account?:string|null;credit_code?:string|null;credit_account?:string|null;journal_entry_id?:string|null;status:string};

const typeLabels:Record<string,string>={receipt:'سند قبض',payment:'سند صرف',expense:'سند مصروف',purchase:'سند مشتريات'};
const methodLabels:Record<string,string>={cash:'نقدي',bank:'بنك',transfer:'تحويل بنكي',credit:'آجل'};

export async function buildVoucherPdf(v:VoucherDocument,p:VoucherProfile){
 if('fonts' in document)await document.fonts.ready;
 const W=1240,H=1754,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('تعذر تجهيز مستند السند.');
 const green='#215b49',ink='#17261f',muted='#6c7c75',line='#dce6e1',soft='#f3f8f5';
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.direction='rtl';ctx.textAlign='right';ctx.textBaseline='top';
 ctx.fillStyle=green;ctx.fillRect(0,0,W,18);

 if(p.logo_url){try{const logo=await loadImage(p.logo_url);const max=108,scale=Math.min(max/logo.naturalWidth,max/logo.naturalHeight);ctx.drawImage(logo,80,65,logo.naturalWidth*scale,logo.naturalHeight*scale)}catch{}}
 ctx.fillStyle=ink;ctx.font='800 42px Tajawal, Tahoma, Arial, sans-serif';ctx.fillText(p.name_ar||'الجمعية',W-80,65);
 ctx.fillStyle=muted;ctx.font='500 22px Tajawal, Tahoma, Arial, sans-serif';
 const meta=[p.charity_code?'رمز الجمعية: '+p.charity_code:'',p.city||'',p.region||''].filter(Boolean).join(' · ');if(meta)ctx.fillText(meta,W-80,120);

 ctx.fillStyle=soft;roundRect(ctx,80,190,W-160,150,24);ctx.fill();
 ctx.fillStyle=green;ctx.font='800 46px Tajawal, Tahoma, Arial, sans-serif';ctx.fillText(typeLabels[v.voucher_type]||'سند مالي',W-110,220);
 ctx.font='700 24px Tajawal, Tahoma, Arial, sans-serif';ctx.fillText('رقم السند: '+v.voucher_no,W-110,282);

 const rows:[string,string][]=[
  ['التاريخ',new Date(v.transaction_date).toLocaleDateString('ar-SA')],
  [v.voucher_type==='receipt'?'استلمنا من':'الجهة / المستفيد / المورد',v.party_name||'—'],
  ['المبلغ',Number(v.amount||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ريال سعودي'],
  ['المبلغ كتابة',amountToArabicWords(Number(v.amount||0))],
  ['طريقة السداد',methodLabels[v.payment_method]||v.payment_method],
  ['البيان',v.description||'—'],
  ['المرجع الخارجي',v.external_reference||'—'],
  ['الحساب المدين',[v.debit_code,v.debit_account].filter(Boolean).join(' — ')||'—'],
  ['الحساب الدائن',[v.credit_code,v.credit_account].filter(Boolean).join(' — ')||'—'],
  ['رقم القيد',v.journal_entry_id||'—'],
  ['الحالة',v.status==='posted'?'مرحّل':'ملغي']
 ];
 let y=390;
 for(const row of rows){
  const label=row[0],value=row[1],tall=label==='البيان'||label==='المبلغ كتابة',h=tall?115:78;
  ctx.fillStyle='#fbfcfb';roundRect(ctx,80,y,W-160,h,14);ctx.fill();ctx.strokeStyle=line;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=muted;ctx.font='700 20px Tajawal, Tahoma, Arial, sans-serif';ctx.fillText(label,W-105,y+18);
  ctx.fillStyle=ink;ctx.font='500 22px Tajawal, Tahoma, Arial, sans-serif';
  const wrapped=wrapText(ctx,value,W-420);let ty=y+18;for(const w of wrapped.slice(0,3)){ctx.fillText(w,W-320,ty,W-420);ty+=30}
  y+=tall?128:91;
 }
 y=Math.max(y+30,1410);ctx.strokeStyle=line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(100,y);ctx.lineTo(350,y);ctx.moveTo(495,y);ctx.lineTo(745,y);ctx.moveTo(890,y);ctx.lineTo(1140,y);ctx.stroke();
 ctx.fillStyle=muted;ctx.font='600 18px Tajawal, Tahoma, Arial, sans-serif';ctx.textAlign='center';ctx.fillText('المستلم / الدافع',225,y+12);ctx.fillText('المحاسب',620,y+12);ctx.fillText('الاعتماد',1015,y+12);ctx.textAlign='right';
 ctx.fillStyle='#f7faf8';ctx.fillRect(0,H-105,W,105);ctx.fillStyle=muted;ctx.font='500 17px Tajawal, Tahoma, Arial, sans-serif';ctx.fillText('تم إنشاء هذا المستند إلكترونيًا من نظام جمعيتي — ويرتبط بالسجل المحاسبي وسجل التدقيق.',W-80,H-72);
 return imageJpegToPdf(dataUrlToBytes(canvas.toDataURL('image/jpeg',0.96)),W,H);
}

export function voucherFileName(v:VoucherDocument){return (typeLabels[v.voucher_type]||'سند')+'-'+v.voucher_no+'.pdf'}

function loadImage(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('logo'));img.src=url})}
function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function wrapText(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){const out:string[]=[];for(const para of text.split(/\n/)){if(!para.trim()){out.push('');continue}const words=para.split(/\s+/);let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width<=maxWidth||!line)line=next;else{out.push(line);line=word}}if(line)out.push(line)}return out}

function amountToArabicWords(amount:number){const riyals=Math.floor(amount),halalas=Math.round((amount-riyals)*100);return numberToArabic(riyals)+' ريال سعودي'+(halalas?' و'+numberToArabic(halalas)+' هللة':'')+' فقط لا غير'}
function numberToArabic(n:number):string{
 if(!Number.isFinite(n)||n<0)return String(n);if(n===0)return'صفر';if(n>999999999)return n.toLocaleString('ar-SA');
 const ones=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
 const tens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
 const hundreds=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
 const under100=(x:number)=>x<20?ones[x]:(x%10?ones[x%10]+' و':'')+tens[Math.floor(x/10)];
 const under1000=(x:number)=>{const h=Math.floor(x/100),r=x%100;return(h?hundreds[h]:'')+(h&&r?' و':'')+(r?under100(r):'')};
 const parts:string[]=[];const millions=Math.floor(n/1000000);n%=1000000;if(millions)parts.push(millions===1?'مليون':millions===2?'مليونان':millions<=10?under1000(millions)+' ملايين':under1000(millions)+' مليون');
 const thousands=Math.floor(n/1000);n%=1000;if(thousands)parts.push(thousands===1?'ألف':thousands===2?'ألفان':thousands<=10?under1000(thousands)+' آلاف':under1000(thousands)+' ألف');if(n)parts.push(under1000(n));return parts.join(' و')
}
function dataUrlToBytes(dataUrl:string){const binary=atob(dataUrl.split(',')[1]||''),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function ascii(v:string){return new TextEncoder().encode(v)}
function concat(parts:Uint8Array[]){const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let off=0;for(const p of parts){out.set(p,off);off+=p.length}return out}
function imageJpegToPdf(jpeg:Uint8Array,imgW:number,imgH:number){
 const pageW=595.28,pageH=841.89,content='q\\n'+pageW+' 0 0 '+pageH+' 0 0 cm\\n/Im0 Do\\nQ\\n';
 const objects:Uint8Array[]=[ascii('<< /Type /Catalog /Pages 2 0 R >>'),ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),concat([ascii('<< /Type /XObject /Subtype /Image /Width '+imgW+' /Height '+imgH+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\\nstream\\n'),jpeg,ascii('\\nendstream')]),ascii('<< /Length '+ascii(content).length+' >>\\nstream\\n'+content+'endstream')];
 const header=ascii('%PDF-1.4\\n%âãÏÓ\\n'),chunks:Uint8Array[]=[header],offsets:number[]=[0];let cursor=header.length;
 objects.forEach((obj,index)=>{offsets.push(cursor);const pre=ascii(String(index+1)+' 0 obj\\n'),post=ascii('\\nendobj\\n');chunks.push(pre,obj,post);cursor+=pre.length+obj.length+post.length});
 const xrefOffset=cursor;let xref='xref\\n0 '+String(objects.length+1)+'\\n0000000000 65535 f \\n';for(let i=1;i<offsets.length;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \\n';xref+='trailer\\n<< /Size '+String(objects.length+1)+' /Root 1 0 R >>\\nstartxref\\n'+String(xrefOffset)+'\\n%%EOF';chunks.push(ascii(xref));return new Blob([concat(chunks)],{type:'application/pdf'})
}
