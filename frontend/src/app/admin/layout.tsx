import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import {RoleInstallCapture} from "@/components/pwa/role-install-capture";
export const metadata: Metadata = { title: "Administration | LOYVANCE", robots: { index: false, follow: false }, manifest: "/admin-app.webmanifest", appleWebApp: {capable:true,title:"LOYVANCE Admin",statusBarStyle:"black"} };
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <><RoleInstallCapture role="admin"/><AdminShell>{children}</AdminShell></>; }
