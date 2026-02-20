import { useState, useMemo } from "react";
import {
  Package,
  Plus,
  Minus,
  Upload,
  Download,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface BatchStockUpdate {
  productId: string;
  productName?: string;
  sku?: string;
  currentTotalStock: number;
  currentOnlineStock: number;
  newTotalStock: number;
  newOnlineStock: number;
  notes?: string;
  success?: boolean; // Added for tracking update status
  error?: string; // Added for error tracking
}

interface BatchUpdateResult {
  productId: string;
  success: boolean;
  previousStock?: {
    total: number;
    online: number;
  };
  newStock?: {
    total: number;
    online: number;
  };
  error?: string;
}

interface BatchUpdateResponse {
  message: string;
  results: BatchUpdateResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export default function BatchStockOperations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [updates, setUpdates] = useState<BatchStockUpdate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [csvInput, setCsvInput] = useState("");

  // Fetch products for search
  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/inventory/products"],
    select: (data: any[]) => data.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      totalStock: p.totalStock,
      onlineStock: p.onlineStock,
    })),
  });

  // Batch update mutation
  const batchUpdateMutation = useMutation({
    mutationFn: async (updateData: BatchStockUpdate[]) => {
      const formattedUpdates = updateData.map(update => ({
        productId: update.productId,
        totalStock: update.newTotalStock,
        onlineStock: update.newOnlineStock,
      }));

      const response = await apiRequest("POST", "/api/inventory/batch-stock-update", {
        updates: formattedUpdates,
      });
      return response.json();
    },
    onSuccess: (data: BatchUpdateResponse) => {
      toast({
        title: "Batch Update Complete",
        description: `Successfully updated ${data.summary.successful}/${data.summary.total} products`,
      });
      
      // Update the local state with results
      setUpdates(prev => prev.map(update => {
        const result = data.results.find(r => r.productId === update.productId);
        return {
          ...update,
          success: result?.success || false,
          error: result?.error,
        };
      }));

      queryClient.invalidateQueries({ queryKey: ["/api/inventory/products"] });
    },
    onError: (error) => {
      toast({
        title: "Batch Update Failed",
        description: "Failed to update stock in batch",
        variant: "destructive",
      });
    },
  });

  // Add product to updates list
  const addProduct = (product: any) => {
    const existingIndex = updates.findIndex(u => u.productId === product.id);
    
    if (existingIndex >= 0) {
      toast({
        title: "Product Already Added",
        description: "This product is already in the update list",
        variant: "destructive",
      });
      return;
    }

    const newUpdate: BatchStockUpdate = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentTotalStock: product.totalStock,
      currentOnlineStock: product.onlineStock,
      newTotalStock: product.totalStock,
      newOnlineStock: product.onlineStock,
    };

    setUpdates([...updates, newUpdate]);
  };

  // Update stock values
  const updateStock = (index: number, field: 'newTotalStock' | 'newOnlineStock', value: number) => {
    const updated = [...updates];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setUpdates(updated);
  };

  // Remove product from updates list
  const removeProduct = (index: number) => {
    setUpdates(updates.filter((_, i) => i !== index));
  };

  // Clear all updates
  const clearUpdates = () => {
    setUpdates([]);
  };

  // Execute batch update
  const executeBatchUpdate = () => {
    if (updates.length === 0) {
      toast({
        title: "No Updates",
        description: "Please add products to update",
        variant: "destructive",
      });
      return;
    }

    // Validate stock values
    const invalidUpdates = updates.filter(u => 
      u.newTotalStock < 0 || 
      u.newOnlineStock < 0 || 
      u.newOnlineStock > u.newTotalStock
    );

    if (invalidUpdates.length > 0) {
      toast({
        title: "Invalid Stock Values",
        description: "Some products have invalid stock values. Please check and fix them.",
        variant: "destructive",
      });
      return;
    }

    batchUpdateMutation.mutate(updates);
  };

  // Parse CSV input
  const parseCSV = () => {
    try {
      const lines = csvInput.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const parsedUpdates: BatchStockUpdate[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        // Find matching product
        const product = products?.find(p => 
          p.sku === row.SKU || p.name === row['Product Name']
        );

        if (product) {
          parsedUpdates.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            currentTotalStock: product.totalStock,
            currentOnlineStock: product.onlineStock,
            newTotalStock: parseInt(row['Total Stock']) || product.totalStock,
            newOnlineStock: parseInt(row['Online Stock']) || product.onlineStock,
            notes: row.Notes,
          });
        }
      }

      if (parsedUpdates.length > 0) {
        setUpdates([...updates, ...parsedUpdates]);
        setIsDialogOpen(false);
        setCsvInput("");
        toast({
          title: "CSV Imported",
          description: `Imported ${parsedUpdates.length} products from CSV`,
        });
      } else {
        toast({
          title: "No Matches Found",
          description: "No matching products found in CSV data",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "CSV Parse Error",
        description: "Failed to parse CSV data. Please check the format.",
        variant: "destructive",
      });
    }
  };

  // Export template
  const exportTemplate = () => {
    const template = [
      ['SKU', 'Product Name', 'Total Stock', 'Online Stock', 'Notes'],
      ['EXAMPLE-001', 'Example Product', '100', '50', 'Update notes'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(data, "batch-stock-template.xlsx");
  };

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!products || !searchTerm) return products;
    
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const getStatusBadge = (update: BatchStockUpdate) => {
    if (update.success === true) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
    } else if (update.success === false) {
      return <Badge variant="destructive">Failed</Badge>;
    } else if (update.newTotalStock !== update.currentTotalStock || update.newOnlineStock !== update.currentOnlineStock) {
      return <Badge variant="secondary">Pending</Badge>;
    } else {
      return <Badge variant="outline">No Change</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Stock Operations</h1>
          <p className="text-muted-foreground">Update multiple products' stock levels simultaneously</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import CSV Data</DialogTitle>
                <DialogDescription>
                  Paste CSV data with columns: SKU, Product Name, Total Stock, Online Stock, Notes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="SKU,Product Name,Total Stock,Online Stock, Notes&#10;EXAMPLE-001,Example Product,100,50,Update notes"
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  rows={10}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={parseCSV}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={clearUpdates} variant="outline" disabled={updates.length === 0}>
            Clear All
          </Button>
          <Button 
            onClick={executeBatchUpdate} 
            disabled={updates.length === 0 || batchUpdateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Update All ({updates.length})
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products to Update</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{updates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Changes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {updates.filter(u => u.newTotalStock !== u.currentTotalStock || u.newOnlineStock !== u.currentOnlineStock).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Change</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {updates.reduce((sum, u) => sum + (u.newTotalStock - u.currentTotalStock), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Stock Change</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {updates.reduce((sum, u) => sum + (u.newOnlineStock - u.currentOnlineStock), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Products */}
      <Card>
        <CardHeader>
          <CardTitle>Add Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {searchTerm && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredProducts?.slice(0, 10).map((product) => (
                  <div
                    key={product.id}
                    className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                    onClick={() => addProduct(product)}
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">SKU: {product.sku}</div>
                    </div>
                    <div className="text-sm text-right">
                      <div>Total: {product.totalStock}</div>
                      <div>Online: {product.onlineStock}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Updates Table */}
      {updates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Updates ({updates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>New Stock</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.map((update, index) => (
                  <TableRow key={update.productId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{update.productName}</div>
                        <div className="text-sm text-muted-foreground">SKU: {update.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Total: {update.currentTotalStock}</div>
                        <div>Online: {update.currentOnlineStock}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          value={update.newTotalStock}
                          onChange={(e) => updateStock(index, 'newTotalStock', parseInt(e.target.value) || 0)}
                          className="w-24"
                          placeholder="Total"
                        />
                        <Input
                          type="number"
                          value={update.newOnlineStock}
                          onChange={(e) => updateStock(index, 'newOnlineStock', parseInt(e.target.value) || 0)}
                          className="w-24"
                          placeholder="Online"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className={update.newTotalStock - update.currentTotalStock >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Total: {update.newTotalStock - update.currentTotalStock >= 0 ? '+' : ''}{update.newTotalStock - update.currentTotalStock}
                        </div>
                        <div className={update.newOnlineStock - update.currentOnlineStock >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Online: {update.newOnlineStock - update.currentOnlineStock >= 0 ? '+' : ''}{update.newOnlineStock - update.currentOnlineStock}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(update)}
                      {update.error && (
                        <div className="text-xs text-red-600 mt-1">{update.error}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(index)}
                        disabled={batchUpdateMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
