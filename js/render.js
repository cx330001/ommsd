/* =========================================
   render.js - 页面渲染逻辑 (完整最终版)
   ========================================= */

let activeUrls = []; // 管理 Blob URL 避免内存溢出
let msgListActiveUrls = []; // 专门存消息列表页的图片
let contactListActiveUrls = []; // 专门存好友列表的图片 (虽有虚拟列表，但列表初始化时可能产生临时图)
let targetContactId = null;

// --- [新] 1. 细分内存清理函数 ---

// A. 专门清理：消息列表 (Tab 1)
window.cleanMsgListMemory = function () {
    // 1. 释放图片内存
    if (msgListActiveUrls.length > 0) {
        msgListActiveUrls.forEach(u => URL.revokeObjectURL(u));
        msgListActiveUrls = [];
    }
    // 2. 清空 DOM
    const list = document.getElementById('msg-list');
    if (list) list.innerHTML = '';

    // 3. 清理 "我" 的卡片 (因为它也在消息页 Tab 里)
    const mePlaceholder = document.getElementById('me-content-placeholder');
    if (mePlaceholder) mePlaceholder.innerHTML = '';

    console.log("消息列表内存已释放 (MsgList Cleaned)");
};
// B. 专门清理：好友列表 (Tab 2)
window.cleanContactMemory = function () {
    // 1. 销毁虚拟列表实例
    if (typeof virtualScroller !== 'undefined' && virtualScroller) {
        virtualScroller.destroy(); // 内部会 revoke 所有的 activeRowUrls
        virtualScroller = null;
    }
    // 2. 释放可能存在的缓存图片
    if (contactListActiveUrls.length > 0) {
        contactListActiveUrls.forEach(u => URL.revokeObjectURL(u));
        contactListActiveUrls = [];
    }
    // 3. 清空 DOM 容器
    const container = document.getElementById('contact-list-dynamic');
    if (container) container.innerHTML = '';

    // 4. 清空数据缓存
    if (typeof allContactsCache !== 'undefined') {
        allContactsCache = [];
    }

    console.log("好友列表内存已释放 (ContactList Cleaned)");
};

// C. 专门清理：聊天详情页 (Window)
window.cleanChatDetailMemory = function () {
    if (typeof chatScroller !== 'undefined' && chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }
    const body = document.getElementById('chat-body');
    if (body) body.innerHTML = '';

    // 清理聊天页可能产生的通用图片
    if (window.activeUrls && window.activeUrls.length > 0) {
        window.activeUrls.forEach(u => URL.revokeObjectURL(u));
        window.activeUrls = [];
    }
    console.log("聊天详情页内存已释放 (ChatDetail Cleaned)");
};

// D. 全局清理 (保留给特殊情况用)
window.cleanUpMemory = function () {
    window.cleanMsgListMemory();
    window.cleanContactMemory();
    window.cleanChatDetailMemory();
};
window.cleanUpMemory = cleanUpMemory;


// --- 2. 渲染好友列表 (Contacts) ---
let allContactsCache = [];
let virtualScroller = null;

// 销毁旧的 Blob URLs (辅助函数)
function revokeOldUrls(urls) {
    if (urls && urls.length) {
        urls.forEach(u => URL.revokeObjectURL(u));
    }
}

// --- 虚拟列表核心类 ---
class VirtualScroller {
    constructor(containerId, listData, itemHeight, renderRowFn) {
        this.container = document.getElementById(containerId); // 真实的滚动容器 (tab-contacts)
        this.content = document.getElementById('contact-list-dynamic'); // 内容撑开容器
        this.listData = listData;
        this.itemHeight = itemHeight + 12; // 70px高度 + 12px margin-bottom
        this.renderRowFn = renderRowFn;

        this.visibleCount = 0;
        this.startIndex = 0;
        this.lastStartIndex = -1;
        this.activeRowUrls = []; // 记录当前视口内生成的 Blob URL

        this.init();
    }

    init() {
        // 1. 设置总高度，撑开滚动条
        const totalHeight = this.listData.length * this.itemHeight + 100;

        this.content.style.height = totalHeight + 'px';

        // 2. 计算可视区域能放下多少个
        // 假设屏幕高度约 800，多渲染几个作为缓冲区
        this.visibleCount = Math.ceil(window.innerHeight / this.itemHeight) + 4;

        // 3. 绑定滚动事件
        this.bindScroll();

        // 4. 初次渲染
        this.render();
    }

