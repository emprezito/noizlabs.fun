import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageLightbox = ({ src, alt, isOpen, onClose }: ImageLightboxProps) => {
  if (!src) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-background/80 rounded-full hover:bg-background transition-colors"
        >
          <X className="w-6 h-6 text-foreground" />
        </button>
        <img
          src={src}
          alt={alt}
          className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
};

export default ImageLightbox;
