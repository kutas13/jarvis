import './style.css';import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={title:'JARVIS Ultimate',description:'Private Personal Intelligence System',manifest:'/manifest.json',icons:{icon:'/jarvis-icon.svg'}};
export const viewport:Viewport={themeColor:'#03131c',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
