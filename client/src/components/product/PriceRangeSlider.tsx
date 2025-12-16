import { useEffect, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

interface PriceRangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: [number, number];
  onChange: (value: { min: number; max: number }) => void;
}

const PriceRangeSlider: React.FC<PriceRangeSliderProps> = ({
  min = 0,
  max = 100_000,
  step = 100,
  value,
  onChange,
}) => {
  // ✅ Local state for smooth dragging
  const [localValue, setLocalValue] =
    useState<[number, number]>(value);

  // ✅ Sync when parent changes (reset / URL change)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs">
        <span>₹{localValue[0].toLocaleString()}</span>
        <span>₹{localValue[1].toLocaleString()}</span>
      </div>

      <SliderPrimitive.Root
        value={localValue}
        min={min}
        max={max}
        step={step}
        onValueChange={(val) =>
          setLocalValue(val as [number, number])
        }
        onValueCommit={(val) =>
          onChange({ min: val[0], max: val[1] })
        }
        className="relative flex w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>

        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-white shadow focus-visible:ring-2 focus-visible:ring-primary/90" />
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-white shadow focus-visible:ring-2 focus-visible:ring-primary/90" />
      </SliderPrimitive.Root>
    </div>
  );
};

export default PriceRangeSlider;
