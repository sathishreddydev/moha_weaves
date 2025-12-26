import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const sizes = ["w-10 h-15", "w-20 h-25", "w-64 h-80"];
interface Iprops {
  initialImages: string[];
}
const LayeredImageStack = ({ initialImages }: Iprops) => {
  const [images, setImages] = useState(initialImages);
  const [direction, setDirection] = useState(0);

  const prev = () => {
    setDirection(-1);
    setImages((prev) => [...prev.slice(1), prev[0]]);
  };

  const next = () => {
    setDirection(1);
    setImages((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <div className="relative w-full h-[500px] flex items-center justify-center perspective-1000">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <div className="flex items-end justify-center gap-2 w-full h-full relative">
            {images.slice(0, 3).map((img, index) => (
              <motion.div
                key={img}
                layout
                initial={{
                  opacity: 0,
                  x: direction > 0 ? 100 : -100,
                  scale: 0.8,
                  zIndex: index,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: 1,
                  zIndex: index,
                  filter: index === 2 ? "grayscale(0%)" : "grayscale(60%)",
                }}
                exit={{
                  opacity: 0,
                  x: direction > 0 ? -100 : 100,
                  scale: 0.8,
                  zIndex: index,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.16, 1, 0.3, 1], // Custom quintic ease
                }}
                className={`${sizes[index]} overflow-hidden rounded-sm shadow-2xl bg-gray-100 flex-shrink-0`}
              >
                <motion.img
                  src={img}
                  alt="Fashion model"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-12 mt-4">
        <button
          onClick={prev}
          className="group flex items-center gap-2 text-xs uppercase tracking-widest font-medium hover:text-orange-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Previous
        </button>

        <div className="h-[1px] w-20 bg-gray-300"></div>

        <button
          onClick={next}
          className="group flex items-center gap-2 text-xs uppercase tracking-widest font-medium hover:text-orange-600 transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default LayeredImageStack;
