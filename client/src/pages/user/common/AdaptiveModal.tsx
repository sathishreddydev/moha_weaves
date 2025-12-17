import { BaseModalProps } from "@/components/common/modal-types";
import { ReusableDialog } from "@/components/common/ReusableDialog";
import { ReusableDrawer } from "@/components/common/ReusableDrawer";
import { useIsMobile } from "@/hooks/use-mobile";


export function AdaptiveModal(props: BaseModalProps) {
  const isMobile = useIsMobile();

  return isMobile ? (
    <ReusableDrawer {...props} />
  ) : (
    <ReusableDialog {...props} />
  );
}
