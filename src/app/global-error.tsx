"use client";

/** Last-resort boundary when the root layout itself fails. Plain markup: no providers available. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 24 }}>
        <main role="alert" style={{ textAlign: "center", maxWidth: 320 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Spend couldn&apos;t start</h1>
          <p style={{ color: "#666", fontSize: 14 }}>Your data is safe in the cloud. Reload to try again.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: "1px solid #ccc", background: "white" }}>
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
