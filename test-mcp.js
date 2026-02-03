const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 启动 MCP 服务器
const mcp = spawn('npx', ['-y', '@peng-shawn/mermaid-mcp-server'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, PATH: 'D:\\APPS\\nodejs;' + process.env.PATH }
});

const outputDir = path.join(__dirname, 'mermaid-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let receivedCallResult = false;

// 读取输出
mcp.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('STDOUT:', text);
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (json.id === 3) {
        receivedCallResult = true;
        console.log('CALL RESULT:', JSON.stringify(json, null, 2));
        setTimeout(() => {
          console.log('Closing...');
          mcp.stdin.end();
          process.exit(0);
        }, 1000);
      }
    } catch {
      // ignore non-json lines
    }
  }
});

mcp.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

mcp.on('error', (err) => {
  console.error('Error:', err);
});

mcp.on('exit', (code) => {
  console.log('Exit code:', code);
});

// 发送初始化请求
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' }
  }
};

console.log('Sending:', JSON.stringify(initRequest));
mcp.stdin.write(JSON.stringify(initRequest) + '\n');

// 3秒后发送 tools/list 请求
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  console.log('Sending:', JSON.stringify(listToolsRequest));
  mcp.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 3000);

// 5秒后发送 tools/call 请求
setTimeout(() => {
  const callRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'generate',
      arguments: {
        code: 'graph TD\n  A[Start] --> B{Is it working?}\n  B -->|Yes| C[Great]\n  B -->|No| D[Fix it]',
        outputFormat: 'png',
        name: 'test-diagram',
        folder: outputDir
      }
    }
  };
  console.log('Sending:', JSON.stringify(callRequest));
  mcp.stdin.write(JSON.stringify(callRequest) + '\n');
}, 5000);

// 30秒后退出
setTimeout(() => {
  if (!receivedCallResult) {
    console.log('No tools/call response within timeout.');
  }
  console.log('Closing...');
  mcp.stdin.end();
  process.exit(0);
}, 30000);
