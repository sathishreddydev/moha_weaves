/**
 * Store module configuration
 */

export interface StoreConfig {
  reorderLevel: number;
  exchangeWindowDays: number;
  lowStockThreshold: number;
  maxCartQuantity: number;
}

const DEFAULT_CONFIG: StoreConfig = {
  reorderLevel: 5,
  exchangeWindowDays: 7,
  lowStockThreshold: 5,
  maxCartQuantity: 100
};

/**
 * Get store configuration from environment variables or defaults
 */
export function getStoreConfig(): StoreConfig {
  return {
    reorderLevel: parseInt(process.env.STORE_REORDER_LEVEL || '5'),
    exchangeWindowDays: parseInt(process.env.STORE_EXCHANGE_WINDOW_DAYS || '7'),
    lowStockThreshold: parseInt(process.env.STORE_LOW_STOCK_THRESHOLD || '5'),
    maxCartQuantity: parseInt(process.env.STORE_MAX_CART_QUANTITY || '100')
  };
}

/**
 * Validate store configuration
 */
export function validateStoreConfig(config: StoreConfig): boolean {
  return (
    config.reorderLevel > 0 &&
    config.exchangeWindowDays > 0 &&
    config.lowStockThreshold > 0 &&
    config.maxCartQuantity > 0
  );
}

export { DEFAULT_CONFIG };
