export type LetterLayout={
  contentTopMm:number;
  contentSideMm:number;
  fontSizePt:number;
};

export type LetterRenderResult={
  pdfBlob:Blob;
  jpegDataUrl:string;
};

const A4_W=1240;
const A4_H=1754;

export function applyTemplate(template:string,values:Record<string,string>){
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g,(_,key)=>values[key]??'');
}

export async function renderOfficialLetter(backgroundUrl:string,content:string,layout:LetterLayout):Promise<LetterRenderResult>{
  if('fonts' in document)await document.fonts.ready;
  const image=await loadImage(backgroundUrl);
  const canvas=document.createElement('canvas');
  canvas.width=A4_W;canvas.height=A4_H;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('تعذر تجهيز صفحة الخطاب.');

  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,A4_W,A4_H);
  drawCover(ctx,image,A4_W,A4_H);

  const pxPerMm=A4_W/210;
  const top=layout.contentTopMm*pxPerMm;
  const side=layout.contentSideMm*pxPerMm;
  const maxWidth=A4_W-(side*2);
  const fontPx=Math.round(layout.fontSizePt*(A4_W/595.28));
  const lineHeight=Math.round(fontPx*1.8);

  ctx.direction='rtl';
  ctx.textAlign='right';
  ctx.textBaseline='top';
  ctx.fillStyle='#17261f';
  ctx.font=`500 ${fontPx}px Tajawal, Tahoma, Arial, sans-serif`;

  const lines=wrapMultiline(ctx,content,maxWidth);
  let y=top;
  for(const line of lines){
    if(y+lineHeight>A4_H-(28*pxPerMm))break;
    if(line===''){y+=Math.round(lineHeight*.6);continue}
    ctx.fillText(line,A4_W-side,y,maxWidth);
    y+=lineHeight;
  }

  const jpegDataUrl=canvas.toDataURL('image/jpeg',0.96);
  const jpgBytes=dataUrlToBytes(jpegDataUrl);
  const pdfBlob=imageJpegToPdf(jpgBytes,A4_W,A4_H);
  return{pdfBlob,jpegDataUrl};
}

function loadImage(url:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('تعذر تحميل الورقة الرسمية. حاول إعادة رفعها.'));
    img.src=url;
  });
}

function drawCover(ctx:CanvasRenderingContext2D,img:HTMLImageElement,w:number,h:number){
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
  ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
}

function wrapMultiline(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
  const result:string[]=[];
  for(const paragraph of text.replace(/\r/g,'').split('\n')){
    if(!paragraph.trim()){result.push('');continue}
    const words=paragraph.trim().split(/\s+/);
    let line='';
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(ctx.measureText(candidate).width<=maxWidth||!line)line=candidate;
      else{result.push(line);line=word}
    }
    if(line)result.push(line);
  }
  return result;
}

function dataUrlToBytes(dataUrl:string){
  const base64=dataUrl.split(',')[1]||'';
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function ascii(value:string){return new TextEncoder().encode(value)}

function concat(parts:Uint8Array[]){
  const total=parts.reduce((n,p)=>n+p.length,0);
  const out=new Uint8Array(total);let offset=0;
  for(const p of parts){out.set(p,offset);offset+=p.length}
  return out;
}

function imageJpegToPdf(jpeg:Uint8Array,imgW:number,imgH:number){
  const pageW=595.28,pageH=841.89;
  const content=`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects:Uint8Array[]=[
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concat([ascii(`<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,ascii('\nendstream')]),
    ascii(`<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`)
  ];

  const header=ascii('%PDF-1.4\n%âãÏÓ\n');
  const chunks:Uint8Array[]=[header];
  const offsets:number[]=[0];
  let cursor=header.length;
  objects.forEach((obj,index)=>{
    offsets.push(cursor);
    const prefix=ascii(`${index+1} 0 obj\n`);
    const suffix=ascii('\nendobj\n');
    chunks.push(prefix,obj,suffix);
    cursor+=prefix.length+obj.length+suffix.length;
  });
  const xrefOffset=cursor;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(ascii(xref));
  return new Blob([concat(chunks)],{type:'application/pdf'});
}
