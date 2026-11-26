#!/usr/bin/env bash
# 当前入口：前端 http://127.0.0.1:5174/ ，后端 127.0.0.1:8001
# 缺少依赖时会自动创建 .venv 并在「前端文件」执行 npm ci。
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

echo "夏遮冬透 · SunCraft  当前开发入口"
echo "浏览器请打开  http://127.0.0.1:5174/"
echo "不要打开 前端文件/SunCraft-离线演示.html，也不要把 start-demo.cmd 当作当前入口。"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node.js 22.12 或以上（或 24 LTS），并确保带有 npm。" >&2
  echo "下载：https://nodejs.org/" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "未找到 npm。请重新安装带有 npm 的 Node.js 22.12 或以上（或 24 LTS）。" >&2
  exit 1
fi

node_ver="$(node -v | tr -d 'v')"
node_major="${node_ver%%.*}"
node_rest="${node_ver#*.}"
node_minor="${node_rest%%.*}"
if ! [[ "$node_major" =~ ^[0-9]+$ && "$node_minor" =~ ^[0-9]+$ ]]; then
  echo "无法解析 Node.js 版本：$node_ver" >&2
  exit 1
fi
if (( node_major < 22 || (node_major == 22 && node_minor < 12) )); then
  echo "当前 Node.js 版本为 v$node_ver，需要 22.12 或以上（或 24 LTS）。" >&2
  exit 1
fi
echo "已找到 Node.js v$node_ver ，npm $(npm -v)"

choose_python() {
  if [[ -n "${SUNCRAFT_PYTHON:-}" ]]; then
    printf '%s\n' "$SUNCRAFT_PYTHON"
    return
  fi
  if [[ -x .venv/bin/python ]]; then
    printf '%s\n' ".venv/bin/python"
    return
  fi
  if [[ -x .venv/Scripts/python.exe ]]; then
    printf '%s\n' ".venv/Scripts/python.exe"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return
  fi
  return 1
}

if ! BASE_PYTHON="$(choose_python)"; then
  echo "未找到 Python 3.11 或以上。请先安装 Python，或设置 SUNCRAFT_PYTHON 指向可用解释器。" >&2
  exit 1
fi

if ! "$BASE_PYTHON" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)'; then
  echo "当前 Python 版本过低（需要 3.11 或以上）：$("$BASE_PYTHON" --version 2>&1)" >&2
  exit 1
fi
echo "已找到 $($BASE_PYTHON --version 2>&1)"

if [[ ! -x .venv/bin/python && ! -x .venv/Scripts/python.exe ]]; then
  echo "未找到 .venv，正在创建虚拟环境并安装后端依赖..."
  "$BASE_PYTHON" -m venv .venv
fi
if [[ -x .venv/bin/python ]]; then
  PYTHON_BIN=".venv/bin/python"
elif [[ -x .venv/Scripts/python.exe ]]; then
  PYTHON_BIN=".venv/Scripts/python.exe"
else
  echo "创建 .venv 后仍未找到虚拟环境里的 Python。" >&2
  exit 1
fi

if ! "$PYTHON_BIN" -c 'import fastapi,uvicorn,numpy'; then
  echo "正在安装后端依赖..."
  "$PYTHON_BIN" -m pip install --disable-pip-version-check -r backend/requirements.txt
fi

if [[ ! -x '前端文件/node_modules/.bin/vite' && ! -f '前端文件/node_modules/vite/bin/vite.js' ]]; then
  echo "未找到前端依赖，正在前端文件目录执行 npm ci..."
  (cd '前端文件' && npm ci)
fi

"$PYTHON_BIN" - <<'CHECK_PORTS'
import socket
import sys
for port in (5174, 8001):
    with socket.socket() as sock:
        try:
            sock.bind(('127.0.0.1', port))
        except OSError:
            print(f'端口 {port} 已被占用。请先关闭占用该端口的程序，再重新运行本脚本。', file=sys.stderr)
            print('当前入口固定为 http://127.0.0.1:5174/ （后端 8001），不会自动更换端口。', file=sys.stderr)
            raise SystemExit(1)
CHECK_PORTS

echo
echo "正在启动后端 127.0.0.1:8001 与前端 127.0.0.1:5174 ..."
SUNCRAFT_DEV_ENTRY=1 "$PYTHON_BIN" -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd '前端文件'
if [[ -x ./node_modules/.bin/vite ]]; then
  ./node_modules/.bin/vite --host 127.0.0.1 --port 5174 --strictPort
else
  npm run dev
fi
