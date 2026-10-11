import subprocess, json

tool_ledger = json.dumps({
    "calls": [
        {"toolName": "SearchReplace", "targetFile": "pages/dashboard.html", "callId": "social-html-insert", "result": "success"},
        {"toolName": "SearchReplace", "targetFile": "pages/dashboard.html", "callId": "social-css-update", "result": "success"}
    ]
})

result = subprocess.run([
    "node",
    r"c:\Users\jingh\.trae-cn\builtin\design\default\skills\solo-design\shared-runtime\deterministic-tooling\record-dispatch-completion.mjs",
    r"d:\文件\TREA 目录\6a64786b5f5ef16ff6d945f5\prediction-dashboard",
    "--node-id=page-dashboard",
    "--changed-files=pages/dashboard.html",
    "--status=completed",
    "--trace-digest=social-hotspots-module",
    f"--tool-ledger-json={tool_ledger}"
], capture_output=True, text=True)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("RC:", result.returncode)