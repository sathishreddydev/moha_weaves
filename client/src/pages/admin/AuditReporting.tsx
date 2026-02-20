import { useState, useMemo } from "react";
import {
  FileText,
  Users,
  Package,
  TrendingUp,
  Download,
  Calendar,
  Filter,
  Search,
  BarChart3,
  PieChart,
  Activity,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entityType: 'product' | 'stock_request' | 'order' | 'stock_movement';
  entityId: string;
  oldValues?: any;
  newValues?: any;
  timestamp: Date;
  notes?: string;
}

interface AuditReport {
  summary: {
    totalMovements: number;
    totalQuantityChanged: number;
    uniqueUsers: number;
    uniqueProducts: number;
    movementsByType: Record<string, number>;
    movementsByUser: Array<{
      userName: string;
      count: number;
      totalQuantity: number;
    }>;
  };
  details: AuditLogEntry[];
}

export default function AuditReporting() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("7days");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<AuditReport | null>(null);

  // Calculate date range
  const getDateRange = (filter: string) => {
    const now = new Date();
    const fromDate = new Date();
    
    switch (filter) {
      case "today":
        fromDate.setHours(0, 0, 0, 0);
        break;
      case "7days":
        fromDate.setDate(now.getDate() - 7);
        break;
      case "30days":
        fromDate.setDate(now.getDate() - 30);
        break;
      case "90days":
        fromDate.setDate(now.getDate() - 90);
        break;
      default:
        fromDate.setDate(now.getDate() - 7);
    }
    
    return {
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    };
  };

  const dateRange = getDateRange(dateFilter);

  // Fetch audit data - Updated to use admin endpoints
  const { data: auditData, isLoading, refetch } = useQuery<{
    data: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: [
      "/api/admin/stock-audit",
      dateRange.dateFrom,
      dateRange.dateTo,
      actionFilter !== "all" ? actionFilter : undefined,
      userFilter !== "all" ? userFilter : undefined,
      searchTerm,
    ],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Generate report mutation - Updated to use admin endpoint
  const generateReport = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/stock-audit/report", {
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        ...(actionFilter !== "all" && { movementType: actionFilter }),
        ...(userFilter !== "all" && { userId: userFilter }),
      });
      
      const data = await response.json();
      setReportData(data);
      setIsReportDialogOpen(true);
    } catch (error) {
      toast({
        title: "Report Generation Failed",
        description: "Failed to generate audit report",
        variant: "destructive",
      });
    }
  };

  // Filter data
  const filteredData = useMemo(() => {
    if (!auditData?.data) return [];

    return auditData.data.filter((entry) => {
      const matchesSearch = 
        entry.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = actionFilter === "all" || entry.action === actionFilter;
      const matchesUser = userFilter === "all" || entry.userId === userFilter;

      return matchesSearch && matchesAction && matchesUser;
    });
  }, [auditData?.data, searchTerm, actionFilter, userFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (!filteredData.length) return {
      totalMovements: 0,
      uniqueUsers: 0,
      uniqueProducts: 0,
      totalQuantity: 0,
      movementsByType: {},
    };

    const uniqueUsers = new Set(filteredData.map(e => e.userId)).size;
    const uniqueProducts = new Set(filteredData.map(e => e.entityId)).size;
    const totalQuantity = filteredData.reduce((sum, e) => sum + Math.abs(e.newValues?.quantity || 0), 0);
    const movementsByType = filteredData.reduce((acc, e) => {
      acc[e.action] = (acc[e.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMovements: filteredData.length,
      uniqueUsers,
      uniqueProducts,
      totalQuantity,
      movementsByType,
    };
  }, [filteredData]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    if (!auditData?.data) return [];
    const users = Array.from(new Set(auditData.data.map(e => e.userId)));
    return users.map(userId => {
      const entry = auditData.data.find(e => e.userId === userId);
      return {
        id: userId,
        name: entry?.userName || 'Unknown',
      };
    });
  }, [auditData?.data]);

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      sale: "destructive",
      return: "secondary",
      restock: "default",
      transfer: "outline",
      adjustment: "secondary",
      exchange: "default",
      request: "outline",
    };

    const colors: Record<string, string> = {
      sale: "bg-red-100 text-red-800",
      return: "bg-blue-100 text-blue-800",
      restock: "bg-green-100 text-green-800",
      transfer: "bg-yellow-100 text-yellow-800",
      adjustment: "bg-purple-100 text-purple-800",
      exchange: "bg-gray-100 text-gray-800",
      request: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge variant={variants[action] || "outline"} className={colors[action] || ""}>
        {action}
      </Badge>
    );
  };

  const getEntityTypeBadge = (entityType: string) => {
    const colors: Record<string, string> = {
      product: "bg-blue-100 text-blue-800",
      stock_request: "bg-green-100 text-green-800",
      order: "bg-purple-100 text-purple-800",
      stock_movement: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge variant="outline" className={colors[entityType] || ""}>
        {entityType.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Audit Reporting</h1>
          <p className="text-muted-foreground">Comprehensive audit trail and compliance reporting</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateReport} variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button onClick={() => refetch()} variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Movements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMovements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Affected</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuantity}</div>
          </CardContent>
        </Card>
      </div>

      {/* Movement Types Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Movements by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.movementsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {getActionBadge(type)}
                  </div>
                  <div className="text-sm font-medium">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Users by Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uniqueUsers.slice(0, 5).map((user) => {
                const userMovements = filteredData.filter(e => e.userId === user.id);
                const userQuantity = userMovements.reduce((sum, e) => sum + Math.abs(e.newValues?.quantity || 0), 0);
                
                return (
                  <div key={user.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{user.name}</span>
                    </div>
                    <div className="text-sm text-right">
                      <div className="font-medium">{userMovements.length} movements</div>
                      <div className="text-muted-foreground">{userQuantity} units</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, action, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="restock">Restock</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="exchange">Exchange</SelectItem>
                <SelectItem value="request">Request</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log ({filteredData.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Activity className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(new Date(entry.timestamp))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.userName}</div>
                        <div className="text-sm text-muted-foreground">{entry.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(entry.action)}</TableCell>
                    <TableCell>{getEntityTypeBadge(entry.entityType)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        ID: {entry.entityId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${
                        (entry.newValues?.quantity || 0) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {entry.newValues?.quantity || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-xs truncate" title={entry.notes}>
                        {entry.notes}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Report</DialogTitle>
            <DialogDescription>
              Comprehensive audit report for {dateRange.dateFrom} to {dateRange.dateTo}
            </DialogDescription>
          </DialogHeader>
          
          {reportData && (
            <div className="space-y-6">
              {/* Summary Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{reportData.summary.totalMovements}</div>
                    <p className="text-xs text-muted-foreground">Total Movements</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{reportData.summary.uniqueUsers}</div>
                    <p className="text-xs text-muted-foreground">Unique Users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{reportData.summary.uniqueProducts}</div>
                    <p className="text-xs text-muted-foreground">Products Affected</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{reportData.summary.totalQuantityChanged}</div>
                    <p className="text-xs text-muted-foreground">Total Quantity</p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Movements by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(reportData.summary.movementsByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="capitalize">{type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reportData.summary.movementsByUser.slice(0, 10).map((user, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{user.userName}</span>
                          <div className="text-right">
                            <div className="font-medium">{user.count}</div>
                            <div className="text-sm text-muted-foreground">{user.totalQuantity} units</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
