# ============================================================
# GenPosFit — Frontend (React + Vite)
# ============================================================
FROM node:22-alpine

# openssl dipakai untuk membuat self-signed cert (HTTPS dev server → secure
# context → getUserMedia/kamera bisa diakses lewat IP host).
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3042

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3042"]
