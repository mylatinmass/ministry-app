import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"

const isDevelopment = process.env.NODE_ENV === "development"

export default defineConfig({
  site: "https://www.mylatinmass.com",
  base: "/ministry",
  publicDir: isDevelopment ? "./public/ministry" : "./public",
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [react()],
  vite: {
    ssr: isDevelopment ? {} : { noExternal: true },
  },
})
