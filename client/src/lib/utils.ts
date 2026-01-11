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
