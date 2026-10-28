import type {Metadata} from "next";
import { AuthGuard } from "@/components/auth/auth-guard";
import {RoleInstallCapture} from "@/components/pwa/role-install-capture";

export const metadata:Metadata={title:"LOYVANCE Business",manifest:"/business-app.webmanifest",icons:{apple:"/pwa-app-icon/business/192"},appleWebApp:{capable:true,title:"LV Business",statusBarStyle:"black"}};
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <><RoleInstallCapture role="business"/><AuthGuard requiredRole="business_owner">{children}</AuthGuard></>;
}
