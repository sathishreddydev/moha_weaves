import { useState, useMemo } from "react";
import { Check, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

type TreeNode<T = unknown> = {
  id: string;
  label: string;
  data?: T;
  children?: TreeNode<T>[];
};

type Props = {
  data: TreeNode[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
};

const MAX_ROOT_VISIBLE = 2;
const MAX_CHILD_VISIBLE = 2;

export function NestedMultiSelectTree({
  data,
  value,
  onChange,
  placeholder = "Search categories...",
}: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filteredData = useMemo(() => {
    if (!query) return data;

    const q = query.toLowerCase();

    const filter = (nodes: TreeNode[]): TreeNode[] =>
      nodes
        .map((node) => {
          const matches = node.label.toLowerCase().includes(q);
          const children = node.children ? filter(node.children) : [];

          if (matches || children.length > 0) {
            return { ...node, children };
          }
          return null;
        })
        .filter(Boolean) as TreeNode[];

    return filter(data);
  }, [data, query]);

  const forceExpand = Boolean(query);

  const getAllIds = (node: TreeNode): string[] =>
    node.children ? node.children.flatMap(getAllIds) : [node.id];

  const toggleNode = (node: TreeNode) => {
    const ids = getAllIds(node);
    const allSelected = ids.every((id) => value.includes(id));

    onChange(
      allSelected
        ? value.filter((id) => !ids.includes(id))
        : Array.from(new Set([...value, ...ids])),
    );
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (nodes: TreeNode[], level = 0) => {
    const isRoot = level === 0;
    const rootExpanded = forceExpand || expanded["__root__"];

    const visibleNodes =
      !forceExpand && isRoot && nodes.length > MAX_ROOT_VISIBLE && !rootExpanded
        ? nodes.slice(0, MAX_ROOT_VISIBLE)
        : nodes;

    return (
      <div className="space-y-1">
        {visibleNodes.map((node) => {
          const ids = getAllIds(node);
          const checked = ids.every((id) => value.includes(id));
          const indeterminate =
            !checked && ids.some((id) => value.includes(id));

          const children = node.children ?? [];
          const isExpanded = forceExpand || expanded[node.id];

          const visibleChildren =
            !forceExpand && children.length > MAX_CHILD_VISIBLE && !isExpanded
              ? children.slice(0, MAX_CHILD_VISIBLE)
              : children;

          return (
            <div key={node.id}>
              <div
                className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-100"
                style={{ paddingLeft: level * 12 }}
              >
                <Checkbox
                  checked={checked || indeterminate}
                  onCheckedChange={() => toggleNode(node)}
                >
                  {checked && <Check size={12} />}
                  {indeterminate && <Minus size={12} />}
                </Checkbox>

                <span className="flex-1">{node.label}</span>

                {children.length > MAX_CHILD_VISIBLE && !forceExpand && (
                  <button
                    onClick={() => toggleExpand(node.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                )}
              </div>

              {visibleChildren.length > 0 &&
                renderTree(visibleChildren, level + 1)}

              {!forceExpand &&
                children.length > MAX_CHILD_VISIBLE &&
                !isExpanded && (
                  <button
                    onClick={() => toggleExpand(node.id)}
                    style={{ paddingLeft: (level + 1) * 12 }}
                    className="mt-1 text-xs text-blue-600 hover:underline"
                  >
                    + {children.length - MAX_CHILD_VISIBLE} more
                  </button>
                )}
            </div>
          );
        })}

        {!forceExpand &&
          isRoot &&
          nodes.length > MAX_ROOT_VISIBLE &&
          !rootExpanded && (
            <button
              onClick={() => toggleExpand("__root__")}
              className="mt-2 text-sm font-medium text-blue-600 hover:underline"
            >
              + {nodes.length - MAX_ROOT_VISIBLE} more categories
            </button>
          )}

        {!forceExpand &&
          isRoot &&
          rootExpanded &&
          nodes.length > MAX_ROOT_VISIBLE && (
            <button
              onClick={() => toggleExpand("__root__")}
              className="mt-2 text-sm font-medium text-gray-600 hover:underline"
            >
              Show less categories
            </button>
          )}
      </div>
    );
  };

  const isEmpty = filteredData.length === 0;

  return (
    <div className="w-full rounded-md border p-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />

      {isEmpty ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No data found
        </div>
      ) : (
        renderTree(filteredData)
      )}
    </div>
  );
}
