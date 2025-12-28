import { Card } from "@/components/ui/card";

export default function ReturnsExchangePolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Card className="p-6">
        <h1 className="font-serif text-2xl font-semibold">Returns & Exchange Policy</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            Returns and exchanges are subject to eligibility based on delivery
            date and item condition. Eligibility is shown on your Order Details
            page.
          </p>
          <div>
            <h2 className="text-base font-semibold text-foreground">Return window</h2>
            <p className="mt-1">
              Returns/exchanges are allowed within the return window displayed
              for your delivered order. If the window has expired, return is not
              available.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Item condition</h2>
            <p className="mt-1">
              Items should be returned in original condition. If items are
              damaged, partial refund rules may apply.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Refunds</h2>
            <p className="mt-1">
              Refunds are initiated after return completion and are processed
              via the original payment method where applicable. Refund status is
              shown in your Order Details.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Exchanges</h2>
            <p className="mt-1">
              For exchange requests, you will see the exchange status updates in
              your Order Details.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
