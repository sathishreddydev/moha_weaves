import { useIsMobile } from "@/hooks/use-mobile";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";

type AddressDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export const ReusableDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: AddressDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/50" />

          <Drawer.Content className="fixed bottom-0 left-0 right-0 max-h-[90vh] rounded-t-xl bg-white flex flex-col">
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
};
