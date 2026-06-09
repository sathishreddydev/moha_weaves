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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDataTable } from "@/hooks/use-data-table";
import type { Color } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { FilterItem } from "@/components/Type/type";

const PAGE_KEY = "adminColors";

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

export default function AdminColors() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [colorToDelete, setColorToDelete] = useState<Color | null>(null);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hexCode: "#B01F1F",
    isActive: true,
  });

  const {
    data: colors,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<Color>({
    queryKey: "/api/admin/getColors",
    initialPageSize: 10,
    pageKey: PAGE_KEY,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/colors", data);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Color created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create color", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/admin/colors/${id}`, data);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Color updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update color", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/colors/${id}`);
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Success", description: "Color deleted successfully" });
      setDeleteDialogOpen(false);
      setColorToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete color", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingColor(null);
    setFormData({ name: "", hexCode: "#B01F1F", isActive: true });
    setDialogOpen(true);
  };

  const handleOpenEdit = (color: Color) => {
    setEditingColor(color);
    setFormData({ name: color.name, hexCode: color.hexCode, isActive: color.isActive });
    setDialogOpen(true);
  };

  const handleOpenDelete = (color: Color) => {
    setColorToDelete(color);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (colorToDelete) deleteMutation.mutate(colorToDelete.id);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingColor(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingColor) {
      updateMutation.mutate({ id: editingColor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: ColumnDef<Color>[] = [
    {
      accessorKey: "hexCode",
      header: "Color",
      cell: ({ row }) => (
        <div
          className="w-8 h-8 rounded-full border"
          style={{ backgroundColor: row.original.hexCode }}
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "hex",
      header: "Hex Code",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono">{row.original.hexCode}</span>
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
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">Colors</h1>
            <p className="text-muted-foreground">Manage product colors</p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-color">
            <Plus className="h-4 w-4 mr-2" />
            Add Color
          </Button>
        </div>

        <DataTable
          pageKey={PAGE_KEY}
          columns={columns}
          data={colors || []}
          totalCount={totalCount}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPaginationChange={handlePaginationChange}
          isLoading={isLoading}
          searchPlaceholder="Search colors..."
          emptyMessage="No colors found"
          filters={statusFilter}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingColor ? "Edit Color" : "Add Color"}</DialogTitle>
            <DialogDescription>
              {editingColor ? "Update color details" : "Create a new color option"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="hexCode">Hex Code</Label>
              <div className="flex gap-2">
                <Input
                  id="hexCode"
                  type="color"
                  value={formData.hexCode}
                  onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                  className="w-16 h-10 p-1"
                  data-testid="input-hex-color"
                />
                <Input
                  value={formData.hexCode}
                  onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                  placeholder="#000000"
                  className="flex-1 font-mono"
                  data-testid="input-hex-text"
                />
              </div>
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingColor ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Color</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{colorToDelete?.name}"? This action cannot be undone.
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
