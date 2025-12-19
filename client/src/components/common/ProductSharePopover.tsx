import * as React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Share2, Mail, Link as LinkIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ProductSharePopoverProps {
  name: string;
  price: string;
  url?: string;
}

export function ProductSharePopover({
  name,
  price,
  url,
}: ProductSharePopoverProps) {
  const shareUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");

  const shareText = `Check out this saree: ${name} - ${price}`;

  const shareOnWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        `${shareText}\n${shareUrl}`
      )}`,
      "_blank"
    );
  };

  const shareOnEmail = () => {
    const subject = encodeURIComponent(`Saree Recommendation: ${name}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link copied",
      description: "Product link copied to clipboard",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9 rounded-full bg-background/90 backdrop-blur-sm"
          title="Share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-2" align="end">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={shareOnWhatsApp}
          >
            <Share2 className="h-4 w-4 text-green-600" />
            WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={shareOnEmail}
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>

          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={copyLink}
          >
            <LinkIcon className="h-4 w-4" />
            Copy Link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
