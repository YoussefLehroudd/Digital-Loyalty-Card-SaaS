"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
export default function LegacyUserLoginPage(){const router=useRouter();const params=useSearchParams();useEffect(()=>{const q=params.toString();router.replace(`/login${q?`?${q}`:""}`);},[params,router]);return null;}
