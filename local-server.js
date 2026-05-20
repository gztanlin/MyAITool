import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let feedbackMessages = [];

// 520 情人节浪漫页面 - 带密码保护
app.get('/lq', (req, res) => {
    const password = req.query.pass;
    const correctPassword = 'lqq';
    
    // 如果密码不正确，显示密码输入页面
    if (password !== correctPassword) {
        const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💕 请输入密码</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            min-height: 100vh;
            background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
            font-family: 'Georgia', 'Times New Roman', serif;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .login-container {
            background: rgba(255,255,255,0.95);
            border-radius: 30px;
            padding: 60px 50px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            text-align: center;
            max-width: 450px;
            width: 100%;
        }
        
        .lock-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .title {
            font-size: 2rem;
            color: #e91e63;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 1.1rem;
            color: #666;
            margin-bottom: 30px;
        }
        
        .password-input {
            width: 100%;
            padding: 15px 20px;
            font-size: 1.2rem;
            border: 2px solid #ffb6c1;
            border-radius: 15px;
            text-align: center;
            outline: none;
            transition: all 0.3s;
        }
        
        .password-input:focus {
            border-color: #e91e63;
            box-shadow: 0 0 20px rgba(233,30,99,0.3);
        }
        
        .submit-btn {
            width: 100%;
            margin-top: 25px;
            padding: 15px;
            font-size: 1.2rem;
            background: linear-gradient(135deg, #e91e63, #c2185b);
            color: white;
            border: none;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 5px 20px rgba(233,30,99,0.3);
        }
        
        .submit-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 30px rgba(233,30,99,0.4);
        }
        
        .error-message {
            margin-top: 15px;
            color: #f44336;
            font-size: 0.95rem;
            display: none;
        }
        
        .error-message.show {
            display: block;
        }
        
        .hint {
            margin-top: 20px;
            font-size: 0.85rem;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="lock-icon">🔐</div>
        <h1 class="title">💕 请输入密码</h1>
        <p class="subtitle">这是一个专属的浪漫页面</p>
        
        <input type="password" id="password" class="password-input" placeholder="请输入密码" />
        <button class="submit-btn" onclick="checkPassword()">解锁浪漫 💝</button>
        
        <div class="error-message" id="error">密码错误，请重试</div>
    </div>
    
    <script>
        function checkPassword() {
            const password = document.getElementById('password').value;
            const error = document.getElementById('error');
            
            if (password === 'lqq') {
                window.location.href = '/lq?pass=lqq';
            } else {
                error.classList.add('show');
                setTimeout(() => error.classList.remove('show'), 3000);
            }
        }
        
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    </script>
</body>
</html>`;
        res.send(loginHtml);
        return;
    }
    
    // 密码正确，显示浪漫页面
    const loveHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💕 致我最爱的人 - 520</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            min-height: 100vh;
            background: url('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=close%20up%20of%20beautiful%20red%20rose%20petals%20soft%20romantic%20lighting%20elegant%20background%20pink%20aesthetic&image_size=landscape_16_9');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            background-attachment: fixed;
            font-family: 'Georgia', 'Times New Roman', serif;
            overflow-x: hidden;
            position: relative;
        }
        
        /* 背景粒子 */
        .particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
            z-index: 0;
        }
        
        .particle {
            position: absolute;
            display: block;
            animation: float 15s infinite;
            opacity: 0.6;
        }
        
        @keyframes float {
            0%, 100% {
                transform: translateY(100vh) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 0.6;
            }
            90% {
                opacity: 0.6;
            }
            100% {
                transform: translateY(-100vh) rotate(720deg);
                opacity: 0;
            }
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 60px 20px;
            position: relative;
            z-index: 1;
        }
        
        .header {
            text-align: center;
            margin-bottom: 60px;
        }
        
        .title {
            font-size: 4rem;
            color: #fff;
            text-shadow: 3px 3px 10px rgba(0,0,0,0.5), 0 0 30px rgba(233,30,99,0.5);
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
            font-weight: bold;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .subtitle {
            font-size: 1.8rem;
            color: #fff;
            font-style: italic;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.5), 0 0 20px rgba(233,30,99,0.4);
            font-weight: 500;
        }
        
        .heart-line {
            width: 100px;
            height: 3px;
            background: linear-gradient(90deg, transparent, #fff, transparent);
            margin: 30px auto;
        }
        
        .poem-card {
            background: rgba(255,255,255,0.95);
            border-radius: 30px;
            padding: 60px 50px;
            margin-bottom: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            position: relative;
            overflow: hidden;
        }
        
        .poem-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,182,193,0.3) 0%, transparent 70%);
            animation: shimmer 8s linear infinite;
        }
        
        @keyframes shimmer {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .poem-title {
            font-size: 2.2rem;
            color: #e91e63;
            text-align: center;
            margin-bottom: 40px;
            position: relative;
        }
        
        .poem-title::after {
            content: '💕';
            display: block;
            font-size: 2rem;
            margin-top: 10px;
        }
        
        .poem-content {
            font-size: 1.3rem;
            line-height: 2.4;
            color: #5d4037;
            text-align: center;
            position: relative;
        }
        
        .poem-content .highlight {
            color: #e91e63;
            font-weight: bold;
        }
        
        .poem-content .section {
            margin: 30px 0;
            padding: 20px;
            border-left: 4px solid #ffb6c1;
            background: linear-gradient(90deg, rgba(255,182,193,0.1), transparent);
        }
        
        .poem-content p {
            margin: 8px 0;
        }
        
        .final-line {
            margin-top: 50px !important;
            font-size: 1.8rem !important;
            color: #c2185b !important;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        
        .footer-message {
            text-align: center;
            margin-top: 60px;
            padding: 40px;
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
            border-radius: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        
        .footer-message h2 {
            font-size: 2.5rem;
            color: #e91e63;
            margin-bottom: 20px;
            animation: heartbeat 1.5s ease-in-out infinite;
        }
        
        @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.1); }
            50% { transform: scale(1); }
            75% { transform: scale(1.1); }
        }
        
        .footer-message p {
            font-size: 1.4rem;
            color: #5d4037;
            line-height: 2;
        }
        
        .signature {
            margin-top: 40px;
            font-size: 1.2rem;
            color: #999;
            font-style: italic;
        }
        
        .decorative-hearts {
            position: fixed;
            font-size: 2rem;
            opacity: 0.3;
            animation: floatHeart 6s ease-in-out infinite;
        }
        
        @keyframes floatHeart {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(10deg); }
        }
        
        @media (max-width: 768px) {
            .title { font-size: 2.5rem; }
            .subtitle { font-size: 1.1rem; }
            .poem-card { padding: 40px 25px; }
            .poem-title { font-size: 1.6rem; }
            .poem-content { font-size: 1.1rem; }
            .footer-message h2 { font-size: 1.8rem; }
            .footer-message p { font-size: 1.1rem; }
        }
        
        .back-btn {
            display: inline-block;
            margin-top: 40px;
            padding: 15px 40px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-size: 1.1rem;
            transition: all 0.3s;
            box-shadow: 0 5px 20px rgba(238,90,90,0.3);
        }
        
        .back-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 30px rgba(238,90,90,0.4);
        }
    </style>
</head>
<body>
    <div class="particles" id="particles"></div>
    
    <div class="container">
        <div class="header">
            <h1 class="title">💕 520 💕</h1>
            <p class="subtitle">致我最爱的人LQQ</p>
            <div class="heart-line"></div>
        </div>
        
        <div class="poem-card">
            <h2 class="poem-title">时光的温柔</h2>
            <div class="poem-content">
                <div class="section">
                    <p>一天很短，</p>
                    <p>短得来不及拥抱清晨，就已经手握黄昏；</p>
                </div>
                
                <div class="section">
                    <p>一年很短，</p>
                    <p>短得来不及细品初春的殷红窦绿，就要打点素裹秋霜；</p>
                </div>
                
                <div class="section">
                    <p>一生很短，</p>
                    <p>短得来不及享用美好年华，就已经身处迟暮。</p>
                </div>
                
                <p class="final-line">而你，是我生命中最长的温柔。💝</p>
            </div>
        </div>
        
        <div class="footer-message">
            <h2>💖 爱你一万年 💖</h2>
            <p>
                <span style="font-size: 2.5rem; color: #c2185b; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">LQQ</span><br><br>
                在这个特别的日子里<br>
                只想对你说：<br>
                遇见你，是我最美的意外<br>
                陪伴你，是我最长情的告白<br><br>
                <strong>520，我爱你！</strong>
            </p>
            <p class="signature">—— 永远爱你的人</p>
            <a href="/" class="back-btn">← 返回首页</a>
        </div>
    </div>
    
    <script>
        // 创建漂浮的心形粒子
        const particlesContainer = document.getElementById('particles');
        const hearts = ['💕', '💖', '💗', '💝', '❤️', '🌸', '✨'];
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('span');
            particle.className = 'particle';
            particle.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
            particle.style.animationDelay = (Math.random() * 10) + 's';
            particle.style.fontSize = (Math.random() * 20 + 15) + 'px';
            particlesContainer.appendChild(particle);
        }
    </script>
</body>
</html>`;
    
    res.send(loveHtml);
});

app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>我的 AI 助手</title>
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
        .header-link { opacity: 0.95; font-size: 1.1rem; color: #bfdbfe; text-decoration: none; transition: color 0.2s ease; }
        .header-link:hover { color: white; text-decoration: underline; }
        .header-links { display: flex; gap: 15px; justify-content: center; margin-top: 15px; }

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
            .header-link {
                font-size: 0.95rem;
                color: #3b82f6;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            .header-link:hover {
                color: #2563eb;
                text-decoration: underline;
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
            <h1>🤖 我的 AI 助手</h1>
            <div class="header-links">
                <a href="/lq" class="header-link">💕 520</a>
                <a href="/feedback" class="header-link">💬 留言交流</a>
            </div>
        </div>

        <div class="mode-tabs">
            <button class="mode-tab active" id="tab-chat" onclick="switchMode('chat')">💬 AI 问答</button>
            <button class="mode-tab" id="tab-conversation" onclick="switchMode('conversation')">🤖 AI 对话</button>
            <button class="mode-tab" id="tab-analyze" onclick="switchMode('analyze')">📝 内容分析</button>
        </div>

        <div class="card">
            <div id="chatMode">
                <div class="tip-box">
                    <div class="tip-title">💡 AI 问答可以做什么</div>
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
                    <div class="tip-title">💡 AI 对话功能</div>
                    <ul>
                        <li>与 AI 进行多轮对话</li>
                        <li>支持查看对话历史</li>
                        <li>上下文理解更准确</li>
                        <li>连续提问更方便</li>
                    </ul>
                </div>

                <div class="chat-messages" id="conversationMessages">
                    <div class="chat-message assistant">
                        <div class="message-bubble">你好！我是你的 AI 助手，有什么可以帮助你的吗？</div>
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
            <div>AI 服务由通义千问提供</div>
            <div class="brand">POWER BY TANLIN@2026</div>
        </div>
    </div>

    <script>
        let currentMode = 'chat';
        let conversationHistory = [];

        function switchMode(mode) {
            currentMode = mode;

            document.querySelectorAll('.mode-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.getElementById('tab-' + mode).classList.add('active');

            document.getElementById('chatMode').classList.add('hidden');
            document.getElementById('analyzeMode').classList.add('hidden');
            document.getElementById('conversationMode').classList.add('hidden');

            document.getElementById(mode + 'Mode').classList.remove('hidden');
        }

        const chatQuestionInput = document.getElementById('chatQuestionInput');
        const chatSubmitBtn = document.getElementById('chatSubmitBtn');
        const chatLoading = document.getElementById('chatLoading');
        const chatErrorMessage = document.getElementById('chatErrorMessage');
        const chatErrorText = document.getElementById('chatErrorText');
        const chatResultContainer = document.getElementById('chatResultContainer');
        const chatResultIcon = document.getElementById('chatResultIcon');
        const chatResultTitle = document.getElementById('chatResultTitle');
        const chatSummaryContent = document.getElementById('chatSummaryContent');

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

                const text = await response.text();
                
                if (!response.ok) {
                    let errorMsg = '请求失败';
                    try {
                        const errorData = JSON.parse(text);
                        errorMsg = errorData.error || errorData.summary || errorMsg;
                    } catch (e) {
                        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                            errorMsg = '服务器错误，请稍后重试';
                        } else {
                            errorMsg = text.substring(0, 100) || errorMsg;
                        }
                    }
                    throw new Error(errorMsg);
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('响应格式错误，请稍后重试');
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

        const analyzeUrlInput = document.getElementById('analyzeUrlInput');
        const analyzeContentInput = document.getElementById('analyzeContentInput');
        const analyzePromptInput = document.getElementById('analyzePromptInput');
        const analyzeSubmitBtn = document.getElementById('analyzeSubmitBtn');
        const analyzeLoading = document.getElementById('analyzeLoading');
        const analyzeErrorMessage = document.getElementById('analyzeErrorMessage');
        const analyzeErrorText = document.getElementById('analyzeErrorText');
        const analyzeResultContainer = document.getElementById('analyzeResultContainer');
        const analyzeResultIcon = document.getElementById('analyzeResultIcon');
        const analyzeResultTitle = document.getElementById('analyzeResultTitle');
        const analyzeSummaryContent = document.getElementById('analyzeSummaryContent');

        async function submitAnalyze() {
            const url = analyzeUrlInput.value.trim();
            const content = analyzeContentInput.value.trim();
            const prompt = analyzePromptInput.value.trim();

            if (!url && !content) {
                showAnalyzeError('请输入网页地址或内容文本');
                return;
            }

            if (url && content) {
                showAnalyzeError('网页地址和内容只能输入一项');
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
                    body: JSON.stringify({
                        mode: 'analyze',
                        url,
                        content,
                        prompt
                    })
                });

                const text = await response.text();
                
                if (!response.ok) {
                    let errorMsg = '请求失败';
                    try {
                        const errorData = JSON.parse(text);
                        errorMsg = errorData.error || errorData.summary || errorMsg;
                    } catch (e) {
                        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                            errorMsg = '服务器错误，请稍后重试';
                        } else {
                            errorMsg = text.substring(0, 100) || errorMsg;
                        }
                    }
                    throw new Error(errorMsg);
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('响应格式错误，请稍后重试');
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

        const conversationInput = document.getElementById('conversationInput');
        const conversationSendBtn = document.getElementById('conversationSendBtn');
        const conversationMessages = document.getElementById('conversationMessages');
        const conversationLoading = document.getElementById('conversationLoading');
        const conversationErrorMessage = document.getElementById('conversationErrorMessage');
        const conversationErrorText = document.getElementById('conversationErrorText');

        async function sendConversation() {
            const message = conversationInput.value.trim();
            if (!message) {
                showConversationError('请输入消息');
                return;
            }

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

                const text = await response.text();
                
                if (!response.ok) {
                    let errorMsg = '请求失败';
                    try {
                        const errorData = JSON.parse(text);
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch (e) {
                        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                            errorMsg = '服务器错误，请稍后重试';
                        } else {
                            errorMsg = text.substring(0, 100) || errorMsg;
                        }
                    }
                    throw new Error(errorMsg);
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('响应格式错误，请稍后重试');
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

    res.send(html);
});

app.post('/api/conversation', async (req, res) => {
    const { history } = req.body;

    if (!Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: '对话历史不能为空' });
    }

    try {
        const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            model: 'qwen-turbo',
            messages: history
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-5b0ae74df47a459985325ddeb221bb7e'
            }
        });

        const result = response.data.choices?.[0]?.message?.content || '';
        res.json({ summary: result });
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || '请求失败';
        res.status(500).json({ error: errorMsg });
    }
});

