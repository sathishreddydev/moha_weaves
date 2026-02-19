import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SelectedTreeNode, TreeNode } from "./type"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}



export function selectedTree<T>(
  nodes: TreeNode<T>[],
  selectedIds: string[]
): SelectedTreeNode<T>[] {
  const result: SelectedTreeNode<T>[] = []

  for (const node of nodes) {
    const selectedChildren = node.children
      ? selectedTree(node.children, selectedIds)
      : []

    const isSelected = selectedIds.includes(node.id)


    if (isSelected || selectedChildren.length > 0) {
      result.push({
        id: node.id,
        name: node.label,
        ...(selectedChildren.length > 0 && {
          children: selectedChildren,
        }),
      })
    }
  }

  return result
}


  export const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  export const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };