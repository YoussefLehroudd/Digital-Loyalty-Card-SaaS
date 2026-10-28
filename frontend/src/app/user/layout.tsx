import type {Metadata} from "next";
import CustomerAreaLayout from "@/components/customer-app/customer-area-layout-client";
export const metadata:Metadata={manifest:"/customer-app.webmanifest",appleWebApp:{capable:true,title:"LOYVANCE Customer",statusBarStyle:"black"}};
export default function UserAreaLayout({children}:{children:React.ReactNode}){return <CustomerAreaLayout>{children}</CustomerAreaLayout>;}
