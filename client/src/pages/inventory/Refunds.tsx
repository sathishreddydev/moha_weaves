import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface Refund {
  id: string;
  returnRequestId: string;
  orderId: string;
  amount: string;
  status: string;
  reason: string;
  createdAt: string;
  razorpayRefundId?: string;
  failureReason?: string;
}

export default function Refunds() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["/api/inventory/refunds", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const response = await apiRequest("GET", `/api/inventory/refunds${params}`);
      return response.json();
    },
  });

  const processRefundMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/inventory/refunds/${id}/process`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/refunds"] });
      toast({ title: "Success", description: "Refund processed" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "processing": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Refund Management</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {(refunds ?? [])?.map((refund: Refund) => (
          <Card key={refund.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(refund.status)}>
                      {refund.status}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {format(new Date(refund.createdAt), "MMM dd, yyyy HH:mm")}
                    </span>
                  </div>
                  <div className="font-semibold">{refund.amount}</div>
                  <p className="text-sm text-gray-600">Order: {refund.orderId}</p>
                  <p className="text-sm text-gray-600">Reason: {refund.reason}</p>
                  {refund.razorpayRefundId && (
                    <p className="text-sm text-gray-600">Refund ID: {refund.razorpayRefundId}</p>
                  )}
                  {refund.failureReason && (
                    <p className="text-sm text-red-600">Error: {refund.failureReason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {refund.status === "failed" && (
                    <Button
                      size="sm"
                      onClick={() => processRefundMutation.mutate({ id: refund.id, status: "retry" })}
                      disabled={processRefundMutation.isPending}
                    >
                      Retry
                    </Button>
                  )}
                  {refund.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => processRefundMutation.mutate({ id: refund.id, status: "processing" })}
                      disabled={processRefundMutation.isPending}
                    >
                      Process
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}