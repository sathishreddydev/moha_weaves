export type SelectedTreeNode<T = unknown> = {
  id: string
  name: string
  children?: SelectedTreeNode<T>[]
}
export type TreeNode<T = unknown> = {
  id: string;
  label: string;
  data?: T;
  children?: TreeNode<T>[];
};