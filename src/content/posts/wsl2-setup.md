---
title: "WSL2 配置笔记"
pubDate: 2025-10-16
description: "WSL2 启动安装 Ubuntu、导入导出、换源、精简桌面环境配置笔记。"
author: "skqfly"
category: "Linux"
image: { url: "/logo.svg", alt: "skqfly 标志" }
---

# WSL2
**启动并安装 Ubuntu：**

```
wsl --install -d Ubuntu-22.04
```

> [!NOTE]
> **在 PowerShell 执行：**
> 
> ```
> wsl -l -v
> ```
> 
> **输出类似：**
> 
> ```
>   NAME            STATE           VERSION
> * Ubuntu-22.04    Running         2
> ```
> 
> **设置默认 WSL 版本为 2：**
> 
> ```
> wsl --set-default-version 2
> ```
> 
> **设为默认发行版：**
> 
> ```
> wsl --set-default Ubuntu-22.04
> ```

**导出当前 Ubuntu 系统到压缩包**

```
wsl --export Ubuntu-22.04 D:\WSL\ubuntu22.04.tar
```

**注销旧的系统（释放默认安装空间）**

```
wsl --unregister Ubuntu-22.04
```

**导入到你的指定目录（D:\\WSL）**

```
wsl --import Ubuntu-22.04 D:\WSL\Ubuntu22.04 D:\WSL\ubuntu22.04.tar --version 2
```

> [!NOTE]
> **确认当前系统有哪些用户**
> 
> **在 root 下执行：**
> 
> ```
> cat /etc/passwd | grep home
> ```
> 
> **会输出类似**：
> 
> ```
> root:x:0:0:root:/root:/bin/bash
> skqfly:x:1000:1000:,,,:/home/skqfly:/bin/bash
> ```
> 
> 针对Ubuntu-22.04发行版，配置其默认用户为skqfly。
> 
> 先进入 WSL（此时可能是 root 身份）：
> 
> ```
> powershell
> wsl  # 进入WSL
> ```
> 
> 在 WSL 中编辑/etc/wsl.conf文件（需要 root 权限）：
> 
> ```
> sudo nano /etc/wsl.conf
> ```
> 
> 在文件中添加或修改以下内容（指定默认用户）：
> 
> ```
> [user]
> default=skqfly
> ```
> 
> 切换到 skqfly 用户
> 
> ```
> su - skqfly
> ```
> 
> 可以临时用该用户登录。
> 
> ```
> wsl -d <你的发行版名> --user skqfly
> ```

```
# 备份原文件
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
# 替换为中科大源
sudo bash -c 'cat > /etc/apt/sources.list <<EOF
deb https://mirrors.ustc.edu.cn/ubuntu/ jammy main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ jammy-updates main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ jammy-backports main restricted universe multiverse
deb https://mirrors.ustc.edu.cn/ubuntu/ jammy-security main restricted universe multiverse
EOF'
# 更新索引
sudo apt update
```

```
sudo apt purge -y acpid acpi-support modemmanager whoopsie apport
sudo apt-mark hold acpid acpi-support modemmanager whoopsie apport

sudo apt install ubuntu-desktop-minimal --no-install-recommends -y

安装 ubuntu-desktop-minimal
 ├── 推荐：firefox（会卡住）
 ├── 推荐：libreoffice
 ├── 推荐：thunderbird
 └── 必须：gnome-shell、gdm3、xwayland
```

**安装docker（在cmd中执行）**

```
start /w "" "Docker Desktop Installer.exe" install -accept-license --installation-dir="D:\Program Files\Docker" --wsl-default-data-root="D:\Program Files\Docker\data"
```
