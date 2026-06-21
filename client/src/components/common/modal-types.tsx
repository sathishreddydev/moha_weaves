import type React from "react";

export type DrawerDirection = "top" | "bottom" | "left" | "right";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export type BaseModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  direction?: DrawerDirection;
  /** Width preset for dialog — defaults to "md" */
  size?: ModalSize;
  /** Additional className for the content container */
  className?: string;
};
