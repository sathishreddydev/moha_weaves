import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface NestedCheckboxOption {
  id: string;
  label: string;
  children?: NestedCheckboxOption[];
}

interface NestedCheckboxProps {
  options: NestedCheckboxOption[];
  selectedValues: Set<string>;
  onChange: (selectedValues: Set<string>) => void;
  className?: string;
  level?: number;
}

const NestedCheckboxItem: React.FC<{
  option: NestedCheckboxOption;
  selectedValues: Set<string>;
  onChange: (selectedValues: Set<string>) => void;
  level?: number;
}> = ({ option, selectedValues, onChange, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = option.children && option.children.length > 0;

  const getAllDescendantIds = useCallback(
    (option: NestedCheckboxOption): string[] => {
      let ids = [option.id];
      if (option.children) {
        option.children.forEach((child) => {
          ids = ids.concat(getAllDescendantIds(child));
        });
      }
      return ids;
    },
    [],
  );

  const isIndeterminate = useCallback(() => {
    if (!hasChildren) return false;

    const allDescendantIds = getAllDescendantIds(option).slice(1); // Remove self
    const selectedDescendants = allDescendantIds.filter((id) =>
      selectedValues.has(id),
    );

    return (
      selectedDescendants.length > 0 &&
      selectedDescendants.length < allDescendantIds.length
    );
  }, [option, selectedValues, getAllDescendantIds, hasChildren]);

  const isChecked = hasChildren
    ? (() => {
        const allDescendantIds = getAllDescendantIds(option).slice(1); // Remove self
        return (
          allDescendantIds.length > 0 &&
          allDescendantIds.every((id) => selectedValues.has(id))
        );
      })()
    : selectedValues.has(option.id);
  const indeterminate = isIndeterminate();

  const handleToggle = useCallback(() => {
    const newSelectedValues = new Set(selectedValues);

    if (hasChildren) {
      // Parent clicked - toggle all children
      const allDescendantIds = getAllDescendantIds(option).slice(1); // Remove self
      const shouldSelect = !isChecked; // If currently checked, uncheck all; if indeterminate or unchecked, check all

      if (shouldSelect) {
        allDescendantIds.forEach((id) => newSelectedValues.add(id));
      } else {
        allDescendantIds.forEach((id) => newSelectedValues.delete(id));
      }
    } else {
      // Leaf node clicked - toggle self
      if (isChecked) {
        newSelectedValues.delete(option.id);
      } else {
        newSelectedValues.add(option.id);
      }
    }

    onChange(newSelectedValues);
  }, [
    isChecked,
    selectedValues,
    onChange,
    getAllDescendantIds,
    option,
    hasChildren,
  ]);

  const handleExpandToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className={cn("select-none", level > 0 && "ml-6")}>
      <div className="flex items-center space-x-2 py-1">
        {hasChildren && (
          <div
            className="cursor-pointer"
            onClick={handleExpandToggle}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}

        <Checkbox
          id={option.id}
          checked={isChecked}
          onCheckedChange={handleToggle}
          data-state={
            indeterminate
              ? "indeterminate"
              : isChecked
                ? "checked"
                : "unchecked"
          }
        />
        <span 
          className="text-xs leading-snug cursor-pointer hover:text-primary"
          onClick={handleToggle}
        >
          {option.label}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-1 ml-3">
          {option.children!.map((child) => (
            <NestedCheckboxItem
              key={child.id}
              option={child}
              selectedValues={selectedValues}
              onChange={onChange}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const getSelectedTree = (
  options: NestedCheckboxOption[],
  selectedValues: Set<string>,
): NestedCheckboxOption[] => {
  const buildSelectedTree = (
    option: NestedCheckboxOption,
  ): NestedCheckboxOption | null => {
    if (!option.children || option.children.length === 0) {
      // Leaf node - include only if selected
      return selectedValues.has(option.id) ? { ...option } : null;
    }

    // Parent node - build tree with selected children
    const selectedChildren = option.children
      .map((child) => buildSelectedTree(child))
      .filter(Boolean) as NestedCheckboxOption[];

    // Include parent only if it has selected children
    if (selectedChildren.length > 0) {
      return {
        ...option,
        children: selectedChildren,
      };
    }

    return null;
  };

  return options
    .map((option) => buildSelectedTree(option))
    .filter(Boolean) as NestedCheckboxOption[];
};

export const NestedCheckbox: React.FC<NestedCheckboxProps> = ({
  options,
  selectedValues,
  onChange,
  className,
  level = 0,
}) => {
  return (
    <div className={cn("space-y-1", className)}>
      {options.map((option) => (
        <NestedCheckboxItem
          key={option.id}
          option={option}
          selectedValues={selectedValues}
          onChange={onChange}
          level={level}
        />
      ))}
    </div>
  );
};

export default NestedCheckbox;
