"use client";

import { useEffect, useMemo, useState } from "react";

type ApiState =
  | { status: "checking" }
  | { status: "online"; service: string; database: string; timestamp: string }
  | { status: "offline"; message: string };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

export default function Home() {
  const [apiState, setApiState] = useState<ApiState>({ status: "checking" });

  const healthUrl = useMemo(() => `${apiBaseUrl}/api/health`, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch(healthUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        setApiState({
          status: "online",
          service: data.service ?? "backend",
          database: data.database ?? "disabled",
          timestamp: data.timestamp ?? "",
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setApiState({
            status: "offline",
            message:
              error instanceof Error ? error.message : "Unable to reach API",
          });
        }
      }
    }

    void checkApi();

    return () => controller.abort();
  }, [healthUrl]);

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Wax Cracking
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight sm:text-6xl">
            Frontend on Vercel, backend on Render.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-700">
            The app is wired for separate deployment with no database dependency
            yet.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatusPanel
            label="Frontend"
            value="Next.js"
            detail="Ready for Vercel"
            tone="ready"
          />
          <StatusPanel
            label="Backend"
            value={
              apiState.status === "online"
                ? "API online"
                : apiState.status === "checking"
                  ? "Checking API"
                  : "API offline"
            }
            detail={
              apiState.status === "online"
                ? `${apiState.service} / DB ${apiState.database}`
                : apiState.status === "checking"
                  ? healthUrl
                  : apiState.message
            }
            tone={apiState.status === "online" ? "ready" : "waiting"}
          />
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-700 shadow-sm">
          <div className="font-medium text-zinc-950">API endpoint</div>
          <code className="mt-2 block break-all rounded bg-zinc-100 px-3 py-2 text-zinc-800">
            {healthUrl}
          </code>
        </div>
      </section>
    </main>
  );
}

function StatusPanel({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "ready" | "waiting";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-medium text-zinc-500">{label}</div>
        <div
          className={`h-3 w-3 rounded-full ${
            tone === "ready" ? "bg-emerald-500" : "bg-amber-500"
          }`}
          aria-hidden="true"
        />
      </div>
      <div className="mt-5 text-2xl font-semibold">{value}</div>
      <div className="mt-2 break-words text-sm leading-6 text-zinc-600">
        {detail}
      </div>
    </div>
  );
}
