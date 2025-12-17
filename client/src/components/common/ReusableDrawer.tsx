import { Drawer } from "vaul";
import { BaseModalProps } from "./modal-types";

export function ReusableDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: BaseModalProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />

        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50
               max-h-[90vh] rounded-t-xl bg-white flex flex-col"
        >
          <div className="mx-auto my-2 h-1.5 w-12 rounded-full bg-muted" />

          <div className="border-b px-6 pb-3">
            <h2 className="text-lg font-semibold">{title}</h2>

            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

          {footer && (
            <div className="border-t px-6 py-4 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
