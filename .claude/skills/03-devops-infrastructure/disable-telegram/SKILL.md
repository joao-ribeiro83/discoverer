---
name: disable-telegram
description: Stop the Telegram channel daemon.
allowed-tools: Read, Grep, Glob
model: sonnet
version: 1.0.0
category: 03-devops-infrastructure
tags:
- telegram
- monitoring
- stop
- daemon
harness:
- claude-code
- opencode
---

# Disable Telegram

Spawn a developer agent to stop the daemon:

```
subagent_type: developer
prompt: Run this command and report the output: node scripts/channels/telegram-ctl.cjs stop
```

After the agent reports, tell the user: "Telegram monitoring stopped. Run /enable-telegram to start again."
