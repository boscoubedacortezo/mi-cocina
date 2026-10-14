import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mi Cocina",
    short_name: "Mi Cocina",
    description: "Recetas, conversión a Thermomix, menú semanal y lista de la compra.",
    lang: "es",
    start_url: "/recetas",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon on Android.
    shortcuts: [
      { name: "Menú semanal", url: "/menu", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Lista de la compra", url: "/compra", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Nueva receta", url: "/recetas/nueva", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
