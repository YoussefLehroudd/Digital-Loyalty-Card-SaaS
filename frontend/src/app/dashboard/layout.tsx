import type {Metadata} from "next";
import { AuthGuard } from "@/components/auth/auth-guard";

export const metadata:Metadata={manifest:"/business-app.webmanifest",appleWebApp:{capable:true,title:"LOYVANCE Business",statusBarStyle:"black"}};
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard requiredRole="business_owner">{children}</AuthGuard>;
}
