"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
export default function LegacyUserRegisterPage(){const router=useRouter();const params=useSearchParams();useEffect(()=>{const q=params.toString();router.replace(`/register${q?`?${q}`:""}`);},[params,router]);return null;}
