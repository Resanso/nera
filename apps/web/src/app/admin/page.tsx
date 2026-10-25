"use client";

import { useEffect, useState } from "react";
import { NeraOrb } from "../../components/mascot/NeraOrb";
import { NotAdmin, NotSignedIn, adminApi, authApi, type AdminOverview } from "../../lib/emailImport";

const formatDate = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "–";

const FORWARD_LABEL = { waiting: "Menunggu", confirm: "Perlu konfirmasi", active: "Aktif" } as const;

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "forbidden"; email?: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: AdminOverview; email: string };

export default function AdminPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    authApi
      .me()
      .then(async (me) => {
        if (!me.isAdmin) return setState({ kind: "forbidden", email: me.email });
        setState({ kind: "ready", data: await adminApi.overview(), email: me.email });
      })
      .catch((e) => {
        if (e instanceof NotSignedIn) return setState({ kind: "signed-out" });
        if (e instanceof NotAdmin) return setState({ kind: "forbidden" });
        setState({ kind: "error", message: (e as Error).message });
      });
  }, []);

  return (
    <main className="min-h-dvh bg-[#F7F7F7] px-4 py-8 text-[#2F240E] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center gap-4">
          <NeraOrb mood={state.kind === "ready" ? "happy" : state.kind === "forbidden" ? "alert" : "idle"} size={64} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#76520E]/70">Admin</p>
            <h1 className="text-2xl font-bold">Pengguna impor email</h1>
          </div>
          {state.kind === "ready" && <p className="ml-auto text-xs text-[#736B60]">Masuk sebagai {state.email}</p>}
        </header>

        {state.kind === "loading" && <p className="mt-10 text-sm text-[#736B60]">Memuat…</p>}

        {state.kind === "signed-out" && (
          <div className="mt-10 max-w-sm rounded-[24px] bg-white p-6">
            <p className="text-sm">Masuk dengan akun Google yang terdaftar sebagai admin.</p>
            <button
              type="button"
              onClick={() => (window.location.href = authApi.loginUrl("/admin"))}
              className="mt-4 h-11 w-full rounded-[14px] bg-[#FFB900] text-sm font-semibold text-[#352500] hover:bg-[#E6A700]"
            >
              Masuk dengan Google
            </button>
          </div>
        )}

        {state.kind === "forbidden" && (
          <p className="mt-10 rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-medium text-[#A92F2F]">
            {state.email ?? "Akun ini"} tidak punya akses admin.
          </p>
        )}

        {state.kind === "error" && (
          <p className="mt-10 rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm font-medium text-[#A92F2F]">{state.message}</p>
        )}

        {state.kind === "ready" && (
          <>
            <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Pengguna", state.data.totals.users],
                ["Gmail terhubung", state.data.totals.gmailConnected],
                ["Forward aktif", state.data.totals.forwardActive],
                ["Transaksi diimpor", state.data.totals.transactions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] bg-white p-4">
                  <p className="text-xs text-[#736B60]">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </section>

            <section className="mt-6 overflow-x-auto rounded-[24px] bg-white">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-[#F1EEE8] text-xs text-[#736B60]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Akun login</th>
                    <th className="px-3 py-3 font-semibold">Gmail (opsi A)</th>
                    <th className="px-3 py-3 font-semibold">Forward (opsi B)</th>
                    <th className="px-3 py-3 text-right font-semibold">Transaksi</th>
                    <th className="px-3 py-3 font-semibold">Pertama</th>
                    <th className="px-5 py-3 font-semibold">Terakhir aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EEE8]">
                  {state.data.users.map((u) => (
                    <tr key={u.email} className="align-top">
                      <td className="px-5 py-3 font-semibold">{u.email}</td>
                      <td className="px-3 py-3">
                        {u.gmail ? (
                          <>
                            <p>{u.gmail.address}</p>
                            <p className="text-xs text-[#736B60]">sinkron {formatDate(u.gmail.lastSyncAt)}</p>
                          </>
                        ) : (
                          <span className="text-[#736B60]">–</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{u.forward ? FORWARD_LABEL[u.forward.status] : <span className="text-[#736B60]">–</span>}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <p className="font-semibold">{u.transactions.total}</p>
                        <p className="text-xs text-[#736B60]">
                          G {u.transactions.gmail} · F {u.transactions.forward} · contoh {u.transactions.demo}
                          {u.transactions.needsReview > 0 && ` · ${u.transactions.needsReview} perlu dicek`}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-[#736B60]">{formatDate(u.firstSeenAt)}</td>
                      <td className="px-5 py-3 text-[#736B60]">{formatDate(u.lastSeenAt)}</td>
                    </tr>
                  ))}
                  {state.data.users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[#736B60]">
                        Belum ada yang mencoba.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
