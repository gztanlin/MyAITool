const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`\n📋 启动参数:`);
console.log(`   PORT: ${PORT}`);
console.log(`   HOST: ${HOST}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   当前目录: ${__dirname}\n`);

const server = http.createServer((req, res) => {
    const fullUrl = `${req.headers.host}${req.url}`;
    console.log(`\n📡 收到请求:`);
    console.log(`   方法: ${req.method}`);
    console.log(`   URL: ${req.url}`);
    console.log(`   完整地址: ${fullUrl}`);
    console.log(`   头部:`, JSON.stringify(req.headers).substring(0, 200));
    
    // 健康检查
    if (req.url === '/health' || req.url === '/health/') {
        console.log('✅ 响应健康检查');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            message: 'Server is running', 
            timestamp: new Date().toISOString(),
            port: PORT,
            host: HOST
        }));
        return;
    }
    
    // 主页
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = path.join(__dirname, 'MyAITool.html');
        console.log(`📄 尝试读取 HTML 文件: ${htmlPath}`);
        
        fs.readFile(htmlPath, (err, data) => {
            if (err) {
                console.error('❌ 读取 HTML 文件失败:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error: ' + err.message);
                return;
            }
            console.log('✅ 成功读取 HTML 文件');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    
    // API 请求
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
    
    // 捕获所有其他请求
    console.warn(`⚠️ 未找到路由: ${req.url}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        error: 'Not Found', 
        path: req.url,
        message: '请求的资源未找到',
        availableRoutes: ['/', '/health', '/api/summarize']
    }));
});

server.listen(PORT, HOST, () => {
    console.log(`\n🚀 服务器已成功启动!`);
    console.log(`📡 监听地址: http://${HOST}:${PORT}`);
    console.log(`📁 当前目录: ${__dirname}`);
    console.log(`📄 HTML 文件路径: ${path.join(__dirname, 'MyAITool.html')}`);
    console.log(`🔧 可用路由: /, /health, /api/summarize`);
    console.log(`\n✅ 服务器准备就绪，等待请求...\n`);
});

// 检查 HTML 文件是否存在
const htmlPath = path.join(__dirname, 'MyAITool.html');
fs.access(htmlPath, fs.constants.F_OK, (err) => {
    if (err) {
        console.error(`❌ HTML 文件不存在: ${htmlPath}`);
    } else {
        console.log(`✅ HTML 文件存在: ${htmlPath}`);
    }
});
