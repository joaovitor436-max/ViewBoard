#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Migrations complete!"

echo "Starting server..."
exec node dist/server.js
