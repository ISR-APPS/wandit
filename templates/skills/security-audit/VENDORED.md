# Vendored skill

This folder is a copy of `skills/security-audit/` from
https://github.com/cloudflare/security-audit-skill at commit
`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14). The license is MIT
(see `LICENSE.txt`). The two `*.test.cjs` files are not copied.

The `builder-turn` task writes these files into the sandbox under `/tmp` at
the start of a `security_scan` turn. Do not edit the files here. To update,
copy a newer commit and change the sha above.
