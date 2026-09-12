# VAIYU console: TanStack Start, server-rendered by Node.
#
# Not nginx: this is an SSR app, not a folder of static files. `vite build`
# emits a server entry that has to run.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NITRO_PRESET is the load-bearing line. The project's default preset is
# cloudflare-module, which emits a Workers bundle and a wrangler.json with no
# Node server in it — the image would build and then have nothing to start.
ENV NITRO_PRESET=node-server

# Baked in at build time, because Vite inlines import.meta.env.
#
# This must be the URL the *browser* will use, not one that resolves inside the
# compose network: the page runs on the viewer's machine, where "backend" is
# not a hostname. Override with --build-arg when deploying anywhere real.
ARG VITE_API_BASE_URL=http://localhost:8081
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only the build output. No node_modules: the Nitro node-server preset bundles
# what the server needs, and the result is an image about a tenth the size.
COPY --from=build /app/.output ./.output

USER node
EXPOSE 3000
ENV PORT=3000 \
    HOST=0.0.0.0

# wget is in busybox, so alpine needs nothing extra here.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["sh", "-c", "wget -q -O /dev/null http://localhost:3000/ || exit 1"]

CMD ["node", ".output/server/index.mjs"]
