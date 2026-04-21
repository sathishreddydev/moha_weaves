import React from "react";
import { ArrowUpRight, ArrowDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export const VisualCategoryHero = ({categoriesData}: {categoriesData: any[]}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const slideDuration = 10000;
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    if (isPaused) return;
    
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % categoriesData.length);
    }, slideDuration);

    return () => clearInterval(timer);
  }, [isPaused]);

  const scrollToContent = () => {
    const content = document.getElementById('main-content');
    if (content) content.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubcategoryClick = (category: any, subcategory: any) => {
    const categoryUrl = `/products?category=${category.name}&subcategory=${subcategory.name}`;
    navigate(categoryUrl);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    // Reset touch end for new swipe
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    // Prevent default to avoid browser scroll during swipe
    if (Math.abs(touchStartX.current - e.targetTouches[0].clientX) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setActiveIndex((prev) => (prev + 1) % categoriesData.length);
    } else if (isRightSwipe) {
      setActiveIndex((prev) => (prev - 1 + categoriesData.length) % categoriesData.length);
    }
    
    // Reset values after swipe
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <section 
      className="relative h-[70vh] w-full bg-zinc-950 overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Layers */}
      {categoriesData.map((cat, idx) => (
        <div 
          key={cat.id}
          className={`absolute inset-0 transition-all duration-[1500ms] ease-out ${activeIndex === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
        >
          <img src={cat?.imageUrl} className="w-full h-full object-cover brightness-[0.6]" alt={cat?.name} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
        </div>
      ))}

      {/* Content Layer */}
      <div className="relative z-10 h-full max-w-[1800px] mx-auto px-8 flex flex-col justify-center">
        <div className="max-w-4xl">
          <p className="text-amber-500 font-bold tracking-[0.5em] uppercase text-xs mb-6 overflow-hidden">
            <span className="inline-block animate-in slide-in-from-bottom-full duration-700">Premium Collection</span>
          </p>
          <h2 className="text-white text-4xl md:text-6xl lg:text-7xl xl:text-[120px] font-serif leading-[0.85] mb-6 md:mb-8 tracking-tighter">
            {categoriesData[activeIndex]?.name}
            <span className="block italic font-light text-2xl md:text-3xl lg:text-4xl xl:text-6xl mt-2 md:mt-4 opacity-80">{categoriesData[activeIndex]?.tagline}</span>
          </h2>
          
          <div className="flex flex-wrap gap-3 md:gap-4 mt-8 md:mt-12">
            {categoriesData[activeIndex]?.subcategories.map((sub: any, sIdx: any) => (
              <button 
                key={sub.id} 
                onClick={() => handleSubcategoryClick(categoriesData[activeIndex], sub)}
                style={{ animationDelay: `${sIdx * 100}ms` }}
                className="group bg-white/10 backdrop-blur-md border border-white/20 px-4 md:px-6 py-3 md:py-4 rounded-full flex items-center gap-3 md:gap-4 hover:bg-white hover:text-black transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
              >
                <div className="text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100">Explore</p>
                  <p className="font-medium text-xs md:text-sm">{sub.name}</p>
                </div>
                <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-black/20 group-hover:rotate-45 transition-all">
                  <ArrowUpRight size={10} className="md:size-14" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-12 left-8 right-8 z-20 flex justify-between items-end">
        <div className="flex gap-2 md:gap-4">
          {categoriesData.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className="relative group transition-all"
            >
              {/* Mobile: Dots */}
              <div className="md:hidden w-2 h-2 rounded-full bg-white/20 group-hover:bg-white/40 transition-all">
                <div 
                  className={`w-2 h-2 rounded-full bg-amber-500 transition-all ${activeIndex === idx ? 'opacity-100 scale-125' : 'opacity-0'}`}
                />
              </div>
              
              {/* Desktop: Bars */}
              <div className="hidden md:block relative h-1 w-24 bg-white/20 overflow-hidden group transition-all">
                <div 
                  className={`absolute inset-0 bg-amber-500 transition-all ${activeIndex === idx && !isPaused ? 'translate-x-0' : '-translate-x-full'}`}
                  style={{
                      transitionDuration: (activeIndex === idx && !isPaused) ? `${slideDuration}ms` : '0ms',
                      transitionTimingFunction: 'linear'
                  }}
                />
                <span className={`absolute -top-6 left-0 text-[10px] font-bold tracking-widest transition-opacity duration-500 ${activeIndex === idx ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                  0{idx + 1}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        <div className="hidden md:flex items-center gap-12 text-white/40 text-[10px] font-bold tracking-[0.3em] uppercase">
          <span className="hover:text-white cursor-pointer transition-colors">Instagram</span>

        </div>
      </div>

      {/* Scroll Indicator */}
      <div 
        onClick={scrollToContent}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2 animate-bounce cursor-pointer z-20 hover:text-amber-500 transition-colors"
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Explore</span>
        <ArrowDown size={14} />
      </div>
    </section>
  );
};