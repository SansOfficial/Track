# Trace - Tatami Factory Management System

榻榻米垫工厂生产管理系统，包含订单管理、工人管理、产品管理和数据仪表盘。

## 技术栈

### 后端
- Go 1.21+
- Gin Web Framework
- GORM + Mysql
- 纯 Go 实现（无 CGO 依赖）

### 前端
- React 19
- Vite
- TailwindCSS
- Recharts（图表）
- React Router DOM

### 小程序
- 微信小程序原生开发

## 快速开始

### 本地开发

```bash
# 启动后端
cd server
go run main.go

# 启动前端（新终端）
cd admin
npm install
npm run dev
```

### 生产部署

```bash
# 本地构建
bash build_release.sh

# 上传 release.zip 到服务器
scp release.zip user@server:/path/

# 在服务器上解压并运行
unzip release.zip
cd server
chmod +x trace-server-linux
nohup ./trace-server-linux > server.log 2>&1 &
```

## CI/CD

本项目已配置 GitHub Actions 自动化流水线。

查看 [CICD.md](./CICD.md) 了解详细配置。

## 文档

- [部署文档](./DEPLOY.md)
- [CI/CD 配置](./CICD.md)

## 功能特性

- ✅ 订单管理（创建、编辑、删除、状态追踪）
- ✅ 产品管理
- ✅ 工人管理
- ✅ QR 码生成与扫描
- ✅ 数据仪表盘（营收趋势、订单统计）
- ✅ 微信小程序集成
- ✅ 响应式设计（黑白红极简风格）

## License

MIT
