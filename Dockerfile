FROM node:8.12.0-alpine

RUN apk update && \
    apk add --no-cache ffmpeg graphicsmagick

COPY ./package.json /src/package.json

RUN mkdir /temp/

WORKDIR /src

ENV NODE_ENV production
ENV TEMP /temp

RUN npm install

COPY . .

CMD ["node", "app"]