    bindScroll() {
        this.onScroll = () => {
            // 根据滚动距离计算开始索引
            const scrollTop = this.container.scrollTop;
            this.startIndex = Math.floor(scrollTop / this.itemHeight);

            // 只有当索引变化时才重新渲染（节流）
            if (this.startIndex !== this.lastStartIndex) {
                this.render();
            }
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    render() {
        this.lastStartIndex = this.startIndex;

        // 计算结束索引
        let endIndex = this.startIndex + this.visibleCount;
        if (endIndex > this.listData.length) endIndex = this.listData.length;

        // 获取要渲染的数据片段
        const visibleData = this.listData.slice(this.startIndex, endIndex);

        // --- 关键：严格内存管理 ---
        // 1. 销毁上一帧的 URL (防止滚动时 Blob 堆积)
        // 注意：这里为了极致省内存，每次滚动都销毁重建。
        // 如果觉得闪烁，可以建立一个 LRU 缓存，但 Safari 建议销毁。
        revokeOldUrls(this.activeRowUrls);
        this.activeRowUrls = [];

        // 2. 生成 HTML
        let html = '';
        visibleData.forEach((item, index) => {
            // 计算绝对定位的 top 值
            const absoluteIndex = this.startIndex + index;
            const top = absoluteIndex * this.itemHeight;

            // 调用外部传入的渲染函数生成单行 HTML
            // 这里的 imgUrl 会被收集到 activeRowUrls
            html += this.renderRowFn(item, top, this.activeRowUrls);
        });

        this.content.innerHTML = html;
    }

    destroy() {
        // 移除监听，清理内存
        if (this.container) {
            this.container.removeEventListener('scroll', this.onScroll);
        }
        revokeOldUrls(this.activeRowUrls);
        this.activeRowUrls = [];
        this.content.innerHTML = '';
        console.log('虚拟列表已销毁，内存已释放');
    }
}

// --- 替换原有的 renderContacts ---
window.renderContacts = async function () {
    // 1. 获取数据
    allContactsCache = await window.dbSystem.getContacts();
    const container = document.getElementById('tab-contacts');

    // 确保容器结构正确
    // 结构应该是: #tab-contacts (scroll) -> #contact-list-dynamic (height)
    let listContainer = document.getElementById('contact-list-dynamic');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.id = 'contact-list-dynamic';
        container.appendChild(listContainer);
    }

    // 2. 如果已存在实例，先销毁（防止重复绑定）
    if (virtualScroller) {
        virtualScroller.destroy();
    }

    // 3. 只有当好友数量大于0时才初始化
    if (allContactsCache.length > 0) {
        virtualScroller = new VirtualScroller(
            'tab-contacts',   // 滚动容器 ID
            allContactsCache, // 数据源
            70,               // 单项高度 (对应 CSS .contact-item 的 height)

            // 单行渲染逻辑
            (p, top, urlTracker) => {
                let img = p.name[0];
                let style = "";

                // Blob 处理
                if (p.avatar instanceof Blob) {
                    const url = URL.createObjectURL(p.avatar);
                    urlTracker.push(url); // 记录以便稍后销毁
                    img = "";
                    style = `background-image:url(${url});`;
                } else if (typeof p.avatar === 'string' && p.avatar) {
                    img = "";
                    style = `background-image:url(${p.avatar});`;
                }

                // 注意：增加了 top: ${top}px 来定位
                return `
                <div class="contact-item" onclick="prepareChat(${p.id})" style="top:${top}px;">
                    <div class="avatar" style="${style}">${img}</div>
                    
                    <div class="chat-info" style="flex-grow:1; min-width:0;">
                        <h4 style="margin-bottom:2px;">${p.name}</h4>
                        <p style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#aaa;">
                            ${p.desc || '暂无介绍'}
                        </p>
                    </div>

                    <div onclick="editContact(${p.id}); event.stopPropagation();" style="padding:10px; cursor:pointer;">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="#9B9ECE">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                        </svg>
                    </div>
                </div>`;
            }
        );
    } else {
        listContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#ccc">暂无好友</div>';
        listContainer.style.height = 'auto';
    }
};

// 修改清理函数，把虚拟列表也清理掉
const originalCleanUp = window.cleanUpMemory;
window.cleanUpMemory = function () {
    if (originalCleanUp) originalCleanUp();
    if (virtualScroller) {
        virtualScroller.destroy();
        virtualScroller = null;
    }
    allContactsCache = [];
};

// --- 3. 准备聊天 (弹出选择身份窗口) ---
window.prepareChat = async function (contactId) {
    targetContactId = contactId; // 记住我们要和谁聊

    // 打开选择弹窗
    const modal = document.getElementById('modal-select-me');
    if (!modal) return alert("请检查 index.html 是否添加了 modal-select-me");

    modal.style.display = 'flex';

    // 渲染我的身份列表
    const listEl = document.getElementById('persona-select-list');

    // 【关键修复】使用 getMyPersonas() 替代 getAll()
    const myPersonas = await window.dbSystem.getMyPersonas();

    if (myPersonas.length === 0) {
        // 提示去创建身份（因为现在身份管理合并了，如果没有type=1的角色，就没法聊天）
        listEl.innerHTML = `
            <div style="padding:20px;text-align:center;color:#999">
                还没有“面具”哦<br>
                <span style="font-size:12px;color:var(--theme-purple);cursor:pointer;" onclick="document.getElementById('modal-select-me').style.display='none';switchTab('me', document.querySelector('.tab-item:last-child'))">去“我”的页面创建一个吧</span>
            </div>`;
        return;
    }

    listEl.innerHTML = myPersonas.map(p => {
        // 简单处理头像显示
        let imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;font-size:14px;background:#9B9ECE;">${p.name[0]}</div>`;

        if (p.avatar instanceof Blob) {
            const u = URL.createObjectURL(p.avatar);
            if (window.activeUrls) window.activeUrls.push(u);
            imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;background-image:url(${u})"></div>`;
        } else if (typeof p.avatar === 'string' && p.avatar) {
            imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;background-image:url(${p.avatar})"></div>`;
        }

        // 点击列表项 -> 确认开始聊天
        return `
        <div class="persona-item" onclick="confirmChat(${p.id})">
            ${imgHtml}
            <div>
                <div style="font-weight:bold;">${p.name}</div>
                <div style="font-size:12px;color:#999;">${p.desc || '...'}</div>
            </div>
        </div>`;
    }).join('');
};


// --- 4. 确认开启聊天 (创建会话) ---
window.confirmChat = async function (myPersonaId) {
    if (!targetContactId) return;

    // 现在的 createOrGetChat 接受一个数组
    // 这样就支持任意组合了，比如 [AI_ID, AI_ID]
    const chatId = await window.dbSystem.createOrGetChat([targetContactId, myPersonaId]);

    document.getElementById('modal-select-me').style.display = 'none';
    await window.renderChatUI();
    window.openChatDetail(chatId);
};


// --- 5. 打开聊天详情页 (Open Chat Window) ---
/* --- js/render.js 的末尾部分 --- */

// 全局变量，用于管理当前的滚动实例
let chatScroller = null;
let currentActiveChatId = null;

// ==========================================
//  ChatVirtualScroller: 不定高度虚拟列表类 (通用版)
// ==========================================
class ChatVirtualScroller {
    // 1. 构造函数新增 chatId 参数
    constructor(containerId, messages, avatarMap, configMap, currentUserId, chatId) {
        this.container = document.getElementById(containerId);
        this.messages = messages || [];
        this.avatarMap = avatarMap || {};
        this.configMap = configMap || {};
        this.currentUserId = currentUserId;
        this.chatId = chatId; // [新增] 存下会话ID，方便去数据库取货

        // [新增] 加载状态标记
        this.isLoading = false;
        this.isFinished = false; // 如果数据库取空了，就标记为 true

        this.heightCache = new Map();
        this.estimatedItemHeight = 80;
        this.visibleCount = 20;
        this.buffer = 5;

        // 初始化容器
        this.container.innerHTML = '';
        this.content = document.createElement('div');
        this.content.id = 'chat-list-dynamic';
        this.container.appendChild(this.content);

        this.bindScroll();
        this.render();

        // 首次打开，强制滚到底部
        setTimeout(() => this.scrollToBottom(), 0);
    }

