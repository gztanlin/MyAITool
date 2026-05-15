export default {
    async fetch(req) {
        const { url, method } = req;
        
        // 解析 URL 路径
        let pathname;
        try {
            const urlObj = new URL(url, 'http://localhost');
            pathname = urlObj.pathname;
        } catch (e) {
            pathname = url;
        }
        
        // 健康检查
        if (pathname === '/health') {
            return new Response(
                JSON.stringify({ status: 'ok', message: 'Server running' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        // API 请求
        if (pathname === '/api/summarize') {
            if (method === 'POST') {
                const body = await req.text();
                let requestData;
                
                try {
                    requestData = JSON.parse(body);
                } catch (e) {
                    return new Response(
                        JSON.stringify({ error: 'Invalid JSON' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                const { url: inputUrl, content, prompt } = requestData;
                
                // 验证输入
                if (!inputUrl && !content) {
                    return new Response(
                        JSON.stringify({ error: '请输入网页地址或内容文本' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                // 调用通义千问 API
                try {
                    const apiKey = 'sk-5b0ae74df47a459985325ddeb221bb7e';
                    
                    // 构建提示词
                    let userPrompt = prompt || '请分析以下内容，提取标题并生成摘要：';
                    let inputContent = content || '';
                    
                    // 如果只有网页地址，先抓取网页内容
                    if (inputUrl && !content) {
                        try {
                            const pageResponse = await fetch(inputUrl);
                            if (!pageResponse.ok) {
                                throw new Error(`HTTP error! status: ${pageResponse.status}`);
                            }
                            const pageText = await pageResponse.text();
                            
                            // 提取文本内容（简单处理）
                            const textContent = pageText
                                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                .replace(/<[^>]+>/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            
                            if (textContent.length > 0) {
                                inputContent = textContent.substring(0, 20000);
                                userPrompt += `\n\n网页内容：\n${inputContent}`;
                            } else {
                                userPrompt += `\n\n网页地址：${inputUrl}\n无法获取网页内容，请提供文本内容。`;
                            }
                        } catch (e) {
                            userPrompt += `\n\n网页地址：${inputUrl}\n获取网页内容失败：${e.message}`;
                        }
                    } else if (content) {
                        userPrompt += `\n\n内容：${content}`;
                    }
                    
                    // 调用通义千问 API
                    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'qwen-turbo',
                            input: {
                                messages: [
                                    {
                                        role: 'system',
                                        content: '你是一个专业的内容分析助手，擅长提取文章标题和生成摘要。请用简洁、准确的语言回答。'
                                    },
                                    {
                                        role: 'user',
                                        content: userPrompt
                                    }
                                ]
                            },
                            parameters: {
                                result_format: 'message'
                            }
                        })
                    });
                    
                    // 检查 HTTP 状态码
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
                    }
                    
                    const result = await response.json();
                    
                    if (result.output && result.output.choices && result.output.choices[0]) {
                        const aiContent = result.output.choices[0].message.content;
                        
                        return new Response(
                            JSON.stringify({ 
                                title: 'AI 分析结果', 
                                summary: aiContent,
                                contentLength: inputContent.length,
                                provider: '通义千问'
                            }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    } else {
                        throw new Error('AI API 返回格式错误: ' + JSON.stringify(result));
                    }
                } catch (error) {
                    console.error('AI API Error:', error);
                    return new Response(
                        JSON.stringify({ 
                            title: '错误', 
                            summary: `AI 分析失败: ${error.message}`,
                            error: error.message
                        }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                }
            }
            
            if (method === 'GET') {
                return new Response(
                    JSON.stringify({ status: 'ok', message: 'API is working' }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
        
        // 主页和所有其他请求返回 HTML
        const html = `<!DOCTYPE html>
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
        .error { color: #dc3545; }
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
            <label>🎯 分析要求（可选）</label>
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
            
            if (url && content) {
                alert('请只选择网页地址或内容文本，不要同时输入');
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
                
                // 检查 HTTP 状态码
                if (!response.ok) {
                    throw new Error('服务器错误: ' + response.status);
                }
                
                const data = await response.json();
                
                if (data.title === '错误') {
                    summary.innerHTML = '<strong class="error">❌ ' + data.title + ':</strong> ' + data.summary;
                } else {
                    summary.innerHTML = '<strong>标题:</strong> ' + data.title + '<br><br><strong>摘要:</strong><br>' + data.summary.replace(/\\n/g, '<br>');
                }
                result.style.display = 'block';
            } catch (error) {
                summary.innerHTML = '<strong class="error">❌ 错误:</strong> ' + error.message;
                result.style.display = 'block';
            } finally {
                loading.style.display = 'none';
                btnText.textContent = '开始分析';
            }
        }
    </script>
</body>
</html>`;
        
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
};