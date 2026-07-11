# SQLite query guide

MiniRouter stores its data at `~/.minirouter/minirouter.db`. In Docker, with
the documented `/data` volume, that becomes `/data/.minirouter/minirouter.db`.

Run queries as the same operating-system user as the service. Set the database
path explicitly instead of using a machine-specific path:

```bash
export MINIROUTER_DB="$HOME/.minirouter/minirouter.db"
```

## Recent requests

```bash
node -e "const D=require('better-sqlite3');const d=new D(process.env.MINIROUTER_DB,{readonly:true});console.table(d.prepare('SELECT created_at,tier,model,status,input_tokens AS input_tokens,output_tokens AS output_tokens,prompt_digest FROM usage_logs ORDER BY created_at DESC LIMIT 30').all())"
```

## Distribution by tier and model

```bash
node -e "const D=require('better-sqlite3');const d=new D(process.env.MINIROUTER_DB,{readonly:true});console.table(d.prepare('SELECT tier, COUNT(*) AS requests FROM usage_logs GROUP BY tier ORDER BY requests DESC').all());console.table(d.prepare('SELECT model, COUNT(*) AS requests FROM usage_logs GROUP BY model ORDER BY requests DESC').all())"
```

## Failed requests

```bash
node -e "const D=require('better-sqlite3');const d=new D(process.env.MINIROUTER_DB,{readonly:true});console.table(d.prepare('SELECT created_at,model,tier,error_type,prompt_digest FROM usage_logs WHERE status = ? ORDER BY created_at DESC LIMIT 20').all('error'))"
```

Timestamps are stored as UTC ISO strings. Use a read-only connection while the
service is running; SQLite WAL mode supports concurrent readers.
