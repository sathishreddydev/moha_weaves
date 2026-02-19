import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star } from "lucide-react";

import { useAuth } from "@/lib/auth";
import type { ProductReview, ProductWithDetails, User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatPrice } from "@/lib/utils";

type ReviewWithDetails = ProductReview & {
  user: User;
  product: ProductWithDetails;
};

export default function AdminReviews() {
  const { user } = useAuth();
  const { data: reviews, isLoading } = useQuery<ReviewWithDetails[]>({
    queryKey: ["/api/admin/reviews"],
    enabled: !!user && user.role === "admin",
  });

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Reviews</h1>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : reviews && reviews.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={review.product.imageUrl ?? ""}
                          className="w-10 h-12 rounded object-cover"
                        />
                        <span className="font-medium">{review.product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{review?.user?.name}</p>
                      {/* <p className="text-xs text-muted-foreground">
                        {review.user.email}
                      </p> */}
                    </TableCell>
                    <TableCell>{renderStars(review.rating)}</TableCell>
                    <TableCell>{review.comment}</TableCell>
                    <TableCell>{formatDate(review.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-6 text-muted-foreground">
              No reviews found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
