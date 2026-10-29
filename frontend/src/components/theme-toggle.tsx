"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
export function ThemeToggle() {
    const { t: tr } = useI18n();
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const isDark = resolvedTheme === "dark";
    useEffect(() => {
        setMounted(true);
    }, []);
    return (<Button className="loyvance-theme-toggle" aria-label={tr("Toggle theme")} size="icon" variant="ghost" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {mounted && isDark ? (<Sun className="size-4"/>) : (<Moon className="size-4"/>)}
    </Button>);
}
