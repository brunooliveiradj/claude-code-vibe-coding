import React, { useState, useRef } from "react";
import { Upload, AlertCircle, CheckCircle2, FileVideo, FileImage, Trash2 } from "lucide-react";

interface CreativeUploaderProps {
  strategy: string;
  onCreativeAdded: (c: { name: string; type: "Display" | "Video"; dimensions: string }) => void;
}

const DISPLAY_DIMS = ["300x250", "300x600", "320x450", "320x480", "336x280", "728x90", "300x50", "320x50", "160x600", "970x250"];
const VIDEO_DIMS = ["1280x720", "1920x1080", "1440x1080", "720x1280", "1080x1920", "1080x1440", "720x720", "1080x1080"];

export function CreativeUploader({ strategy, onCreativeAdded }: CreativeUploaderProps) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; size: string; dim: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const isVideo = strategy?.toLowerCase() === "video";

  const validate = (f: File) => {
    setError(null);
    if (isVideo) {
      if (f.type !== "video/mp4") return setError("Apenas MP4 para campanhas de Vídeo.");
      if (f.size > 100 * 1024 * 1024) return setError("Máximo 100MB para vídeo.");
    } else {
      if (!["image/png","image/jpeg","image/gif"].includes(f.type)) return setError("Apenas PNG, JPG ou GIF para Display.");
      if (f.size > 800 * 1024) return setError("Máximo 800KB para Display.");
    }
    const dims = isVideo ? VIDEO_DIMS : DISPLAY_DIMS;
    const dim = dims[Math.floor(Math.random() * dims.length)];
    const size = f.size > 1024*1024 ? `${(f.size/1048576).toFixed(1)}MB` : `${(f.size/1024).toFixed(0)}KB`;
    setFile({ name: f.name, size, dim });
    onCreativeAdded({ name: f.name, type: isVideo ? "Video" : "Display", dimensions: dim });
  };

  return (
    <div className="mt-2">
      {!file ? (
        <label
          onDragEnter={e => { e.preventDefault(); setDrag(true); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) validate(e.dataTransfer.files[0]); }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all ${drag ? "border-yellow-400 bg-yellow-50" : "border-zinc-200 hover:border-black bg-zinc-50"}`}>
          <input ref={ref} type="file" className="hidden" accept={isVideo ? "video/mp4" : "image/png,image/jpeg,image/gif"} onChange={e => { if (e.target.files?.[0]) validate(e.target.files[0]); }} />
          {isVideo ? <FileVideo className="h-7 w-7 text-black mb-2" /> : <FileImage className="h-7 w-7 text-black mb-2" />}
          <p className="text-sm font-bold text-zinc-700 text-center">Arraste ou <span className="underline">selecione o arquivo</span></p>
          <p className="text-[10px] text-zinc-400 mt-1">{isVideo ? "MP4 · máx 100MB" : "PNG, JPG, GIF · máx 800KB"}</p>
        </label>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-zinc-100 rounded-lg">{isVideo ? <FileVideo className="h-4 w-4" /> : <FileImage className="h-4 w-4" />}</div>
            <div>
              <p className="text-xs font-bold text-zinc-900 truncate max-w-[200px]">{file.name}</p>
              <p className="text-[10px] text-zinc-400">{file.dim} · {file.size}</p>
            </div>
          </div>
          <button type="button" onClick={() => { setFile(null); setError(null); if (ref.current) ref.current.value = ""; }}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && <div className="flex items-center gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</div>}
      <div className="flex flex-wrap gap-1 mt-2">
        {(isVideo ? VIDEO_DIMS : DISPLAY_DIMS).map(d => (
          <span key={d} className="text-[9px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">{d}</span>
        ))}
      </div>
    </div>
  );
}
