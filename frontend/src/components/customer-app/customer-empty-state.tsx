"use client";
import { useI18n } from "@/components/i18n/language-provider";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export function CustomerEmptyState({ title, description, actionLabel, onAction, }: {
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    const { t: tr } = useI18n();
    return (<Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <div className="rounded-full bg-muted p-3">
          <Inbox className="h-5 w-5 text-muted-foreground"/>
        </div>
        <div>
          <h3 className="text-sm font-semibold">{tr(title)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr(description)}</p>
        </div>
        {actionLabel && onAction ? (<Button variant="outline" onClick={onAction}>
            {tr(actionLabel)}
          </Button>) : null}
      </CardContent>
    </Card>);
}
