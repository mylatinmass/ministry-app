import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import vercel from "@astrojs/vercel"
import { fileURLToPath } from "node:url"

export default defineConfig({
  site: "https://www.mylatinmass.com",
  base: "/ministry",
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: true,
    },
    resolve: {
      alias: {
        gatsby: fileURLToPath(
          new URL("./src/react/compat/gatsby.jsx", import.meta.url),
        ),
      },
    },
  },
})
