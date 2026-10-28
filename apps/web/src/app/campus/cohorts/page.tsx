"use client";

import React from "react";
import { CAMPUS_COHORT_RISK } from "@nera/core";
import { Card } from "@nera/ui";
import { ShieldCheckIcon } from "@nera/ui/icons";

export default function CampusCohortsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2F240E]">Kohort Risiko per Fakultas</h1>
        <p className="text-sm text-[#736B60] mt-1">
          Dikelompokkan berdasarkan Fakultas &amp; Angkatan.
        </p>
      </div>

      <div className="flex items-start gap-2.5 bg-[#FFF3D6] border border-[#A36A00]/30 rounded-xl p-3.5">
        <ShieldCheckIcon size={16} className="text-[#5B410C] shrink-0 mt-0.5" />
        <p className="text-xs text-[#2F240E] leading-relaxed">
          Data pada tabel ini <strong>teragregasi dan anonim</strong> — tidak ada nama mahasiswa, NIM, atau data mutasi individual yang ditampilkan ke pihak kampus.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="bg-[#F7F5F0] text-left text-[11px] font-bold uppercase tracking-wider text-[#736B60]">
              <th className="px-5 py-3">Fakultas</th>
              <th className="px-5 py-3">Angkatan</th>
              <th className="px-5 py-3">Total Mahasiswa</th>
              <th className="px-5 py-3">Aman</th>
              <th className="px-5 py-3">Waspada</th>
              <th className="px-5 py-3">Kritis</th>
            </tr>
          </thead>
          <tbody>
            {CAMPUS_COHORT_RISK.map((row, idx) => (
              <tr
                key={row.id}
                className={idx !== CAMPUS_COHORT_RISK.length - 1 ? "border-b border-[#F7F5F0]" : ""}
              >
                <td className="px-5 py-3.5 font-semibold text-[#2F240E]">{row.faculty}</td>
                <td className="px-5 py-3.5 text-[#736B60]">{row.cohortYear}</td>
                <td className="px-5 py-3.5 text-[#736B60]">{row.totalStudents}</td>
                <td className="px-5 py-3.5">
                  <span className="text-[#15803D] font-bold">{row.amanPct}%</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[#B45309] font-bold">{row.waspadaPct}%</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[#B91C1C] font-bold">{row.kritisPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