app.post('/api/summarize', async (req, res) => {
    const { url, mode, question } = req.body;

    if (mode === 'chat' && question) {
        try {
            const response = await axios.post('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                model: 'qwen-turbo',
                messages: [{ role: 'user', content: question }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sk-5b0ae74df47a459985325ddeb221bb7e'
                }
            });

            const result = response.data.choices?.[0]?.message?.content || '';
            res.json({ summary: result, title: 'AI 回答' });
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || '请求失败';
            res.status(500).json({ error: errorMsg, summary: errorMsg, title: '错误' });
        }
        return;
    }

    if (!url) {
        return res.status(400).json({ error: '请输入网页地址', summary: '请输入网页地址', title: '错误' });
    }

    try {
        const response = await axios.post('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
            model: 'qwen-turbo',
            input: { prompt: '请分析这个网页的内容并给出摘要：' + url },
            parameters: {}
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-5b0ae74df47a459985325ddeb221bb7e'
            }
        });

        res.json({ summary: response.data.output?.text || '暂无摘要', title: 'AI 分析' });
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || '请求失败';
        res.status(500).json({ error: errorMsg, summary: errorMsg, title: '错误' });
    }
});

app.get('/api/feedback', (req, res) => {
    res.json({ messages: feedbackMessages });
});

app.post('/api/feedback', (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: '请输入留言内容' });
    }

    const feedbackEntry = {
        id: Date.now(),
        time: new Date().toLocaleString('zh-CN'),
        content: content,
        replies: []
    };

    feedbackMessages.unshift(feedbackEntry);
    res.json({ success: true, message: '留言提交成功' });
});

app.listen(PORT, () => {
    console.log('\n✅ 本地服务器运行在 http://localhost:' + PORT);
    console.log('📝 请在浏览器中访问上述地址\n');
});
