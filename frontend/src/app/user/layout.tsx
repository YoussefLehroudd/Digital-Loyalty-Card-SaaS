import type {Metadata} from "next";
import CustomerAreaLayout from "@/components/customer-app/customer-area-layout-client";
import {RoleInstallCapture} from "@/components/pwa/role-install-capture";
export const metadata:Metadata={title:"LOYVANCE Wallet",manifest:"/customer-app.webmanifest",icons:{apple:"/pwa-app-icon/customer/192"},appleWebApp:{capable:true,title:"LV Wallet",statusBarStyle:"black"}};
export default function UserAreaLayout({children}:{children:React.ReactNode}){return <><RoleInstallCapture role="customer"/><CustomerAreaLayout>{children}</CustomerAreaLayout></>;}
