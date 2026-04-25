import os
invalid_keys = ["oauth_server", "web3", "email_optional", "health_timeout", "network_restrictions", "analytics", "s3_protocol", "vector"]
invalid_sections = ["db.migrations", "storage.analytics", "storage.vector", "storage.s3_protocol", "auth.oauth_server", "auth.web3.solana", "analytics"]
if os.path.exists("supabase/config.toml"):
    with open("supabase/config.toml", "r") as f:
        lines = f.readlines()
    with open("supabase/config.toml", "w") as f:
        for line in lines:
            stripped = line.strip()
            is_invalid = False
            if stripped.startswith("[") and stripped.endswith("]"):
                section = stripped[1:-1]
                if section in invalid_sections:
                    is_invalid = True
            elif "=" in stripped and not stripped.startswith("#"):
                key = stripped.split("=")[0].strip()
                if key in invalid_keys:
                    is_invalid = True
            if is_invalid:
                f.write("# " + line)
            else:
                f.write(line)
