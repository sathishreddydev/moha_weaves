import * as Dialog from "@radix-ui/react-dialog";
import { BaseModalProps } from "./modal-types";

export function ReusableDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: BaseModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />

        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-lg flex flex-col">
          <div className="border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">
              {title}
            </Dialog.Title>

            {description && (
              <Dialog.Description className="text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            )}
          </div>

          <div className="px-6 py-4">{children}</div>

          {footer && (
            <div className="border-t px-6 py-4 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
