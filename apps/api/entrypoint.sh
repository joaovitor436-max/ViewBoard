#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Migrations complete!"

if [ "${SEED_DB:-}" = "true" ]; then
  echo "Running database seed..."
  npx tsx prisma/seed.ts
  echo "Seed complete!"
fi

echo "Starting server..."
exec node dist/server.js
