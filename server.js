export default {
    async fetch(req) {
        const { url, method } = req;
        
        let pathname;
        try {
            const urlObj = new URL(url, 'http://localhost');
            pathname = urlObj.pathname;
        } catch (e) {
            pathname = url;
        }
        
        if (pathname === '/health') {
            return new Response(
                JSON.stringify({ status: 'ok', message: 'Server running' }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        if (pathname === '/api/summarize') {
            if (method === 'POST') {
                let body;
                try {
                    body = await req.text();
                } catch (e) {
                    return new Response(
                        JSON.stringify({ error: '无法读取请求体' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                let requestData;
                try {
                    requestData = JSON.parse(body);
                } catch (e) {
                    return new Response(
                        JSON.stringify({ error: 'Invalid JSON' }),
                        { status: 400, headers: { 'Content-Type': 'application/json' } }
                    );
                }
                
                const { mode, url: inputUrl, content, prompt, question } = requestData;
                
                try {
                    const apiKey = 'sk-5b0ae74df47a459985325ddeb221bb7e';
                    let userPrompt = '';
                    
                    if (mode === 'chat') {
                        if (!question) {
                            return new Response(
                                JSON.stringify({ error: '请输入问题' }),
                                { status: 400, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                        userPrompt = question;
                    } else {
                        if (!inputUrl && !content) {
                            return new Response(
                                JSON.stringify({ error: '请输入网页地址或内容文本' }),
                                { status: 400, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                        
                        let inputContent = content || '';
                        userPrompt = prompt || '请分析以下内容，提取标题并生成摘要：';
                        
                        if (inputUrl && !content) {
                            try {
                                const pageResponse = await fetch(inputUrl);
                                if (!pageResponse.ok) {
                                    throw new Error(`HTTP error! status: ${pageResponse.status}`);
                                }
                                const pageText = await pageResponse.text();
                                
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
                    }
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 25000);
                    
                    let response;
                    try {
                        response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
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
                                            content: mode === 'chat' 
                                                ? '你是一个专业的AI助手，擅长回答各种问题。请用简洁、准确的语言回答。'
                                                : '你是一个专业的内容分析助手，擅长提取文章标题和生成摘要。请用简洁、准确的语言回答。'
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
                            }),
                            signal: controller.signal
                        });
                    } catch (fetchError) {
                        clearTimeout(timeoutId);
                        if (fetchError.name === 'AbortError') {
                            throw new Error('AI 分析超时（超过25秒），请尝试简化分析要求或减少内容长度');
                        }
                        throw fetchError;
                    }
                    
                    clearTimeout(timeoutId);
                    
                    const responseText = await response.text();
                    const contentType = response.headers.get('content-type') || '';
                    
                    console.log('API Response Status:', response.status);
                    console.log('API Content-Type:', contentType);
                    console.log('Response starts with:', responseText.substring(0, 50));
                    
                    if (!response.ok) {
                        let errorMsg = `API 请求失败: ${response.status}`;
                        if (responseText && responseText.length < 500) {
                            if (responseText.trim().startsWith('<')) {
                                const match = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
                                if (match) {
                                    errorMsg += ` - ${match[1].trim()}`;
                                } else {
                                    errorMsg += ` - HTML响应`;
                                }
                            } else {
                                errorMsg += ` - ${responseText.substring(0, 200)}`;
                            }
                        }
                        throw new Error(errorMsg);
                    }
                    
                    if (responseText.trim().startsWith('<')) {
                        throw new Error('API 返回了 HTML 内容，不是预期的 JSON 响应');
                    }
                    
                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析 API 响应为 JSON: ' + responseText.substring(0, 100));
                    }
                    
                    if (result.output && result.output.choices && result.output.choices[0]) {
                        const aiContent = result.output.choices[0].message.content;
                        
                        return new Response(
                            JSON.stringify({ 
                                title: mode === 'chat' ? 'AI 回答' : 'AI 分析结果', 
                                summary: aiContent,
                                provider: '通义千问',
                                mode: mode
                            }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    } else {
                        throw new Error('AI API 返回格式错误: ' + JSON.stringify(result).substring(0, 200));
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
        
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的AI工具</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 40px 20px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%);
            min-height: 100vh;
        }
        .container { 
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px; 
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 { 
            color: #1a1a2e; 
            text-align: center;
            margin-bottom: 30px;
            font-size: 2em;
        }
        .form-group { margin-bottom: 20px; }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600;
            color: #333;
        }
        input, textarea, select { 
            width: 100%; 
            padding: 14px 16px; 
            border: 2px solid #e0e0e0; 
            border-radius: 10px; 
            font-size: 14px;
            transition: all 0.3s ease;
        }
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        textarea { height: 120px; resize: vertical; }
        select {
            cursor: pointer;
            background: white;
        }
        button { 
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%);
            color: white; 
            border: none; 
            padding: 14px 40px; 
            border-radius: 10px; 
            font-size: 16px; 
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        button:hover:not(:disabled) { 
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        button:active:not(:disabled) {
            transform: translateY(0);
        }
        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }
        button:hover:not(:disabled)::before {
            left: 100%;
        }
        .result-card { 
            margin-top: 30px; 
            padding: 24px; 
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #667eea;
            display: none;
            animation: slideIn 0.3s ease;
        }
        .result-card h3 {
            color: #667eea;
            margin-bottom: 12px;
        }
        .result-content {
            color: #333;
            line-height: 1.8;
            white-space: pre-wrap;
        }
        @keyframes spin { 
            to { transform: rotate(360deg); } 
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .loading { 
            display: inline-block; 
            width: 18px; 
            height: 18px; 
            border: 2px solid rgba(255,255,255,0.3); 
            border-radius: 50%; 
            border-top-color: white;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        .error { color: #dc3545; }
        .hidden { display: none; }
        .mode-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 24px;
        }
        .mode-tab {
            flex: 1;
            padding: 12px;
            text-align: center;
            background: #f0f0f0;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            border: 2px solid transparent;
        }
        .mode-tab.active {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%);
            color: white;
        }
        .mode-tab:not(.active):hover {
            background: #e0e0e0;
        }
        .mode-content {
            transition: all 0.3s ease;
        }
        .tip-box {
            background: linear-gradient(135deg, #6366f115 0%, #8b5cf615 100%);
            border: 1px solid #6366f130;
            border-radius: 12px;
            padding: 14px 18px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #4a5568;
        }
        .tip-box .tip-title {
            font-weight: 600;
            color: #6366f1;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .tip-box ul {
            margin: 0;
            padding: 0;
            columns: 2;
            column-gap: 20px;
            list-style: none;
        }
        .tip-box li {
            margin-bottom: 6px;
            padding-left: 16px;
            position: relative;
            break-inside: avoid;
        }
        .tip-box li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: 600;
        }
        .footer {
            text-align: center;
            color: #78716c;
            margin-top: 25px;
            font-size: 11px;
            line-height: 1.5;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            backdrop-filter: blur(8px);
        }
        .footer .brand {
            font-weight: 600;
            color: #4b5563;
            margin-bottom: 3px;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 20px 12px;
            }
            h1 {
                font-size: 1.6rem;
                margin-bottom: 10px;
            }
            .container {
                padding: 20px 18px;
                border-radius: 16px;
            }
            .mode-tab {
                padding: 12px 14px;
                font-size: 14px;
            }
            .tip-box {
                padding: 12px 14px;
                margin-bottom: 16px;
                font-size: 12px;
            }
            .tip-box .tip-title {
                font-size: 13px;
                margin-bottom: 8px;
            }
            .tip-box ul {
                column-gap: 15px;
            }
            .tip-box li {
                margin-bottom: 4px;
                padding-left: 14px;
            }
            .form-group {
                margin-bottom: 18px;
            }
            input, textarea {
                padding: 14px 16px;
                font-size: 15px;
            }
            button {
                padding: 16px;
                font-size: 16px;
            }
            .footer {
                margin-top: 20px;
                padding: 10px 12px;
                font-size: 10px;
            }
        }
        
        @media (max-width: 480px) {
            body {
                padding: 15px 8px;
            }
            h1 {
                font-size: 1.4rem;
            }
            .container {
                padding: 16px 14px;
            }
            .mode-tabs {
                gap: 8px;
                padding: 6px;
            }
            .mode-tab {
                padding: 10px 12px;
                font-size: 13px;
            }
            .tip-box ul {
                columns: 1;
            }
            input, textarea {
                padding: 12px 14px;
                font-size: 14px;
            }
            button {
                padding: 14px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 我的AI工具</h1>
        
        <div class="mode-tabs">
            <div class="mode-tab" id="tab-analyze" onclick="switchMode('analyze')">📝 内容分析</div>
            <div class="mode-tab active" id="tab-chat" onclick="switchMode('chat')">💬 AI问答</div>
        </div>
        
        <input type="hidden" id="modeSelect" value="chat">
        
        <div id="analyzeMode" class="mode-content hidden">
            <div class="tip-box">
                <div class="tip-title">💡 内容分析可以做什么</div>
                <ul>
                    <li>提取文章标题和核心要点</li>
                    <li>生成简洁摘要</li>
                    <li>分析新闻事件</li>
                    <li>总结产品介绍</li>
                    <li>提取关键数据和结论</li>
                </ul>
            </div>
            
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
                <textarea id="promptInput" placeholder="请输入分析要求（可选）" style="height: 80px;"></textarea>
            </div>
        </div>
        
        <div id="chatMode" class="mode-content">
            <div class="tip-box">
                <div class="tip-title">💡 AI问答可以做什么</div>
                <ul>
                    <li>解答各类问题</li>
                    <li>提供建议和方案</li>
                    <li>解释概念和原理</li>
                    <li>协助写作和创作</li>
                    <li>代码编写和调试</li>
                </ul>
            </div>
            
            <div class="form-group">
                <label>💬 你的问题</label>
                <textarea id="questionInput" placeholder="请输入你想问的问题" style="height: 120px;"></textarea>
            </div>
        </div>
        
        <button id="submitBtn" onclick="analyze()">
            <span class="loading" id="loading" style="display:none"></span>
            <span id="btnText">提问</span>
        </button>
        
        <div id="result" class="result-card">
            <h3 id="resultTitle">📊 分析结果</h3>
            <div id="summary" class="result-content"></div>
        </div>
        
        <div class="footer">
            <div class="brand">POWER BY TANLIN@2026</div>
            <div>AI 服务由通义千问提供</div>
        </div>
    </div>
    <script>
        function switchMode(mode) {
            const modeSelect = document.getElementById('modeSelect');
            const analyzeMode = document.getElementById('analyzeMode');
            const chatMode = document.getElementById('chatMode');
            const tabAnalyze = document.getElementById('tab-analyze');
            const tabChat = document.getElementById('tab-chat');
            const btnText = document.getElementById('btnText');
            const result = document.getElementById('result');
            
            modeSelect.value = mode;
            
            if (mode === 'chat') {
                analyzeMode.classList.add('hidden');
                chatMode.classList.remove('hidden');
                tabAnalyze.classList.remove('active');
                tabChat.classList.add('active');
                btnText.textContent = '提问';
            } else {
                analyzeMode.classList.remove('hidden');
                chatMode.classList.add('hidden');
                tabAnalyze.classList.add('active');
                tabChat.classList.remove('active');
                btnText.textContent = '开始分析';
            }
            result.style.display = 'none';
        }
        
        async function analyze() {
            const mode = document.getElementById('modeSelect').value;
            const loading = document.getElementById('loading');
            const btnText = document.getElementById('btnText');
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');
            const summary = document.getElementById('summary');
            const resultTitle = document.getElementById('resultTitle');
            
            let requestData = { mode };
            
            if (mode === 'chat') {
                const question = document.getElementById('questionInput').value;
                if (!question) {
                    alert('请输入问题');
                    return;
                }
                requestData.question = question;
            } else {
                const url = document.getElementById('urlInput').value;
                const content = document.getElementById('contentInput').value;
                const prompt = document.getElementById('promptInput').value;
                
                if (!url && !content) {
                    alert('请输入网页地址或内容文本');
                    return;
                }
                
                if (url && content) {
                    alert('请只选择网页地址或内容文本，不要同时输入');
                    return;
                }
                
                requestData.url = url;
                requestData.content = content;
                requestData.prompt = prompt;
            }
            
            loading.style.display = 'inline-block';
            btnText.textContent = mode === 'chat' ? '思考中...' : '分析中...';
            submitBtn.disabled = true;
            result.style.display = 'none';
            
            try {
                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    throw new Error('服务器错误: ' + response.status);
                }
                
                const responseText = await response.text();
                
                if (responseText.trim().startsWith('<')) {
                    throw new Error('服务器返回了 HTML 内容，不是预期的 JSON');
                }
                
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    throw new Error('无法解析响应为 JSON: ' + responseText.substring(0, 50));
                }
                
                resultTitle.textContent = data.title === '错误' ? '❌ 错误' : (mode === 'chat' ? '💬 AI 回答' : '📊 分析结果');
                
                if (data.title === '错误') {
                    summary.innerHTML = data.summary;
                    summary.className = 'result-content error';
                } else {
                    summary.innerHTML = data.summary.replace(/\\n/g, '<br>');
                    summary.className = 'result-content';
                }
                result.style.display = 'block';
            } catch (error) {
                resultTitle.textContent = '❌ 错误';
                summary.innerHTML = error.message;
                summary.className = 'result-content error';
                result.style.display = 'block';
            } finally {
                loading.style.display = 'none';
                btnText.textContent = mode === 'chat' ? '提问' : '开始分析';
                submitBtn.disabled = false;
            }
        }
    </script>
</body>
</html>`;
        
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
};