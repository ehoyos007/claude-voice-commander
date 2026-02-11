#!/bin/bash
cd "$(dirname "$0")"
exec ~/.bun/bin/bun run src/index.ts
