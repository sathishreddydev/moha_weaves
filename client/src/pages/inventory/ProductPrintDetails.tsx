import Barcode from "react-barcode"

type ProductPrintDetailsProps = {
  products: any[]
  selectedRows: any
  showDescription?: boolean
  printRef?: React.Ref<HTMLDivElement>
}

const formatPrice = (price: string | number) => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numPrice)
}

export const ProductPrintDetails = ({
  products,
  selectedRows,
  showDescription = false,
  printRef,
}: ProductPrintDetailsProps) => {
  if (!products?.length) return null

  return (
    <div ref={printRef}>
      {products
        .filter((product) => selectedRows.has(product.id))
        .map((product) => {
          const rows = [
            { label: "SKU", value: product.sku || "-" },
            { label: "Name", value: product.name },
            { label: "Category", value: product.category?.name || "-" },
            { label: "Color", value: product.color?.name || "-" },
            { label: "Fabric", value: product.fabric?.name || "-" },
            { label: "Price", value: formatPrice(product.price) },
          ]

          return (
            <div key={product.id} className="product-details mb-8">
              {/* <h1 className="text-xl font-bold text-center mb-4">
                Product Details
              </h1> */}

              <div className="space-y-3">
                {rows.map(({ label, value }) => (
                  <div
                    key={label}
                    className="detail-row flex justify-between border-b pb-2"
                  >
                    <span className="font-semibold">{label}:</span>
                    <span>{value}</span>
                  </div>
                ))}

                {showDescription && product.description && (
                  <div className="detail-row flex justify-between border-b pb-2">
                    <span className="font-semibold">Description:</span>
                    <span className="text-right max-w-md">
                      {product.description}
                    </span>
                  </div>
                )}
              </div>

              <div className="barcode-container mt-6 flex justify-center">
                <Barcode
                  value={product.sku || product.id}
                  width={2}
                  height={60}
                  displayValue
                />
              </div>
            </div>
          )
        })}
    </div>
  )
}
