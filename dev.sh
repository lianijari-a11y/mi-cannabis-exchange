#!/bin/bash
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")/web"
exec npm run dev
