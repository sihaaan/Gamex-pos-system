#!/bin/sh
set -e

node scripts/validate-env.mjs
npx prisma migrate deploy
node server.js
