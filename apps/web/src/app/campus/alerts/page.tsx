"use client";

import React from "react";
import { CAMPUS_INTERVENTION_ALERTS } from "@nera/core";
import { Card } from "@nera/ui";
import { AlertOctagonIcon, AlertTriangleIcon, InfoIcon, ArrowRightIcon } from "@nera/ui/icons";

const SEVERITY_CONFIG = {
  critical: { icon: AlertOctagonIcon, bg: "bg-[#FBE4DE]", border: "border-[#EF4444]/30", text: "text-[#EF4444]", label: "Kritis" },
  warning: { icon: AlertTriangleIcon, bg: "bg-[#FFF3D6]", border: "border-[#FBBF24]/30", text: "text-[#B45309]", label: "Perhatian" },
  info: { icon: InfoIcon, bg: "bg-[#FFF3D6]", border: "border-[#A36A00]/30", text: "text-[#76520E]", label: "Info" },
} as const;

export default function CampusAlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2F240E]">Peringatan &amp; Rekomendasi Intervensi</h1>
        <p className="text-sm text-[#736B60] mt-1">
          Dihasilkan otomatis dari pola agregat, bukan pemantauan individu mahasiswa.
        </p>
      </div>

      <div className="space-y-3">
        {CAMPUS_INTERVENTION_ALERTS.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity];
          const Icon = config.icon;
          const dateStr = new Date(alert.detectedAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
          });

          return (
            <Card key={alert.id} className={`space-y-3 ${config.border}`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${config.text}`}>
                  <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">{config.label}</span>
                </div>
                <span className="text-[11px] text-[#817B70]">{dateStr}</span>
              </div>

              <h3 className="text-sm font-bold text-[#2F240E]">{alert.title}</h3>
              <p className="text-xs text-[#736B60] leading-relaxed">{alert.description}</p>

              <div className="flex items-center gap-2 pt-2 border-t border-[#F7F5F0] text-xs">
                <ArrowRightIcon size={12} className="text-[#5B410C] shrink-0" />
                <span className="text-[#2F240E] font-medium">{alert.recommendedAction}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
