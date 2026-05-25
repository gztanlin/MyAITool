let feedbackMessages = [];

// 聊天消息存储
let chatMessages = [];

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

const CHAT_STORE_KEY = 'lq_chat_messages';
const ONLINE_STORE_KEY = 'lq_chat_online';
const FEEDBACK_STORE_KEY = 'feedback_messages';
const HEARTBEAT_INTERVAL = 20000; // 20秒心跳一次
const HEARTBEAT_TIMEOUT = 60000; // 60秒超时

class KVStorage {
    constructor(namespace, kvBinding = null) {
        this.namespace = namespace || process.env.EDGEKV_NAMESPACE || 'chat-store';
        this.kvBinding = kvBinding;
    }
    
    getEdgeKV() {
        if (typeof EdgeKV === 'undefined') {
            console.log('EdgeKV is not defined, cannot create instance');
            return null;
        }
        if (!this.namespace || this.namespace.trim() === '') {
            console.log('Namespace is empty or invalid:', this.namespace);
            return null;
        }
        try {
            // 阿里云 ESA: EdgeKV 需要 id 和 namespace 两个参数
            const edgeKv = new EdgeKV({ 
                namespace: this.namespace,
                id: this.namespace // 使用 namespace 名称作为 ID
            });
            console.log('EdgeKV instance created for namespace:', this.namespace);
            return edgeKv;
        } catch (e) {
            console.log('EdgeKV init error:', e.message || e);
            return null;
        }
    }
    
    async get(key) {
        if (!key || key.trim() === '') {
            console.log('KV get error: key is empty');
            return null;
        }
        
        if (this.kvBinding) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('KV get timeout')), 5000);
                });
                const value = await Promise.race([this.kvBinding.get(key, { type: 'text' }), timeoutPromise]);
                console.log('KV binding get success for key:', key, 'has value:', value ? 'yes' : 'no');
                return value;
            } catch (e) {
                console.log('KV binding get error for key:', key, '-', e.message || e);
                return null;
            }
        }
        
        const edgeKv = this.getEdgeKV();
        console.log('EdgeKV instance:', edgeKv ? 'created' : 'NULL');
        if (edgeKv) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('EdgeKV get timeout')), 5000);
                });
                const value = await Promise.race([edgeKv.get(key), timeoutPromise]);
                console.log('KV get success for key:', key, 'has value:', value ? 'yes' : 'no');
                return value;
            } catch (e) {
                console.log('KV get error for key:', key, '-', e.message || e);
                return null;
            }
        }
        
        console.log('KV not available for namespace:', this.namespace);
        return null;
    }
    
    async put(key, value) {
        if (!key || key.trim() === '') {
            console.log('KV put error: key is empty');
            return false;
        }
        if (value === undefined || value === null) {
            console.log('KV put error: value is null/undefined for key:', key);
            return false;
        }
        
        console.log('KV put attempt for key:', key, 'namespace:', this.namespace, 'kvBinding:', !!this.kvBinding);
        
        if (this.kvBinding) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('KV put timeout')), 5000);
                });
                await Promise.race([this.kvBinding.put(key, value), timeoutPromise]);
                console.log('KV binding put success for key:', key);
                return true;
            } catch (e) {
                console.log('KV binding put error for key:', key, '-', e.message || e);
                return false;
            }
        }
        
        const edgeKv = this.getEdgeKV();
        console.log('EdgeKV instance:', edgeKv ? 'created' : 'NULL');
        if (edgeKv) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('EdgeKV put timeout')), 5000);
                });
                await Promise.race([edgeKv.put(key, value), timeoutPromise]);
                console.log('KV put success for key:', key);
                return true;
            } catch (e) {
                console.log('KV put error for key:', key, '-', e.message || e);
                return false;
            }
        } else {
            console.log('KV not available for namespace:', this.namespace, '- KV put FAILED');
            return false;
        }
    }
}

