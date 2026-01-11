import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataTableFilterStore } from "@/components/Store/useDataTableFilter";
import { TreeNode } from "@/lib/type";
import { NestedMultiSelectTree } from "./NestedMultiSelect";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryTree?: TreeNode[];
  colorTree?: TreeNode[];
};

export function RightFilterPanel({
  open,
  onOpenChange,
  categoryTree,
  colorTree,
}: Props) {
  const {
    categoryIds,
    setCategoryIds,
    colorIds,
    setColorIds,
    resetFilters,
  } = useDataTableFilterStore();

  const [tempCategoryIds, setTempCategoryIds] = useState<string[]>([]);
  const [tempColorIds, setTempColorIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTempCategoryIds(categoryIds);
      setTempColorIds(colorIds);
    }
  }, [open, categoryIds, colorIds]);

  const handleApply = () => {
    setCategoryIds(tempCategoryIds);
    setColorIds(tempColorIds);
    onOpenChange(false);
  };

  const handleReset = () => {
    setTempCategoryIds([]);
    setTempColorIds([]);
    resetFilters();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />

        <Dialog.Content
          className="
            fixed right-0 top-0 h-full w-[380px]
            bg-background border-l shadow-lg
            flex flex-col
          "
        >
          <div className="flex items-center justify-between p-4 border-b">
            <Dialog.Title className="text-lg font-semibold">
              Filters
            </Dialog.Title>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="text-sm font-medium">Categories</label>
              <div className="mt-2">
                <NestedMultiSelectTree
                  data={categoryTree || []}
                  value={tempCategoryIds}
                  onChange={setTempCategoryIds}
                  placeholder="Search categories..."
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Colors</label>
              <div className="mt-2">
                <NestedMultiSelectTree
                  data={colorTree || []}
                  value={tempColorIds}
                  onChange={setTempColorIds}
                  placeholder="Search colors..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex justify-between gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>

            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
