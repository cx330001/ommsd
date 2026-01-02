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
window.chatScroller = null;
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
    toggleExpand(msgId) {
        // 1. 找到数据对象
        const targetId = String(msgId);
        const index = this.messages.findIndex(m => String(m.id) === targetId);
        if (index === -1) return;

        const msg = this.messages[index];

        // 2. 修改数据状态 (持久化，防止滚动丢失)
        msg.isExpanded = !msg.isExpanded;

        // 3. 【关键】清除该条目的高度缓存
        // 因为高度变了，必须让虚拟列表下次渲染时重新计算高度
        // 这里的 index 是在整个 messages 数组中的索引
        this.heightCache.delete(index);

        // 4. 强制重新渲染
        // 这会生成带有 .show 类的 HTML，并触发 updateHeights 重新计算高度
        this.render();

        // 5. [可选] 如果展开导致内容超出屏幕底部，稍微滚一下
        if (msg.isExpanded) {
            // 简单的防遮挡逻辑：如果是在最底部，适当上滑
            // 这里的逻辑可以根据体验细调
            const body = this.container;
            if (body.scrollHeight - body.scrollTop - body.clientHeight < 100) {
                body.scrollTop += 50;
            }
        }
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

        // 1. 记录当前状态
        // scrollHeight 是在这个时刻，内容的总高度
        const oldScrollHeight = this.container.scrollHeight;
        const oldScrollTop = this.container.scrollTop;

        // 2. 去数据库取更早的消息
        const moreMsgs = await window.dbSystem.getMessagesPaged(this.chatId, 20, this.messages.length);

        if (moreMsgs.length === 0) {
            this.isFinished = true;
            this.isLoading = false;
            console.log("历史记录已全部加载完毕");
            return;
        }

        // 3. 拼接数据
        this.messages = [...moreMsgs, ...this.messages];

        // 4. 清空高度缓存 (因为索引全变了)
        this.heightCache.clear();

        // 5. 重新渲染 (注意：这里必须是同步渲染，如果 render 里面有 await 要小心)
        this.render();

        // ============================================
        // 🔴 核心修复：不要用 requestAnimationFrame
        // 必须在 render 后立即计算，否则浏览器会先画一帧错误的
        // ============================================

        // 强制浏览器重排，获取新的总高度
        const newScrollHeight = this.container.scrollHeight;

        // 算出新增了多少高度
        const addedHeight = newScrollHeight - oldScrollHeight;

        // 立即修正滚动条，抵消新增的高度
        // 这样用户视觉上就会停留在原地不动
        this.container.scrollTop = oldScrollTop + addedHeight;

        this.isLoading = false;
    }
    /* js/render.js */

    // 假设你的 ChatScroller 类里面有这个方法
    // 如果没有，请在 ChatScroller.prototype 或类定义中添加：

    removeMessageById(id) {
        if (!this.messages) return;

        const targetId = String(id);
        // 1. 从内存数组移除
        const index = this.messages.findIndex(m => String(m.id) === targetId);
        if (index !== -1) {
            this.messages.splice(index, 1);
        }

        // 2. 暴力移除 DOM (给用户瞬间反馈，防止重载慢了)
        // 查找所有 data-msg-id 等于该 ID 的气泡
        const bubbles = this.content.querySelectorAll(`.msg-bubble[data-msg-id="${targetId}"]`);
        bubbles.forEach(el => {
            // 找到外层的 .virtual-item 并隐藏/移除
            const row = el.closest('.virtual-item');
            if (row) row.style.display = 'none'; // 先隐藏，等 refresh
        });

        // 3. 清理缓存并重绘
        this.heightCache.clear();
        this.render();
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
            // 判断是否是“我”发的
            const isRight = (this.currentUserId && msg.senderId === this.currentUserId);

            // 读取配置 (头像等)
            const config = this.configMap[msg.senderId] || { size: 40, shape: 'circle', hidden: false };
            const rowClass = `${isRight ? 'msg-row me' : 'msg-row'} ${config.hidden ? 'no-avatar' : ''}`;

            // 头像样式
            const sizePx = config.size + 'px';
            const radius = config.shape === 'square' ? '6px' : '50%';
            let avatarStyle = this.avatarMap[msg.senderId] || 'background:#ccc';
            if (msg.senderId === -1) avatarStyle = "background: transparent; box-shadow: none;";

            const finalAvatarStyle = `
                ${avatarStyle}; 
                width: ${sizePx}; 
                height: ${sizePx}; 
                border-radius: ${radius};
                margin-right: ${isRight ? 0 : 10}px;
                margin-left: ${isRight ? 10 : 0}px;
            `;

            let contentHtml = "";

            // 🌟🌟🌟 重点修改：样式变量 🌟🌟🌟
            // 默认清空，后面针对图片做特殊覆盖
            let bubbleStyleOverride = "";

            if (msg.type === 'image') {
                // === 图片消息处理 (修复版) ===

                // 1. 样式覆盖：
                // line-height: 0 -> 消除图片底部的文字基线空隙
                // width/height: auto -> 让气泡紧贴图片，不要有多余空白
                bubbleStyleOverride = "background: transparent; box-shadow: none; padding: 0; width: auto; height: auto; line-height: 0;";

                let imgSrc = msg.text;
                if (msg.text instanceof Blob) {
                    imgSrc = URL.createObjectURL(msg.text);
                    if (window.activeUrls) window.activeUrls.push(imgSrc);
                }

                // 2. 内容 HTML：
                // 🔴 核心修复：去掉了外层的 120px 固定宽高 div，也不需要 flex 布局了
                // 直接放 img，让外层的 .msg-row (flex-direction) 自动处理左右位置
                contentHtml = `
        <img src="${imgSrc}" 
             onclick="window.previewImage && window.previewImage(this.src)" 
             style="
                width: 100px;        /* 🔴 强制宽度 */
                height: 100px;       /* 🔴 强制高度，解决高度塌陷 */
                object-fit: contain; /* 保持图片比例，不会被拉伸变形 */
                border-radius: 6px;
                cursor: pointer;
                display: block;
                background: rgba(0,0,0,0.03); /* 加个淡底色，加载慢时也有个框 */
             " 
             loading="lazy">`;
            } else if (msg.type === 'audio') {
                // 模拟语音条：图标 + 时长/内容
                const len = msg.text ? msg.text.length : 0;
                const duration = Math.min(60, Math.max(2, Math.ceil(len / 2)));
                const safeText = this.escapeHtml(msg.text || "语音转文字...");

                // === 🔴 核心修改 1：读取数据中的展开状态 ===
                // 如果 msg.isExpanded 为 true，则加上 'show' 类
                const textClass = msg.isExpanded ? "voice-transcription show" : "voice-transcription";

                bubbleStyleOverride = "padding: 8px 13px; display: flex; align-items: center; min-height: 40px; box-sizing: border-box; flex-wrap: wrap;"; // flex-wrap 允许换行

                // === 🔴 核心修改 2：HTML 结构调整，onclick 改为调用 toggleExpand ===
                // 注意：这里 onclick 不再直接操作 DOM，而是调用 scroller 的方法
                contentHtml = `<div class="voice-msg-container" style="width:100%" onclick="event.stopPropagation(); window.chatScroller.toggleExpand(${msg.id})"><div class="voice-bar-wrapper"><div class="voice-wave-icon"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div><span class="voice-duration">${duration}"</span></div><div class="${textClass}">${safeText}</div></div>`;
            } else {
                // === 文本消息处理 (保持原样) ===
                contentHtml = this.escapeHtml(msg.text);
                if (msg.text && (msg.text.includes('typing-dots') || msg.text.includes('typing-bubble'))) {
                    contentHtml = msg.text;
                }
            }

            html += `
<div class="virtual-item" data-index="${realIndex}">
    <div class="${rowClass}" style="align-items: flex-start;"> <div class="avatar" style="${finalAvatarStyle}"></div>
        
        <div class="msg-bubble" 
             style="${bubbleStyleOverride}"
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
    window.chatScroller = new ChatVirtualScroller(
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

                <div class="menu-item" onclick="openStickerManager()">
                    <div class="avatar" style="width:40px;height:40px;background:#EAEBF9; margin-right:12px;">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="#9B9ECE">
                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                        </svg>
                    </div>
                    <div class="chat-info" style="flex-grow:1;">
                        <h4 style="margin:0;">我的表情</h4>
                        <p style="margin:0;font-size:12px;color:#999;">管理自定义表情包</p>
                    </div>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#ccc">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                    </svg>
                </div>
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

        // 1. 【修正】调用世界书的查询接口，而不是表情包的
        // 使用 this.type (global/local) 和 this.categoryId
        const newItems = await window.dbSystem.getWorldBooksPaged(this.type, this.categoryId, this.pageSize, this.offset);

        if (newItems.length < this.pageSize) {
            this.isFinished = true;
        }

        if (newItems.length > 0) {
            this.listData = [...this.listData, ...newItems];
            this.offset += newItems.length;

            // 2. 【修正】高度计算逻辑
            // 世界书是单列列表，高度 = 数量 * 单项高度
            // 之前的 this.colCount 和 this.gap 是表情包网格用的，这里要删掉
            const totalHeight = this.listData.length * this.itemHeight;
            this.content.style.height = totalHeight + 'px';

            this.render();
        }
        // 3. 【修正】空状态文案
        else if (this.listData.length === 0) {
            this.container.innerHTML = `
            <div style="
                width: 100%;
                height: 300px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #ccc;
            ">
                <svg viewBox="0 0 24 24" width="60" height="60" fill="#eee" style="margin-bottom:15px;">
                    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                </svg>
                <div style="font-size:15px; color:#999; font-weight:500;">还没有相关设定</div>
                <div style="font-size:13px; color:#ccc; margin-top:6px;">点击右上角 + 号添加</div>
            </div>`;
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

/* js/render.js */

// --- 全局长按监听 (修复新消息无法长按的问题) ---
// 将监听器绑定在 document 上，这样无论 DOM 怎么变，都能捉到

let globalLongPressTimer = null;
let globalLongPressStart = { x: 0, y: 0 };
let currentLongPressBubble = null;

document.addEventListener('touchstart', function (e) {
    // 1. 检查点击的目标是否是消息气泡
    const bubble = e.target.closest('.msg-bubble');

    // 如果不是气泡，或者是系统消息，忽略
    if (!bubble || bubble.classList.contains('msg-system')) return;

    currentLongPressBubble = bubble;
    globalLongPressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    // 视觉反馈
    bubble.classList.add('long-pressed');

    // 开启定时器 (500ms)
    globalLongPressTimer = setTimeout(() => {
        if (currentLongPressBubble) {
            // 触发菜单
            window.showMsgMenu(globalLongPressStart.x, globalLongPressStart.y, currentLongPressBubble);

            // 震动反馈
            if (navigator.vibrate) navigator.vibrate(10);
        }
    }, 500);

}, { passive: true });

document.addEventListener('touchmove', function (e) {
    if (!globalLongPressTimer) return;

    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;

    // 如果移动超过 10px，视为滑动，取消长按
    if (Math.abs(moveX - globalLongPressStart.x) > 10 || Math.abs(moveY - globalLongPressStart.y) > 10) {
        clearTimeout(globalLongPressTimer);
        globalLongPressTimer = null;

        // 移除高亮
        if (currentLongPressBubble) {
            currentLongPressBubble.classList.remove('long-pressed');
            currentLongPressBubble = null;
        }
    }
}, { passive: true });

document.addEventListener('touchend', function (e) {
    // 手指抬起，清除定时器
    if (globalLongPressTimer) {
        clearTimeout(globalLongPressTimer);
        globalLongPressTimer = null;
    }
    // 移除高亮
    if (currentLongPressBubble) {
        currentLongPressBubble.classList.remove('long-pressed');
        currentLongPressBubble = null;
    }
}, { passive: true });

/* =========================================
   [新增] 表情包网格虚拟列表 (Grid Virtual Scroller)
   ========================================= */

let stickerScroller = null; // 全局实例

// 1. 清理内存 (在关闭APP时调用)
window.cleanStickerMemory = function () {
    if (stickerScroller) {
        stickerScroller.destroy();
        stickerScroller = null;
    }
    const container = document.getElementById('sticker-grid-container');
    if (container) container.innerHTML = '';
    console.log("表情包内存已释放 (Sticker Cleaned)");
};

// 2. 网格虚拟列表类
class StickerVirtualScroller {
    constructor(containerId, packId) {
        this.container = document.getElementById(containerId); // 外部容器 app-body
        // 注意：表情页的滚动容器其实是 app-body，而不是 grid-container
        // 我们需要找到最近的 scroll 父级
        this.scrollParent = this.container.closest('.app-body') || this.container;

        this.packId = packId;
        this.listData = [];
        this.isLoading = false;
        this.isFinished = false;

        this.offset = 0;
        this.pageSize = 30; // 每次加载30张

        // 网格配置
        this.colCount = 3; // 3列
        this.gap = 12;     // 间距 12px
        this.paddingX = 0; // 容器内边距(如果CSS设了padding这里要扣掉)

        // 动态计算单项宽高
        // 容器宽 - (列数-1)*间距 / 列数
        const clientW = this.container.clientWidth || window.innerWidth;
        // 假设 app-body 有 16px padding * 2 = 32px
        // 我们取 container 的实际宽度
        this.itemWidth = (clientW - (this.gap * (this.colCount - 1))) / this.colCount;

        // 高度 = 宽度 (正方形图) + 名字高度 (约26px)
        this.itemHeight = this.itemWidth + 26;

        this.buffer = 4; // 多渲染几行
        this.activeUrls = []; // Blob管理

        // 内部容器 (用于撑开高度)
        this.content = document.createElement('div');
        this.container.innerHTML = '';
        this.container.appendChild(this.content);

        this.bindScroll();
        this.loadMore();
    }

    bindScroll() {
        this.onScroll = () => {
            requestAnimationFrame(() => {
                this.render();
                // 触底加载
                const { scrollTop, scrollHeight, clientHeight } = this.scrollParent;
                if (scrollHeight - scrollTop - clientHeight < 300) {
                    this.loadMore();
                }
            });
        };
        this.scrollParent.addEventListener('scroll', this.onScroll, { passive: true });
    }

    async loadMore() {
        if (this.isLoading || this.isFinished) return;
        this.isLoading = true;

        const newItems = await window.dbSystem.getStickersPaged(this.packId, this.pageSize, this.offset);

        if (newItems.length < this.pageSize) {
            this.isFinished = true;
        }

        if (newItems.length > 0) {
            // ... (这部分保持不变) ...
            this.listData = [...this.listData, ...newItems];
            this.offset += newItems.length;

            const rowCount = Math.ceil(this.listData.length / this.colCount);
            const totalHeight = rowCount * (this.itemHeight + this.gap);
            this.content.style.height = totalHeight + 'px';

            this.render();
        }
        // 👇👇👇 重点修改这里 👇👇👇
        else if (this.listData.length === 0) {
            this.container.innerHTML = `
            <div style="
                width: 100%;
                height: 300px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #ccc;
            ">
                <svg viewBox="0 0 24 24" width="60" height="60" fill="#eee" style="margin-bottom:15px;">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
                <div style="font-size:15px; color:#999; font-weight:500;">这里还是空的</div>
                <div style="font-size:13px; color:#ccc; margin-top:6px;">点击右上角 <span style="font-weight:bold; color:#9B9ECE;">+</span> 号添加表情</div>
            </div>`;
        }
        // 👆👆👆 修改结束 👆👆👆

        this.isLoading = false;
    }

    refresh() {
        this.render(true); // 强制重绘
    }

    render(force = false) {
        if (!this.scrollParent) return;

        const scrollTop = this.scrollParent.scrollTop;
        const visibleHeight = this.scrollParent.clientHeight;

        // 计算可视行范围
        const startRow = Math.floor(scrollTop / (this.itemHeight + this.gap)) - this.buffer;
        const endRow = Math.floor((scrollTop + visibleHeight) / (this.itemHeight + this.gap)) + this.buffer;

        // 转换为数据索引范围
        let startIndex = startRow * this.colCount;
        let endIndex = (endRow + 1) * this.colCount;

        if (startIndex < 0) startIndex = 0;
        if (endIndex > this.listData.length) endIndex = this.listData.length;

        // 简单的差异检测 (实际应用中这里可以优化)
        // 为省事直接全部重绘可视区域，销毁旧Blob
        if (this.activeUrls.length > 0) {
            this.activeUrls.forEach(u => URL.revokeObjectURL(u));
            this.activeUrls = [];
        }

        let html = '';
        const visibleData = this.listData.slice(startIndex, endIndex);

        visibleData.forEach((s, i) => {
            const realIndex = startIndex + i;

            // --- 核心：网格坐标计算 ---
            const row = Math.floor(realIndex / this.colCount);
            const col = realIndex % this.colCount;

            const top = row * (this.itemHeight + this.gap);
            const left = col * (this.itemWidth + this.gap);
            // -----------------------

            let src = s.src;
            if (s.src instanceof Blob) {
                src = URL.createObjectURL(s.src);
                this.activeUrls.push(src);
            }

            const isSelectMode = window.isStickerSelectMode || false;
            const selectedSet = window.selectedStickerIds || new Set();
            const isSelected = selectedSet.has(s.id);
            const cellClass = `sticker-cell ${isSelectMode ? 'selected-mode' : ''} ${isSelected ? 'selected' : ''}`;

            const clickAction = isSelectMode
                ? `toggleStickerSelection(${s.id}, this)`
                : `openStickerPreview('${src}')`;

            html += `
            <div class="${cellClass}" onclick="${clickAction}"
                 style="width:${this.itemWidth}px; height:${this.itemHeight}px; transform:translate3d(${left}px, ${top}px, 0);">
                <div class="sticker-check-overlay"></div>
                <div class="sticker-img-box" style="height:${this.itemWidth}px;">
                    <img src="${src}" loading="lazy" style="pointer-events:none;">
                </div>
                <div class="sticker-name">${s.name || '未命名'}</div>
            </div>`;
        });

        this.content.innerHTML = html;
    }

    destroy() {
        if (this.scrollParent) this.scrollParent.removeEventListener('scroll', this.onScroll);
        if (this.activeUrls.length > 0) {
            this.activeUrls.forEach(u => URL.revokeObjectURL(u));
        }
        this.container.innerHTML = '';
        this.listData = [];
    }
}

// 3. 初始化入口
window.initStickerScroller = function (packId) {
    if (stickerScroller) stickerScroller.destroy();
    stickerScroller = new StickerVirtualScroller('sticker-grid-container', packId);
};

// 4. 刷新 (用于选择模式切换)
window.refreshStickerScroller = function () {
    if (stickerScroller) stickerScroller.refresh();
};
let chatStickerScroller = null;
let chatPanelActiveUrls = []; // 专门管理聊天面板的临时图片

// 1. 清理内存 (关闭面板时调用)
window.cleanChatStickerMemory = function () {
    if (chatStickerScroller) {
        chatStickerScroller.destroy();
        chatStickerScroller = null;
    }
    if (chatPanelActiveUrls.length > 0) {
        chatPanelActiveUrls.forEach(u => URL.revokeObjectURL(u));
        chatPanelActiveUrls = [];
    }
    const container = document.getElementById('chat-sticker-body');
    if (container) container.innerHTML = '';

    console.log("聊天表情面板内存已释放");
};

// 2. 简易虚拟列表类 (针对聊天面板优化)
class ChatStickerVirtualScroller {
    constructor(containerId, packId) {
        this.container = document.getElementById(containerId);
        this.packId = packId;
        this.listData = [];
        this.isLoading = false;

        this.colCount = 4; // 聊天面板窄，放4列
        this.gap = 10;

        // 动态计算宽高
        const clientW = this.container.clientWidth;
        // 减去 padding (假设10px * 2)
        const usableW = clientW;
        this.itemSize = (usableW - (this.gap * (this.colCount - 1))) / this.colCount;

        // 撑开高度的内容层
        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.content);

        this.bindScroll();
        this.loadData();
    }

    bindScroll() {
        this.onScroll = () => {
            requestAnimationFrame(() => this.render());
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    async loadData() {
        // 一次性拿该分类下的所有表情 (一般表情包不会有几千张，几百张一次性拿没问题)
        this.listData = await window.dbSystem.stickers.where('packId').equals(this.packId).reverse().toArray();

        const rowCount = Math.ceil(this.listData.length / this.colCount);
        this.content.style.height = (rowCount * (this.itemSize + this.gap)) + 'px';

        this.render();
    }

    render() {
        if (!this.container) return;
        const scrollTop = this.container.scrollTop;
        const visibleHeight = this.container.clientHeight;
        const buffer = 2; // 上下缓冲行数

        const rowHeight = this.itemSize + this.gap;

        let startRow = Math.floor(scrollTop / rowHeight) - buffer;
        let endRow = Math.ceil((scrollTop + visibleHeight) / rowHeight) + buffer;

        if (startRow < 0) startRow = 0;

        let startIndex = startRow * this.colCount;
        let endIndex = endRow * this.colCount;
        if (endIndex > this.listData.length) endIndex = this.listData.length;

        // 清理上一帧的 URL (极致内存管理)
        // 注意：这里可能会导致闪烁，如果闪烁严重，可以像之前一样维护一个 LRU 或只在 destroy 时清理
        // 既然用户要求“关闭就释放”，为了流畅度，这里可以暂不每帧 revoke，而是等 closeChatStickerPanel 统一 revoke
        // 但为了把控 Blob 生成量，我们只生成可视区域的

        let html = '';
        const visibleData = this.listData.slice(startIndex, endIndex);

        visibleData.forEach((s, i) => {
            const realIndex = startIndex + i;
            const row = Math.floor(realIndex / this.colCount);
            const col = realIndex % this.colCount;

            const top = row * rowHeight;
            const left = col * (this.itemSize + this.gap);

            let src = s.src;
            if (s.src instanceof Blob) {
                src = URL.createObjectURL(s.src);
                chatPanelActiveUrls.push(src); // 记录
            }

            // 点击直接发送
            // 注意：如果 src 是 Blob URL，我们不能直接传 URL string，因为异步后可能失效
            // 所以我们由于数据都在 listData 里，我们可以传 id 或者 index，然后在 send 函数里去 listData 取
            // 这里为了方便，直接把 s.src (原始数据) 传给 sendStickerMsg 还是比较麻烦，因为 onclick 是字符串。
            // 解决：我们将原始数据挂在 DOM 上，或者使用闭包，但虚拟列表是 innerHTML 字符串拼接。
            // 最佳方案：onclick="prepareSendSticker(${s.id})"

            html += `
            <div class="chat-sticker-item" 
                 onclick="handleStickerClick(${s.id})"
                 style="width:${this.itemSize}px; height:${this.itemSize}px; top:${top}px; left:${left}px;">
                <img src="${src}" loading="lazy">
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

// 3. 初始化入口
window.initChatStickerScroller = async function (packId) {
    const container = document.getElementById('chat-sticker-body');
    if (!container) return;

    // 1. 清空容器
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#ccc;">加载中...</div>';

    // 2. 获取数据
    const stickers = await window.dbSystem.stickers
        .where('packId').equals(packId)
        .reverse()
        .toArray();

    if (stickers.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ddd;font-size:12px;">这里是空的</div>';
        return;
    }

    // 3. 生成 HTML
    let html = `<div class="chat-sticker-grid-layout">`;

    stickers.forEach(s => {
        let src = s.src;
        // 如果是 Blob，转 URL
        if (s.src instanceof Blob) {
            src = URL.createObjectURL(s.src);
            // 这里为了简单，我们暂不追踪 activeUrls，
            // 因为聊天面板开关频率高，浏览器自己会处理部分 GC
        }

        // 🔴🔴🔴 修改点在这里：加入了 chat-sticker-name 🔴🔴🔴
        // 使用 || '表情' 防止名字为空时塌陷
        html += `
        <div class="chat-sticker-grid-item" onclick="handleStickerClick(${s.id})">
            <img src="${src}" loading="lazy">
            <div class="chat-sticker-name">${s.name || '表情'}</div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
};

// 4. 刷新 (切换 Tab 时)
window.refreshChatStickerGrid = function () {
    if (chatStickerScroller) chatStickerScroller.render();
};

// 5. 点击处理 (中转函数)
window.handleStickerClick = async function (id) {
    // 从 DB 取最新数据发送，最稳妥
    const sticker = await window.dbSystem.stickers.get(id);
    if (sticker) {
        window.sendStickerMsg(sticker.src);
    }
};