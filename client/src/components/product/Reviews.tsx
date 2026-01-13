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

interface ReviewsProps {
  reviewsData: {
    reviews: any[];
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
    };
  } | null | undefined;
  reviewLoading: boolean;
}

export function Reviews({ reviewsData, reviewLoading }: ReviewsProps) {
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
            disabled={true}
            className="cursor-default"
            data-testid={interactive ? `star-rating-${star}` : undefined}
          >
            <Star
              className={`h-5 w-5 ${
                star <= (value)
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
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingDistribution[stars] || 0;
            const percentage =
              totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-right font-medium">{stars}</span>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <Progress value={percentage} className="h-2" />
                </div>
                <span className="w-12 text-right text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="md:col-span-2 space-y-4">
          {reviewLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-pulse">Loading reviews...</div>
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <Card
                  key={review.id}
                  className="p-6 border border-border hover-elevate transition-all duration-200"
                  data-testid={`review-${review.id}`}
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {review?.user?.name || "Anonymous"}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            {renderStars(review.rating)}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                        </div>
                        {review.isVerifiedPurchase && (
                          <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded-md border border-green-200 dark:border-green-800">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        {review.comment}
                      </p>
                      {(review?.helpfulCount ?? 0) > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-border">
              <div className="space-y-2">
                <p className="font-medium">No reviews yet</p>
                <p className="text-sm">Be the first to review this product!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
