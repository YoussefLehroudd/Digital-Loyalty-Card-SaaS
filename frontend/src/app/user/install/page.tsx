"use client";
import {CustomerLayout} from "@/components/customer-app/customer-layout";
import {useCustomerAuth} from "@/components/customer-app/customer-auth-provider";
import {RoleAppInstallPanel} from "@/components/pwa/role-app-install-panel";
export default function CustomerInstallPage(){const {token}=useCustomerAuth();return <CustomerLayout title="Install Loyvance" subtitle="Your loyalty cards, just one tap away."><div className="mx-auto max-w-3xl"><RoleAppInstallPanel role="customer" token={token}/></div></CustomerLayout>;}
