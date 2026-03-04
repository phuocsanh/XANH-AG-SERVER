# ==========================================
# PRODUCTION DOCKERFILE - OPTIMIZED FOR RENDER
# ==========================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
# Một số thư viện native cần các tool này nếu dùng alpine
RUN apk add --no-cache python3 make g++

# Layer caching: Chỉ copy file package trước để cache npm install
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm cả dev để build)
RUN npm ci

# Copy configuration files (tránh copy toàn bộ ngay để giữ cache)
COPY tsconfig*.json ./
COPY nest-cli.json* ./
COPY ormconfig.ts* ./

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Xóa bớt devDependencies ngay tại stage này để giảm dung lượng trước khi copy
RUN npm prune --production

# Stage 2: Production Runner
FROM node:20-alpine AS production

WORKDIR /app

# Copy các file cần thiết từ builder
# Thay vì npm ci lại, ta copy trực tiếp node_modules đã prune
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ormconfig.ts ./ormconfig.ts

# Tạo folder uploads nếu chưa có
RUN mkdir -p uploads

# Security: Không dùng root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3003

# Dùng lệnh chạy tối ưu của Node
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/main.js"]