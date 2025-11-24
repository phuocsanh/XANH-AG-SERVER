# 🔒 Security Checklist

Checklist bảo mật trước khi deploy lên production.

## ✅ Environment Variables

- [ ] `NODE_ENV` được set thành `production`
- [ ] `JWT_SECRET` là chuỗi random mạnh (64+ characters)
- [ ] `JWT_REFRESH_SECRET` là chuỗi random mạnh khác với JWT_SECRET
- [ ] `DATABASE_URL` sử dụng SSL connection (Supabase)
- [ ] `CORS_ORIGIN` chỉ cho phép domain cụ thể (không dùng `*`)
- [ ] Tất cả API keys đều là production keys (không phải dev/test)
- [ ] Không có credentials nào bị commit vào Git

## ✅ Database

- [ ] `synchronize` được set thành `false` trong production
- [ ] Đã chạy tất cả migrations cần thiết
- [ ] Database connection sử dụng SSL/TLS
- [ ] Database password đủ mạnh
- [ ] Backup database được setup (Supabase tự động)

## ✅ Application Code

- [ ] Tất cả sensitive data được log đã bị remove/mask
- [ ] Error messages không expose internal details
- [ ] Rate limiting được enable (nếu cần)
- [ ] Input validation được implement đầy đủ
- [ ] File upload có giới hạn size và type
- [ ] Authentication/Authorization hoạt động đúng

## ✅ Docker (nếu dùng)

- [ ] Sử dụng multi-stage build để giảm image size
- [ ] Chạy container với non-root user
- [ ] Không copy file `.env` vào image
- [ ] Health check được configure
- [ ] Resource limits được set (memory, CPU)

## ✅ Network & CORS

- [ ] CORS chỉ cho phép trusted domains
- [ ] HTTPS được enable (Render tự động)
- [ ] Helmet middleware được enable (nếu cần)
- [ ] Rate limiting được configure phù hợp

## ✅ Monitoring & Logging

- [ ] Log level được set thành `error` hoặc `warn`
- [ ] Không log sensitive information (passwords, tokens)
- [ ] Health check endpoint hoạt động
- [ ] Error tracking được setup (optional)

## ✅ Dependencies

- [ ] Tất cả dependencies đã update lên version mới nhất
- [ ] Không có known vulnerabilities (`npm audit`)
- [ ] Production dependencies được tách biệt khỏi dev dependencies

## ✅ Testing

- [ ] Tất cả tests pass
- [ ] API endpoints quan trọng đã được test
- [ ] Authentication flow đã được test
- [ ] Error handling đã được test

## 🔐 Generate Strong Secrets

### JWT Secrets

```bash
# Option 1: OpenSSL
openssl rand -base64 64

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Option 3: Online (sử dụng trusted source)
# https://www.random.org/strings/
```

### Password Guidelines

- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Không sử dụng từ điển hoặc thông tin cá nhân
- Unique cho mỗi service

## 📋 Pre-Deployment Commands

```bash
# 1. Audit dependencies
npm audit

# 2. Run tests
npm run test

# 3. Build production
npm run build

# 4. Test production build locally
NODE_ENV=production npm run start:prod

# 5. Check environment variables
npm run env:prod
cat .env | grep -v "^#" | grep -v "^$"
```

## 🚨 Post-Deployment Checks

- [ ] Application starts successfully
- [ ] Health check endpoint returns 200
- [ ] Database connection works
- [ ] Authentication works
- [ ] File upload works (Cloudinary)
- [ ] API documentation accessible
- [ ] CORS works for frontend domain
- [ ] Error responses don't leak sensitive info

## 📞 Incident Response

Nếu phát hiện security issue:

1. **Immediate**: Revoke compromised credentials
2. **Rotate**: Generate new secrets/keys
3. **Update**: Deploy với credentials mới
4. **Audit**: Check logs for unauthorized access
5. **Document**: Ghi lại incident và actions taken

## 🔗 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

---

**Last Updated**: 2025-11-24  
**Review Frequency**: Before every production deployment
