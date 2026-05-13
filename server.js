const express = require('express');
const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

const httpsAgent = new https.Agent({
    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT,
    rejectUnauthorized: false
});

app.use(express.json());

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'MyAITool.html');
    res.sendFile(htmlPath);
});

function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
}

function extractMainContent($) {
    $('script, style, nav, footer, header, aside, iframe, img, svg, video, audio, form, input, button, select').remove();
    
    const selectors = [
        'article',
        'main',
        '.content',
        '#content',
        '.post-content',
        '.article-content',
        '.main-content',
        '.entry-content',
        '.post-body',
        '.article-body',
        '.blog-content',
        '.story-content',
        '.news-content',
        '.content-body',
        '.detail-content',
        'div[role="main"]',
        '#main',
        '.container',
        '.wrapper',
        '.inner',
        '.post',
        '.entry',
        '.article',
        '.story',
        '.news',
        '.detail',
        'body'
    ];
    
    let content = '';
    for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().length > content.length) {
            content = element.text();
        }
    }
    
    if (!content || content.length < 100) {
        content = $('body').text();
    }
    
    return cleanText(content).substring(0, 15000);
}

async function fetchWebPage(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            httpsAgent: httpsAgent
        });
        
        const $ = cheerio.load(response.data);
        const title = $('title').text().trim();
        const content = extractMainContent($);
        
        return { title, content };
    } catch (error) {
        throw new Error('无法获取网页内容: ' + error.message);
    }
}

async function callAI(content, provider, apiKey, apiSecret, userPrompt = '') {
    const defaultPrompt = `请为以下内容进行详细分析并生成中文分析报告。要求：
1. 总结核心要点
2. 分点梳理关键信息
3. 分析内容结构和重点
4. 语言流畅易懂
5. 详细分析，不少于800字

内容：
${content}`;

    const customPrompt = userPrompt 
        ? `请根据以下要求分析这段内容：

分析要求：
${userPrompt}

内容：
${content}`
        : defaultPrompt;

    switch(provider) {
        case 'qianwen':
            return await callQianWen(customPrompt, apiKey);
        case 'wenxin':
            return await callWenxin(customPrompt, apiKey, apiSecret);
        case 'doubao':
            return await callDoubao(customPrompt, apiKey);
        case 'openai':
        default:
            return await callOpenAI(customPrompt, apiKey);
    }
}

async function callOpenAI(prompt, apiKey) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });
    
    return response.data.choices[0].message.content;
}

async function callQianWen(prompt, apiKey) {
    try {
        console.log('📡 正在调用通义千问API...');
        console.log('🔑 API Key前8位:', apiKey.substring(0, 8) + '...');
        
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            model: 'qwen-turbo',
            input: { messages: [{ role: 'user', content: prompt }] },
            parameters: { temperature: 0.5, max_tokens: 2000 }
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        console.log('✅ API响应状态:', response.status);
        console.log('📄 响应数据:', JSON.stringify(response.data).substring(0, 1000) + '...');
        
        if (response.status !== 200) {
            throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
        }
        
        const data = response.data;
        
        if (!data || typeof data !== 'object') {
            throw new Error('API返回数据格式异常');
        }
        
        if (data.status_code !== undefined) {
            if (data.status_code === 401) {
                throw new Error('API认证失败（401）：API Key无效或已过期');
            } else if (data.status_code === 403) {
                throw new Error('API访问被拒绝（403）：账户余额不足或未开通服务');
            } else if (data.status_code !== 200) {
                throw new Error('API调用失败 [代码' + data.status_code + ']: ' + (data.message || '未知错误'));
            }
        } else if (data.code !== undefined) {
            if (data.code === 401) {
                throw new Error('API认证失败（401）：API Key无效或已过期');
            } else if (data.code === 403) {
                throw new Error('API访问被拒绝（403）：账户余额不足或未开通服务');
            } else if (data.code !== 200) {
                throw new Error('API调用失败 [代码' + data.code + ']: ' + (data.message || data.error || '未知错误'));
            }
        } else if (data.error) {
            throw new Error('API调用失败: ' + (data.error.message || data.error || '未知错误'));
        }
        
        if (data.output && data.output.text) {
            return data.output.text;
        } else if (data.result) {
            return data.result;
        } else if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            return data.choices[0].message.content;
        }
        
        throw new Error('API返回数据格式异常，无法提取结果');
        
    } catch (error) {
        console.error('❌ 通义千问API调用失败:', error.message);
        
        if (error.response) {
            console.error('📊 响应状态:', error.response.status);
            console.error('📋 响应数据:', JSON.stringify(error.response.data));
            
            const status = error.response.status;
            if (status === 401) {
                throw new Error('API认证失败（401）：请检查API Key是否正确，或确认已在阿里云开通通义千问服务');
            } else if (status === 403) {
                throw new Error('API访问被拒绝（403）：可能原因：① 账户余额不足 ② 未开通通义千问服务 ③ 访问权限受限');
            } else if (status === 429) {
                throw new Error('请求过于频繁（429）：已达到API调用限制，请稍后再试');
            } else if (status === 500) {
                throw new Error('服务器内部错误（500）：阿里云服务暂时不可用，请稍后再试');
            }
        }
        
        throw new Error('通义千问API调用失败: ' + (error.message || '未知错误'));
    }
}

