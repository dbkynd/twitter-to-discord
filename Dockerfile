FROM node:8.12.0-alpine

RUN mkdir /data/ && mkdir /src/

COPY ./package.json /src/package.json

WORKDIR /src

ENV NODE_ENV production

RUN npm install

COPY . .

CMD ["node", "app"]
