import React, { useState } from "react";
import {
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Camera,
  Palette,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProductWithDetails } from "@shared/schema";

interface ProductImageGalleryProps {
  product: ProductWithDetails;
  images: string[];
  selectedImage: number;
  onImageSelect: (index: number) => void;
}

export function ProductImageGallery({
  product,
  images,
  selectedImage,
  onImageSelect,
}: ProductImageGalleryProps) {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(0);

  const handleZoomOpen = () => {
    setZoomedImage(selectedImage);
    setIsZoomOpen(true);
  };

  const handlePreviousImage = () => {
    onImageSelect(selectedImage === 0 ? images.length - 1 : selectedImage - 1);
  };

  const handleNextImage = () => {
    onImageSelect(selectedImage === images.length - 1 ? 0 : selectedImage + 1);
  };

  const handleZoomPreviousImage = () => {
    setZoomedImage(zoomedImage === 0 ? images.length - 1 : zoomedImage - 1);
  };

  const handleZoomNextImage = () => {
    setZoomedImage(zoomedImage === images.length - 1 ? 0 : zoomedImage + 1);
  };

  return (
    <>
      {/* Mobile Layout - Thumbnails at Bottom */}
      <div className="lg:hidden flex flex-col gap-4">
        {/* Main Image Container */}
        <div className="relative group">
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-zinc-100 group">
            <img
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              onClick={handleZoomOpen}
              data-testid="img-product-main"
            />

            {/* Zoom Button */}
            <button
              onClick={handleZoomOpen}
              className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
            >
              <ZoomIn className="h-5 w-5 text-gray-700" />
            </button>

            {/* Featured Badge */}
            {product.isFeatured && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-lg">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              </div>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-4">
                <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span>
                    {selectedImage + 1}/{images.length}
                  </span>
                </div>
              </div>
            )}

            {/* Color Display */}
            {product.color && (
              <div className="absolute bottom-4 right-4">
                <div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                  <div className="flex items-center gap-2">
                    <Palette className="h-3 w-3 text-gray-600" />
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: product.color.hexCode }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail Gallery - Bottom for Mobile */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pb-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => onImageSelect(i)}
                className={cn(
                  "w-20 h-24 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg",
                  selectedImage === i
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-transparent hover:border-gray-300",
                )}
                data-testid={`button-thumbnail-${i}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Layout - Thumbnails on Left */}
      <div className="hidden lg:flex gap-3">
        {/* Thumbnail Gallery - Left Side */}
        {images.length > 1 && (
          <div className="flex flex-col gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => onImageSelect(i)}
                className={cn(
                  "w-24 h-28 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg",
                  selectedImage === i
                    ? "border-primary ring-2 ring-primary/20 shadow-lg"
                    : "border-transparent hover:border-gray-300",
                )}
                data-testid={`button-thumbnail-${i}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Main Image Container */}
        <div className="flex-1">
          <div className="relative group">
            <div className="order-1 lg:order-2 flex-1 relative aspect-[3/4] overflow-hidden rounded-3xl bg-zinc-100 group">
              <img
                src={images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                onClick={handleZoomOpen}
                data-testid="img-product-main"
              />

              {/* Zoom Button */}
              <button
                onClick={handleZoomOpen}
                className="absolute top-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
              >
                <ZoomIn className="h-5 w-5 text-gray-700" />
              </button>

              {/* Featured Badge */}
              {product.isFeatured && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-lg">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                </div>
              )}

              {/* Image Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-4 left-4">
                  <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    <span>
                      {selectedImage + 1}/{images.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Color Display */}
              {product.color && (
                <div className="absolute bottom-4 right-4">
                  <div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                    <div className="flex items-center gap-2">
                      <Palette className="h-3 w-3 text-gray-600" />
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: product.color.hexCode }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Zoom Dialog */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden">
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Navigation Arrows in Zoom */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handleZoomPreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </button>
                <button
                  onClick={handleZoomNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </button>
              </>
            )}

            {/* Zoomed Image */}
            <img
              src={images[zoomedImage]}
              alt={`${product.name} - Zoomed view`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Image Counter in Zoom */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
                <span className="text-white text-sm font-medium">
                  {zoomedImage + 1} / {images.length}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
