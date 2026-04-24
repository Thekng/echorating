import sys

def fix_supabase_config():
    with open("supabase/config.toml", "r") as f:
        lines = f.readlines()

    new_lines = []
    skip_keys = [
        "oauth_server",
        "web3",
        "email_optional",
        "health_timeout",
        "network_restrictions",
        "enabled = true", # specifically for db.migrations and storage.s3_protocol
        "analytics",
        "s3_protocol",
        "vector"
    ]

    in_db_migrations = False
    in_storage_s3 = False

    for line in lines:
        stripped = line.strip()

        if "[db.migrations]" in stripped:
            in_db_migrations = True
            new_lines.append("# " + line)
            continue
        if "[storage.s3_protocol]" in stripped:
            in_storage_s3 = True
            new_lines.append("# " + line)
            continue
        if "[storage.analytics]" in stripped:
            new_lines.append("# " + line)
            continue
        if "[storage.vector]" in stripped:
            new_lines.append("# " + line)
            continue

        if any(key in stripped for key in skip_keys):
            new_lines.append("# " + line)
        else:
            new_lines.append(line)

    with open("supabase/config.toml", "w") as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    fix_supabase_config()
