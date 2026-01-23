import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Edit,
  Package,
  DollarSign,
  Layers,
  Palette,
  Tag,
  Store,
  TrendingUp,
  Eye,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import type { ProductWithDetails } from "@shared/schema";

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice);
};

export default function AdminProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery<ProductWithDetails>({
    queryKey: ["/api/admin/products", id],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-[3/4] rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Product not found</h2>
        <Link to="/admin/products">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  const images = [product.imageUrl, ...(product.images || [])].filter(
    Boolean,
  ) as string[];
  if (images.length === 0) {
    images.push("/banner.png");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/products">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Product Details</h1>
            <p className="text-muted-foreground">SKU: {product.sku || "N/A"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product Images */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Product Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(1, 5).map((image, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 2}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Product Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Product Name
                  </label>
                  <p className="font-semibold">{product.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    SKU
                  </label>
                  <p className="font-semibold">{product.sku || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Category
                  </label>
                  <p className="font-semibold">
                    {product.category?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Subcategory
                  </label>
                  <p className="font-semibold">
                    {product.subcategory?.name || "N/A"}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Description
                </label>
                <p className="mt-1">
                  {product.description || "No description available"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Actual Price
                  </label>
                  <p className="text-xs font-bold text-primary">
                    {formatPrice(product?.actualPrice ?? 0)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Regular Price
                  </label>
                  <p className="text-xs font-bold text-primary">
                    {formatPrice(product.price)}
                  </p>
                </div>
                {product.discountedPrice && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Discounted Price
                    </label>
                    <p className="text-xs font-bold text-green-600">
                      {formatPrice(product.discountedPrice)}
                    </p>
                    <Badge variant="secondary" className="mt-1">
                      {Math.round(
                        (1 -
                          parseFloat(product.discountedPrice.toString()) /
                            parseFloat(product.price)) *
                          100,
                      )}
                      % OFF
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Stock Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Total Stock
                  </label>
                  <p
                    className={`text-xl font-bold ${
                      product.totalStock < 10
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {product.totalStock} units
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Online Stock
                    </label>
                    <p className="font-semibold">{product.onlineStock}</p>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-muted-foreground">
                      Store Allocations
                    </label>

                    <p >
                      {product.storeAllocations?.length
                        ? product.storeAllocations.map((alloc) => (
                            <span key={alloc.storeId} className="text-xs">
                              {alloc.storeName} - {alloc.quantity}
                            </span>
                          ))
                        : "0"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Attributes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Product Attributes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Color
                  </label>
                  <p className="font-semibold">
                    {product.color?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Fabric
                  </label>
                  <p className="font-semibold">
                    {product.fabric?.name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Distribution Channel
                  </label>
                  <Badge variant="outline" className="capitalize">
                    {product.distributionChannel}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    {product.isActive ? (
                      <Badge className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {product.isFeatured && (
                      <Badge className="bg-amber-100 text-amber-800">
                        Featured
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Product ID
                  </label>
                  <p className="font-mono text-sm">{product.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Category ID
                  </label>
                  <p className="font-mono text-sm">{product.categoryId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="text-sm">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
