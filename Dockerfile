FROM node:12.19.0-alpine

RUN apk update && \
    apk add --no-cache ffmpeg graphicsmagick yarn

COPY ./package.json /src/package.json
COPY ./yarn.lock /src/yarn.lock

RUN mkdir /temp/

WORKDIR /src

ENV NODE_ENV production
ENV TEMP /temp

RUN yarn

COPY . .

CMD ["yarn", "start"]
