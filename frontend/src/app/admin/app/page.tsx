"use client";
import {useI18n} from "@/components/i18n/language-provider";
import {useAdmin} from "@/components/admin/admin-shell";
import {RoleAppInstallPanel} from "@/components/pwa/role-app-install-panel";
export default function AdminInstallPage(){
 const {t:tr}=useI18n();const {token}=useAdmin();return <div className="admin-install-page mx-auto max-w-3xl space-y-5"><header><p className="text-xs font-bold uppercase tracking-widest text-[#edbc62]">{tr("PLATFORM APP")}</p><h1 className="mt-2 text-2xl font-bold text-white">{tr("LOYVANCE Admin — Install & Security")}</h1><p className="mt-2 text-sm text-white/50">{tr("Install the private administrator app and protect your account with a passkey.")}</p></header><RoleAppInstallPanel role="admin" token={token}/></div>;}
