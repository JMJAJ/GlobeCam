import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium"),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "src/data/camera_data.min.v2.json",
          dest: "",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Workers/*",
          dest: "cesium/Workers",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Assets/*",
          dest: "cesium/Assets",
        },
        {
          src: "node_modules/cesium/Build/Cesium/ThirdParty/*",
          dest: "cesium/ThirdParty",
        },
        {
          src: "node_modules/cesium/Build/Cesium/Widgets/*",
          dest: "cesium/Widgets",
        },
      ],
    }),
  ].filter(Boolean),
  assetsInclude: [
    "**/*.glb",
    "**/*.gltf",
    "**/*.czml",
    "**/*.geojson",
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
