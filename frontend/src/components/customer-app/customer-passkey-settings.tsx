"use client";
import {useCustomerAuth} from "@/components/customer-app/customer-auth-provider";
import {AccountPasskeySettings} from "@/components/pwa/account-passkey-settings";
export function CustomerPasskeySettings(){
 const {token}=useCustomerAuth();
 return <AccountPasskeySettings token={token}/>;
}