export default {
    async fetch(req, env) {
        const { url, method, headers } = req;
        
        // 阿里云 ESA: 使用 EDGEKV_NAMESPACE 环境变量，不依赖 env 绑定
        const kvNamespace = env.EDGEKV_NAMESPACE || 'chat-store';
        const chatStore = new KVStorage(kvNamespace);
        const onlineStore = new KVStorage(kvNamespace);
        const feedbackStore = new KVStorage('feedback-kv');
        
        // Load feedback messages from KV
        if (feedbackMessages.length === 0) {
            const stored = await feedbackStore.get(FEEDBACK_STORE_KEY);
            if (stored) {
                try {
                    feedbackMessages = JSON.parse(stored);
                } catch (e) {}
            }
        }
        
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
        
        if (pathname === '/api/chat/online') {
            if (method === 'POST') {
                try {
                    const body = await req.json();
                    const userId = body.userId;
                    const username = body.username;
                    
                    if (!userId || !username) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Missing userId or username' }),
                            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                        );
                    }
                    
                    let onlineUsers = {};
                    try {
                        const stored = await onlineStore.get(ONLINE_STORE_KEY);
                        if (stored) {
                            onlineUsers = JSON.parse(stored);
                        }
                    } catch (e) {}
                    
                    const now = Date.now();
                    for (const id in onlineUsers) {
                        if (now - onlineUsers[id].lastHeartbeat > HEARTBEAT_TIMEOUT) {
                            delete onlineUsers[id];
                        }
                    }
                    
                    onlineUsers[userId] = {
                        username: username,
                        lastHeartbeat: now
                    };
                    
                    await onlineStore.put(ONLINE_STORE_KEY, JSON.stringify(onlineUsers));
                    
                    return new Response(
                        JSON.stringify({ success: true, onlineCount: Object.keys(onlineUsers).length }),
                        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                    );
                } catch (e) {
                    return new Response(
                        JSON.stringify({ success: false, error: 'Invalid request' }),
                        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                    );
                }
            } else if (method === 'GET') {
                let onlineUsers = {};
                try {
                    const stored = await onlineStore.get(ONLINE_STORE_KEY);
                    if (stored) {
                        onlineUsers = JSON.parse(stored);
                    }
                } catch (e) {}
                
                const now = Date.now();
                for (const id in onlineUsers) {
                    if (now - onlineUsers[id].lastHeartbeat > HEARTBEAT_TIMEOUT) {
                        delete onlineUsers[id];
                    }
                }
                
                await onlineStore.put(ONLINE_STORE_KEY, JSON.stringify(onlineUsers));
                
                return new Response(
                    JSON.stringify({ success: true, onlineCount: Object.keys(onlineUsers).length }),
                    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                );
            }
        }
        
        if (pathname === '/api/chat/messages') {
            if (method === 'POST') {
                try {
                    const body = await req.json();
                    const now = Date.now();
                    const clientId = body.clientId || generateId(); // 使用客户端提供的 clientId 或生成新 ID
                    const newMessage = {
                        id: generateId(),
                        clientId: clientId, // 客户端唯一标识，用于去重
                        user: body.user || '匿名用户',
                        content: body.content,
                        time: getCurrentTime(),
                        timestamp: now,
                        readBy: {} // 初始化已读记录
                    };
                    
                    // 发送者立即标记为已读
                    newMessage.readBy[body.user] = now;
                    
                    // 增加重试机制确保KV写入成功（每次重试前重新读取最新数据以避免竞态条件）
                    const MAX_RETRIES = 5;
                    let saved = false;
                    let storedMessages = [];
                    
                    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                        // 每次重试前重新读取最新数据
                        try {
                            const stored = await chatStore.get(CHAT_STORE_KEY);
                            if (stored) {
                                storedMessages = JSON.parse(stored);
                            } else {
                                storedMessages = [];
                            }
                        } catch (e) {
                            console.log('KV get failed on attempt', attempt + 1, ':', e);
                        }
                        
                        // 检查消息是否已存在（通过 clientId 防止重复添加）
                        const existingMsg = storedMessages.find(msg => msg.clientId === clientId);
                        if (existingMsg) {
                            console.log('Message with same clientId already exists, skipping duplicate');
                            saved = true;
                            break;
                        }
                        
                        storedMessages.push(newMessage);
                        if (storedMessages.length > 100) {
                            storedMessages = storedMessages.slice(-100);
                        }
                        
                        const result = await chatStore.put(CHAT_STORE_KEY, JSON.stringify(storedMessages));
                        if (result) {
                            // 验证写入是否成功：重新读取并检查消息是否存在
                            try {
                                const verifyStored = await chatStore.get(CHAT_STORE_KEY);
                                if (verifyStored) {
                                    const verifyMessages = JSON.parse(verifyStored);
                                    const messageExists = verifyMessages.some(msg => msg.id === newMessage.id);
                                    if (messageExists) {
                                        saved = true;
                                        console.log('Message verified in KV on attempt', attempt + 1);
                                        break;
                                    } else {
                                        console.log('Message NOT found in KV after put, retrying...');
                                    }
                                } else {
                                    console.log('KV returned empty after put, retrying...');
                                }
                            } catch (e) {
                                console.log('Verification read failed:', e.message || e);
                            }
                            // 验证失败，继续重试
                            storedMessages.pop();
                            if (attempt < MAX_RETRIES - 1) {
                                await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                            }
                        } else {
                            console.log('KV put failed, attempt', attempt + 1);
                            storedMessages.pop();
                            if (attempt < MAX_RETRIES - 1) {
                                await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
                            }
                        }
                    }
                    
                    // 如果保存失败，返回错误给客户端
                    if (!saved) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'Failed to save message to server', message: newMessage }),
                            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                        );
                    }
                    
                    return new Response(
                        JSON.stringify({ success: true, message: newMessage, total: storedMessages.length, saved: saved }),
                        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                    );
                } catch (e) {
                    console.log('POST error:', e);
                    return new Response(
                        JSON.stringify({ success: false, error: 'Invalid request' }),
                        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                    );
                }
            } else if (method === 'GET') {
                // 定时清理：每2小时清理一次2小时前已读的消息
                const TWO_HOURS = 2 * 60 * 60 * 1000;
                const now = Date.now();
                
                // 从KV获取上次清理时间
                let lastCleanupTime = 0;
                try {
                    const lastCleanupStr = await chatStore.get('lq_cleanup_time');
                    if (lastCleanupStr) {
                        lastCleanupTime = parseInt(lastCleanupStr, 10);
                    }
                } catch (e) {
                    console.log('Get last cleanup time failed:', e);
                }
                
                // 如果超过2小时，执行清理
                if (now - lastCleanupTime > TWO_HOURS) {
                    try {
                        const stored = await chatStore.get(CHAT_STORE_KEY);
                        if (stored) {
                            let messages = JSON.parse(stored);
                            const beforeCount = messages.length;
                            
                            // 过滤掉：1) 超过2小时 且 2) 已被其他人阅读（readBy中有非发送者记录）
                            messages = messages.filter(msg => {
                                const age = now - (msg.timestamp || 0);
                                const isOld = age > TWO_HOURS;
                                
                                // 检查是否已被其他人阅读
                                let hasOtherReader = false;
                                if (msg.readBy && typeof msg.readBy === 'object') {
                                    const readers = Object.keys(msg.readBy);
                                    hasOtherReader = readers.some(reader => reader !== msg.user);
                                }
                                
                                // 保留条件：不是旧消息 或者 未被其他人阅读
                                return !(isOld && hasOtherReader);
                            });
                            
                            const afterCount = messages.length;
                            if (beforeCount !== afterCount) {
                                console.log(`Cleanup: removed ${beforeCount - afterCount} old read messages`);
                                await chatStore.put(CHAT_STORE_KEY, JSON.stringify(messages));
                            }
                        }
                        
                        // 更新上次清理时间
                        await chatStore.put('lq_cleanup_time', now.toString());
                    } catch (e) {
                        console.log('Cleanup error:', e);
                    }
                }
                
                // 获取消息（只从服务器获取，不使用本地存储）
                let chatMessages = [];
                let hasData = false;
                try {
                    const stored = await chatStore.get(CHAT_STORE_KEY);
                    if (stored) {
                        chatMessages = JSON.parse(stored);
                        hasData = true;
                    }
                } catch (e) {
                    console.log('KV get failed:', e);
                }
                
                // 如果 KV 为空，不执行任何写入操作，避免覆盖数据
                if (!hasData) {
                    console.log('KV is empty, skipping sync');
                    return new Response(
                        JSON.stringify({ success: true, messages: [], onlineCount: 0 }),
                        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                    );
                }
                
                // 获取阅读者参数
                const urlObj = new URL(req.url, 'http://localhost');
                const reader = urlObj.searchParams.get('reader');
                
                let messageUpdated = false;
                chatMessages.forEach(msg => {
                    // 初始化 readBy 如果不存在
                    if (!msg.readBy) {
                        msg.readBy = {};
                    }
                    
                    // 如果有阅读者参数，标记已读（但不标记发送者）
                    if (reader && reader !== msg.user && (!msg.readBy[reader] || msg.readBy[reader] !== now)) {
                        msg.readBy[reader] = now;
                        messageUpdated = true;
                    }
                });
                
                // 只有当消息状态实际发生变化时才同步到KV
                if (messageUpdated) {
                    try {
                        await chatStore.put(CHAT_STORE_KEY, JSON.stringify(chatMessages));
                    } catch (e) {
                        console.log('KV sync failed:', e);
                    }
                }
                
                return new Response(
                    JSON.stringify({ success: true, messages: chatMessages, onlineCount: chatMessages.length }),
                    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
                );
            }
        }
        
        if (pathname === '/lq') {
            const urlObj = new URL(url, 'http://localhost');
            const password = urlObj.searchParams.get('pass');
            const correctPassword = 'lqq';
            const username = urlObj.searchParams.get('name');
            
            // 检查是否有登录标记cookie
            const hasLoginCookie = headers.get('Cookie')?.includes('lq_login=1');
            
            if (password !== correctPassword || !username) {
                return new Response(
                    `<!DOCTYPE html>
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
            font-family: Georgia, serif;
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
        .lock-icon { font-size: 4rem; margin-bottom: 20px; }
        .title {
            font-size: 2rem;
            color: #ff6b9d;
            margin-bottom: 30px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 10px;
            color: #fff;
            font-size: 1.1rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }
        .form-input {
            width: 100%;
            padding: 15px 20px;
            font-size: 1.2rem;
            border: 2px solid #ffc8dd;
            border-radius: 30px;
            outline: none;
            transition: all 0.3s;
            text-align: center;
        }
        .form-input:focus {
            border-color: #ff6b9d;
            box-shadow: 0 0 20px rgba(255, 107, 157, 0.3);
        }
        .submit-btn {
            margin-top: 30px;
            padding: 15px 60px;
            font-size: 1.2rem;
            background: linear-gradient(135deg, #ff6b9d 0%, #ff8fab 100%);
            color: white;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 8px 30px rgba(255, 107, 157, 0.4);
        }
        .submit-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 40px rgba(255, 107, 157, 0.5);
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="lock-icon">🔐</div>
        <h1 class="title">💕 请输入密码</h1>
        <div class="form-group">
            <label>你是谁？</label>
            <select class="form-input" id="username">
                <option value="">请选择</option>
                <option value="LONG">LONG</option>
                <option value="TAN">TAN</option>
            </select>
        </div>
        <div class="form-group">
            <label>请输入密码</label>
            <input type="password" class="form-input" id="password" placeholder="请输入密码" />
        </div>
        <button class="submit-btn" onclick="submitPassword()">解锁浪漫</button>
    </div>
    <script>
        function submitPassword() {
            const password = document.getElementById('password').value;
            const username = document.getElementById('username').value;
            if (!username) {
                alert('请选择你的名字！');
                return;
            }
            if (password !== 'lqq') {
                alert('密码错误，请重新输入！');
                return;
            }
            // 设置登录标记cookie
            document.cookie = 'lq_login=1; path=/; max-age=3600';
            window.location.href = '/lq?pass=' + encodeURIComponent(password) + '&name=' + encodeURIComponent(username);
        }
        document.getElementById('password').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') submitPassword();
        });
        document.getElementById('username').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') submitPassword();
        });
    </script>
</body>
</html>`,
                    { headers: { 'Content-Type': 'text/html' } }
                );
            }
            
            // 验证必须从登录页面进入（检查cookie）
            if (!hasLoginCookie) {
                return new Response(
                    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💕 请从登录页面进入</title>
    <style>
        body {
            min-height: 100vh;
            background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
            font-family: Georgia, serif;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: rgba(255,255,255,0.95);
            border-radius: 30px;
            padding: 60px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            text-align: center;
            max-width: 450px;
            width: 100%;
        }
        .icon { font-size: 4rem; margin-bottom: 20px; }
        .title { font-size: 1.8rem; color: #ff6b9d; margin-bottom: 20px; }
        .desc { color: #666; margin-bottom: 30px; }
        .btn {
            padding: 15px 40px;
            background: linear-gradient(135deg, #ff6b9d 0%, #ff8fab 100%);
            color: white;
            border: none;
            border-radius: 30px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { transform: translateY(-3px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <h1 class="title">💕 请从登录页面进入</h1>
        <p class="desc">为了保证你的安全，请返回登录页面，输入密码后进入。</p>
        <a href="/lq" class="btn">返回登录</a>
    </div>
</body>
</html>`,
                    { headers: { 'Content-Type': 'text/html' } }
                );
            }
            
            return new Response(
                `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💕 专属聊天室</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            background: linear-gradient(135deg, #ff6b9d 0%, #ffc8dd 25%, #ff9a9e 50%, #fecfef 75%, #ff6b9d 100%);
            font-family: Georgia, serif;
            overflow-x: hidden;
            position: relative;
        }
        .petal-container {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; overflow: hidden; z-index: 0;
        }
        .petal {
            position: absolute; width: 60px; height: 80px;
            background: linear-gradient(135deg, #ff6b9d 0%, #ff8fab 50%, #ffc8dd 100%);
            border-radius: 50% 0 50% 50%; opacity: 0.7;
            animation: float 8s infinite ease-in-out;
            box-shadow: 0 2px 10px rgba(255, 107, 157, 0.3);
        }
        .petal:nth-child(odd) {
            background: linear-gradient(135deg, #ff8fab 0%, #ffa8b8 50%, #ffc8dd 100%);
            border-radius: 0 50% 50% 50%;
        }
        .petal:nth-child(1) { top: 10%; left: 10%; animation-delay: 0s; transform: rotate(30deg); }
        .petal:nth-child(2) { top: 20%; left: 80%; animation-delay: 1s; transform: rotate(60deg); }
        .petal:nth-child(3) { top: 30%; left: 20%; animation-delay: 2s; transform: rotate(90deg); }
        .petal:nth-child(4) { top: 40%; left: 60%; animation-delay: 3s; transform: rotate(120deg); }
        .petal:nth-child(5) { top: 50%; left: 30%; animation-delay: 4s; transform: rotate(150deg); }
        .petal:nth-child(6) { top: 60%; left: 70%; animation-delay: 5s; transform: rotate(180deg); }
        .petal:nth-child(7) { top: 70%; left: 40%; animation-delay: 6s; transform: rotate(210deg); }
        .petal:nth-child(8) { top: 80%; left: 50%; animation-delay: 7s; transform: rotate(240deg); }
        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0.7; }
            25% { transform: translateY(-20px) rotate(20deg) scale(1.1); opacity: 0.8; }
            50% { transform: translateY(-10px) rotate(-10deg) scale(0.9); opacity: 0.6; }
            75% { transform: translateY(-30px) rotate(10deg) scale(1.05); opacity: 0.75; }
        }
        .particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
        .container { max-width: 900px; margin: 0 auto; padding: 60px 20px; position: relative; z-index: 1; }
        .header { text-align: center; margin-bottom: 40px; }
        .title {
            font-size: 3rem; color: #fff;
            text-shadow: 3px 3px 10px rgba(0,0,0,0.5), 0 0 30px rgba(233,30,99,0.5);
            margin-bottom: 15px; animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .subtitle { font-size: 1.5rem; color: #fff; text-shadow: 2px 2px 8px rgba(0,0,0,0.5); }
        .heart-line { width: 100px; height: 3px; background: linear-gradient(90deg, transparent, #fff, transparent); margin: 30px auto; }
        .poem-card {
            background: rgba(255,255,255,0.95); border-radius: 30px;
            padding: 50px; margin-bottom: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .poem-title {
            text-align: center; color: #ff6b9d; font-size: 1.8rem;
            margin-bottom: 30px; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        .poem-content { line-height: 2.2; color: #333; font-size: 1.1rem; }
        .section { margin-bottom: 25px; }
        .section p { margin: 8px 0; }
        .final-line {
            text-align: center; font-size: 1.3rem; color: #ff6b9d;
            margin-top: 30px; font-weight: bold;
        }
        .footer-message {
            text-align: center; margin-top: 40px; padding: 40px;
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
            border-radius: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .footer-message h2 {
            font-size: 2.5rem; color: #e91e63; margin-bottom: 20px;
        }
        .footer-message p {
            font-size: 1.4rem; color: #5d4037; line-height: 2;
        }
        .daily-message {
            text-align: center; margin-top: 30px; padding: 30px 40px;
            background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
            border-radius: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .daily-message p {
            font-size: 1.4rem; color: #5d4037; line-height: 1.8;
        }
        .signature {
            margin-top: 30px; font-size: 1.2rem; color: #999; font-style: italic;
        }
        .chat-container {
            background: rgba(255,255,255,0.95); border-radius: 30px;
            padding: 30px 30px 0; margin-top: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .chat-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 20px; padding-bottom: 15px;
            border-bottom: 2px solid #ffc8dd;
        }
        .chat-header h3 {
            font-size: 1.8rem; color: #e91e63; margin: 0;
        }
        .online-count {
            background: linear-gradient(135deg, #ff6b9d, #ff8fab);
            color: white; padding: 8px 20px; border-radius: 20px;
            font-size: 1rem; font-weight: bold;
        }
        .name-selector select {
            padding: 8px 15px; border: 2px solid #ffc8dd;
            border-radius: 20px; background: rgba(255, 240, 245, 0.9);
            color: #e91e63; font-size: 1rem; font-weight: bold;
            cursor: pointer; outline: none;
        }
        .name-selector select:hover {
            border-color: #ff6b9d;
        }
        .chat-input input:disabled {
            background: rgba(200, 200, 200, 0.5);
            cursor: not-allowed;
        }
        .chat-input button:disabled {
            opacity: 0.6; cursor: not-allowed;
        }
        .chat-messages {
            height: 450px; overflow-y: auto;
            padding: 15px; background: rgba(255, 240, 245, 0.5);
            border-radius: 20px; margin-bottom: 20px;
        }
        .chat-messages::-webkit-scrollbar {
            width: 6px;
        }
        .chat-messages::-webkit-scrollbar-track {
            background: #ffe4ec; border-radius: 3px;
        }
        .chat-messages::-webkit-scrollbar-thumb {
            background: #ff8fab; border-radius: 3px;
        }
        .message {
            margin-bottom: 15px; padding: 12px 18px;
            background: linear-gradient(135deg, #fff, #ffe4ec);
            border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            max-width: 75%;
        }
        .message.me {
            margin-left: auto;
            background: linear-gradient(135deg, #ffe4ec, #fff0f5);
            border: 2px solid #ff6b9d;
        }
        .message.other {
            margin-right: auto;
        }
        .message-user {
            font-weight: bold; color: #e91e63; margin-bottom: 5px;
        }
        .message-content {
            color: #333; line-height: 1.5;
        }
        .message-time {
            font-size: 0.8rem; color: #999; margin-top: 5px;
        }
        .message-status {
            font-size: 0.7rem; margin-left: 8px; padding: 2px 6px;
            border-radius: 10px; display: inline-block;
        }
        .message-status.sending {
            background: #ffc107; color: #333;
        }
        .message-status.unread {
            background: #6c757d; color: white;
        }
        .message-status.read {
            background: #28a745; color: white;
        }
        .message-status.failed {
            background: #dc3545; color: white;
        }
        .system-message {
            text-align: center; color: #ff6b9d;
            font-style: italic; padding: 10px;
        }
        .chat-input {
            display: flex;
            align-items: stretch;
            gap: 0;
            padding: 0;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
            width: calc(100% + 60px);
            margin: 0 -30px -30px;
        }
        .chat-input textarea {
            flex: 1;
            padding: 16px 90px 16px 20px;
            border: none;
            border-radius: 0 0 0 30px;
            background: rgba(255, 240, 245, 0.6);
            font-size: 1rem;
            outline: none;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
            transition: all 0.3s;
            resize: none;
            min-height: 80px;
            max-height: 180px;
            line-height: 1.5;
            font-family: inherit;
            margin: 0;
        }
        .chat-input textarea:focus {
            background: rgba(255, 240, 245, 0.9);
            box-shadow: inset 0 2px 10px rgba(255, 107, 157, 0.1);
        }
        .chat-input textarea::placeholder {
            color: rgba(255, 107, 157, 0.5);
        }
        .emoji-btn {
            position: absolute;
            right: 12px;
            bottom: 12px;
            padding: 6px;
            background: transparent;
            border: none;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 32px;
            height: 32px;
            opacity: 0.6;
            z-index: 10;
            box-shadow: none;
        }
        .emoji-btn:hover {
            transform: scale(1.1);
            opacity: 1;
            box-shadow: none;
        }
        .chat-input button {
            padding: 16px 25px;
            background: linear-gradient(135deg, #ff6b9d, #ff8fab);
            color: white;
            border: none;
            border-radius: 0 0 30px 0;
            font-size: 0.95rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 5px 20px rgba(255, 107, 157, 0.4);
            flex-shrink: 0;
            min-width: 70px;
            margin-left: -1px;
        }
        .chat-input button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 157, 0.5);
            background: linear-gradient(135deg, #ff7ba2, #ffa0b8);
        }
        .emoji-panel {
            position: absolute;
            bottom: 70px;
            left: 0;
            background: white;
            border-radius: 20px;
            padding: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            display: none;
            z-index: 100;
            width: 260px;
        }
        .emoji-panel.show {
            display: flex;
            gap: 8px;
        }
        .emoji-category-bar {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-right: 8px;
            border-right: 1px solid #ffe4ec;
            min-width: 28px;
        }
        .category-btn {
            padding: 2px 4px;
            background: transparent;
            border: none;
            border-radius: 6px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s;
            color: #ff6b9d;
            flex: none;
            text-align: center;
            min-width: 24px;
            height: 24px;
            line-height: 20px;
        }
        .category-btn:hover {
            background: rgba(255, 240, 245, 0.8);
        }
        .category-btn.active {
            background: rgba(255, 107, 157, 0.2);
            color: #e91e63;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
        }
        .emoji-item {
            font-size: 1.5rem;
            text-align: center;
            padding: 8px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .emoji-item:hover {
            background: rgba(255, 107, 157, 0.1);
            transform: scale(1.2);
        }
        .chat-input-wrapper {
            position: relative;
            flex: 1;
            display: flex;
            align-items: stretch;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            display: flex;
            justify-content: center;
            gap: 20px;
        }
        .back-btn, .login-btn {
            padding: 12px 25px;
            background: rgba(255,255,255,0.9);
            color: #ff6b9d;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .back-btn:hover, .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 107, 157, 0.3);
            background: white;
        }
        
        /* 响应式布局 */
        @media (max-width: 600px) {
            .chat-container {
                padding: 15px;
                border-radius: 20px;
            }
            .chat-header {
                padding: 12px 15px;
                gap: 10px;
            }
            .chat-header h3 {
                font-size: 1rem;
            }
            .online-count {
                font-size: 0.8rem;
            }
            .chat-messages {
                min-height: 300px;
                max-height: 400px;
            }
            .chat-input {
                gap: 8px;
                padding: 8px 10px;
                border-radius: 20px;
            }
            .chat-input textarea {
                padding: 12px 16px;
                font-size: 0.9rem;
                min-height: 42px;
                max-height: 80px;
            }
            .emoji-btn {
                width: 30px;
                height: 30px;
                padding: 6px;
                font-size: 0.9rem;
                background: transparent;
                box-shadow: none;
            }
            .chat-input button {
                padding: 10px 20px;
                font-size: 0.85rem;
                min-width: 60px;
            }
            .emoji-panel {
                width: 250px;
                bottom: 65px;
            }
            .emoji-grid {
                grid-template-columns: repeat(7, 1fr);
                gap: 6px;
            }
            .emoji-item {
                font-size: 1.3rem;
                padding: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="petal-container">
        <div class="petal"></div><div class="petal"></div><div class="petal"></div><div class="petal"></div>
        <div class="petal"></div><div class="petal"></div><div class="petal"></div><div class="petal"></div>
    </div>
    <div class="particles" id="particles"></div>
    <div class="container">
        <div class="daily-message">
            <p id="romanticText"></p>
        </div>
        
        <div class="chat-container">
            <div class="chat-header">
                <h3>💬 专属聊天室</h3>
                <span class="online-count" id="onlineCount">💕 共 0 条消息</span>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="system-message">💕 欢迎来到浪漫聊天室！</div>
            </div>
            <div class="chat-input">
                <div class="chat-input-wrapper">
                    <button class="emoji-btn" id="emojiBtn">😊</button>
                    <textarea id="chatInput" placeholder="输入你的心声..." rows="2"></textarea>
                    <div class="emoji-panel" id="emojiPanel">
                        <div class="emoji-grid" id="emojiGrid"></div>
                    </div>
                </div>
                <button id="sendBtn" onclick="sendMessage()">发送 💌</button>
            </div>
        </div>
        
        <div class="footer">
            <a href="/" class="back-btn">🏠 返回首页</a>
            <a href="/lq" class="login-btn" onclick="logout()">🔄 重新登录</a>
        </div>
    </div>
    <script>
        // 退出登录函数
        function logout() {
            document.cookie = 'lq_login=; path=/; max-age=0';
            localStorage.removeItem('lqUserId');
        }
        
        // 浪漫句子数组（每天随机显示一段）
        const romanticMessages = [
            "💕 在时光长河中，你是我唯一想停靠的港湾。",
            "💖 世界很大，我的心很小，只装得下一个你。",
            "🌹 遇见你，是我今生最美的意外。",
            "💝 爱是一场温柔的冒险，而你是我唯一的目的地。",
            "✨ 你的名字，是我听过最美的情话。",
            "🌙 愿与你一起，从心动到古稀。",
            "💗 喜欢你，是我做过最认真的事。",
            "🌸 余生很长，我想和你一起浪费。",
            "💞 你是我生命中，最温暖的那束光。",
            "🎀 爱你，是我藏在心里的秘密。",
            "💓 你在，春华秋实夏蝉冬雪；你不在，春夏秋冬。",
            "💘 遇见你之前，我没想过永远；遇见你之后，我没想过别人。"
        ];
        
        // 根据日期获取句子（每天一段）
        function getTodayMessage() {
            const today = new Date();
            const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
            return romanticMessages[dayOfYear % romanticMessages.length];
        }
        
        // 显示今日浪漫句子
        document.getElementById('romanticText').textContent = getTodayMessage();
        
        // 加密密钥（简单混淆）
        const ENCRYPT_KEY = 'lqq520secret';
        
        // 简易加密函数
        function encrypt(str) {
            if (!str) return '';
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPT_KEY.charCodeAt(i % ENCRYPT_KEY.length));
            }
            return btoa(encodeURIComponent(result));
        }
        
        // 简易解密函数
        function decrypt(str) {
            if (!str) return '';
            try {
                const decoded = decodeURIComponent(atob(str));
                let result = '';
                for (let i = 0; i < decoded.length; i++) {
                    result += String.fromCharCode(decoded.charCodeAt(i) ^ ENCRYPT_KEY.charCodeAt(i % ENCRYPT_KEY.length));
                }
                return result;
            } catch (e) {
                return str;
            }
        }
        
        // 从URL获取用户名
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('name') || '访客';
        
        let userId = localStorage.getItem('lqUserId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
            localStorage.setItem('lqUserId', userId);
        }
        
        // 分类表情列表
        const emojiCategories = {
            '💕': ['💕', '💖', '💗', '💓', '💘', '💝', '💞', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '❤️‍🔥', '❤️‍🩹', '💟', '❣️'],
            '😊': ['😍', '🥰', '😘', '😗', '😙', '😚', '😊', '😇', '🤗', '😌', '😏', '😻', '😽', '😋', '🤤', '🤩', '🥴', '🥳'],
            '👫': ['💋', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩', '💑', '👫', '👭', '👬', '💏', '👪', '🫂', '🤝'],
            '🌹': ['🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌷', '💐'],
            '🎊': ['🎉', '🎊', '🎁', '🎀', '🎈', '💌', '🥂', '🍾', '🍷'],
            '✨': ['✨', '💫', '⭐', '🌟', '💥', '🔥', '🌈', '☀️', '🌙', '🌠', '🌌', '💎', '💍']
        };
        
        // 初始化表情面板
        function initEmojiPanel() {
            const emojiGrid = document.getElementById('emojiGrid');
            const emojiBtn = document.getElementById('emojiBtn');
            const emojiPanel = document.getElementById('emojiPanel');
            const chatInput = document.getElementById('chatInput');
            
            // 创建分类标签容器
            const categoryBar = document.createElement('div');
            categoryBar.className = 'emoji-category-bar';
            
            // 获取所有分类名称
            const categories = Object.keys(emojiCategories);
            let activeCategory = categories[0];
            
            // 创建分类按钮
            categories.forEach(category => {
                const btn = document.createElement('button');
                btn.className = 'category-btn';
                btn.textContent = category;
                btn.onclick = () => {
                    // 切换激活状态
                    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeCategory = category;
                    // 重新渲染表情
                    renderEmojis(category);
                };
                // 默认激活第一个分类
                if (category === activeCategory) {
                    btn.classList.add('active');
                }
                categoryBar.appendChild(btn);
            });
            
            // 添加分类栏到面板
            emojiPanel.insertBefore(categoryBar, emojiGrid);
            
            // 渲染表情函数
            function renderEmojis(category) {
                emojiGrid.innerHTML = '';
                const emojis = emojiCategories[category] || [];
                emojis.forEach(emoji => {
                    const emojiItem = document.createElement('div');
                    emojiItem.className = 'emoji-item';
                    emojiItem.textContent = emoji;
                    emojiItem.onclick = () => insertEmoji(emoji);
                    emojiGrid.appendChild(emojiItem);
                });
            }
            
            // 初始渲染第一个分类
            renderEmojis(activeCategory);
            
            // 切换表情面板显示
            emojiBtn.onclick = (e) => {
                e.stopPropagation();
                emojiPanel.classList.toggle('show');
            };
            
            // 点击其他地方关闭面板
            document.addEventListener('click', (e) => {
                if (!emojiPanel.contains(e.target) && e.target !== emojiBtn) {
                    emojiPanel.classList.remove('show');
                }
            });
        }
        
        // 插入表情到输入框光标位置
        function insertEmoji(emoji) {
            const chatInput = document.getElementById('chatInput');
            const startPos = chatInput.selectionStart;
            const endPos = chatInput.selectionEnd;
            
            const textBefore = chatInput.value.substring(0, startPos);
            const textAfter = chatInput.value.substring(endPos);
            
            chatInput.value = textBefore + emoji + textAfter;
            chatInput.focus();
            
            // 移动光标到插入位置之后
            const newCursorPos = startPos + emoji.length;
            chatInput.setSelectionRange(newCursorPos, newCursorPos);
            
            // 关闭表情面板
            document.getElementById('emojiPanel').classList.remove('show');
        }
        
        // 页面加载时自动获取消息
        loadMessages();
        fetchMessages();
        initEmojiPanel();
        
        const container = document.getElementById('particles');
        for(let i=0; i<30; i++) {
            const heart = document.createElement('div');
            heart.textContent = '❤️';
            heart.style.position = 'absolute';
            heart.style.fontSize = (Math.random()*20+10) + 'px';
            heart.style.left = (Math.random()*100) + '%';
            heart.style.top = (Math.random()*100) + '%';
            heart.style.opacity = Math.random()*0.5+0.3;
            heart.style.animation = 'floatHeart ' + (Math.random()*5+5) + 's infinite ease-in-out';
            heart.style.animationDelay = (Math.random()*5) + 's';
            container.appendChild(heart);
        }
        const style = document.createElement('style');
        style.textContent = '@keyframes floatHeart { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(10deg); } }';
        document.head.appendChild(style);
        
        async function sendHeartbeat() {
            try {
                const response = await fetch('/api/chat/online', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, username: username })
                });
                const data = await response.json();
                if (data.success) {
                    document.getElementById('onlineCount').textContent = '💕 ' + data.onlineCount + ' 人在线';
                }
            } catch (e) {
                console.log('Heartbeat failed:', e);
            }
        }
        
        async function fetchOnlineCount() {
            try {
                const response = await fetch('/api/chat/online');
                const data = await response.json();
                if (data.success) {
                    document.getElementById('onlineCount').textContent = '💕 ' + data.onlineCount + ' 人在线';
                }
            } catch (e) {
                console.log('Fetch online count failed:', e);
            }
        }
        
        async function fetchMessages() {
            try {
                // 从服务器获取消息，传递阅读者参数
                const response = await fetch('/api/chat/messages?reader=' + encodeURIComponent(username));
                const data = await response.json();
                if (data.success && data.messages) {
                    // 获取服务器返回的消息
                    const serverMessages = data.messages;
                    
                    // 按时间排序服务器消息
                    serverMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    
                    const messagesContainer = document.getElementById('chatMessages');
                    
                    // 获取所有消息元素
                    const allMessageEls = {};
                    messagesContainer.querySelectorAll('.message[data-id]').forEach(el => {
                        const id = el.getAttribute('data-id');
                        if (id) {
                            allMessageEls[id] = el;
                        }
                    });
                    
                    // 收集正在发送中的临时消息
                    const pendingMessages = {}; // content -> element
                    Object.values(allMessageEls).forEach(el => {
                        const id = el.getAttribute('data-id');
                        if (id && id.startsWith('temp_')) {
                            const content = el.querySelector('.message-content');
                            if (content) {
                                pendingMessages[content.textContent] = el;
                            }
                        }
                    });
                    
                    // 只添加新消息，不重新构建整个HTML
                    serverMessages.forEach(function(msg) {
                        const decryptedContent = decrypt(msg.content);
                        
                        // 如果有正在发送中的相同内容消息，更新那个临时消息
                        if (pendingMessages[decryptedContent]) {
                            const el = pendingMessages[decryptedContent];
                            // 更新临时消息为服务器消息
                            el.setAttribute('data-id', msg.id);
                            
                            // 更新消息状态
                            const statusSpan = el.querySelector('.message-status');
                            if (statusSpan && msg.user === username) {
                                const otherReaders = Object.keys(msg.readBy || {}).filter(r => r !== username);
                                if (otherReaders.length > 0) {
                                    statusSpan.className = 'message-status read';
                                    statusSpan.textContent = '对方已读';
                                } else {
                                    statusSpan.className = 'message-status unread';
                                    statusSpan.textContent = '对方未读';
                                }
                            }
                            // 标记为已处理
                            delete pendingMessages[decryptedContent];
                            return;
                        }
                        
                        // 如果消息已经显示（通过服务器ID），更新状态
                        const existingEl = allMessageEls[msg.id];
                        if (existingEl) {
                            if (msg.user === username) {
                                const otherReaders = Object.keys(msg.readBy || {}).filter(r => r !== username);
                                const statusEl = existingEl.querySelector('.message-status');
                                if (statusEl) {
                                    if (otherReaders.length > 0) {
                                        statusEl.className = 'message-status read';
                                        statusEl.textContent = '对方已读';
                                    } else {
                                        statusEl.className = 'message-status unread';
                                        statusEl.textContent = '对方未读';
                                    }
                                }
                            }
                            return;
                        }
                        
                        const isMe = msg.user === username;
                        const messageClass = isMe ? 'message me' : 'message other';
                        
                        // 计算消息状态
                        let statusHtml = '';
                        if (isMe) {
                            const otherReaders = Object.keys(msg.readBy || {}).filter(r => r !== username);
                            if (otherReaders.length > 0) {
                                statusHtml = '<span class="message-status read">对方已读</span>';
                            } else {
                                statusHtml = '<span class="message-status unread">对方未读</span>';
                            }
                        }
                        
                        // 创建新消息元素并添加到容器
                        const msgDiv = document.createElement('div');
                        msgDiv.className = messageClass;
                        msgDiv.setAttribute('data-id', msg.id);
                        msgDiv.innerHTML = '<div class="message-user">' + msg.user + '</div><div class="message-content">' + decryptedContent + '</div><div class="message-time">' + msg.time + statusHtml + '</div>';
                        messagesContainer.appendChild(msgDiv);
                    });
                    
                    // 滚动到底部
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } catch (e) {
                console.log('Fetch messages failed:', e);
            }
        }
        
        function loadMessages() {
            // 不再使用本地存储，由 fetchMessages 直接更新显示
        }
        
        async function sendMessage() {
            const input = document.getElementById('chatInput');
            const content = input.value.trim();
            if (!content) return;
            
            const encryptedContent = encrypt(content);
            
            const messagesContainer = document.getElementById('chatMessages');
            const messageClass = 'message me';
            const tempId = 'temp_' + Date.now();
            const clientId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9); // 生成唯一客户端ID
            const tempElement = document.createElement('div');
            tempElement.className = messageClass;
            tempElement.setAttribute('data-id', tempId);
            tempElement.innerHTML = '<div class="message-user">' + username + '</div><div class="message-content">' + content + '</div><div class="message-time">' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' <span class="message-status sending">发送中</span></div>';
            messagesContainer.appendChild(tempElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            input.value = '';
            
            let serverMessageId = null;
            let saveFailed = false;
            
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('请求超时')), 10000);
                });
                
                const response = await Promise.race([
                    fetch('/api/chat/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user: username, content: encryptedContent, clientId: clientId })
                    }),
                    timeoutPromise
                ]);
                
                const data = await response.json();
                if (data.success && data.message) {
                    serverMessageId = data.message.id;
                    tempElement.setAttribute('data-id', serverMessageId);
                    const statusSpan = tempElement.querySelector('.message-status');
                    if (statusSpan) {
                        statusSpan.className = 'message-status unread';
                        statusSpan.textContent = '对方未读';
                    }
                } else {
                    saveFailed = true;
                    const statusSpan = tempElement.querySelector('.message-status');
                    if (statusSpan) {
                        statusSpan.className = 'message-status failed';
                        statusSpan.textContent = '发送失败';
                    }
                    console.log('Server save failed:', data.error || 'Unknown error');
                }
            } catch (e) {
                saveFailed = true;
                const statusSpan = tempElement.querySelector('.message-status');
                if (statusSpan) {
                    statusSpan.className = 'message-status failed';
                    statusSpan.textContent = '发送失败';
                }
                console.log('Send message failed:', e);
            }
            
            // 重试函数：如果保存失败，自动重试
            let retryCount = 0;
            const maxRetries = 3;
            
            const retrySend = () => {
                if (serverMessageId) return;
                if (retryCount >= maxRetries) {
                    console.log('Max retries reached, giving up');
                    return;
                }
                
                retryCount++;
                console.log('Retrying send message, attempt', retryCount);
                
                fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: username, content: encryptedContent, clientId: clientId })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.message) {
                        serverMessageId = data.message.id;
                        saveFailed = false;
                        const messagesContainer = document.getElementById('chatMessages');
                        const el = messagesContainer.querySelector('[data-id="' + tempId + '"]');
                        if (el) {
                            el.setAttribute('data-id', serverMessageId);
                            const statusSpan = el.querySelector('.message-status');
                            if (statusSpan) {
                                statusSpan.className = 'message-status unread';
                                statusSpan.textContent = '对方未读';
                            }
                            console.log('Message saved successfully on retry', retryCount);
                        }
                    } else {
                        if (retryCount < maxRetries) {
                            setTimeout(retrySend, 1000 * retryCount);
                        }
                    }
                })
                .catch(e => {
                    console.log('Retry failed:', e);
                    if (retryCount < maxRetries) {
                        setTimeout(retrySend, 1000 * retryCount);
                    }
                });
            };
            
            if (saveFailed) {
                setTimeout(retrySend, 1000);
            }
        }
        
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        // 启动聊天功能
        sendHeartbeat();
        fetchOnlineCount();
        setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
        setInterval(fetchMessages, 5000); // 5秒刷新一次
        setInterval(fetchOnlineCount, 5000); // 5秒刷新一次在线人数
        document.getElementById('chatInput').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>`,
                    { headers: { 'Content-Type': 'text/html' } }
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
        
        .required {
            color: #ef4444;
            font-weight: 600;
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

        .messages-section {
            margin-top: 40px;
            border-top: 1px solid #e5e7eb;
            padding-top: 30px;
        }

        .messages-section h2 {
            font-size: 1.5rem;
            color: #1f2937;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .message-card {
            background: #f9fafb;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .message-time {
            color: #9ca3af;
            font-size: 0.875rem;
        }

        .message-name {
            font-weight: 600;
            color: #374151;
            font-size: 0.9375rem;
        }

        .message-content {
            color: #374151;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .message-replies {
            margin-top: 16px;
            padding-left: 20px;
            border-left: 3px solid #3b82f6;
        }

        .reply-card {
            background: white;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 10px;
            border: 1px solid #e5e7eb;
        }

        .reply-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }

        .reply-admin {
            color: #3b82f6;
            font-weight: 600;
            font-size: 0.875rem;
        }

        .reply-time {
            color: #9ca3af;
            font-size: 0.75rem;
        }

        .reply-content {
            color: #4b5563;
            line-height: 1.5;
            font-size: 0.9375rem;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .reply-form {
            margin-top: 12px;
            display: flex;
            gap: 10px;
        }

        .reply-form textarea {
            flex: 1;
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 0.9375rem;
            font-family: inherit;
            resize: none;
            min-height: 60px;
        }

        .reply-form textarea:focus {
            outline: none;
            border-color: #3b82f6;
            background: white;
        }

        .reply-form button {
            padding: 10px 20px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease;
        }

        .reply-form button:hover {
            background: #2563eb;
        }

        .reply-form button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: #9ca3af;
        }

        .empty-state .icon {
            font-size: 3rem;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💬 留言交流</h1>
            <p>欢迎留言，我会尽快回复您！</p>
        </div>

        <div class="messages-section">
            <h2>📋 留言记录</h2>
            <div id="messagesList"></div>
        </div>

        <form id="feedbackForm">
            <div class="form-group">
                <label>👤 您的称呼 <span class="required">*</span></label>
                <input type="text" id="feedbackName" placeholder="请输入您的称呼..." required>
            </div>

            <div class="form-group">
                <label>📝 您的留言</label>
                <textarea id="feedbackContent" placeholder="请输入您的留言、建议或问题..."></textarea>
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
        const feedbackName = document.getElementById('feedbackName');
        const feedbackContent = document.getElementById('feedbackContent');
        const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
        const feedbackLoading = document.getElementById('feedbackLoading');
        const feedbackErrorMessage = document.getElementById('feedbackErrorMessage');
        const feedbackErrorText = document.getElementById('feedbackErrorText');
        const feedbackSuccessMessage = document.getElementById('feedbackSuccessMessage');
        const messagesList = document.getElementById('messagesList');

        function showFeedbackError(message) {
            feedbackErrorText.textContent = message;
            feedbackErrorMessage.classList.add('show');
            setTimeout(() => {
                feedbackErrorMessage.classList.remove('show');
            }, 5000);
        }

        async function submitFeedback(e) {
            e.preventDefault();
            
            const name = feedbackName.value.trim();
            const content = feedbackContent.value.trim();

            if (!name) {
                showFeedbackError('请输入您的称呼');
                return;
            }
            
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
                    body: JSON.stringify({ name: name, content: content })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '提交失败');
                }

                feedbackSuccessMessage.classList.add('show');
                feedbackName.value = '';
                feedbackContent.value = '';
                loadMessages();

            } catch (error) {
                showFeedbackError(error.message);
            } finally {
                feedbackLoading.classList.remove('show');
                feedbackSubmitBtn.disabled = false;
            }
        }

        async function loadMessages() {
            try {
                const response = await fetch('/api/feedback');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || '加载失败');
                }

                renderMessages(data.messages || []);
            } catch (error) {
                console.error('加载留言失败:', error);
            }
        }

        function renderMessages(messages) {
            if (messages.length === 0) {
                messagesList.innerHTML = '<div class="empty-state">' +
                    '<div class="icon">💬</div>' +
                    '<p>暂无留言，快来发表第一条留言吧！</p>' +
                    '</div>';
                return;
            }

            messages.sort((a, b) => new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time));

            messagesList.innerHTML = messages.map(msg => {
                let repliesHtml = '';
                if (msg.replies && msg.replies.length > 0) {
                    repliesHtml = '<div class="message-replies">';
                    for (const reply of msg.replies) {
                        repliesHtml += '<div class="reply-card">' +
                            '<div class="reply-header">' +
                            '<span class="reply-admin">👤 管理员回复</span>' +
                            '<span class="reply-time">' + reply.time + '</span>' +
                            '</div>' +
                            '<div class="reply-content">' + escapeHtml(reply.content) + '</div>' +
                            '</div>';
                    }
                    repliesHtml += '</div>';
                }
                
                const name = escapeHtml(msg.name || '匿名用户');
                return '<div class="message-card">' +
                    '<div class="message-header">' +
                    '<span class="message-name">👤 ' + name + '</span>' +
                    '<span class="message-time">' + msg.time + '</span>' +
                    '</div>' +
                    '<div class="message-content">' + escapeHtml(msg.content) + '</div>' +
                    repliesHtml +
                    '<div class="reply-form" data-id="' + msg.id + '">' +
                    '<textarea placeholder="输入回复内容..."></textarea>' +
                    '<button type="button" onclick="submitReply(' + msg.id + ')">回复</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
        }

        async function submitReply(messageId) {
            const replyForm = document.querySelector('.reply-form[data-id="' + messageId + '"]');
            const textarea = replyForm.querySelector('textarea');
            const button = replyForm.querySelector('button');
            const content = textarea.value.trim();

            if (!content) {
                alert('请输入回复内容');
                return;
            }

            button.disabled = true;

            try {
                const response = await fetch('/api/feedback/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: messageId, content: content })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '回复失败');
                }

                textarea.value = '';
                loadMessages();

            } catch (error) {
                alert(error.message);
            } finally {
                button.disabled = false;
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        feedbackForm.addEventListener('submit', submitFeedback);
        
        loadMessages();
    </script>
</body>
</html>`,
                { headers: { 'Content-Type': 'text/html' } }
            );
        }
        
        if (pathname === '/') {
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
            <a href="/feedback" class="header-link">💬 留言交流</a>
        </div>

        <div class="mode-tabs">
            <button class="mode-tab active" id="tab-chat" onclick="switchMode('chat')">💬 AI 问答</button>
            <button class="mode-tab" id="tab-conversation" onclick="switchMode('conversation')">🤖 AI 对话</button>
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
        
        if (pathname === '/api/summarize' || pathname === '/api/conversation' || pathname === '/api/feedback' || pathname === '/api/feedback/reply') {
            if (method === 'GET' && pathname === '/api/feedback') {
                return new Response(
                    JSON.stringify({ messages: feedbackMessages }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            }
            
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
                    const { name, content } = requestData;
                    if (!content) {
                        return new Response(
                            JSON.stringify({ error: '请输入留言内容' }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }
                        );
                    }

                    const timestamp = Date.now();
                    const feedbackEntry = {
                        id: Date.now(),
                        time: new Date().toLocaleString('zh-CN'),
                        timestamp: timestamp,
                        name: name || '匿名用户',
                        content: content,
                        replies: []
                    };
                    
                    feedbackMessages.unshift(feedbackEntry);
                    
                    // Save to KV storage
                    await feedbackStore.put(FEEDBACK_STORE_KEY, JSON.stringify(feedbackMessages));

                    console.log('=== 收到新留言 ===');
                    console.log(`ID: ${feedbackEntry.id}`);
                    console.log(`时间: ${feedbackEntry.time}`);
                    console.log(`称呼: ${feedbackEntry.name}`);
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
                
                if (pathname === '/api/feedback/reply') {
                    const { id, content } = requestData;
                    if (!id || !content) {
                        return new Response(
                            JSON.stringify({ error: '缺少参数' }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }
                        );
                    }
                    
                    const message = feedbackMessages.find(m => m.id === id);
                    if (!message) {
                        return new Response(
                            JSON.stringify({ error: '留言不存在' }),
                            { status: 404, headers: { 'Content-Type': 'application/json' } }
                        );
                    }
                    
                    const timestamp = new Date().toLocaleString('zh-CN');
                    message.replies.push({
                        time: timestamp,
                        content: content
                    });
                    
                    // Save to KV storage
                    await feedbackStore.put(FEEDBACK_STORE_KEY, JSON.stringify(feedbackMessages));

                    console.log('=== 收到回复 ===');
                    console.log(`留言ID: ${id}`);
                    console.log(`时间: ${timestamp}`);
                    console.log(`内容: ${content}`);
                    console.log('====================');

                    return new Response(
                        JSON.stringify({
                            success: true,
                            message: '回复成功'
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
                        response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: 'qwen-turbo',
                                messages: messages
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
                    
                    if (!response.ok) {
                        let errorMsg = `API 请求失败: ${response.status}`;
                        try {
                            const errorData = JSON.parse(responseText);
                            errorMsg += ` - ${errorData.error?.message || errorData.message || responseText.substring(0, 200)}`;
                        } catch (e) {
                            errorMsg += ` - ${responseText.substring(0, 200)}`;
                        }
                        throw new Error(errorMsg);
                    }
                    
                    let result;
                    try {
                        result = JSON.parse(responseText);
                    } catch (e) {
                        throw new Error('无法解析 API 响应');
                    }
                    
                    const aiContent = result.choices?.[0]?.message?.content || '';
                    
                    return new Response(
                        JSON.stringify({ 
                            title: pathname === '/api/conversation' ? 'AI 对话' : (requestData.mode === 'chat' ? 'AI 回答' : 'AI 分析结果'), 
                            summary: aiContent,
                            provider: '通义千问'
                        }),
                        { headers: { 'Content-Type': 'application/json' } }
                    );
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
        .header-link { opacity: 0.95; font-size: 1.1rem; color: #bfdbfe; text-decoration: none; transition: color 0.2s ease; }
        .header-link:hover { color: white; text-decoration: underline; }
        
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
            <a href="/lq" class="header-link">💌 查收520专属浪漫</a>
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