import React, { useState } from "react";
import { MapPin, Navigation } from "lucide-react";

interface InteractiveMapProps {
  address: string;
  setAddress: (v: string) => void;
  radius: number;
  setRadius: (r: number) => void;
}

export function InteractiveMap({ address, setAddress, radius, setRadius }: InteractiveMapProps) {
  const [pin, setPin] = useState({ x: 50, y: 50 });
  const [search, setSearch] = useState(address);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    setAddress(search || "Ponto personalizado");
  };

  const pick = (loc: string) => {
    setSearch(loc);
    setAddress(loc);
    setPin({ x: 45 + Math.random() * 10, y: 45 + Math.random() * 10 });
  };

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 mt-2">
      <div className="relative mb-2">
        <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-black" />
        <input
          type="text"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 text-black"
          placeholder="Endereço ou ponto de referência..."
          value={search}
          onChange={e => { setSearch(e.target.value); setAddress(e.target.value); }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {["Av. Paulista, SP", "Copacabana, RJ", "Esplanada, DF", "Savassi, MG"].map(loc => (
          <button key={loc} type="button" onClick={() => pick(loc)}
            className="text-[10px] bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded cursor-pointer">
            {loc}
          </button>
        ))}
      </div>
      <div className="relative h-40 bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 cursor-crosshair" onClick={handleMapClick}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(0deg,#ddd 1px,transparent 1px),linear-gradient(90deg,#ddd 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none"
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-black bg-yellow-400/10 animate-pulse transition-all"
            style={{ width: `${radius * 6}px`, height: `${radius * 6}px` }} />
          <MapPin className="h-5 w-5 text-black fill-yellow-400 drop-shadow relative z-10" />
        </div>
        <div className="absolute bottom-2 right-2 bg-white text-[9px] font-mono p-1 rounded border border-zinc-200 text-zinc-400 flex items-center gap-1">
          <Navigation className="h-2.5 w-2.5" /> {radius}KM raio
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] font-bold text-zinc-600">Raio:</span>
        <div className="flex gap-1">
          {[5, 10, 15, 20].map(r => (
            <button key={r} type="button" onClick={() => setRadius(r)}
              className={`text-[10px] px-2 py-0.5 rounded border font-bold cursor-pointer ${radius === r ? "bg-black text-yellow-400 border-black" : "bg-white text-zinc-600 border-zinc-200"}`}>
              {r}KM
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
