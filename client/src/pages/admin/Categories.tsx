import { CloudinaryUploader } from "@/components/CloudinaryUploader";
import { DataTable } from "@/components/DataTable/DataTable";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { AdaptiveModal } from "@/components/common/AdaptiveModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDataTable } from "@/hooks/use-data-table";
import { apiRequest } from "@/lib/queryClient";
import type { Category, Subcategory } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  Plus,
  Tags,
  Trash2,
  Upload
} from "lucide-react";
import React, { useState } from 'react';
import { FilterItem } from "@/components/Type/type";

const PREDEFINED_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

const PAGE_KEY = "adminCategories";

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


export default function AdminCategories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<Subcategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    isActive: true,
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    isActive: true,
    hasSizes: false,
    sizes: [] as string[],
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [addSubcategoryForms, setAddSubcategoryForms] = useState<Record<string, boolean>>({});
  const [newSubcategories, setNewSubcategories] = useState<Record<string, Partial<Subcategory>>>({});
  const [editingSubcategories, setEditingSubcategories] = useState<Record<string, Partial<Subcategory>>>({});

  const {
    data: categories,
    totalCount,
    pageIndex,
    pageSize,
    isLoading,
    handlePaginationChange,
    refetch,
  } = useDataTable<Category & { subcategories?: Subcategory[] }>({
    queryKey: "/api/admin/getCategories",
    initialPageSize: 10,
    pageKey: PAGE_KEY,
  });

  const [subcategories, setSubcategories] = useState<Partial<Subcategory>[]>([]);

  // Subcategory mutations
  const createSubcategoryMutation = useMutation({
    mutationFn: async (data: { categoryId: string; name: string; description: string; imageUrl: string; isActive: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/subcategories", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Subcategory added successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add subcategory",
        variant: "destructive",
      });
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Subcategory> }) => {
      const response = await apiRequest("PATCH", `/api/admin/subcategories/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Subcategory updated successfully" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subcategory",
        variant: "destructive",
      });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/subcategories/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Subcategory deleted successfully" });
      setDeleteDialogOpen(false);
      setSubcategoryToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete subcategory",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { subcategories?: Partial<Subcategory>[] }) => {
      const response = await apiRequest("POST", "/api/admin/categories", {
        ...data,
        subcategories: data.subcategories || []
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Category created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/categories/${id}`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Category updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/categories/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories?includeSubcategories=true"] });
      toast({ title: "Success", description: "Category deleted successfully" });
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "", imageUrl: "", isActive: true, hasSizes: false, sizes: [] });
    setSubcategories([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      imageUrl: category.imageUrl || "",
      isActive: category.isActive,
      hasSizes: !!(category.sizes && category.sizes.length > 0),
      sizes: category.sizes || [],
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (categoryToDelete) {
      deleteMutation.mutate(categoryToDelete.id);
    } else if (subcategoryToDelete) {
      deleteSubcategoryMutation.mutate(subcategoryToDelete.id);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      sizes: formData.hasSizes ? formData.sizes : []
    };
    
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: submitData });
    } else {
      createMutation.mutate({ ...submitData, subcategories });
    }
  };

  const handleImageUpload = (urls: string[]) => {
    if (urls.length > 0) {
      // Delete old image from Cloudinary before replacing
      if (formData.imageUrl?.includes("res.cloudinary.com")) {
        apiRequest("DELETE", "/api/uploads/cloudinary", { url: formData.imageUrl }).catch(
          (err) => console.error("Failed to delete old category image:", err)
        );
      }
      setFormData({ ...formData, imageUrl: urls[0] });
    }
  };

  const addSubcategory = () => {
    setSubcategories([
      ...subcategories,
      { name: "", description: "", imageUrl: "", isActive: true }
    ]);
  };


  const handleRowExpand = (rowId: string, isExpanded: boolean) => {
    const newExpandedRows = new Set(expandedRows);
    if (isExpanded) {
      newExpandedRows.add(rowId);
    } else {
      newExpandedRows.delete(rowId);
    }
    setExpandedRows(newExpandedRows);
  };

  const toggleAddSubcategoryForm = (categoryId: string) => {
    setAddSubcategoryForms(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const updateNewSubcategory = (categoryId: string, field: keyof Subcategory, value: any) => {
    setNewSubcategories(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: value
      }
    }));
  };

  const handleAddSubcategory = async (categoryId: string) => {
    const newSubcategory = newSubcategories[categoryId];
    if (newSubcategory?.name?.trim()) {
      createSubcategoryMutation.mutate({
        categoryId,
        name: newSubcategory.name,
        description: newSubcategory.description || "",
        imageUrl: newSubcategory.imageUrl || "",
        isActive: newSubcategory.isActive !== false
      });
      
      // Reset form for this category
      setNewSubcategories(prev => ({
        ...prev,
        [categoryId]: { name: "", description: "", imageUrl: "", isActive: true }
      }));
      setAddSubcategoryForms(prev => ({
        ...prev,
        [categoryId]: false
      }));
    }
  };

  const handleCancelAddSubcategory = (categoryId: string) => {
    setNewSubcategories(prev => ({
      ...prev,
      [categoryId]: { name: "", description: "", imageUrl: "", isActive: true }
    }));
    setAddSubcategoryForms(prev => ({
      ...prev,
      [categoryId]: false
    }));
  };

  const handleOpenAddSubcategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setEditingSubcategory(null);
    setSubcategoryFormData({
      name: "",
      description: "",
      imageUrl: "",
      isActive: true,
    });
    setSubcategoryModalOpen(true);
  };

  const handleEditSubcategoryModal = (subcategory: Subcategory) => {
    setSelectedCategory(null);
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({
      name: subcategory.name,
      description: subcategory.description || "",
      imageUrl: subcategory.imageUrl || "",
      isActive: subcategory.isActive,
    });
    setSubcategoryModalOpen(true);
  };

  const handleCloseSubcategoryModal = () => {
    setSubcategoryModalOpen(false);
    setSelectedCategory(null);
    setEditingSubcategory(null);
    setSubcategoryFormData({
      name: "",
      description: "",
      imageUrl: "",
      isActive: true,
    });
  };

  const handleSubcategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSubcategory) {
      // Update existing subcategory
      updateSubcategoryMutation.mutate({
        id: editingSubcategory.id,
        data: {
          name: subcategoryFormData.name,
          description: subcategoryFormData.description,
          imageUrl: subcategoryFormData.imageUrl,
          isActive: subcategoryFormData.isActive,
        }
      });
    } else if (selectedCategory) {
      // Create new subcategory
      createSubcategoryMutation.mutate({
        categoryId: selectedCategory.id,
        name: subcategoryFormData.name,
        description: subcategoryFormData.description,
        imageUrl: subcategoryFormData.imageUrl,
        isActive: subcategoryFormData.isActive,
      });
    }
    
    handleCloseSubcategoryModal();
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategories(prev => ({
      ...prev,
      [subcategory.id]: subcategory
    }));
  };

  const handleUpdateSubcategory = (subcategoryId: string) => {
    const editingSubcategory = editingSubcategories[subcategoryId];
    if (editingSubcategory?.name?.trim()) {
      updateSubcategoryMutation.mutate({
        id: subcategoryId,
        data: {
          name: editingSubcategory.name,
          description: editingSubcategory.description,
          imageUrl: editingSubcategory.imageUrl,
          isActive: editingSubcategory.isActive
        }
      });
      
      // Clear edit state
      setEditingSubcategories(prev => {
        const newState = { ...prev };
        delete newState[subcategoryId];
        return newState;
      });
    }
  };

  const handleCancelEditSubcategory = (subcategoryId: string) => {
    setEditingSubcategories(prev => {
      const newState = { ...prev };
      delete newState[subcategoryId];
      return newState;
    });
  };

  const handleDeleteSubcategory = (subcategory: Subcategory) => {
    setSubcategoryToDelete(subcategory);
    setDeleteDialogOpen(true);
  };

  const handleSizesToggle = (checked: boolean) => {
    setFormData({ 
      ...formData, 
      hasSizes: checked,
      sizes: checked ? PREDEFINED_SIZES : []
    });
  };

  const handleSizeToggle = (size: string) => {
    setFormData(prev => {
      const newSizes = prev.sizes.includes(size)
        ? prev.sizes.filter(s => s !== size)
        : [...prev.sizes, size];
      // Sort sizes to maintain predefined order (XS, S, M, L, XL, 2XL, 3XL), custom sizes go at the end
      const sorted = newSizes.sort((a, b) => {
        const indexA = PREDEFINED_SIZES.indexOf(a);
        const indexB = PREDEFINED_SIZES.indexOf(b);
        // If both are predefined, sort by predefined order
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Predefined sizes come before custom sizes
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        // Custom sizes maintain alphabetical order
        return a.localeCompare(b);
      });
      return { ...prev, sizes: sorted };
    });
  };

  const handleCustomSizeAdd = (customSize: string) => {
    if (customSize.trim() && !formData.sizes.includes(customSize.trim())) {
      setFormData(prev => {
        const newSizes = [...prev.sizes, customSize.trim()];
        // Sort sizes to maintain predefined order, custom sizes go at the end
        const sorted = newSizes.sort((a, b) => {
          const indexA = PREDEFINED_SIZES.indexOf(a);
          const indexB = PREDEFINED_SIZES.indexOf(b);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.localeCompare(b);
        });
        return { ...prev, sizes: sorted };
      });
    }
  };

  const handleCustomSizeRemove = (customSize: string) => {
    setFormData(prev => ({
      ...prev,
      sizes: prev.sizes.filter(s => s !== customSize)
    }));
  };


  // DataTable columns
  const columns: ColumnDef<Category & { subcategories?: Subcategory[] }>[] = [
    {
      accessorKey: "imageUrl",
      header: "Image",
      cell: ({ row }) => {
        const category = row.original;
        return (
          <div className="w-12 h-12">
            {category.imageUrl ? (
              <img
                src={category.imageUrl}
                alt={category.name}
                className="w-12 h-12 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                <Tags className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const category = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{category.name}</span>
            {category.subcategories && category.subcategories.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {category.subcategories.length} subcategories
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string;
        return (
          <div className="text-muted-foreground max-w-[300px] truncate">
            {description || "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "sizes",
      header: "Sizes",
      cell: ({ row }) => {
        const category = row.original;
        const sizes = category.sizes || [];
        return (
          <div className="max-w-[200px]">
            {sizes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {sizes.slice(0, 3).map((size) => (
                  <Badge key={size} variant="outline" className="text-xs">
                    {size}
                  </Badge>
                ))}
                {sizes.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{sizes.length - 3}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">No sizes</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.getValue("isActive") as boolean;
        return (
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const category = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenAddSubcategoryModal(category)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Sub
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenEdit(category)}
              data-testid={`button-edit-${category.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenDelete(category)}
              data-testid={`button-delete-${category.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  // Subcategories accordion content
  const renderSubcategories = (category: Category & { subcategories?: Subcategory[] }) => {
    if (!category.subcategories || category.subcategories.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          No subcategories found. Click "Add Sub" in the Actions column to add one.
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Image</th>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {category.subcategories.map((subcategory) => (
              <tr key={subcategory.id} className="border-t">
                <td className="p-3">
                  {subcategory.imageUrl ? (
                    <img
                      src={subcategory.imageUrl}
                      alt={subcategory.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Tags className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <span className="font-medium">{subcategory.name}</span>
                </td>
                <td className="p-3">
                  <span className="text-muted-foreground">
                    {subcategory.description || "No description"}
                  </span>
                </td>
                <td className="p-3">
                  <Badge variant={subcategory.isActive ? "default" : "secondary"}>
                    {subcategory.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSubcategoryModal(subcategory)}
                      disabled={updateSubcategoryMutation.isPending}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSubcategory(subcategory)}
                      disabled={deleteSubcategoryMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
              Categories
            </h1>
            <p className="text-muted-foreground">Manage product categories</p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        <DataTable
          pageKey="adminCategoryPage"
          columns={columns}
          data={categories || []}
          totalCount={categories?.length || 0}
          pageSize={10}
          pageIndex={0}
          onPaginationChange={() => {}}
          isLoading={isLoading}
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          accordion={true}
          accordionContent={renderSubcategories}
          accordionPosition="inline"
          onRowExpand={handleRowExpand}
        />
      </div>

      <AdaptiveModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingCategory ? "Edit Category" : "Add Category"}
        description={editingCategory
          ? "Update category details"
          : "Create a new category"}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="category-form"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingCategory
                ? "Update"
                : "Create"}
            </Button>
          </>
        }
      >
          <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                data-testid="input-description"
              />
            </div>
            <div>
              <Label>Category Image</Label>
              <div className="space-y-2">
                {formData.imageUrl && (
                  <div className="relative w-24 h-24">
                    <img
                      src={formData.imageUrl}
                      alt="Category preview"
                      className="w-full h-full object-cover rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => {
                        if (formData.imageUrl?.includes("res.cloudinary.com")) {
                          apiRequest("DELETE", "/api/uploads/cloudinary", { url: formData.imageUrl }).catch(
                            (err) => console.error("Failed to delete category image:", err)
                          );
                        }
                        setFormData({ ...formData, imageUrl: "" });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <CloudinaryUploader
                  maxNumberOfFiles={1}
                  onComplete={handleImageUpload}
                  buttonVariant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {formData.imageUrl ? "Change Image" : "Upload Image"}
                </CloudinaryUploader>
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

            {/* Sizes Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hasSizes"
                  checked={formData.hasSizes}
                  onCheckedChange={handleSizesToggle}
                  data-testid="switch-has-sizes"
                />
                <Label htmlFor="hasSizes">Enable Sizes</Label>
              </div>

              {formData.hasSizes && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-sm font-medium">Available Sizes</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {PREDEFINED_SIZES.map((size) => (
                        <div key={size} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`size-${size}`}
                            checked={formData.sizes.includes(size)}
                            onChange={() => handleSizeToggle(size)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={`size-${size}`} className="text-sm">
                            {size}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Custom Sizes</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add custom size (e.g., 4XL, Kids)"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const target = e.target as HTMLInputElement;
                              handleCustomSizeAdd(target.value);
                              target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            handleCustomSizeAdd(input.value);
                            input.value = '';
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      
                      {/* Display custom sizes */}
                      {formData.sizes.filter(size => !PREDEFINED_SIZES.includes(size)).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.sizes
                            .filter(size => !PREDEFINED_SIZES.includes(size))
                            .map((customSize) => (
                              <Badge
                                key={customSize}
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                {customSize}
                                <button
                                  type="button"
                                  onClick={() => handleCustomSizeRemove(customSize)}
                                  className="ml-1 text-xs hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
      </AdaptiveModal>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {categoryToDelete ? "Delete Category" : "Delete Subcategory"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {categoryToDelete ? (
                <>
                  the category "<strong>{categoryToDelete.name}</strong>"? This will also remove all associated subcategories.
                </>
              ) : (
                <>
                  the subcategory "<strong>{subcategoryToDelete?.name}</strong>"?
                </>
              )} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setCategoryToDelete(null);
                setSubcategoryToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending || deleteSubcategoryMutation.isPending}
            >
              {(deleteMutation.isPending || deleteSubcategoryMutation.isPending) ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subcategory Modal */}
      <AdaptiveModal
        open={subcategoryModalOpen}
        onOpenChange={setSubcategoryModalOpen}
        title={
          <>
            {editingSubcategory ? "Edit Subcategory" : "Add Subcategory"}
            {selectedCategory && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                for {selectedCategory.name}
              </span>
            )}
          </>
        }
        description={editingSubcategory 
          ? "Update subcategory details" 
          : selectedCategory 
            ? `Create a new subcategory for ${selectedCategory.name}`
            : "Create a new subcategory"
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSubcategoryModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="subcategory-form"
              disabled={createSubcategoryMutation.isPending || updateSubcategoryMutation.isPending}
            >
              {createSubcategoryMutation.isPending || updateSubcategoryMutation.isPending
                ? "Saving..."
                : editingSubcategory
                ? "Update"
                : "Create"}
            </Button>
          </>
        }
      >
          <form id="subcategory-form" onSubmit={handleSubcategorySubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subcategory-name">Name *</Label>
                <Input
                  id="subcategory-name"
                  value={subcategoryFormData.name}
                  onChange={(e) =>
                    setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })
                  }
                  placeholder="e.g., Kanchipuram silk"
                  required
                />
              </div>
              <div>
                <Label htmlFor="subcategory-description">Description</Label>
                <Textarea
                  id="subcategory-description"
                  value={subcategoryFormData.description}
                  onChange={(e) =>
                    setSubcategoryFormData({ ...subcategoryFormData, description: e.target.value })
                  }
                  placeholder="Brief description of the subcategory"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <Label>Subcategory Image</Label>
              <div className="flex items-center gap-4">
                {subcategoryFormData.imageUrl && (
                  <div className="relative w-20 h-20">
                    <img
                      src={subcategoryFormData.imageUrl}
                      alt="Subcategory preview"
                      className="w-full h-full object-cover rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => {
                        if (subcategoryFormData.imageUrl?.includes("res.cloudinary.com")) {
                          apiRequest("DELETE", "/api/uploads/cloudinary", { url: subcategoryFormData.imageUrl }).catch(
                            (err) => console.error("Failed to delete subcategory image:", err)
                          );
                        }
                        setSubcategoryFormData({ ...subcategoryFormData, imageUrl: "" });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <CloudinaryUploader
                  maxNumberOfFiles={1}
                  onComplete={(urls) => {
                    if (urls.length > 0) {
                      // Delete old subcategory image from Cloudinary before replacing
                      if (subcategoryFormData.imageUrl?.includes("res.cloudinary.com")) {
                        apiRequest("DELETE", "/api/uploads/cloudinary", { url: subcategoryFormData.imageUrl }).catch(
                          (err) => console.error("Failed to delete old subcategory image:", err)
                        );
                      }
                      setSubcategoryFormData({ ...subcategoryFormData, imageUrl: urls[0] });
                    }
                  }}
                  buttonVariant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {subcategoryFormData.imageUrl ? "Change Image" : "Upload Image"}
                </CloudinaryUploader>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="subcategory-active"
                checked={subcategoryFormData.isActive}
                onCheckedChange={(checked) =>
                  setSubcategoryFormData({ ...subcategoryFormData, isActive: checked })
                }
              />
              <Label htmlFor="subcategory-active">Active</Label>
            </div>
          </form>
      </AdaptiveModal>
    </div>
  );
}
