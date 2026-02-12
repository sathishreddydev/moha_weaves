import { AdaptiveModal } from "@/components/common/AdaptiveModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProductWithDetails } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";

interface ReviewsProps {
  product: ProductWithDetails;
}

export function WriteReview({ product }: ReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const createReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      const response = await apiRequest(
        "POST",
        `/api/products/${product.id}/reviews`,
        data
      );
      return response;
    },
    onSuccess: () => {
      toast({ title: "Review submitted successfully" });
      queryClient.invalidateQueries({
        queryKey: ["/api/products", product.id, "reviews"],
      });
      setShowForm(false);
      setRating(5);
      setComment("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (comment.trim().length < 10) {
      toast({
        title: "Review too short",
        description: "Please write at least 10 characters.",
        variant: "destructive",
      });
      return;
    }
    createReviewMutation.mutate({ rating, comment });
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
              className={`h-5 w-5 ${star <= (interactive ? hoverRating || rating : value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
                }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      {user && user.role === "user" && (
        <span
          onClick={() => setShowForm(true)}
          data-testid="text-write-review"
          className="cursor-pointer text-xs hover:text-primary"
        >
          Write a Review
        </span>
      )}

      <AdaptiveModal
        title="Write Your Review"
        open={showForm}
        onOpenChange={setShowForm}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={createReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {createReviewMutation.isPending
                ? "Submitting..."
                : "Submit Review"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex gap-4">
              <div className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={
                    product.imageUrl ||
                    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100&h=150&fit=crop"
                  }
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm line-clamp-1 hover:text-primary">
                  {product.name}
                </h4>
                {renderStars(rating, true)}
              </div>
            </div>
          </div>
          <div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this product..."
              rows={4}
              data-testid="input-review-comment"
            />
          </div>
        </div>
      </AdaptiveModal>
    </>
  );
}
