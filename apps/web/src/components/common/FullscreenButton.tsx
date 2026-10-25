"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setError("");
    };

    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    setError("");

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setError("Browser ini tidak mendukung fullscreen. Coba buka lewat browser lain atau tambahkan aplikasi ke layar utama.");
      }
    } catch {
      setError("Fullscreen tidak dapat diaktifkan di browser ini.");
    }
  };

  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = isFullscreen ? "Keluar dari fullscreen" : "Masuk fullscreen";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleFullscreen}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F5] text-[#2F240E] transition-colors hover:bg-[#FFF3D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#76520E] sm:h-9 sm:w-9"
        aria-label={label}
        title={label}
      >
        <Icon size={18} strokeWidth={2} />
      </button>
      {error && (
        <p role="status" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl bg-[#2F240E] px-3 py-2 text-xs text-white shadow-md">
          {error}
        </p>
      )}
    </div>
  );
}