async function callWenxin(prompt, apiKey, apiSecret) {
    let accessToken = apiKey;
    
    if (apiSecret) {
        const tokenResponse = await axios.post('https://aip.baidubce.com/oauth/2.0/token', 
            `grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            }
        );
        accessToken = tokenResponse.data.access_token;
    }
    
    const response = await axios.post('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions', {
        model: 'ERNIE-4.0-Turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5
    }, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });
    
    return response.data.result;
}

async function callDoubao(prompt, apiKey) {
    const response = await axios.post('https://api.bytedance.net/api/text', {
        model: 'Doubao-1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });
    
    return response.data.choices[0].message.content;
}

function generateBuiltInSummary(content, userPrompt = '') {
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 15);
    const keySentences = sentences.slice(0, 6);
    
    let summary = '';
    
    if (userPrompt) {
        summary = '🎯 分析要求：\n' + userPrompt + '\n\n';
    }
    
    summary += '📌 内容摘要：\n\n';
    summary += '【主要内容】\n';
    
    keySentences.forEach((sentence, index) => {
        if (sentence.trim().length > 20) {
            summary += `${index + 1}. ${sentence.trim()}。\n`;
        }
    });
    
    summary += '\n💡 提示：配置AI服务商可获得更精准的智能摘要。';
    
    return summary;
}

app.post('/api/summarize', async (req, res) => {
    try {
        const { url, content, prompt } = req.body;
        
        const provider = process.env.AI_PROVIDER || req.body.provider || 'qianwen';
        const apiKey = process.env.AI_API_KEY || req.body.apiKey;
        const apiSecret = process.env.AI_API_SECRET || req.body.apiSecret;
        
        let pageContent = content || '';
        let pageTitle = '';
        
        if (url && !content) {
            const pageData = await fetchWebPage(url);
            pageContent = pageData.content;
            pageTitle = pageData.title;
        }
        
        if (!pageContent || pageContent.length < 30) {
            return res.status(400).json({ error: '内容太短，无法生成摘要' });
        }

        let summary;
        if (apiKey) {
            summary = await callAI(pageContent, provider, apiKey, apiSecret, prompt);
        } else {
            summary = generateBuiltInSummary(pageContent, prompt);
        }

        res.json({
            title: pageTitle || '未获取到标题',
            url,
            summary,
            contentLength: pageContent.length,
            provider: process.env.AI_PROVIDER || '内置摘要'
        });

    } catch (error) {
        console.error('处理错误:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 AI内容分析服务器已启动!`);
    console.log(`📄 前端页面: http://localhost:${PORT}`);
    console.log(`💡 提示: 在前端页面配置AI服务商即可使用AI内容分析功能\n`);
});