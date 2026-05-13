const http = require('http');

const PORT = process.env.PORT || 3000;

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI内容分析工具</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; border-radius: 12px; padding: 30px; }
        h1 { color: #1a73e8; text-align: center; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        input, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        textarea { height: 150px; resize: vertical; }
        button { background: #1a73e8; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; }
        button:hover { background: #1557b0; }
        #result { margin-top: 20px; padding: 20px; background: white; border-radius: 8px; display: none; }
        .loading { display: inline-block; width: 20px; height: 20px; border: 2px solid #1a73e8; border-radius: 50%; border-top-color: transparent; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI 内容分析工具</h1>
        
        <div class="form-group">
            <label>📄 网页地址</label>
            <input type="text" id="urlInput" placeholder="请输入要分析的网页地址">
        </div>
        
        <div class="form-group">
            <label>📝 内容文本</label>
            <textarea id="contentInput" placeholder="或者直接输入要分析的文本内容"></textarea>
        </div>
        
        <div class="form-group">
            <label>🎯 分析要求</label>
            <textarea id="promptInput" placeholder="请输入分析要求（可选）"></textarea>
        </div>
        
        <button onclick="analyze()">
            <span class="loading" id="loading" style="display:none"></span>
            <span id="btnText">开始分析</span>
        </button>
        
        <div id="result">
            <h3>📊 分析结果</h3>
            <div id="summary"></div>
        </div>
    </div>
    
    <script>
        async function analyze() {
            const url = document.getElementById('urlInput').value;
            const content = document.getElementById('contentInput').value;
            const prompt = document.getElementById('promptInput').value;
            const loading = document.getElementById('loading');
            const btnText = document.getElementById('btnText');
            const result = document.getElementById('result');
            const summary = document.getElementById('summary');
            
            if (!url && !content) {
                alert('请输入网页地址或内容文本');
                return;
            }
            
            loading.style.display = 'inline-block';
            btnText.textContent = '分析中...';
            result.style.display = 'none';
            
            try {
                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, content, prompt })
                });
                
                const data = await response.json();
                
                summary.innerHTML = '<strong>标题:</strong> ' + data.title + '<br><br><strong>摘要:</strong><br>' + data.summary;
                result.style.display = 'block';
            } catch (error) {
                summary.innerHTML = '<strong>❌ 错误:</strong> ' + error.message;
                result.style.display = 'block';
            } finally {
                loading.style.display = 'none';
                btnText.textContent = '开始分析';
            }
        }
    </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
    const { method, url } = req;
    
    console.log('收到请求:', method, url);
    
    // 健康检查 - 多个路径都支持
    if (url === '/health' || url === '/health/' || url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Server running' }));
        return;
    }
    
    // 主页 - 多个路径都支持
    if (url === '/' || url === '/index' || url === '/index.html' || url === '/index.htm' || url === '') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML);
        return;
    }
    
    // API 请求
    if (url === '/api/summarize' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                title: '测试标题', 
                summary: '这是一个测试摘要，服务器运行正常！\n\n测试内容：\n- 功能1：网页内容分析\n- 功能2：文本内容分析\n- 功能3：AI智能摘要',
                contentLength: 100,
                provider: '测试模式'
            }));
        });
        return;
    }
    
    // API 测试 GET 请求
    if ((url === '/api/summarize' || url === '/api/test') && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'API is working' }));
        return;
    }
    
    // 所有其他请求返回主页（SPA 模式）
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});
