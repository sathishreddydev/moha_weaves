
export function formatProductsByStore(
    data: any[],
    storeId: string
): any[] {
    return data.map((product) => {

        const productStore = product?.storeAllocations?.find(
            (s: any) => s.storeId === storeId
        );

        const storeTotalStock = productStore ? productStore.quantity : 0;

        let formattedVariants: any[] | undefined;

        if (product?.variants && product?.variants?.length > 0) {
            formattedVariants = product?.variants?.map((variant: any) => {
                const variantStore = variant?.storeAllocations?.find(
                    (s: any) => s.storeId === storeId
                );

                const stockQuantity = variantStore ? variantStore.quantity : 0;

                const { storeAllocations, ...restVariant } = variant;

                return {
                    ...restVariant,
                    stockQuantity
                };
            });

            if (formattedVariants?.length === 0) {
                formattedVariants = undefined;
            }
        }

        const {
            onlineStock,
            storeAllocations,
            totalStock,
            variants,
            ...restProduct
        } = product;

        return {
            ...restProduct,
            totalStock:storeTotalStock,
            ...(formattedVariants ? { variants: formattedVariants } : {})
        };
    });
}
