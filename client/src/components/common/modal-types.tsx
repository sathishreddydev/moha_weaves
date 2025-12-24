export type DrawerDirection = "top" | "bottom" | "left" | "right";

export type BaseModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  direction?:DrawerDirection
};
