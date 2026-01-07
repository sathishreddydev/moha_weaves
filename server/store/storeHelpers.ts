import { eq } from "drizzle-orm";
import { categories, colors, fabrics, sarees } from "@shared/schema";

/**
 * Helper function to create standard saree joins with categories, colors, and fabrics
 * This eliminates duplicate join patterns across multiple functions
 */
export function addSareeJoins(query: any) {
  return query
    .leftJoin(categories, eq(sarees.categoryId, categories.id))
    .leftJoin(colors, eq(sarees.colorId, colors.id))
    .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id));
}

/**
 * Helper function to transform saree data with details
 */
export function transformSareeWithDetails(item: any) {
  return {
    ...item.sarees,
    category: item.categories,
    color: item.colors,
    fabric: item.fabrics,
  };
}

/**
 * Helper function to apply saree joins and transform results
 */
export function getSareesWithDetails(query: any) {
  return query
    .leftJoin(categories, eq(sarees.categoryId, categories.id))
    .leftJoin(colors, eq(sarees.colorId, colors.id))
    .leftJoin(fabrics, eq(sarees.fabricId, fabrics.id));
}
