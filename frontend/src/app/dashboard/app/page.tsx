"use client";
import {DashboardShell} from "@/components/dashboard/dashboard-shell";
import {useAuth} from "@/components/auth/auth-guard";
import {RoleAppInstallPanel} from "@/components/pwa/role-app-install-panel";
export default function BusinessInstallPage(){const {token}=useAuth();return <DashboardShell activeItem="app"><div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6"><h1 className="text-2xl font-bold text-white">Business App & Security</h1><RoleAppInstallPanel role="business" token={token}/></div></DashboardShell>;}
