# GPC Smart Contract — Hardhat worker image
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENTRYPOINT ["npx", "hardhat"]