FROM node:24.19.0-bookworm-slim

WORKDIR /app

# ติดตั้งจาก lockfile เพื่อให้ได้แพ็กเกจชุดเดิมทุกครั้ง
COPY package.json package-lock.json ./
RUN npm install --global npm@11.19.0 && npm ci --include=dev

COPY . .
RUN npm run build \
    && mkdir -p /app/data \
    && chown -R node:node /app

ENV NODE_ENV=production
USER node
EXPOSE 3000

# สร้างตารางที่ยังไม่มี ก่อนเปิดเว็บ
CMD ["sh", "-c", "npm run db:migrate && npm start"]
