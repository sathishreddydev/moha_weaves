import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/DataTable/DataTable";
import { AdaptiveModal } from "@/components/common/AdaptiveModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDataTable } from "@/hooks/use-data-table";
import type { Fabric } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { FilterItem } from "@/components/Type/type";

const PAGE_KEY = "adminFabrics";

const statusFilter: FilterItem[] = [
  {
    key: "status",
    label: "Status",
    placeholder: "Filter by status",
    tree: [
      { id: "active", label: "Active" },
      { id: "inactive", label: "Inactive" },
    ],
  },
];

export default function AdminFabrics() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fabricToDelete, setFabricToDelete] = useState<Fabric | null>(null);
  const [editingFabric, setEditingFabric] = useState<Fabric | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  const {
    data: fabrics,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<Fabric>({
    queryKey: "/api/admin/getFabrics",
    initialPageSize: 10,
    pageKey: PAGE_KEY,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/fabrics", data);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Fabric created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create fabric", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/admin/fabrics/${id}`, data);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Fabric updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update fabric", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/fabrics/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Fabric deleted successfully" });
      setDeleteDialogOpen(false);
      setFabricToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to delete fabric", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingFabric(null);
    setFormData({ name: "", description: "", isActive: true });
    setDialogOpen(true);
  };

  const handleOpenEdit = (fabric: Fabric) => {
    setEditingFabric(fabric);
    setFormData({ name: fabric.name, description: fabric.description || "", isActive: fabric.isActive });
    setDialogOpen(true);
  };

  const handleOpenDelete = (fabric: Fabric) => {
    setFabricToDelete(fabric);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (fabricToDelete) deleteMutation.mutate(fabricToDelete.id);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFabric(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFabric) {
      updateMutation.mutate({ id: editingFabric.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<Fabric>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground max-w-[300px] truncate block">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(row.original)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Fabrics</h1>
            <p className="text-muted-foreground">Manage fabric types</p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-fabric">
            <Plus className="h-4 w-4 mr-2" />
            Add Fabric
          </Button>
        </div>

        <DataTable
          pageKey={PAGE_KEY}
          columns={columns}
          data={fabrics || []}
          totalCount={totalCount}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
          isLoading={isLoading}
          searchPlaceholder="Search fabrics..."
          emptyMessage="No fabrics found"
          filters={statusFilter}
        />
      </div>

      <AdaptiveModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingFabric ? "Edit Fabric" : "Add Fabric"}
        description={editingFabric ? "Update fabric details" : "Create a new fabric type"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              form="fabric-form"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingFabric ? "Update" : "Create"}
            </Button>
          </>
        }
      >
        <form id="fabric-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-description"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="switch-active"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
        </form>
      </AdaptiveModal>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fabric</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fabricToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
