import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Check, X, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
};

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = 400; // output size
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Draw circular clip
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9);
  });
}

export default function AvatarCropper({ imageSrc, onCropComplete, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((location: { x: number; y: number }) => setCrop(location), []);
  const onZoomChange = useCallback((z: number) => setZoom(z), []);

  const onMediaLoaded = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCropComplete(blob);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm mx-auto flex flex-col h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onCancel} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <p className="font-montserrat font-bold text-white text-sm">Ajustar foto</p>
          <button onClick={handleConfirm} className="p-2 rounded-xl bg-secondary text-white hover:bg-secondary/80 transition-colors">
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper */}
        <div className="flex-1 relative">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onMediaLoaded}
          />
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-6 py-4">
          <ZoomOut className="w-4 h-4 text-white/60 flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-secondary h-1"
          />
          <ZoomIn className="w-4 h-4 text-white/60 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}
