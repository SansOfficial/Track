# Server Deployment Guide

This guide explains how to deploy the Trace application to a Linux server.

## 1. Prepare Release Package
On your local machine (Mac), run the release script to create a deployable package:

```bash
chmod +x build_release.sh
./build_release.sh
```

This will generate a file named **`release.zip`**.

## 2. Upload to Server
Upload `release.zip` to your Linux server (e.g., using `scp` or FileZilla).

```bash
scp release.zip user@your-server-ip:/path/to/directory
```

## 3. Install & Run on Server
SSH into your server and execute the following:

```bash
# Unzip the package
unzip release.zip

# Enter the directory
cd server

# Grant execution permission
chmod +x trace-server-linux

# Run the server (background mode recommended)
# Using nohup to keep it running after you logout
nohup ./trace-server-linux > server.log 2>&1 &

# Check if it's running
ps aux | grep trace-server-linux
```

The server will start on port **8080**.

## 4. Accessing the Admin Panel
The Admin Panel (Frontend) is **bundled inside** the application.
Once the server is running, simply access:
> **http://your-server-ip:8080/**

You do NOT need to deploy the frontend separately. It is served automatically by the `trace-server-linux` program from the `dist` folder.

## 5. Configuration (Optional)
If you need to change the port or database location:
-   **Port**: Currently hardcoded to `:8080`.
-   **Database**: `trace.db` will be created in the same directory as the executable.

## 5. Reverse Proxy (Nginx) - Recommended
For a production environment, it is best to use Nginx as a reverse proxy.

Example Nginx Config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
