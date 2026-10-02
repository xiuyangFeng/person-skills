#!/usr/bin/env bash
# context-meter 自检：Claude Code 升级后跑一下，确认插件还能用。
#   ./selfcheck.sh          清单校验 + 单元测试 + 类型检查（找得到 tsc 时）
#   ./selfcheck.sh --live   再另起一个 Claude Code（示例数据，不发请求）确认仪表真的画出来
# 全部通过时把当前版本号写进 TESTED_WITH。
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
LIVE=${1:-}
NOW=$(claude --version 2>/dev/null | awk '{print $1}')
TESTED=$(cat "$DIR/TESTED_WITH" 2>/dev/null || echo 未知)
echo "Claude Code ${NOW}（上次验证通过：${TESTED}）"
[ "$NOW" != "$TESTED" ] && echo "  版本变了：function hooks 接口还是 early access，下面的检查决定能不能继续用"
fail=0
step() { local name=$1; shift; local out; if out=$("$@" 2>&1); then echo "✔ $name"; else echo "✘ $name"; echo "$out" | tail -25 | sed 's/^/    /'; fail=1; fi; }

step "清单与钩子校验 (claude plugin validate)" claude plugin validate "$DIR"
step "单元测试 (claude plugin test)" claude plugin test "$DIR"

TSC=$(command -v tsc || true)
[ -z "$TSC" ] && [ -x "$HOME/.local/share/context-meter-dev/node_modules/.bin/tsc" ] && TSC="$HOME/.local/share/context-meter-dev/node_modules/.bin/tsc"
if [ -n "$TSC" ] && [ -f "$DIR/.claude-plugin/types/tsconfig.json" ]; then
  step "类型检查 (tsc)" "$TSC" -p "$DIR"
else
  echo "· 跳过类型检查（没有 tsc，或引擎还没在 .claude-plugin/types/ 生成类型；"
  echo "  装一次：npm install --prefix ~/.local/share/context-meter-dev typescript@5）"
fi

if [ "$LIVE" = "--live" ]; then
  if ! command -v tmux >/dev/null; then echo "· 跳过实机检查：没有 tmux"; else
    SOCK=ctxmeter-selfcheck; CAP=$(mktemp)
    tmux -L $SOCK kill-server 2>/dev/null
    tmux -L $SOCK new-session -d -x 150 -y 24 -c "${CONTEXT_METER_LIVE_CWD:-$PWD}" \
      "env -u CLAUDE_CODE_PLUGIN_DIRS CONTEXT_METER_DEMO=1 TERM=xterm-256color COLORTERM=truecolor claude"
    sleep 16; tmux -L $SOCK capture-pane -p -t 0 > "$CAP"; tmux -L $SOCK kill-server 2>/dev/null
    if grep -q "✓ 42s" "$CAP" && grep -q "⛁" "$CAP"; then echo "✔ 实机：新开的 Claude Code 里画出了仪表"
    else echo "✘ 实机：没看到仪表，截屏如下"; sed -e 's/[[:space:]]*$//' "$CAP" | grep -v '^$' | tail -12 | sed 's/^/    /'; fail=1; fi
    rm -f "$CAP"
  fi
fi

if [ $fail -eq 0 ]; then echo "$NOW" > "$DIR/TESTED_WITH"; echo "全部通过，已记录 $NOW"; else echo "有检查没过，见上"; exit 1; fi