    getItemHeight(index) {
        return this.heightCache.get(index) || this.estimatedItemHeight;
    }

    getOffsetTop(index) {
        let sum = 0;
        for (let i = 0; i < index; i++) sum += this.getItemHeight(i);
        return sum;
    }

    bindScroll() {
        this.onScroll = () => {
            requestAnimationFrame(() => this.render());

            // [核心修改] 检测是否滑到了顶部 (距离顶部 < 50px)
            if (this.container.scrollTop < 50 && !this.isLoading && !this.isFinished) {
                this.loadMoreHistory(); // 触发加载历史
            }
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    // [新增] 加载历史记录的核心逻辑
    async loadMoreHistory() {
        if (this.isLoading) return;
        this.isLoading = true;

        // 1. 记住当前的高度 (为了防止画面乱跳)
        const oldScrollHeight = this.container.scrollHeight;
        const oldScrollTop = this.container.scrollTop;

        // 2. 去数据库取更早的 20 条
        // offset 传当前已经有的消息数量
        const moreMsgs = await window.dbSystem.getMessagesPaged(this.chatId, 20, this.messages.length);

        if (moreMsgs.length === 0) {
            this.isFinished = true; // 没数据了，以后别加载了
            this.isLoading = false;
            console.log("历史记录已全部加载完毕");
            return;
        }

        // 3. 把旧消息拼接到数组头部
        this.messages = [...moreMsgs, ...this.messages];

        // 4. 强制清空高度缓存 (因为索引变了)，否则计算会错
        this.heightCache.clear();

        // 5. 重新渲染
        this.render();

        // 6. [无感魔法] 瞬间修正滚动条位置
        requestAnimationFrame(() => {
            const newScrollHeight = this.container.scrollHeight;
            // 算出多了多少高度
            const addedHeight = newScrollHeight - oldScrollHeight;

            // 把滚动条往下拽，抵消新增的高度
            this.container.scrollTop = oldScrollTop + addedHeight;

            this.isLoading = false;
        });
    }
    removeMessageById(id) {
        const idx = this.messages.findIndex(m => m.id === id);
        if (idx !== -1) {
            // 1. 先从数据源移除
            this.messages.splice(idx, 1);

            // 2. 【新增】暴力移除当前 DOM，给用户瞬间反馈
            const bubble = this.container.querySelector(`[data-msg-id="${id}"]`);
            if (bubble) {
                // 找到包含这个气泡的行容器 (virtual-item)
                const row = bubble.closest('.virtual-item');
                if (row) row.style.display = 'none'; // 直接隐藏，视觉立即生效
            }

            // 3. 清除高度缓存并重新计算
            this.heightCache.clear();

            // 4. 强制重新渲染 (稍微延迟一点点，让 DOM 操作先消化)
            requestAnimationFrame(() => {
                this.render();
            });

            console.log("UI已移除消息:", id);
        }
    }
    render() {
        const scrollTop = this.container.scrollTop;
        const totalCount = this.messages.length;

        // 1. 找起点
        let sum = 0;
        let start = 0;
        for (let i = 0; i < totalCount; i++) {
            sum += this.getItemHeight(i);
            if (sum >= scrollTop) { start = i; break; }
        }

        // 2. 算范围
        let end = start + this.visibleCount;
        start = Math.max(0, start - this.buffer);
        end = Math.min(totalCount, end + this.buffer);

        // 3. 算Padding
        const paddingTop = this.getOffsetTop(start);
        let paddingBottom = 0;
        for (let i = end; i < totalCount; i++) paddingBottom += this.getItemHeight(i);

        this.content.style.paddingTop = paddingTop + 'px';
        this.content.style.paddingBottom = paddingBottom + 'px';

        // 4. 生成HTML
        let html = '';
        const visibleData = this.messages.slice(start, end);

        visibleData.forEach((msg, i) => {
            const realIndex = start + i;
            const isRight = (this.currentUserId && msg.senderId === this.currentUserId);

            // 读取配置
            const config = this.configMap[msg.senderId] || { size: 40, shape: 'circle', hidden: false };

            // 【关键】如果隐藏头像，添加 'no-avatar' 类，配合CSS彻底移除占位
            const rowClass = `${isRight ? 'msg-row me' : 'msg-row'} ${config.hidden ? 'no-avatar' : ''}`;

            // 样式计算
            const sizePx = config.size + 'px';
            const radius = config.shape === 'square' ? '6px' : '50%';

            let avatarStyle = this.avatarMap[msg.senderId] || 'background:#ccc';
            if (msg.senderId === -1) avatarStyle = "background: transparent; box-shadow: none;";

            const finalAvatarStyle = `
                ${avatarStyle}; 
                width: ${sizePx}; 
                height: ${sizePx}; 
                border-radius: ${radius};
                /* 注意：这里不需要 visibility:hidden，因为父级加了 no-avatar 会直接 display:none */
                margin-right: ${isRight ? 0 : 10}px;
                margin-left: ${isRight ? 10 : 0}px;
            `;

            let contentHtml = this.escapeHtml(msg.text);
            if (msg.text && (msg.text.includes('typing-dots') || msg.text.includes('typing-bubble'))) {
                contentHtml = msg.text;
            }

            html += `
<div class="virtual-item" data-index="${realIndex}">
    <div class="${rowClass}">
        <div class="avatar" style="${finalAvatarStyle}"></div>
        
        <div class="msg-bubble" 
             data-msg-id="${msg.id}" 
             data-msg-text="${this.escapeHtml(msg.text)}"
             oncontextmenu="return false;">${contentHtml}</div>

    </div>
</div>`;
        });

        this.content.innerHTML = html;
        this.updateHeights();
    }

    updateHeights() {
        const nodes = this.content.querySelectorAll('.virtual-item');
        nodes.forEach(node => {
            const index = parseInt(node.getAttribute('data-index'));
            const h = node.getBoundingClientRect().height;
            if (h > 0 && this.heightCache.get(index) !== h) {
                this.heightCache.set(index, h);
            }
        });
    }

    append(msg) {
        this.messages.push(msg);
        // 发新消息时，先渲染，再滚到底部
        this.render();
        requestAnimationFrame(() => {
            this.scrollToBottom();
        });
    }

    removeLast() {
        if (this.messages.length > 0) {
            this.messages.pop();
            this.render();
        }
    }

    scrollToBottom() {
        const body = this.container;
        if (body) body.scrollTop = body.scrollHeight;
    }

    destroy() {
        if (this.container) this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
        this.messages = [];
        this.heightCache.clear();
    }

    escapeHtml(text) {
        if (!text) return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

// -----------------------------------------------------
//  修改 openChatDetail：连接数据库 + 启动虚拟列表
// -----------------------------------------------------
window.openChatDetail = async function (chatId) {
    // [极致优化] 打开聊天窗口时，背后的消息列表不可见，直接销毁以省内存
    window.cleanMsgListMemory();
    // 顺便把好友列表也清了，防止从好友列表直接点进聊天
    window.cleanContactMemory();

    currentActiveChatId = chatId;
    window.currentActiveChatId = chatId;
    const chats = await window.dbSystem.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // === 【核心修复】标题显示逻辑 (与列表逻辑保持一致) ===
    const titleEl = document.getElementById('chat-title-text');
    const statusContainer = document.querySelector('.status-container'); // 获取状态栏

    if (chat.name) {
        // --- 群聊 ---
        titleEl.innerText = chat.name + ` (${chat.members.length}人)`;
        // 群聊隐藏状态栏
        if (statusContainer) statusContainer.style.display = 'none';
    } else {
        // --- 私聊 (修复点) ---

        let targetId = null;

        // 1. 【优先】找 Type=0 (AI/NPC)
        // 这样不管我当前切成了哪个身份，进这个窗口看到的永远是“小助手”
        for (const mid of chat.members) {
            const c = await window.dbSystem.getChar(mid);
            if (c && c.type === 0) {
                targetId = mid;
                break;
            }
        }

        // 2. 【兜底】如果没找到 AI (比如是 UserA 和 UserB 互聊)
        // 就默认取第一个成员，保证视图稳定，不随 currentUser 变化而乱跳
        if (!targetId) targetId = chat.members[0];

        const targetChar = await window.dbSystem.getChar(targetId);
        titleEl.innerText = targetChar ? targetChar.name : "未知用户";

        // 私聊显示状态栏
        if (statusContainer) {
            statusContainer.style.display = 'flex';
            // 随机模拟状态
            const isOnline = Math.random() > 0.3;
            const statusDot = document.getElementById('chat-status-dot');
            const statusText = document.getElementById('chat-status-text');
            if (isOnline) {
                statusDot.classList.add('online');
                statusText.innerText = "在线";
            } else {
                statusDot.classList.remove('online');
                statusText.innerText = "离线";
            }
        }
    }

    window.openApp('conversation');

    // 3. [关键] 预处理所有成员的视觉配置 (Avatar Map & Config Map)
    const avatarMap = {};
    const configMap = {};
    const overrides = chat.visualOverrides || {};

    if (chat.name) {
        // === 群聊 ===
        title = chat.name + ` (${chat.members.length}人)`;

        // [新增] 优先使用群头像设置
        if (overrides['GROUP'] && overrides['GROUP'].avatar) {
            avatarContent = "";
            avatarStyle = `background-image:url(${overrides['GROUP'].avatar})`;
        } else {
            avatarContent = "群";
            avatarStyle = "background:#9B9ECE; display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px;";
        }
    }

    // 3.1 遍历成员
    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        let finalAvatarUrl = null;
        let style = "background:#ccc";

        // 优先用 Override
        if (overrides[memberId] && overrides[memberId].avatar) {
            finalAvatarUrl = overrides[memberId].avatar;
            style = `background-image:url(${finalAvatarUrl})`;
        } else if (char) {
            // 原始头像
            if (char.avatar instanceof Blob) {
                const u = URL.createObjectURL(char.avatar);
                if (window.activeUrls) window.activeUrls.push(u);
                style = `background-image:url(${u})`;
            } else if (typeof char.avatar === 'string' && char.avatar) {
                style = `background-image:url(${char.avatar})`;
            }
        }

        avatarMap[memberId] = style;

        // 读取配置
        const setting = overrides[memberId] || {};
        configMap[memberId] = {
            shape: setting.shape || 'circle',
            size: setting.size || 40,
            hidden: setting.hidden || false,
            alias: setting.alias // 暂未使用，可用于气泡上方显示名字
        };
    }

    // 4. 从数据库取消息
    const messages = await window.dbSystem.getMessagesPaged(chatId, 20, 0);

    // 5. 初始化虚拟列表
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }

    // === 【核心修复】确定在这个聊天窗口里，“我”是谁 ===
    // 我们不能直接用 currentUser.id，因为全局身份可能已经切走了。
    // 我们必须在这个聊天室的成员里，找到那个属于“我” (type=1) 的 ID。
    let myIdentityIdInChat = null;

    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        if (char && char.type === 1) {
            myIdentityIdInChat = char.id;
            break; // 找到了！在这个群里，我是这个人。
        }
    }

    // 如果没找到（比如全是NPC的特殊情况），再兜底用全局身份
    if (!myIdentityIdInChat && currentUser) {
        myIdentityIdInChat = currentUser.id;
    }

    // 传入 myIdentityIdInChat 而不是 currentUser.id
    chatScroller = new ChatVirtualScroller(
        'chat-body',
        messages,
        avatarMap,
        configMap,
        myIdentityIdInChat,
        chatId // <--- [修改] 传入会话ID，给加载更多用
    );

    // 6. 绑定回车键
    const input = document.querySelector('.chat-input');
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') window.sendMessage();
        };
        setTimeout(() => input.focus(), 300);
    }
};

