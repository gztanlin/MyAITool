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
        
        if (pathname === '/feedback') {
            return new Response(
                `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>给我留言 - AI助手</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 30px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2rem;
            color: #1f2937;
            margin-bottom: 10px;
        }

        .header p {
            color: #6b7280;
            font-size: 1rem;
        }

        .form-group {
            margin-bottom: 22px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #374151;
            font-size: 1rem;
        }

        .form-group textarea,
        .form-group input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            font-size: 1rem;
            font-family: inherit;
            transition: all 0.2s ease;
            background: #f9fafb;
        }

        .form-group textarea:focus,
        .form-group input:focus {
            outline: none;
            border-color: #3b82f6;
            background: white;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group textarea {
            min-height: 150px;
            resize: vertical;
        }

        .optional {
            color: #9ca3af;
            font-weight: 400;
            font-size: 0.875rem;
        }

        .submit-btn {
            width: 100%;
            padding: 15px 30px;
            font-size: 1.1rem;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .loading {
            display: none;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            color: #6b7280;
        }

        .loading.show {
            display: flex;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e5e7eb;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 10px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-message {
            display: none;
            align-items: flex-start;
            gap: 10px;
            padding: 14px 16px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            color: #dc2626;
            margin-bottom: 16px;
        }

        .error-message.show {
            display: flex;
        }

        .success-message {
            display: none;
            align-items: flex-start;
            gap: 10px;
            padding: 14px 16px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            color: #16a34a;
            margin-bottom: 16px;
        }

        .success-message.show {
            display: flex;
        }

        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
        }

        .back-link:hover {
            color: #2563eb;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ 给我留言</h1>
            <p>欢迎给我留言，我会尽快回复您！</p>
        </div>

        <form id="feedbackForm">
            <div class="form-group">
                <label>📝 您的留言</label>
                <textarea id="feedbackContent" placeholder="请输入您的留言、建议或问题..."></textarea>
            </div>
            <div class="form-group">
                <label>📧 您的邮箱 <span class="optional">可选</span></label>
                <input type="email" id="feedbackEmail" placeholder="方便我们回复您">
            </div>
            <div class="form-group">
                <label>📱 您的微信 <span class="optional">可选</span></label>
                <input type="text" id="feedbackWechat" placeholder="方便我们联系您">
            </div>

            <button type="submit" class="submit-btn" id="feedbackSubmitBtn">
                <span>📤</span>
                <span>提交留言</span>
            </button>
        </form>

        <div class="loading" id="feedbackLoading">
            <div class="spinner"></div>
            <p>正在提交，请稍候...</p>
        </div>

        <div class="error-message" id="feedbackErrorMessage">
            <span class="icon">❌</span>
            <span id="feedbackErrorText"></span>
        </div>

        <div class="success-message" id="feedbackSuccessMessage">
            <span class="icon">✅</span>
            <span>留言提交成功，感谢您的反馈！</span>
        </div>

        <a href="/" class="back-link">← 返回首页</a>
    </div>

    <script>
        const feedbackForm = document.getElementById('feedbackForm');
        const feedbackContent = document.getElementById('feedbackContent');
        const feedbackEmail = document.getElementById('feedbackEmail');
        const feedbackWechat = document.getElementById('feedbackWechat');
        const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
        const feedbackLoading = document.getElementById('feedbackLoading');
        const feedbackErrorMessage = document.getElementById('feedbackErrorMessage');
        const feedbackErrorText = document.getElementById('feedbackErrorText');
        const feedbackSuccessMessage = document.getElementById('feedbackSuccessMessage');

        function showFeedbackError(message) {
            feedbackErrorText.textContent = message;
            feedbackErrorMessage.classList.add('show');
            setTimeout(() => {
                feedbackErrorMessage.classList.remove('show');
            }, 5000);
        }

        async function submitFeedback(e) {
            e.preventDefault();
            
            const content = feedbackContent.value.trim();
            const email = feedbackEmail.value.trim();
            const wechat = feedbackWechat.value.trim();

            if (!content) {
                showFeedbackError('请输入留言内容');
                return;
            }

            feedbackSubmitBtn.disabled = true;
            feedbackLoading.classList.add('show');
            feedbackErrorMessage.classList.remove('show');
            feedbackSuccessMessage.classList.remove('show');

            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: content,
                        email: email,
                        wechat: wechat
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '提交失败');
                }

                feedbackSuccessMessage.classList.add('show');
                feedbackContent.value = '';
                feedbackEmail.value = '';
                feedbackWechat.value = '';

            } catch (error) {
                showFeedbackError(error.message);
            } finally {
                feedbackLoading.classList.remove('show');
                feedbackSubmitBtn.disabled = false;
            }
        }

        feedbackForm.addEventListener('submit', submitFeedback);
    </script>
</body>
</html>`,
                { headers: { 'Content-Type': 'text/html' } }
            );
        }
        
        if (pathname === '/api/summarize' || pathname === '/api/conversation' || pathname === '/api/feedback') {
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

                if (pathname === '/api/feedback') {
                    const { content, email, wechat } = requestData;
                    if (!content) {
                        return new Response(
                            JSON.stringify({ error: '请输入留言内容' }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }
                        );
                    }

                    const timestamp = new Date().toLocaleString('zh-CN');
                    const feedbackEntry = {
                        time: timestamp,
                        content: content,
                        email: email || '未提供',
                        wechat: wechat || '未提供'
                    };

                    console.log('=== 收到新留言 ===');
                    console.log(`时间: ${feedbackEntry.time}`);
                    console.log(`邮箱: ${feedbackEntry.email}`);
                    console.log(`微信: ${feedbackEntry.wechat}`);
                    console.log(`内容: ${feedbackEntry.content}`);
                    console.log('====================');

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: '留言提交成功'
                        }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                }

                try {
                    const apiKey = 'sk-5b0ae74df47a459985325ddeb221bb7e';
                    let messages = [];
                    let systemPrompt = '';
                    
                    if (pathname === '/api/conversation') {
                        const { history } = requestData;
                        if (!history || !Array.isArray(history)) {
                            return new Response(
                                JSON.stringify({ error: '无效的对话历史' }),
                                { status: 400, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                        systemPrompt = '你是一个友好的AI助手，擅长与用户进行对话交流。请用自然、准确的语言回答用户的问题。';
                        messages = [
                            { role: 'system', content: systemPrompt },
                            ...history
                        ];
                    } else {
                        const { mode, url: inputUrl, content, prompt, question } = requestData;
                        
                        if (mode === 'chat') {
                            if (!question) {
                                return new Response(
                                    JSON.stringify({ error: '请输入问题' }),
                                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                                );
                            }
                            systemPrompt = '你是一个专业的AI助手，擅长回答各种问题。请用简洁、准确的语言回答。';
                            messages = [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: question }
                            ];
                        } else {
                            if (!inputUrl && !content) {
                                return new Response(
                                    JSON.stringify({ error: '请输入网页地址或内容文本' }),
                                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                                );
                            }
                            
                            let inputContent = content || '';
                            let userPrompt = prompt || '请分析以下内容，提取标题并生成摘要：';
                            
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
                            
                            systemPrompt = '你是一个专业的内容分析助手，擅长提取文章标题和生成摘要。请用简洁、准确的语言回答。';
                            messages = [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: userPrompt }
                            ];
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
                                input: { messages: messages },
                                parameters: { result_format: 'message' }
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
                                title: pathname === '/api/conversation' ? 'AI 对话' : (requestData.mode === 'chat' ? 'AI 回答' : 'AI 分析结果'), 
                                summary: aiContent,
                                provider: '通义千问'
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #ec4899 100%);
            min-height: 100vh;
            padding: 40px 20px;
            line-height: 1.6;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; color: white; margin-bottom: 40px; }
        .header h1 { font-size: 2.6rem; margin-bottom: 15px; font-weight: 700; }
        .header p { opacity: 0.95; font-size: 1.1rem; }
        
        .mode-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 25px;
            background: white;
            padding: 8px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .mode-tab {
            flex: 1;
            padding: 14px 20px;
            text-align: center;
            background: transparent;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            font-size: 15px;
            color: #666;
            border: none;
        }
        .mode-tab.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102,126,234,0.4);
        }
        .mode-tab:not(.active):hover {
            background: #f0f0f0;
        }
        
        .card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.3);
            padding: 35px;
        }
        
        .form-group { margin-bottom: 22px; }
        .form-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 15px;
        }
        .form-group label .badge {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .form-group label .optional {
            background: #e2e8f0;
            color: #718096;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 14px 18px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 15px;
            transition: all 0.3s;
            outline: none;
            font-family: inherit;
            line-height: 1.6;
        }
        .form-group input:focus,
        .form-group textarea:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102,126,234,0.15);
        }
        
        .form-group textarea {
            min-height: 120px;
            resize: vertical;
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
            display: flex;
            align-items: center;
            gap: 6px;
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
        
        .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            position: relative;
            overflow: hidden;
        }
        .submit-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }
        .submit-btn:hover:not(:disabled)::before {
            left: 100%;
        }
        .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 30px rgba(102,126,234,0.4);
        }
        .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 30px;
        }
        .loading.show { display: block; }
        .spinner {
            width: 45px;
            height: 45px;
            border: 4px solid #e2e8f0;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading p {
            color: #667eea;
            font-weight: 500;
            font-size: 15px;
        }
        
        .result-container {
            display: none;
            margin-top: 25px;
            animation: fadeIn 0.3s ease;
        }
        .result-container.show { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 18px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
        }
        .result-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1a202c;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .summary-content {
            line-height: 1.9;
            color: #4a5568;
            font-size: 15px;
            background: #f7fafc;
            padding: 22px;
            border-radius: 12px;
            white-space: pre-wrap;
            min-height: 150px;
            border: 1px solid #e2e8f0;
        }
        
        .error-message {
            display: none;
            background: #fff5f5;
            border: 1px solid #feb2b2;
            color: #c53030;
            padding: 14px;
            border-radius: 10px;
            margin-top: 18px;
            font-size: 14px;
            align-items: flex-start;
            gap: 10px;
        }
        .error-message.show { display: flex; }
        .error-message .icon { font-size: 18px; }
        
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
            margin-bottom: 4px;
            color: #4b5563;
        }
        
        .hidden { display: none !important; }

        .chat-messages {
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 20px;
            padding: 10px;
            background: #f7fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }

        .chat-message {
            margin-bottom: 16px;
            animation: fadeIn 0.3s ease;
        }

        .chat-message.user {
            display: flex;
            justify-content: flex-end;
        }

        .chat-message.assistant {
            display: flex;
            justify-content: flex-start;
        }

        .message-bubble {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 16px;
            line-height: 1.6;
            font-size: 15px;
            word-wrap: break-word;
        }

        .chat-message.user .message-bubble {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border-bottom-right-radius: 4px;
        }

        .chat-message.assistant .message-bubble {
            background: white;
            color: #2d3748;
            border: 1px solid #e2e8f0;
            border-bottom-left-radius: 4px;
        }

        .chat-input-container {
            display: flex;
            gap: 10px;
        }

        .chat-input-container textarea {
            flex: 1;
            min-height: 60px !important;
            max-height: 120px;
            resize: vertical;
        }

        .chat-input-container button {
            align-self: flex-end;
            white-space: nowrap;
            padding: 14px 24px;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 20px 12px;
                min-height: 100vh;
            }
            .header {
                margin-bottom: 25px;
            }
            .header h1 {
                font-size: 1.6rem;
                margin-bottom: 10px;
            }
            .header p {
                font-size: 0.95rem;
            }
            .card {
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
            .form-group label {
                font-size: 14px;
                margin-bottom: 8px;
            }
            .form-group input,
            .form-group textarea {
                padding: 14px 16px;
                font-size: 15px;
                border-radius: 10px;
            }
            .form-group textarea {
                min-height: 100px;
            }
            .submit-btn {
                padding: 16px;
                font-size: 16px;
                border-radius: 10px;
            }
            .result-header {
                margin-bottom: 14px;
                padding-bottom: 12px;
            }
            .result-title {
                font-size: 1.1rem;
            }
            .summary-content {
                padding: 18px;
                font-size: 14px;
                line-height: 1.7;
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
            .header h1 {
                font-size: 1.4rem;
            }
            .card {
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
            .form-group input,
            .form-group textarea {
                padding: 12px 14px;
                font-size: 14px;
            }
            .submit-btn {
                padding: 14px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 我的AI工具</h1>
            <p>智能内容分析与 AI 问答助手</p>
        </div>

        <div class="mode-tabs">
            <button class="mode-tab active" id="tab-chat" onclick="switchMode('chat')">💬 AI问答</button>
            <button class="mode-tab" id="tab-conversation" onclick="switchMode('conversation')">🤖 AI对话</button>
            <button class="mode-tab" id="tab-analyze" onclick="switchMode('analyze')">📝 内容分析</button>
        </div>

        <div class="card">
            <div id="chatMode">
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
                    <label>
                        💬 你的问题
                    </label>
                    <textarea id="chatQuestionInput" placeholder="请输入你想问的问题..." style="min-height: 150px;"></textarea>
                </div>

                <button class="submit-btn" id="chatSubmitBtn" onclick="submitChat()">
                    <span>💬</span>
                    <span>提问</span>
                </button>

                <div class="loading" id="chatLoading">
                    <div class="spinner"></div>
                    <p>AI 正在思考，请稍候...</p>
                </div>

                <div class="error-message" id="chatErrorMessage">
                    <span class="icon">❌</span>
                    <span id="chatErrorText"></span>
                </div>

                <div class="result-container" id="chatResultContainer">
                    <div class="result-header">
                        <div class="result-title">
                            <span id="chatResultIcon">💬</span>
                            <span id="chatResultTitle">AI 回答</span>
                        </div>
                    </div>
                    <div class="summary-content" id="chatSummaryContent"></div>
                </div>
            </div>

            <div id="analyzeMode" class="hidden">
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
                    <label>
                        🌐 网页地址
                        <span class="badge">URL</span>
                    </label>
                    <input type="url" id="analyzeUrlInput" placeholder="请输入网页地址，例如：https://example.com/article">
                </div>

                <div class="form-group">
                    <label>
                        📝 内容文本
                        <span class="optional">可选</span>
                    </label>
                    <textarea id="analyzeContentInput" placeholder="或者直接输入要分析的文本内容..."></textarea>
                </div>

                <div class="form-group">
                    <label>
                        🎯 分析要求
                        <span class="optional">可选</span>
                    </label>
                    <textarea id="analyzePromptInput" placeholder="请输入分析要求，例如：总结核心要点、提取关键数据等" style="min-height: 80px;"></textarea>
                </div>

                <button class="submit-btn" id="analyzeSubmitBtn" onclick="submitAnalyze()">
                    <span>🚀</span>
                    <span>开始分析</span>
                </button>

                <div class="loading" id="analyzeLoading">
                    <div class="spinner"></div>
                    <p>AI 正在分析，请稍候...</p>
                </div>

                <div class="error-message" id="analyzeErrorMessage">
                    <span class="icon">❌</span>
                    <span id="analyzeErrorText"></span>
                </div>

                <div class="result-container" id="analyzeResultContainer">
                    <div class="result-header">
                        <div class="result-title">
                            <span id="analyzeResultIcon">📊</span>
                            <span id="analyzeResultTitle">分析结果</span>
                        </div>
                    </div>
                    <div class="summary-content" id="analyzeSummaryContent"></div>
                </div>
            </div>

            <div id="conversationMode" class="hidden">
                <div class="tip-box">
                    <div class="tip-title">💡 AI对话功能</div>
                    <ul>
                        <li>与AI进行多轮对话</li>
                        <li>支持查看对话历史</li>
                        <li>上下文理解更准确</li>
                        <li>连续提问更方便</li>
                    </ul>
                </div>

                <div class="chat-messages" id="conversationMessages">
                    <div class="chat-message assistant">
                        <div class="message-bubble">你好！我是你的AI助手，有什么可以帮助你的吗？</div>
                    </div>
                </div>

                <div class="chat-input-container">
                    <textarea id="conversationInput" placeholder="请输入你的消息..." style="min-height: 60px;"></textarea>
                    <button class="submit-btn" id="conversationSendBtn" style="width: auto;">发送</button>
                </div>

                <div class="loading" id="conversationLoading">
                    <div class="spinner"></div>
                    <p>AI 正在思考，请稍候...</p>
                </div>

                <div class="error-message" id="conversationErrorMessage">
                    <span class="icon">❌</span>
                    <span id="conversationErrorText"></span>
                </div>
            </div>
        </div>

        <div class="footer">
            <a href="/feedback" class="footer-link">✉️ 给我留言</a>
            <div>AI 服务由通义千问提供</div>
            <div class="brand">POWER BY TANLIN@2026</div>
        </div>
    </div>

    <script>
        const tabAnalyze = document.getElementById('tab-analyze');
        const tabChat = document.getElementById('tab-chat');
        const tabConversation = document.getElementById('tab-conversation');
        const analyzeMode = document.getElementById('analyzeMode');
        const chatMode = document.getElementById('chatMode');
        const conversationMode = document.getElementById('conversationMode');

        const chatQuestionInput = document.getElementById('chatQuestionInput');
        const chatSubmitBtn = document.getElementById('chatSubmitBtn');
        const chatLoading = document.getElementById('chatLoading');
        const chatErrorMessage = document.getElementById('chatErrorMessage');
        const chatErrorText = document.getElementById('chatErrorText');
        const chatResultContainer = document.getElementById('chatResultContainer');
        const chatResultTitle = document.getElementById('chatResultTitle');
        const chatResultIcon = document.getElementById('chatResultIcon');
        const chatSummaryContent = document.getElementById('chatSummaryContent');

        const analyzeUrlInput = document.getElementById('analyzeUrlInput');
        const analyzeContentInput = document.getElementById('analyzeContentInput');
        const analyzePromptInput = document.getElementById('analyzePromptInput');
        const analyzeSubmitBtn = document.getElementById('analyzeSubmitBtn');
        const analyzeLoading = document.getElementById('analyzeLoading');
        const analyzeErrorMessage = document.getElementById('analyzeErrorMessage');
        const analyzeErrorText = document.getElementById('analyzeErrorText');
        const analyzeResultContainer = document.getElementById('analyzeResultContainer');
        const analyzeResultTitle = document.getElementById('analyzeResultTitle');
        const analyzeResultIcon = document.getElementById('analyzeResultIcon');
        const analyzeSummaryContent = document.getElementById('analyzeSummaryContent');

        const conversationMessages = document.getElementById('conversationMessages');
        const conversationInput = document.getElementById('conversationInput');
        const conversationSendBtn = document.getElementById('conversationSendBtn');
        const conversationLoading = document.getElementById('conversationLoading');
        const conversationErrorMessage = document.getElementById('conversationErrorMessage');
        const conversationErrorText = document.getElementById('conversationErrorText');

        let conversationHistory = [];

        function switchMode(mode) {
            analyzeMode.classList.add('hidden');
            chatMode.classList.add('hidden');
            conversationMode.classList.add('hidden');
            
            tabAnalyze.classList.remove('active');
            tabChat.classList.remove('active');
            tabConversation.classList.remove('active');

            if (mode === 'chat') {
                chatMode.classList.remove('hidden');
                tabChat.classList.add('active');
            } else if (mode === 'conversation') {
                conversationMode.classList.remove('hidden');
                tabConversation.classList.add('active');
            } else {
                analyzeMode.classList.remove('hidden');
                tabAnalyze.classList.add('active');
            }
        }

        async function submitChat() {
            const question = chatQuestionInput.value.trim();
            if (!question) {
                showChatError('请输入问题');
                return;
            }

            chatLoading.classList.add('show');
            chatSubmitBtn.disabled = true;
            chatErrorMessage.classList.remove('show');
            chatResultContainer.classList.remove('show');

            try {
                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'chat', question })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '请求失败');
                }

                if (data.title === '错误') {
                    chatResultTitle.textContent = '错误';
                    chatResultIcon.textContent = '❌';
                    chatSummaryContent.textContent = data.summary;
                } else {
                    chatResultTitle.textContent = 'AI 回答';
                    chatResultIcon.textContent = '💬';
                    chatSummaryContent.textContent = data.summary;
                }
                chatResultContainer.classList.add('show');

            } catch (error) {
                showChatError(error.message);
            } finally {
                chatLoading.classList.remove('show');
                chatSubmitBtn.disabled = false;
            }
        }

        function showChatError(message) {
            chatErrorText.textContent = message;
            chatErrorMessage.classList.add('show');
        }

        async function submitAnalyze() {
            const url = analyzeUrlInput.value.trim();
            const content = analyzeContentInput.value.trim();
            const prompt = analyzePromptInput.value.trim();

            if (!url && !content) {
                showAnalyzeError('请输入网页地址或内容文本');
                return;
            }

            if (url && content) {
                showAnalyzeError('请只选择网页地址或内容文本，不要同时输入');
                return;
            }

            analyzeLoading.classList.add('show');
            analyzeSubmitBtn.disabled = true;
            analyzeErrorMessage.classList.remove('show');
            analyzeResultContainer.classList.remove('show');

            try {
                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: 'analyze', url, content, prompt })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '请求失败');
                }

                if (data.title === '错误') {
                    analyzeResultTitle.textContent = '错误';
                    analyzeResultIcon.textContent = '❌';
                    analyzeSummaryContent.textContent = data.summary;
                } else {
                    analyzeResultTitle.textContent = '分析结果';
                    analyzeResultIcon.textContent = '📊';
                    analyzeSummaryContent.textContent = data.summary;
                }
                analyzeResultContainer.classList.add('show');

            } catch (error) {
                showAnalyzeError(error.message);
            } finally {
                analyzeLoading.classList.remove('show');
                analyzeSubmitBtn.disabled = false;
            }
        }

        function showAnalyzeError(message) {
            analyzeErrorText.textContent = message;
            analyzeErrorMessage.classList.add('show');
        }

        async function sendConversation() {
            const message = conversationInput.value.trim();
            if (!message) return;

            addConversationMessage('user', message);
            conversationInput.value = '';
            conversationHistory.push({ role: 'user', content: message });

            conversationLoading.classList.add('show');
            conversationSendBtn.disabled = true;
            conversationErrorMessage.classList.remove('show');

            try {
                const response = await fetch('/api/conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ history: conversationHistory })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '请求失败');
                }

                const aiMessage = data.summary;
                addConversationMessage('assistant', aiMessage);
                conversationHistory.push({ role: 'assistant', content: aiMessage });
            } catch (error) {
                showConversationError(error.message);
            } finally {
                conversationLoading.classList.remove('show');
                conversationSendBtn.disabled = false;
            }
        }

        function addConversationMessage(role, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message ' + role;
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            bubbleDiv.textContent = content;
            messageDiv.appendChild(bubbleDiv);
            conversationMessages.appendChild(messageDiv);
            conversationMessages.scrollTop = conversationMessages.scrollHeight;
        }

        function showConversationError(message) {
            conversationErrorText.textContent = message;
            conversationErrorMessage.classList.add('show');
        }

        chatSubmitBtn.addEventListener('click', submitChat);
        analyzeSubmitBtn.addEventListener('click', submitAnalyze);
        conversationSendBtn.addEventListener('click', sendConversation);

        conversationInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendConversation(); 
            }
        });

        switchMode('chat');
    </script>
</body>
</html>`;
        
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }
};