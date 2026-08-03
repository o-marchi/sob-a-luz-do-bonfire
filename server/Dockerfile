FROM node:22

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
