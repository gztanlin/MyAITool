const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    console.log(`📡 请求: ${req.method} ${req.url}`);
    
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() }));
        return;
    }
    
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = path.join(__dirname, 'MyAITool.html');
        fs.readFile(htmlPath, (err, data) => {
            if (err) {
                console.error('❌ 读取 HTML 文件失败:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    
    // 处理 API 请求
    if (req.url === '/api/summarize' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('📋 API 请求数据:', JSON.stringify(data).substring(0, 200));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    title: '测试标题', 
                    summary: '这是一个测试摘要，服务器运行正常！',
                    contentLength: 100,
                    provider: '测试模式'
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    console.warn('⚠️ 未找到路由:', req.url);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 服务器已启动!`);
    console.log(`📡 监听地址: 0.0.0.0:${PORT}`);
    console.log(`📁 当前目录: ${__dirname}`);
    console.log(`📄 HTML 文件路径: ${path.join(__dirname, 'MyAITool.html')}\n`);
});
