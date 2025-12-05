# 🚀 Hướng dẫn Deploy Production

## 📋 Checklist trước khi deploy

- [ ] Đã tạo Supabase Production database
- [ ] Đã generate JWT secrets mới
- [ ] Đã cấu hình CORS cho domain production
- [ ] Đã test kỹ trên local với production config
- [ ] Đã backup database development

## 🗄️ Cấu hình Database Production

### Thông tin Supabase Production
- **Region:** Singapore (ap-southeast-1)
- **Project Ref:** fvjmfuzrqnhgmkaianut
- **Connection String:** Đã cấu hình trong `.env.production`

### Migrate Schema sang Production

**Option 1: Sử dụng Supabase Dashboard**
1. Vào Supabase Dashboard của Development
2. Settings > Database > Connection string
3. Export schema: `pg_dump -h ... -U postgres --schema-only > schema.sql`
4. Import vào Production: Paste vào SQL Editor của Production database

**Option 2: Sử dụng TypeORM Migration**
```bash
# Nếu có migrations
npm run migration:run
```

**Option 3: Chạy init scripts thủ công**
```bash
# Kết nối đến Production database
psql "postgresql://postgres.fvjmfuzrqnhgmkaianut:0987383606Tp$@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Chạy các init scripts
\i src/database/init.sql
```

## 🔐 Generate JWT Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 64

# Generate JWT_REFRESH_SECRET
openssl rand -base64 64

# Copy kết quả vào .env.production
```

## 🌐 Cấu hình CORS

Thay đổi `CORS_ORIGIN` trong `.env.production`:
```bash
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
```

## 🚀 Deploy lên Platform

### Option 1: Deploy lên Render

1. **Tạo Web Service**
   - Vào [Render Dashboard](https://dashboard.render.com/)
   - New > Web Service
   - Connect GitHub repository

2. **Cấu hình Build**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Environment: Node

3. **Set Environment Variables**
   - Copy tất cả biến từ `.env.production`
   - Paste vào Render Environment Variables
   - **QUAN TRỌNG:** Đổi `JWT_SECRET` và `JWT_REFRESH_SECRET`

4. **Deploy**
   - Click "Create Web Service"
   - Đợi build và deploy

### Option 2: Deploy lên Railway

1. **New Project**
   - Vào [Railway Dashboard](https://railway.app/)
   - New Project > Deploy from GitHub

2. **Cấu hình**
   - Select repository
   - Add Environment Variables từ `.env.production`

3. **Deploy**
   - Railway tự động build và deploy

### Option 3: Deploy lên VPS (Ubuntu)

```bash
# 1. SSH vào VPS
ssh user@your-server-ip

# 2. Clone repository
git clone https://github.com/your-repo/XANH-AG-SERVER.git
cd XANH-AG-SERVER

# 3. Install dependencies
npm install

# 4. Copy file .env.production thành .env
cp .env.production .env

# 5. Build
npm run build

# 6. Install PM2
npm install -g pm2

# 7. Start với PM2
pm2 start dist/main.js --name xanh-ag-api

# 8. Setup auto-restart
pm2 startup
pm2 save

# 9. Setup Nginx reverse proxy
sudo nano /etc/nginx/sites-available/xanh-ag-api

# Paste config:
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/xanh-ag-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 10. Setup SSL với Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## ✅ Kiểm tra sau khi deploy

1. **Health Check**
   ```bash
   curl https://api.yourdomain.com/health
   ```

2. **Test API**
   ```bash
   # Test login
   curl -X POST https://api.yourdomain.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password"}'
   ```

3. **Check Logs**
   - Render: Logs tab
   - Railway: Logs tab
   - VPS: `pm2 logs xanh-ag-api`

## 🔄 Update Production

### Render/Railway (Auto-deploy)
- Push code lên GitHub
- Platform tự động build và deploy

### VPS (Manual)
```bash
# SSH vào server
ssh user@your-server-ip
cd XANH-AG-SERVER

# Pull code mới
git pull origin main

# Install dependencies mới (nếu có)
npm install

# Build
npm run build

# Restart PM2
pm2 restart xanh-ag-api
```

## 🔒 Bảo mật Production

1. **Firewall**
   ```bash
   # Chỉ mở port 80, 443, 22
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Database**
   - Chỉ cho phép IP của server kết nối (Supabase Settings > Database > Connection pooling)
   - Enable SSL connection

3. **Environment Variables**
   - KHÔNG commit file `.env` hoặc `.env.production`
   - Sử dụng platform secrets management

## 📊 Monitoring

1. **Supabase Dashboard**
   - Monitor database performance
   - Check query performance
   - View logs

2. **Application Logs**
   - Render: Logs tab
   - Railway: Logs tab
   - VPS: `pm2 logs`

3. **Uptime Monitoring**
   - Sử dụng [UptimeRobot](https://uptimerobot.com/)
   - Hoặc [Pingdom](https://www.pingdom.com/)

## 🆘 Troubleshooting

### Database connection failed
```bash
# Kiểm tra connection string
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT 1"
```

### Port already in use
```bash
# Tìm process đang dùng port 3003
lsof -i :3003

# Kill process
kill -9 <PID>
```

### PM2 not starting
```bash
# Check logs
pm2 logs xanh-ag-api

# Restart
pm2 restart xanh-ag-api

# Delete and recreate
pm2 delete xanh-ag-api
pm2 start dist/main.js --name xanh-ag-api
```

## 📞 Support

Nếu gặp vấn đề, liên hệ team DevOps hoặc tạo issue trên GitHub.
