import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BaseModalProps, ModalSize } from "./modal-types";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw]",
};

export function ReusableDialog({
  open,
  onOpenChange,
  title,
  description,
  headerRight,
  children,
  footer,
  size = "md",
  className,
}: BaseModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
            "flex flex-col max-h-[90vh] rounded-xl bg-white shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            sizeClasses[size],
            className
          )}
        >
          {/* ─── Header (sticky) ─── */}
          <div className="flex items-start justify-between gap-3 border-b px-6 py-4 shrink-0">
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {headerRight && <div className="shrink-0">{headerRight}</div>}
            <Dialog.Close className="shrink-0 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          {/* ─── Body (scrollable) ─── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

          {/* ─── Footer (sticky) ─── */}
          {footer && (
            <div className="flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
