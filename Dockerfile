# syntax=docker/dockerfile:1

FROM cgr.dev/chainguard/node:latest-dev@sha256:81d77836dacab0c421ab4fbbf1cc2ffe56f9bc64793c1b077bbc1a30d61e1c05 AS deps
WORKDIR /app
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

COPY package.json package-lock.json ./
RUN npm ci

FROM cgr.dev/chainguard/node:latest-dev@sha256:81d77836dacab0c421ab4fbbf1cc2ffe56f9bc64793c1b077bbc1a30d61e1c05 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_CACHE=/tmp/npm-cache

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM cgr.dev/chainguard/node:latest@sha256:6a066f8decea77c67ef2772a78fad81df7a78a346d0b22a05fc9dac14537f2b0 AS runtime-clean
COPY --from=builder /sbin/apk /sbin/apk
COPY --from=builder /usr/lib/libapk.so* /usr/lib/
USER 0
RUN ["/usr/bin/node", "-e", "const fs = require('node:fs'); const { execFileSync } = require('node:child_process'); const packages = fs.readFileSync('/lib/apk/db/installed', 'utf8').split(String.fromCharCode(10)).filter((line) => /^P:npm(?:-[0-9]+)?$/.test(line)).map((line) => line.slice(2)); if (!packages.length) throw new Error('npm package not found'); execFileSync('/sbin/apk', ['del', ...packages], { stdio: 'inherit' });"]
RUN ["/usr/bin/node", "-e", "const fs = require('node:fs'); for (const path of ['/sbin/apk', '/usr/lib/libapk.so.2.14.10']) fs.rmSync(path, { force: true });"]

FROM scratch AS runner
COPY --from=runtime-clean / /
WORKDIR /app
LABEL org.opencontainers.image.title="Internal Developer Platform" \
	org.opencontainers.image.version="0.1.0" \
	com.azure.containerizationassist.createdby="containerization-assist"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV HOME=/home/node
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 CMD ["/usr/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["/usr/bin/node"]
CMD ["server.js"]