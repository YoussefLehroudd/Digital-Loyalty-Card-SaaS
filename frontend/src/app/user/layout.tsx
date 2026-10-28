import type {Metadata} from "next";
import CustomerAreaLayout from "@/components/customer-app/customer-area-layout-client";
import {RoleInstallCapture} from "@/components/pwa/role-install-capture";
export const metadata:Metadata={title:"LOYVANCE Wallet",manifest:"/customer-app.webmanifest",icons:{apple:"/pwa/icon-192.png?v=20261028-logo2"},appleWebApp:{capable:true,title:"LV Wallet",statusBarStyle:"black"}};
export default function UserAreaLayout({children}:{children:React.ReactNode}){return <><RoleInstallCapture role="customer"/><CustomerAreaLayout>{children}</CustomerAreaLayout></>;}
