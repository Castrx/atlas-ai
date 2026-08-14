import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api para o backend do Atlas AI em desenvolvimento, para que
// RealChatApi funcione com "/api" relativo sem precisar de CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
