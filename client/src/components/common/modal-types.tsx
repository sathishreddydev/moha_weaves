import type React from "react";

export type DrawerDirection = "top" | "bottom" | "left" | "right";

export type BaseModalProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  direction?:DrawerDirection
};
