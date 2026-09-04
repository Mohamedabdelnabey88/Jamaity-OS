import type { ReactNode } from 'react';
import BackButton from './BackButton';
import SmartAssistant from './SmartAssistant';

export default function WorkspaceFrame({page,children}:{page:string;children:ReactNode}){return <div className="workspace-frame"><div className="workspace-tools"><BackButton/><SmartAssistant page={page}/></div>{children}</div>}
