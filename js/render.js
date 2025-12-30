/* =========================================
   render.js - 页面渲染逻辑 (完整最终版)
   ========================================= */

let activeUrls = []; // 管理 Blob URL 避免内存溢出
let targetContactId = null; // 临时记录：我想和“谁”聊天

// --- 1. 内存清理函数 ---
function cleanUpMemory() {
    // 清空消息列表
    const msgList = document.getElementById('msg-list');
    if (msgList) msgList.innerHTML = '';

    // 清空“我”的页面
    const meContent = document.getElementById('me-content-placeholder');
    if (meContent) meContent.innerHTML = '';

    // 清空好友列表
    const contactList = document.getElementById('contact-list-dynamic');
    if (contactList) contactList.innerHTML = '';

    // 【新增】清空聊天详情页的消息气泡 (非常重要，防止聊天记录占用内存)
    const chatBody = document.getElementById('chat-body');
    if (chatBody) chatBody.innerHTML = '';

    // 销毁所有图片链接
    activeUrls.forEach(u => URL.revokeObjectURL(u));
    activeUrls = [];
    console.log("内存已释放 (Memory Cleaned)");
}
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
    // 构造函数变动：传入 avatarMap 和 currentUserId
    constructor(containerId, messages, avatarMap, currentUserId) {
        this.container = document.getElementById(containerId);
        this.messages = messages || [];
        this.avatarMap = avatarMap || {}; // { id: "background-image:..." }
        this.currentUserId = currentUserId; // 当前登录用户的ID

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
        setTimeout(() => this.scrollToBottom(), 50);
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
        this.onScroll = () => requestAnimationFrame(() => this.render());
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
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

            // --- 核心修改开始 ---

            // 判断左右：发送者是否是当前用户
            // 如果 currentUserId 为空(未登录)，或者不匹配，都显示在左边
            const isRight = (this.currentUserId && msg.senderId === this.currentUserId);
            const rowClass = isRight ? 'msg-row me' : 'msg-row';

            // 获取头像：从 Map 中查找，找不到用默认灰色
            const avatarStyle = this.avatarMap[msg.senderId] || 'background:#ccc';

            // --- 核心修改结束 ---

            // 转义处理
            let contentHtml = this.escapeHtml(msg.text);
            if (msg.text && msg.text.includes('typing-dots')) {
                contentHtml = msg.text;
            }

            html += `
            <div class="virtual-item" data-index="${realIndex}">
                <div class="${rowClass}">
                    <div class="avatar" style="${avatarStyle}"></div>
                    <div class="msg-bubble">${contentHtml}</div>
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
        this.container.scrollTop = this.container.scrollHeight + 10000;
        this.render();
        requestAnimationFrame(() => {
            this.container.scrollTop = this.container.scrollHeight;
            setTimeout(() => {
                this.container.scrollTop = this.container.scrollHeight;
            }, 50);
        });
    }

    removeLast() {
        if (this.messages.length > 0) {
            this.messages.pop();
            this.render();
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const body = this.container;
            body.scrollTop = body.scrollHeight + 500;
            setTimeout(() => {
                body.scrollTop = body.scrollHeight + 500;
                this.render();
            }, 50);
        });
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
    currentActiveChatId = chatId;
    window.currentActiveChatId = chatId;

    // 1. 获取会话和当前用户
    const currentUser = await window.dbSystem.getCurrent();
    const chats = await window.dbSystem.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // 2. 确定聊天标题 (对方的名字)
    // 逻辑：在 members 里找一个“不是我”的人。如果都是我，或者都没找到，默认取第一个。
    let targetId = chat.members.find(id => id !== currentUser?.id);
    if (!targetId) targetId = chat.members[0];

    const targetChar = await window.dbSystem.getChar(targetId);
    if (targetChar) {
        document.getElementById('chat-title-text').innerText = targetChar.name;
    } else {
        document.getElementById('chat-title-text').innerText = "未知用户";
    }

    // 设置在线状态 (模拟)
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

    window.openApp('conversation');

    // 3. [关键] 预处理所有成员的头像 (Avatar Map)
    // 这样 Scroller 渲染时直接取，不用每次都 createObjectURL
    const avatarMap = {};

    // 遍历所有成员ID (members 是数组 [1, 5] 等)
    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        if (char) {
            let style = "background:#ccc"; // 默认灰
            if (char.avatar instanceof Blob) {
                const u = URL.createObjectURL(char.avatar);
                // 记得加入 activeUrls 以便 cleanUpMemory 时释放
                if (window.activeUrls) window.activeUrls.push(u);
                style = `background-image:url(${u})`;
            } else if (typeof char.avatar === 'string' && char.avatar) {
                style = `background-image:url(${char.avatar})`;
            } else {
                // 没有头像时，可以用名字首字母做背景
                // 这里简单处理，你可以写复杂点
                style = `background:#9B9ECE`;
            }
            avatarMap[memberId] = style;
        }
    }

    // 4. 从数据库取消息
    const messages = await window.dbSystem.getMessages(chatId);

    // 5. 初始化虚拟列表
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }

    // 传入 avatarMap 和 当前用户的ID (用于判断左右)
    chatScroller = new ChatVirtualScroller(
        'chat-body',
        messages,
        avatarMap,
        currentUser ? currentUser.id : null
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
    // 1. 这里定义的变量叫 currentUser
    const currentUser = await window.dbSystem.getCurrent();

    // --- A. 渲染“我”的页面 ---
    const container = document.getElementById('me-content-placeholder');
    if (container) {
        // 2. 这里必须用 currentUser 来判断
        if (currentUser) {
            // 1. 如果有当前身份，显示卡片
            let avatarStyle = "background:#9B9ECE"; // 默认紫色
            let avatarText = currentUser.name[0]; // 修改 user -> currentUser

            if (currentUser.avatar instanceof Blob) { // 修改 user -> currentUser
                const url = URL.createObjectURL(currentUser.avatar);
                if (window.activeUrls) window.activeUrls.push(url);
                avatarStyle = `background-image: url(${url});`;
                avatarText = "";
            } else if (typeof currentUser.avatar === 'string' && currentUser.avatar.length > 0) {
                avatarStyle = `background-image: url(${currentUser.avatar});`;
                avatarText = "";
            }

            container.innerHTML = `
                <div class="me-card">
                    <div class="me-avatar" style="${avatarStyle}" onclick="openModal()">${avatarText}</div>
                    <div class="chat-info" onclick="openModal()" style="flex-grow:1;">
                        <h3 style="margin:0;color:#333;">${currentUser.name}</h3> <p style="margin:4px 0 0 0;color:#999;font-size:12px;">${currentUser.desc || '点击切换/管理身份'}</p> </div>
                    <div style="padding:10px; cursor:pointer;" onclick="editCurrentPersona()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#9B9ECE">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </div>
                </div>
                <div class="menu-item"><div class="chat-info"><h4>通用设置</h4></div></div>
            `;
        } else {
            // 2. [修复空白] 如果没有选中身份，显示创建按钮
            container.innerHTML = `
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

    // --- B. 渲染“消息”列表 (从数据库读取) ---
    const list = document.getElementById('msg-list');


    list.innerHTML = ''; // 清空列表

    // 检查是否有 getChats 方法


    const chats = await window.dbSystem.getChats();

    if (chats.length === 0) return;

    // 遍历会话并显示
    for (const chat of chats) {
        // 逻辑更新：
        // 以前是找 contactId，现在 chat.members 是一个数组 [id1, id2]
        // 我们需要找到 "不是我" 的那个 ID 来展示头像
        let targetId = chat.members.find(id => id !== currentUser?.id);
        if (!targetId) targetId = chat.members[0]; // 防御性

        const targetChar = await window.dbSystem.getChar(targetId);
        if (!targetChar) continue;

        // 渲染头像
        let img = targetChar.name[0];
        let style = "background:#E8C1C6"; // 默认莫兰迪粉

        // =========== ❌ 错误代码 ===========
        /*
        if (contact.avatar instanceof Blob) {
            const u = URL.createObjectURL(contact.avatar);
            activeUrls.push(u);
            img = "";
            style = `background-image:url(${u})`;
        } else if (typeof contact.avatar === 'string' && contact.avatar) {
            img = "";
            style = `background-image:url(${contact.avatar})`;
        }
        */

        // =========== ✅ 修正代码 (把 contact 改为 targetChar) ===========
        if (targetChar.avatar instanceof Blob) {
            const u = URL.createObjectURL(targetChar.avatar);
            if (window.activeUrls) window.activeUrls.push(u); // 建议加上 window. 前缀以防万一
            img = "";
            style = `background-image:url(${u})`;
        } else if (typeof targetChar.avatar === 'string' && targetChar.avatar) {
            img = "";
            style = `background-image:url(${targetChar.avatar})`;
        }
        // ============================================================

        const html = `
        <div class="chat-item" onclick="openChatDetail(${chat.id})">
            <div class="avatar" style="${style}">${img}</div>
            <div class="chat-info">
                <h4>${targetChar.name}</h4>
                <p>${chat.lastMsg || '暂无消息'}</p>
            </div>
        </div>`;
        list.insertAdjacentHTML('beforeend', html);
    }
};