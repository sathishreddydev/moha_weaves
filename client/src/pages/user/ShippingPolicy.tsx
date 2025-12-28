import { Card } from "@/components/ui/card";

export default function ShippingPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Card className="p-6">
        <h1 className="font-serif text-2xl font-semibold">Shipping Policy</h1>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground">
          <p>
            We process and ship orders as quickly as possible. Delivery timelines
            may vary based on your location and courier availability.
          </p>
          <div>
            <h2 className="text-base font-semibold text-foreground">Order processing</h2>
            <p className="mt-1">
              Orders are typically processed within 1-2 business days. You will
              receive updates as your order moves through different stages.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Delivery timeline</h2>
            <p className="mt-1">
              Estimated delivery dates shown in your Order Details are
              approximate and may change due to external factors.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Tracking</h2>
            <p className="mt-1">
              If tracking is available for your shipment, it will appear in your
              Order Details page.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Support</h2>
            <p className="mt-1">
              If you need assistance, please reach out via the Contact page.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
