FROM alpine as base
RUN apk update && \
    apk add  --no-cache yarn nodejs ffmpeg graphicsmagick
WORKDIR /app

FROM base AS prod_dependencies
COPY . .
RUN yarn --production=true

FROM prod_dependencies as dev_dependencies
RUN yarn --production=false

FROM dev_dependencies AS builder
RUN yarn prettier
RUN yarn lint
RUN yarn build

FROM base
ENV DOCKER true
ENV NODE_ENV production
COPY package.json .
COPY --from=prod_dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENTRYPOINT ["node", "/app/dist/src/index.js"]
