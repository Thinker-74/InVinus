"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ backgroundColor: "#0A0A0A", color: "#F5F5F5", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#C8A85C" }}>Qualcosa è andato storto</h2>
          <button onClick={() => reset()} style={{ marginTop: "1rem", padding: "0.5rem 1.5rem", backgroundColor: "#C8A85C", color: "#0A0A0A", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}>
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
