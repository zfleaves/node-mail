# 部署发布指南

## 一、环境准备

### 1.1 系统要求
- **操作系统**: Linux/Windows/macOS
- **Node.js**: >= 14.x
- **MySQL**: >= 5.7 或 >= 8.0
- **Redis**: >= 5.0
- **磁盘空间**: >= 5GB (用于文件上传)

### 1.2 安装 Node.js
```bash
# 使用 nvm 安装（推荐）
nvm install 18
nvm use 18

# 验证安装
node --version
npm --version
```

### 1.3 安装 MySQL
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install mysql-server

# CentOS/RHEL
sudo yum install mysql-server

# macOS
brew install mysql

# 启动 MySQL
sudo systemctl start mysql
```

### 1.4 安装 Redis
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# CentOS/RHEL
sudo yum install redis

# macOS
brew install redis

# 启动 Redis
sudo systemctl start redis
# 或
redis-server
```

---

## 二、配置文件

### 2.1 环境变量配置
创建 `.env` 文件（参考 `.env.example`）：

```bash
# 服务器配置
NODE_ENV=production
SERVER_PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ecommerce_admin

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT 配置
JWT_SECRET=your_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=uploads
MAX_IMAGE_SIZE=10485760
MAX_VIDEO_SIZE=524288000
```

### 2.2 安全配置
- **JWT_SECRET**: 使用强随机字符串（至少 32 字符）
- **DB_PASSWORD**: 使用强密码
- **REDIS_PASSWORD**: 生产环境建议设置密码

生成强密钥：
```bash
# 生成 JWT 密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 三、依赖安装

### 3.1 安装 pnpm（推荐）
```bash
npm install -g pnpm
```

### 3.2 安装项目依赖
```bash
# 克隆项目
git clone <repository-url>
cd zfleave-node

# 安装依赖
pnpm install
```

---

## 四、数据库准备

### 4.1 创建数据库
```sql
CREATE DATABASE ecommerce_admin
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

### 4.2 创建数据库用户（可选）
```sql
CREATE USER 'ecommerce'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON ecommerce_admin.* TO 'ecommerce'@'localhost';
FLUSH PRIVILEGES;
```

### 4.3 初始化数据库
```bash
# 启动应用时会自动初始化数据库表
# 或手动运行初始化脚本
node -e "require('./src/database/schema').initDatabase()"
```

---

## 五、Redis 准备

### 5.1 配置 Redis
编辑 `redis.conf`：
```conf
# 设置最大内存
maxmemory 256mb

# 设置内存淘汰策略
maxmemory-policy allkeys-lru

# 持久化配置
save 900 1
save 300 10
save 60 10000

# 生产环境建议设置密码
requirepass your_redis_password
```

### 5.2 测试 Redis 连接
```bash
redis-cli ping
# 应该返回 PONG
```

---

## 六、启动应用

### 6.1 开发环境启动
```bash
# 直接启动
node src/index.js

# 或使用 npm 脚本
npm start
```

### 6.2 生产环境启动

#### 使用 PM2（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start src/index.js --name ecommerce-api

# 查看状态
pm2 status

# 查看日志
pm2 logs ecommerce-api

# 重启应用
pm2 restart ecommerce-api

# 停止应用
pm2 stop ecommerce-api

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用 Docker
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "src/index.js"]
```

```bash
# 构建镜像
docker build -t ecommerce-api .

# 运行容器
docker run -d \
  --name ecommerce-api \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -e NODE_ENV=production \
  -e DB_HOST=host.docker.internal \
  -e REDIS_HOST=host.docker.internal \
  ecommerce-api
```

#### 使用 Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=ecommerce_admin
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  mysql_data:
  redis_data:
```

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 七、生产环境优化

### 7.1 反向代理配置（Nginx）
```nginx
# /etc/nginx/sites-available/ecommerce-api
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 上传文件大小限制
    client_max_body_size 500M;

    # 静态文件
    location /uploads {
        alias /path/to/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

### 7.2 SSL 证书配置（Let's Encrypt）
```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 7.3 日志管理
```javascript
// 使用 winston 进行日志管理
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 7.4 监控和告警
```bash
# 使用 PM2 监控
pm2 install pm2-logrotate

# 配置 PM2 监控
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 八、性能优化

### 8.1 数据库优化
```sql
-- 添加索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- 配置 MySQL 缓冲池
SET GLOBAL innodb_buffer_pool_size = 2G;
```

### 8.2 Redis 优化
```conf
# redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

### 8.3 应用优化
- 启用 Gzip 压缩
- 配置 HTTP 缓存头
- 使用 CDN 加速静态资源
- 数据库连接池优化

---

## 九、安全加固

### 9.1 网络安全
- 配置防火墙规则
- 限制数据库访问 IP
- 启用 HTTPS
- 配置 CORS 策略

### 9.2 应用安全
- 定期更新依赖
- 使用 Helmet 中间件
- 限制请求频率
- 输入验证和过滤

### 9.3 数据备份
```bash
# 数据库备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p ecommerce_admin > backup_$DATE.sql

# 备份 Redis
redis-cli BGSAVE

# 定时备份（crontab）
0 2 * * * /path/to/backup.sh
```

---

## 十、故障排查

### 10.1 常见问题

**应用无法启动**
```bash
# 检查端口占用
lsof -i :3000

# 检查日志
pm2 logs ecommerce-api
```

**数据库连接失败**
```bash
# 测试数据库连接
mysql -u root -p -h localhost

# 检查数据库服务
sudo systemctl status mysql
```

**Redis 连接失败**
```bash
# 测试 Redis 连接
redis-cli ping

# 检查 Redis 服务
sudo systemctl status redis
```

**文件上传失败**
- 检查 uploads 目录权限
- 检查磁盘空间
- 检查文件大小限制

### 10.2 日志查看
```bash
# PM2 日志
pm2 logs ecommerce-api --lines 100

# 系统日志
tail -f /var/log/syslog

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 十一、更新和回滚

### 11.1 部署更新
```bash
# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 重启应用
pm2 restart ecommerce-api

# 或零停机部署
pm2 reload ecommerce-api
```

### 11.2 回滚
```bash
# 回滚到上一版本
git revert HEAD

# 或回滚到指定版本
git checkout <commit-hash>

# 重启应用
pm2 restart ecommerce-api
```

---

## 十二、检查清单

部署前检查：

- [ ] Node.js 版本 >= 14.x
- [ ] MySQL 已安装并运行
- [ ] Redis 已安装并运行
- [ ] .env 文件已配置
- [ ] JWT_SECRET 已设置强密钥
- [ ] 数据库已创建
- [ ] 依赖已安装
- [ ] uploads 目录已创建且有写权限
- [ ] 端口 3000 可用
- [ ] 防火墙规则已配置
- [ ] SSL 证书已配置（生产环境）
- [ ] 日志监控已配置
- [ ] 备份策略已设置
- [ ] 监控告警已配置