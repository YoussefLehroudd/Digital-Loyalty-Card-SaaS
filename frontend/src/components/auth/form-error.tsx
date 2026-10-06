import { Alert } from "@/components/ui/alert";

export function FormError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return <Alert className="border-red-500/30 text-red-600">{message}</Alert>;
}
