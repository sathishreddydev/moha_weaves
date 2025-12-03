import { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload as UploadIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  fileType?: "image" | "video";
  onComplete?: (urls: string[]) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  allowedFileTypes,
  fileType = "image",
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const acceptTypes = allowedFileTypes?.join(",") || (fileType === "video" ? "video/*" : "image/*");

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the maximum file size of ${Math.round(maxFileSize / 1048576)}MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    const totalFiles = selectedFiles.length + validFiles.length;
    if (totalFiles > maxNumberOfFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxNumberOfFiles} files allowed`,
        variant: "destructive",
      });
      setSelectedFiles([...selectedFiles, ...validFiles.slice(0, maxNumberOfFiles - selectedFiles.length)]);
    } else {
      setSelectedFiles([...selectedFiles, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of selectedFiles) {
        const presignedResponse = await apiRequest("POST", "/api/uploads/presigned-url", {
          fileType,
          fileName: file.name,
          contentType: file.type,
        });
        const { uploadURL, objectPath, uploadToken } = await presignedResponse.json();

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        const confirmResponse = await apiRequest("POST", "/api/uploads/confirm", {
          objectPath,
          uploadToken,
        });
        
        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to confirm upload");
        }
        
        const confirmData = await confirmResponse.json();
        uploadedUrls.push(confirmData.objectPath);
      }

      onComplete?.(uploadedUrls);
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${uploadedUrls.length} file(s)`,
      });
      setShowModal(false);
      setSelectedFiles([]);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setSelectedFiles([]);
  };

  return (
    <>
      <Button
        type="button"
        onClick={handleOpenModal}
        className={buttonClassName}
        variant={buttonVariant}
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Upload {fileType === "video" ? "Video" : "Images"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Click to select {fileType === "video" ? "video" : "images"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max {maxNumberOfFiles} file(s), {Math.round(maxFileSize / 1048576)}MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptTypes}
                multiple={maxNumberOfFiles > 1}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selected files:</p>
                <div className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-accent/50 rounded px-3 py-2"
                    >
                      <span className="text-sm truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
