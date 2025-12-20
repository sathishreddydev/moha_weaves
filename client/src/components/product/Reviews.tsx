import { useState } from "react";
import { Star, ThumbsUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProductReview } from "@shared/schema";
import { ReviewWithUser } from "server/storage";

interface ReviewsProps {
  sareeId: string;
}

export function Reviews({ sareeId }: ReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const { data: reviewsData, isLoading } = useQuery<{
    reviews: ReviewWithUser[];
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
    };
  }>({
    queryKey: ["/api/sarees", sareeId, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/sarees/${sareeId}/reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });

  const reviews = reviewsData?.reviews;
  const reviewStats = reviewsData?.stats;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderStars = (value: number, interactive = false) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? "cursor-pointer" : "cursor-default"}`}
            data-testid={interactive ? `star-rating-${star}` : undefined}
          >
            <Star
              className={`h-5 w-5 ${
                star <= (interactive ? hoverRating || rating : value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const ratingDistribution = reviewStats?.ratingDistribution || {};
  const totalReviews = reviewStats?.totalReviews || 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <div className="text-xl font-bold text-primary">
              {reviewStats?.averageRating?.toFixed(1) || "0.0"}
            </div>
            <div className="flex justify-center my-2">
              {renderStars(reviewStats?.averageRating || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              {totalReviews} review{totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = ratingDistribution[stars] || 0;
              const percentage =
                totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-8">{stars}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <Progress value={percentage} className="flex-1 h-2" />
                  <span className="w-8 text-right text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading reviews...
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card
                  key={review.id}
                  className="p-4"
                  data-testid={`review-${review.id}`}
                >
                  <div className="flex items-start gap-4">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {review?.user?.name || "Anonymous"}
                          </p>
                          <div className="flex items-center gap-2">
                            {renderStars(review.rating)}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                        </div>
                        {review.isVerifiedPurchase && (
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded dark:bg-green-900 dark:text-green-100">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm">{review.comment}</p>
                      {(review?.helpfulCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{review.helpfulCount} found this helpful</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No reviews yet. Be the first to review this product!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
