import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0A0A0A",
        color: "#F5F5F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2 style={{ color: "#C8A85C", fontSize: "1.5rem" }}>Pagina non trovata</h2>
        <p style={{ color: "#6B6B6B", marginTop: "0.5rem" }}>La pagina che cerchi non esiste.</p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            marginTop: "1.5rem",
            padding: "0.5rem 1.5rem",
            backgroundColor: "#C8A85C",
            color: "#0A0A0A",
            borderRadius: "0.5rem",
            textDecoration: "none",
          }}
        >
          Torna alla dashboard
        </Link>
      </div>
    </div>
  );
}
