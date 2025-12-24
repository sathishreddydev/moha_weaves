import { Drawer } from "vaul";
import clsx from "clsx";
import { BaseModalProps } from "./modal-types";

export function ReusableDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  direction = "bottom",
}: BaseModalProps) {
  const isVertical = direction === "top" || direction === "bottom";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={direction}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />

        <Drawer.Content
          className={clsx(
            "fixed z-50 bg-white flex flex-col",
            isVertical && "left-0 right-0 max-h-[90vh]",
            direction === "bottom" && "bottom-0 rounded-t-xl",
            direction === "top" && "top-0 rounded-b-xl",

            !isVertical && "top-0 bottom-0 max-w-[90vw]",
            direction === "left" && "left-0 rounded-r-xl",
            direction === "right" && "right-0 rounded-l-xl"
          )}
        >
          {isVertical && (
            <div className="mx-auto my-2 h-1.5 w-12 rounded-full bg-muted" />
          )}

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
