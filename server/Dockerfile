FROM node:22

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install

COPY . .

RUN pnpm build

CMD ["node", "dist/main.js"]
