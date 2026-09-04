import type { ReactNode } from 'react';
import SmartAssistant from './SmartAssistant';

export default function WorkspaceFrame({page,children}:{page:string;children:ReactNode}){return <div className="workspace-frame"><div className="workspace-tools"><SmartAssistant page={page}/></div>{children}</div>}
