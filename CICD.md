# CI/CD Setup Guide

本项目已配置 GitHub Actions 自动化构建和部署流水线。

## 自动触发条件

- **Push 到 main/master 分支**：自动构建并部署
- **Pull Request**：仅构建，不部署
- **手动触发**：在 GitHub Actions 页面手动运行

## 工作流程

### 1. 构建阶段 (Build Job)
- ✅ 检出代码
- ✅ 安装 Node.js 和 Go 环境
- ✅ 构建前端 (`npm run build`)
- ✅ 交叉编译 Linux 二进制文件
- ✅ 打包为 `release.zip`
- ✅ 上传构建产物（保留 30 天）

### 2. 部署阶段 (Deploy Job) - 可选
仅在推送到 main 分支时执行：
- ✅ 通过 SCP 上传到服务器
- ✅ 解压并重启服务

## 配置服务器自动部署

如果您想启用自动部署，需要在 GitHub 仓库设置中添加以下 Secrets：

1. 进入仓库 Settings → Secrets and variables → Actions
2. 添加以下 secrets：

| Secret Name | 说明 | 示例值 |
|-------------|------|--------|
| `SERVER_HOST` | 服务器 IP 地址 | `123.456.789.0` |
| `SERVER_USER` | SSH 用户名 | `root` 或 `ubuntu` |
| `SERVER_SSH_KEY` | SSH 私钥 | 完整的私钥内容 |

### 生成 SSH 密钥（如果没有）

```bash
# 在本地生成密钥对
ssh-keygen -t rsa -b 4096 -C "github-actions"

# 将公钥添加到服务器
ssh-copy-id user@your-server-ip

# 复制私钥内容到 GitHub Secrets
cat ~/.ssh/id_rsa
```

## 仅使用构建功能

如果您暂时不想自动部署，可以：
1. 删除 `.github/workflows/deploy.yml` 中的 `deploy` job
2. 或者保留构建功能，手动从 GitHub Actions 页面下载 `release.zip` 并上传到服务器

## 查看构建状态

访问仓库的 **Actions** 标签页查看所有工作流运行记录和日志。

## 本地构建（不依赖 CI/CD）

如果您想在本地构建，仍然可以使用：
```bash
bash build_release.sh
```
