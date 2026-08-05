import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"

export default defineConfig({
  site: "https://ministry.mylatinmass.com",
  base: "/",
  publicDir: "./public/ministry",
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [react()],
})
