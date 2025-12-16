import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  LayoutDashboard,
  Tags,
  Palette,
  Shirt,
  Users,
  UserCog,
  Building2,
  ShoppingCart,
  LogOut,
  Menu,
  Ticket,
  Star,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Color } from "@shared/schema";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Package, label: "Sarees", href: "/admin/sarees" },
  { icon: Tags, label: "Categories", href: "/admin/categories" },
  { icon: Palette, label: "Colors", href: "/admin/colors" },
  { icon: Shirt, label: "Fabrics", href: "/admin/fabrics" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: UserCog, label: "Staff", href: "/admin/staff" },
  { icon: Building2, label: "Stores", href: "/admin/stores" },
  { icon: ShoppingCart, label: "Orders", href: "/admin/orders" },
  { icon: Ticket, label: "Coupons", href: "/admin/coupons" },
  { icon: Star, label: "Reviews", href: "/admin/reviews" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

export default function AdminColors() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [colorToDelete, setColorToDelete] = useState<Color | null>(null);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hexCode: "#B01F1F",
    isActive: true,
  });

  const { data: colors, isLoading } = useQuery<Color[]>({
    queryKey: ["/api/colors"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/colors", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Success", description: "Color created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create color",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest("PATCH", `/api/admin/colors/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Success", description: "Color updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update color",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/colors/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Success", description: "Color deleted successfully" });
      setDeleteDialogOpen(false);
      setColorToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete color",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const handleOpenCreate = () => {
    setEditingColor(null);
    setFormData({ name: "", hexCode: "#B01F1F", isActive: true });
    setDialogOpen(true);
  };

  const handleOpenEdit = (color: Color) => {
    setEditingColor(color);
    setFormData({
      name: color.name,
      hexCode: color.hexCode,
      isActive: color.isActive,
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (color: Color) => {
    setColorToDelete(color);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (colorToDelete) {
      deleteMutation.mutate(colorToDelete.id);
    }
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

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-semibold"
              data-testid="text-page-title"
            >
              Colors
            </h1>
            <p className="text-muted-foreground">Manage product colors</p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-color">
            <Plus className="h-4 w-4 mr-2" />
            Add Color
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Hex Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colors?.map((color) => (
                    <TableRow
                      key={color.id}
                      data-testid={`row-color-${color.id}`}
                    >
                      <TableCell>
                        <div
                          className="w-8 h-8 rounded-full border"
                          style={{ backgroundColor: color.hexCode }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {color.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {color.hexCode}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={color.isActive ? "default" : "secondary"}
                        >
                          {color.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(color)}
                          data-testid={`button-edit-${color.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(color)}
                          data-testid={`button-delete-${color.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingColor ? "Edit Color" : "Add Color"}
            </DialogTitle>
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
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
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
                  onChange={(e) =>
                    setFormData({ ...formData, hexCode: e.target.value })
                  }
                  className="w-16 h-10 p-1"
                  data-testid="input-hex-color"
                />
                <Input
                  value={formData.hexCode}
                  onChange={(e) =>
                    setFormData({ ...formData, hexCode: e.target.value })
                  }
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
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
                data-testid="switch-active"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingColor
                  ? "Update"
                  : "Create"}
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
