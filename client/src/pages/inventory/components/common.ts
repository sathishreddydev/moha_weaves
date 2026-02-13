import { TreeNode } from "@/lib/type";
type Option = {
  value: string;
  label: string;
};
export function transformOptions<T extends Option>(
  items: T[]
): TreeNode<T>[] {
  return items.map((item) => ({
    id: item.value,
    label: item.label,
    data: item,
  }));
}