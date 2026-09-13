#!/usr/bin/env bash
set -euo pipefail
cd /root/pinwall-deploy

# Keep a database rollback point before applying pending migrations.
install -d -m 700 /root/pinwall-backups
backup="/root/pinwall-backups/$(date -u +%Y%m%dT%H%M%SZ).dump"
(umask 077; docker exec supabase-db pg_dump -U postgres -d postgres -Fc > "$backup")

for migration in supabase/migrations/*.sql; do
  version=$(basename "$migration" | cut -d_ -f1)
  [[ "$version" =~ ^[0-9]+$ ]]
  applied=$(docker exec supabase-db psql -U postgres -d postgres -Atc \
    "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version = '$version'")
  if [ "$applied" = 0 ]; then
    { cat "$migration"; printf '\nINSERT INTO supabase_migrations.schema_migrations (version) VALUES (%s);\n' "'$version'"; } |
      docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction
  fi
done

for function in _shared create-pin create-pin-cli pin; do
  cp -a "supabase/functions/$function" /root/supabase-project/volumes/functions/
done
docker exec supabase-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
docker restart supabase-edge-functions
for attempt in {1..30}; do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' supabase-edge-functions)" = healthy ]; then
    exit 0
  fi
  sleep 2
done
echo 'Edge Functions did not become healthy' >&2
exit 1