// 内存清理逻辑
window.cleanUpMemory = function () {
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }
    // 之前的清理逻辑（如果你有）也应该保留，比如清理 Blob URL
    if (window.activeUrls) {
        window.activeUrls.forEach(u => URL.revokeObjectURL(u));
        window.activeUrls = [];
    }
};

// [新增] 滚动到底部的辅助函数
function scrollToBottom() {
    const body = document.getElementById('chat-body');
    if (body) {
        setTimeout(() => {
            body.scrollTop = body.scrollHeight;
        }, 50);
    }
}


// --- 6. 渲染首页 (消息列表 + 个人中心) ---
window.renderChatUI = async function () {

    window.cleanMsgListMemory();

    const currentUser = await window.dbSystem.getCurrent();
    const meContainer = document.getElementById('me-content-placeholder');

    // --- A. 渲染“我”的卡片 ---
    if (meContainer) {
        if (currentUser) {
            let avatarStyle = "background:#9B9ECE";
            let avatarText = currentUser.name[0];

            if (currentUser.avatar instanceof Blob) {
                const url = URL.createObjectURL(currentUser.avatar);
                msgListActiveUrls.push(url); // <--- [追踪] 加入列表专用数组
                avatarStyle = `background-image: url(${url});`;
                avatarText = "";
            } else if (typeof currentUser.avatar === 'string' && currentUser.avatar.length > 0) {
                avatarStyle = `background-image: url(${currentUser.avatar});`;
                avatarText = "";
            }

            meContainer.innerHTML = `
                <div class="me-card">
                    <div class="me-avatar" style="${avatarStyle}" onclick="openPersonaManager()">${avatarText}</div>
                    <div class="chat-info" onclick="openPersonaManager()" style="flex-grow:1;">
                        <h3 style="margin:0;color:#333;">${currentUser.name}</h3> 
                        <p style="margin:4px 0 0 0;color:#999;font-size:12px;">${currentUser.desc || '点击切换/管理身份'}</p> 
                    </div>
                    <div style="padding:10px; cursor:pointer;" onclick="editCurrentPersona()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#9B9ECE"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </div>
                </div>
                <div class="menu-item"><div class="chat-info"><h4>通用设置</h4></div></div>
            `;
        } else {
            meContainer.innerHTML = `
                <div class="me-card" onclick="showAddForm(); document.getElementById('modal-persona').style.display='flex';">
                    <div class="me-avatar" style="background:#ddd; color:#fff;">+</div>
                    <div class="chat-info">
                        <h3 style="margin:0;color:#333;">暂无身份</h3>
                        <p style="margin:4px 0 0 0;color:#999;font-size:12px;">点击创建你的第一个人设</p>
                    </div>
                </div>
            `;
        }
    }

    // --- B. 渲染“消息”列表 ---
    const list = document.getElementById('msg-list');
    // list.innerHTML = ''; // 上面 cleanMsgListMemory 已经清空过了，这句可以删掉

    const chats = await window.dbSystem.getChats();
    if (chats.length === 0) return;

    for (const chat of chats) {
        let title = "未知会话";
        let avatarStyle = "background:#E8C1C6";
        let avatarContent = "";

        // 获取独立设置
        const overrides = chat.visualOverrides || {};

        if (chat.name) {
            // === 群聊 ===
            title = (overrides['GROUP'] && overrides['GROUP'].alias)
                ? overrides['GROUP'].alias
                : (chat.name + ` (${chat.members.length}人)`);

            // 群头像处理
            if (overrides['GROUP'] && overrides['GROUP'].avatar) {
                // Base64 不需要 Blob URL 管理，直接用
                avatarContent = "";
                avatarStyle = `background-image:url(${overrides['GROUP'].avatar})`;
            } else {
                avatarContent = "群";
                avatarStyle = "background:#9B9ECE; display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px;";
            }

        } else {
            // === 私聊 ===
            let targetId = null;
            for (const mid of chat.members) {
                const c = await window.dbSystem.getChar(mid);
                if (c && c.type === 0) {
                    targetId = mid;
                    break;
                }
            }
            if (!targetId) targetId = chat.members[0];

            const targetChar = await window.dbSystem.getChar(targetId);
            if (!targetChar) continue;

            // 标题
            if (overrides[targetId] && overrides[targetId].alias) {
                title = overrides[targetId].alias;
            } else {
                title = targetChar.name;
            }

            // 头像
            if (overrides[targetId] && overrides[targetId].avatar) {
                // Override 是 Base64，安全
                avatarContent = "";
                avatarStyle = `background-image:url(${overrides[targetId].avatar})`;
            }
            else if (targetChar.avatar instanceof Blob) {
                // === 关键：Blob URL 需要追踪 ===
                const u = URL.createObjectURL(targetChar.avatar);
                msgListActiveUrls.push(u); // <--- [追踪] 加入数组
                avatarContent = "";
                avatarStyle = `background-image:url(${u})`;
            } else if (typeof targetChar.avatar === 'string' && targetChar.avatar) {
                avatarContent = "";
                avatarStyle = `background-image:url(${targetChar.avatar})`;
            } else {
                avatarContent = targetChar.name[0];
                avatarStyle = "background:#E8C1C6";
            }
        }

        const html = `
        <div class="chat-item" onclick="openChatDetail(${chat.id})">
            <div class="avatar" style="${avatarStyle}">${avatarContent}</div>
            <div class="chat-info">
                <h4>${title}</h4>
                <p>${chat.lastMsg || '暂无消息'}</p>
            </div>
            <div class="chat-meta">
                ${chat.updated ? new Date(chat.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
        </div>`;
        list.insertAdjacentHTML('beforeend', html);
    }
};
let wbScroller = null; // 全局实例

