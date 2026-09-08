import {Component,type ReactNode} from 'react';
export default class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="auth"><section className="auth-card" role="alert"><h1>تعذر عرض الصفحة</h1><p>قد يكون الاتصال انقطع أو صدر تحديث جديد للموقع. أعد تحميل الصفحة للمتابعة.</p><button className="primary" onClick={()=>window.location.reload()}>إعادة تحميل الصفحة</button></section></main>:this.props.children;}
}
