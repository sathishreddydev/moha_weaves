import { useDataTableFilterStore } from "@/components/Store/useDataTableFilter";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { FilterItem } from "../Type/type";
import { NestedMultiSelectTree } from "./NestedMultiSelectTree";


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: FilterItem[];
};

type TempFilters = Record<string, string[]>;

export function RightFilterPanel({ open, onOpenChange, filters }: Props) {
  const store = useDataTableFilterStore();

  const [tempFilters, setTempFilters] = useState<TempFilters>({});

  useEffect(() => {
    if (!open || !filters) return;

    const initial: TempFilters = {};
    filters.forEach(({ key }) => {
      initial[key] = (store[key as keyof typeof store] as string[]) || [];
    });

    setTempFilters(initial);
  }, [open, filters, store]);

  const handleApply = () => {
    if (!filters) return;
    
    filters.forEach(({ key }) => {
      const values = tempFilters[key as string] || [];
      store.setFilter(key, values);
    });

    onOpenChange(false);
  };

  const handleReset = () => {
    setTempFilters({});
    store.resetFilters();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />

        <Dialog.Content className="fixed right-0 top-0 h-full w-[380px] bg-background border-l shadow-lg flex flex-col">
          {/* Header */}
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
            {filters?.map(({ key, label, tree, placeholder }) => (
              <div key={key as string}>
                <label className="text-sm font-medium">{label}</label>

                <div className="mt-2">
                  <NestedMultiSelectTree
                    data={tree || []}
                    value={tempFilters[key as string] || []}
                    onChange={(value) =>
                      setTempFilters((prev) => ({
                        ...prev,
                        [key]: value,
                      }))
                    }
                    placeholder={placeholder}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex justify-between gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>

            <Button onClick={handleApply}>Apply Filters</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