window.cleanWorldBookMemory = function () {
    // A. 销毁滚动监听和数据引用
    if (wbScroller) {
        wbScroller.destroy();
        wbScroller = null;
    }
    // B. 清空 DOM
    const container = document.getElementById('worldbook-list-container');
    if (container) container.innerHTML = '';

    console.log("世界书内存已释放 (WorldBook Cleaned)");
};

// 2. 世界书虚拟列表类 (支持不定高度估算 + 滚动加载)
class WbVirtualScroller {
    constructor(containerId, type, categoryId) {
        this.container = document.getElementById(containerId);
        this.type = type;
        this.categoryId = categoryId;

        this.listData = []; // 已加载的数据缓存
        this.isLoading = false;
        this.isFinished = false; // 是否已无更多数据
        this.offset = 0;
        this.pageSize = 20; // 每次查20条

        this.itemHeight = 110; // 预估每个卡片高度 (px)
        this.buffer = 5; // 上下缓冲区数量
        this.renderState = { start: 0, end: 0 };

        // 创建撑开高度的容器
        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.content);

        // 绑定滚动
        this.bindScroll();

        // 初始加载
        this.loadMore();
    }

    bindScroll() {
        this.onScroll = () => {
            requestAnimationFrame(() => {
                this.render(); // 滚动时更新可视区域

                // 触底检测 (距离底部 200px 时加载下一页)
                const { scrollTop, scrollHeight, clientHeight } = this.container;
                if (scrollHeight - scrollTop - clientHeight < 200) {
                    this.loadMore();
                }
            });
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    async loadMore() {
        if (this.isLoading || this.isFinished) return;
        this.isLoading = true;

        // 从 DB 分页获取
        const newItems = await window.dbSystem.getWorldBooksPaged(
            this.type,
            this.categoryId,
            this.pageSize,
            this.offset
        );

        if (newItems.length < this.pageSize) {
            this.isFinished = true; // 数据取完了
        }

        if (newItems.length > 0) {
            this.listData = [...this.listData, ...newItems];
            this.offset += newItems.length;

            // 更新容器总高度估算 (为了撑开滚动条)
            this.content.style.height = (this.listData.length * this.itemHeight) + 'px';

            this.render(); // 渲染新数据
        }

        this.isLoading = false;
    }

    // 重新刷新视图 (用于切换选择模式时更新 checkbox 状态)
    refresh() {
        this.render(true);
    }

    render(force = false) {
        const scrollTop = this.container.scrollTop;
        const visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight);

        // 计算可视范围索引
        let start = Math.floor(scrollTop / this.itemHeight) - this.buffer;
        let end = start + visibleCount + (this.buffer * 2);

        // 边界限制
        if (start < 0) start = 0;
        if (end > this.listData.length) end = this.listData.length;

        // 如果可视范围没变且非强制刷新，则跳过
        if (!force && start === this.renderState.start && end === this.renderState.end) return;
        this.renderState = { start, end };

        // 生成 HTML
        let html = '';
        const visibleData = this.listData.slice(start, end);

        visibleData.forEach((b, index) => {
            // 计算绝对定位 Top 值
            const absoluteTop = (start + index) * this.itemHeight;

            // 下面是你原有的渲染逻辑，封装进来了
            const typeClass = b.type;
            const modeTag = b.constant
                ? `<span class="wb-tag tag-const">⚡ 常驻</span>`
                : `<span class="wb-tag tag-trig">🔍 触发</span>`;

            let keysHtml = '';
            if (!b.constant && b.keys && b.keys.length > 0) {
                keysHtml = `<div class="wb-keys-box">` +
                    b.keys.map(k => `<span class="wb-key-pill">${k}</span>`).join('') +
                    `</div>`;
            }

            // 引用 main.js 中的全局变量 (isWbSelectMode, selectedWbIds)
            // 注意：需要确保 render.js 在 main.js 之前加载，或者变量挂在 window 上
            const isSelectMode = window.isWbSelectMode || false;
            const selectedSet = window.selectedWbIds || new Set();

            const isChecked = selectedSet.has(b.id) ? 'checked' : '';
            const clickAction = isSelectMode ? `toggleWbSelection(${b.id}, this)` : `openWorldBookEdit(${b.id})`;
            const cardClass = isSelectMode ? 'wb-card selected-mode' : 'wb-card';
            const checkedClass = (isSelectMode && selectedSet.has(b.id)) ? 'checked' : '';

            // 关键：增加 position: absolute 和 top
            html += `
            <div class="${cardClass} ${checkedClass} ${typeClass}" 
                 onclick="${clickAction}" 
                 id="wb-card-${b.id}"
                 style="position:absolute; top:${absoluteTop}px; left:0; width:100%; box-sizing:border-box; height:${this.itemHeight - 14}px;">
                <div class="wb-check-overlay">
                    <div class="wb-checkbox"></div>
                </div>
                
                <div class="wb-header">
                    <div class="wb-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.name} ${modeTag}</div>
                    <div class="wb-meta">W:${b.order}</div>
                </div>
                ${keysHtml}
                <div class="wb-preview" style="-webkit-line-clamp: 2;">${b.content}</div>
            </div>`;
        });

        this.content.innerHTML = html;
    }

    destroy() {
        this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
        this.listData = [];
    }
}

