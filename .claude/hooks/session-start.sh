#!/usr/bin/env bash
# ==============================================================================
# session-start.sh — SessionStart hook
#
# Runs at the beginning of each Claude Code session (source: startup / resume / clear /
# compact / fork). Checks project readiness and reports findings to Claude.
# On source == "compact" it re-injects the core rules instead: the official way to
# restore context after compaction is a SessionStart hook with the `compact` matcher,
# whose output is added to the compacted context right away (PostCompact cannot inject).
#
# Output: stdout JSON hookSpecificOutput.additionalContext (SessionStart)
#         NOTE: stderr on exit 0 never reaches Claude (official spec)
# Exit:   always 0 (informational only, never blocks)
# ==============================================================================

set -uo pipefail

# ── Claude へ所見を届けるための共通エミッタ ────────────────────────────
# 公式仕様: exit 0 時の stderr は debug log にしか残らず、Claude にもユーザーにも
# 届かない。Claude に伝えるには stdout に hookSpecificOutput.additionalContext を出す。
emit_context() {
    local event="$1"; shift
    local text="$*"
    [[ -z "$text" ]] && return 0
    if command -v jq &>/dev/null; then
        jq -nc --arg e "$event" --arg t "$text" \
            '{hookSpecificOutput:{hookEventName:$e, additionalContext:$t}}'
    else
        local esc
        esc="$(printf '%s' "$text" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')"
        printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$event" "$esc"
    fi
}

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
warnings=()

# --- 起動理由(source)を stdin JSON から読む(jq 不在時は文字列検索で代用)---
INPUT="$(cat 2>/dev/null || true)"
SOURCE="startup"
if command -v jq &>/dev/null; then
    SOURCE="$(printf '%s' "$INPUT" | jq -r '.source // "startup"' 2>/dev/null || echo startup)"
elif printf '%s' "$INPUT" | grep -q '"source"[[:space:]]*:[[:space:]]*"compact"'; then
    SOURCE="compact"
fi
IS_COMPACT=0
[[ "$SOURCE" == "compact" ]] && IS_COMPACT=1

# ── コンパクト直後は起動時チェックを繰り返さない(圧縮前に伝えている)──
if [[ "$IS_COMPACT" -eq 0 && ! -f "$PROJECT_DIR/project-config.md" ]]; then
    warnings+=("project-config.md が見つかりません。project-config.sample.md をコピーして作成してください。")
fi

# --- Check docs/ directory exists ---
if [[ "$IS_COMPACT" -eq 0 && ! -d "$PROJECT_DIR/docs" ]]; then
    warnings+=("docs/ ディレクトリが存在しません。セットアップ手順を確認してください。")
fi

# --- Check docs/ stubs ---
for doc in project.md architecture.md data-model.md development-patterns.md; do
    [[ "$IS_COMPACT" -eq 1 ]] && break
    doc_path="$PROJECT_DIR/docs/$doc"
    if [[ -f "$doc_path" ]]; then
        # Check if still a stub (< 5 non-empty lines = likely stub)
        content_lines=$(grep -c '[^[:space:]]' "$doc_path" 2>/dev/null || true)
        content_lines=${content_lines:-0}
        if [[ "$content_lines" -lt 5 ]]; then
            warnings+=("docs/$doc はスタブ状態です。実装進行に伴い内容を生成してください。")
        elif [[ "$content_lines" -gt 300 ]]; then
            # docs/*.md は CLAUDE.md から常時 @import されるため、育ちすぎると毎セッションの起動コストになる
            warnings+=("docs/$doc が ${content_lines} 行あります(目安 300 行)。常時 load されるため、詳細は skill の references/ や path-scoped rule に切り出してください。")
        fi
    fi
done

# --- Check settings.local.json exists ---
if [[ "$IS_COMPACT" -eq 0 && ! -f "$PROJECT_DIR/.claude/settings.local.json" ]]; then
    warnings+=("settings.local.json が未作成です。settings.local.json.template を参考に作成してください。")
fi

# --- 進捗引き継ぎノート(複数セッション作業の再開) ---
# output/tasks/PROGRESS.md があれば冒頭(状態 + 機能リスト + 次の一手)を注入する。
# 長時間エージェント運用の公式知見: 新しいコンテキストは git log と進捗ノートから始める。
HANDOFF=""
PROGRESS="$PROJECT_DIR/output/tasks/PROGRESS.md"
if [[ -f "$PROGRESS" ]]; then
    EXCERPT="$(head -n 60 "$PROGRESS" 2>/dev/null | head -c 3500 || true)"
    if [[ -n "$EXCERPT" ]]; then
        HANDOFF="[progress handoff] output/tasks/PROGRESS.md を検出しました。作業を再開する前に:
  1. \`git log --oneline -10\` と下記ノートで前回の到達点を把握する
  2. 記載のスモークテストを実行し、壊れていれば新機能より先に直す
  3. 機能リストから未完了(passes=❌)の最優先 1 件だけに着手する
  4. 終了前にテスト緑 + コミット + PROGRESS.md 更新(セッションログ追記)
--- PROGRESS.md(先頭 60 行) ---
$EXCERPT"
    fi
fi

# --- Claude に状態を通知 ---
MSG=""
if [[ "$IS_COMPACT" -eq 1 ]]; then
    MSG="[post-compact recovery] コンテキストがコンパクトされました。CLAUDE.md・AGENTS.md・paths なしの rules はディスクから再注入済み。要約に残らないものを再確認すること:
  - paths 付き rule(.claude/rules/)は該当ファイルを再度 Read したときに再 load される
  - 進行中の成果物: output/ 配下の最新ファイル、未完了タスク、直前に実行した検証コマンドとその結果
  - ユーザーが述べた制約・採用/却下した案は要約の記述を正とし、勝手に再設計しない
  - 圧縮前の要約は testreport/transcripts/ に保全済み(必要なら Read する)"
fi
if [[ ${#warnings[@]} -gt 0 ]]; then
    MSG="プロジェクト状態チェック(project-blueprint SessionStart):"
    for w in "${warnings[@]}"; do
        MSG="$MSG"$'\n'"  - $w"
    done
fi
if [[ -n "$HANDOFF" ]]; then
    [[ -n "$MSG" ]] && MSG="$MSG"$'\n\n'
    MSG="$MSG$HANDOFF"
fi
[[ -n "$MSG" ]] && emit_context SessionStart "$MSG"

exit 0
