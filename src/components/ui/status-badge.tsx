import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva("status-badge", {
  variants: {
    tone: {
      operational: "",
      neutral: "",
    },
  },
  defaultVariants: {
    tone: "operational",
  },
});

type StatusBadgeProps = React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>;

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ tone }), className)}
      data-slot="status-badge"
      {...props}
    />
  );
}
