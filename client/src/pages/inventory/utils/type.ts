import { TreeNodeType, ReturnStatus, ABCClass, TrendType, DamageSource, DamageCategory, DamageSeverity } from './enums';

export interface inventoryTreeNode {
  id: string;
  label: string;
  type: TreeNodeType;
  children?: inventoryTreeNode[];
  data?: any;
}

export interface FilterItem {
  key: string;
  label: string;
  tree: inventoryTreeNode[] | any[];
  placeholder: string;
}

export interface ReturnStatusFlow {
  [key: string]: ReturnStatus[];
}

export interface StatusBadgeProps {
  status: string;
}

// Analytics Interfaces
export interface StockMovementStats {
  totalOnlineCleared: number;
  totalStoreCleared: number;
  onlineMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    createdAt: string;
  }[];
  storeMovements: {
    productId: string;
    productName: string;
    quantity: number;
    orderRefId: string;
    storeId: string | null;
    storeName: string | null;
    createdAt: string;
  }[];
}

export interface InventoryTurnover {
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  averageStock: number;
  costOfGoodsSold: number;
  turnoverRatio: number;
  daysOfSupply: number;
  category: string;
}

export interface ABCAnalysis {
  class: ABCClass;
  productId: string;
  productName: string;
  sku: string;
  revenueContribution: number;
  cumulativeRevenue: number;
  revenuePercentage: number;
  quantitySold: number;
  currentStock: number;
  category: string;
}

export interface SeasonalTrend {
  productId: string;
  productName: string;
  category: string;
  monthlyData: {
    month: string;
    year: number;
    quantity: number;
    revenue: number;
  }[];
  trend: TrendType;
  seasonalityIndex: number;
  peakMonths: string[];
}

// Damage History Interfaces
export interface ProductDamage {
  id: string;
  productId: string;
  variantId?: string;
  source: DamageSource;
  quantity: number;
  damageCategory: DamageCategory;
  damageSeverity: DamageSeverity;
  reason: string;
  reportedBy: string;
  approvedBy?: string;
  costValue?: string;
  recoveryValue?: string;
  disposalMethod?: string;
  notes?: string;
  imageUrls?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DamageAnalytics {
  totalDamages: number;
  totalCost: number;
  totalRecovered: number;
  damagesBySource: Array<{
    source: DamageSource;
    count: number;
    cost: number;
  }>;
  damagesByCategory: Array<{
    category: DamageCategory;
    count: number;
    cost: number;
  }>;
  recentDamages: ProductDamage[];
}