// 3. 暴露给外部调用的初始化函数 (替换原有的 renderWorldBookList)
window.initWbScroller = function (type, catId) {
    if (wbScroller) {
        wbScroller.destroy();
    }
    // 实例化新的虚拟列表
    wbScroller = new WbVirtualScroller('worldbook-list-container', type, catId);
};

// 4. 暴露刷新方法给 main.js 使用
window.refreshWbScroller = function () {
    if (wbScroller) wbScroller.refresh();
};
let longPressTimer = null;
let longPressStartPos = { x: 0, y: 0 };
let currentLongPressMsgId = null;
let currentLongPressText = "";

// 监听聊天容器的触摸事件 (Event Delegation)
const chatBody = document.getElementById('chat-body');
if (chatBody) {
    chatBody.addEventListener('touchstart', (e) => {
        // 找到最近的 msg-bubble
        const bubble = e.target.closest('.msg-bubble');
        if (!bubble) return;

        const id = parseInt(bubble.getAttribute('data-msg-id'));
        if (!id) return;

        currentLongPressMsgId = id;
        currentLongPressText = bubble.getAttribute('data-msg-text'); // 存下来给复制用
        longPressStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        // 视觉反馈
        bubble.classList.add('long-pressed');

        // 开启定时器 (500ms 算长按)
        longPressTimer = setTimeout(() => {
            // 触发菜单
            window.showMsgMenu(longPressStartPos.x, longPressStartPos.y, bubble);
            // 震动反馈 (如果有)
            if (navigator.vibrate) navigator.vibrate(10);
        }, 500);

    }, { passive: true });

    chatBody.addEventListener('touchmove', (e) => {
        if (!longPressTimer) return;
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;

        // 如果移动超过 10px，视为滑动，取消长按
        if (Math.abs(moveX - longPressStartPos.x) > 10 || Math.abs(moveY - longPressStartPos.y) > 10) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            // 移除高亮
            document.querySelectorAll('.msg-bubble.long-pressed').forEach(el => el.classList.remove('long-pressed'));
        }
    }, { passive: true });

    chatBody.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        // 移除高亮
        setTimeout(() => {
            document.querySelectorAll('.msg-bubble.long-pressed').forEach(el => el.classList.remove('long-pressed'));
        }, 100);
    });
}