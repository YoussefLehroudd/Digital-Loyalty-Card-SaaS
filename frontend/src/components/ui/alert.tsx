"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
type AlertProps = React.ComponentProps<"div"> & {
    /** Auto-hide delay in ms. Set to 0 to keep the alert persistent. */
    duration?: number;
};
export function Alert({ className, duration = 5000, ...props }: AlertProps) {
    const [visible, setVisible] = React.useState(true);
    React.useEffect(() => {
        setVisible(true);
        if (!duration || duration <= 0)
            return;
        const timer = window.setTimeout(() => setVisible(false), duration);
        return () => window.clearTimeout(timer);
    }, [duration, props.children]);
    if (!visible)
        return null;
    return (<div className={cn("rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground transition-opacity", className)} role="alert" {...props}/>);
}
