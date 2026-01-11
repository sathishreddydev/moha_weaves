import { TreeNode } from "@/lib/type";

export interface FilterItem {
  key: string;
  label: string;
  tree?: TreeNode[];
  placeholder: string;
}
