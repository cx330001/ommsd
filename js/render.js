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
        const totalHeight = this.listData.length * this.itemHeight;
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
    const myPersonas = await window.dbSystem.getAll();

    if (myPersonas.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999">请先去“我”的页面创建一个身份</div>';
        return;
    }

    listEl.innerHTML = myPersonas.map(p => {
        // 简单处理头像显示
        let imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;font-size:14px;background:#9B9ECE;">${p.name[0]}</div>`;
        if (p.avatar instanceof Blob) {
            const u = URL.createObjectURL(p.avatar);
            activeUrls.push(u); // 记得也要管理这个内存
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
                <div style="font-size:12px;color:#999;">ID: ${p.userId}</div>
            </div>
        </div>`;
    }).join('');
};


// --- 4. 确认开启聊天 (创建会话) ---
window.confirmChat = async function (myPersonaId) {
    if (!targetContactId) return;

    // 调用数据库：创建或获取已有的会话ID
    // (注意：这里假设你在 db.js 里加了 createOrGetChat 方法)
    let chatId;
    if (window.dbSystem.createOrGetChat) {
        chatId = await window.dbSystem.createOrGetChat(targetContactId, myPersonaId);
    } else {
        alert("请先更新 db.js 文件，添加 createOrGetChat 方法！");
        return;
    }

    // 关闭弹窗
    document.getElementById('modal-select-me').style.display = 'none';

    // 刷新首页消息列表 (这样新会话会显示在第一个)
    await window.renderChatUI();

    // 直接跳转进聊天页面
    window.openChatDetail(chatId);
};


// --- 5. 打开聊天详情页 (Open Chat Window) ---
/* --- js/render.js 的末尾部分 --- */

// 全局变量，用于管理当前的滚动实例
let chatScroller = null;
let currentActiveChatId = null;

// ==========================================
//  ChatVirtualScroller: 不定高度虚拟列表类
// ==========================================
class ChatVirtualScroller {
    constructor(containerId, messages, meAvatar, contactAvatar) {
        this.container = document.getElementById(containerId);
        this.messages = messages || [];
        this.meAvatar = meAvatar;
        this.contactAvatar = contactAvatar;

        this.heightCache = new Map(); // 缓存高度
        this.estimatedItemHeight = 80;
        this.visibleCount = 20; // 只渲染20条
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

        // 4. 生成HTML (DOM 销毁与重建都在这里发生)
        let html = '';
        const visibleData = this.messages.slice(start, end);

        visibleData.forEach((msg, i) => {
            const realIndex = start + i;
            const isMe = msg.isMe === 1;
            const avatarStyle = isMe ? this.meAvatar : this.contactAvatar;
            // 样式 class 对应 style.css
            const rowClass = isMe ? 'msg-row me' : 'msg-row';

            html += `
            <div class="virtual-item" data-index="${realIndex}">
                <div class="${rowClass}">
                    <div class="avatar" style="${avatarStyle}"></div>
                    <div class="msg-bubble">${this.escapeHtml(msg.text)}</div>
                </div>
            </div>`;
        });

        this.content.innerHTML = html;

        // 5. 修正高度
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
        this.render();
        this.scrollToBottom();
    }

    scrollToBottom() {
        // 使用 setTimeout 等待 DOM 渲染完成
        setTimeout(() => {
            // 1. 获取容器现在的总高度
            const totalHeight = this.container.scrollHeight;
            // 2. 强行设置滚动位置为最大高度 + 额外偏移量
            this.container.scrollTop = totalHeight + 200;

            // 3. 再次触发渲染，确保最后一条消息真的被画出来了（因为虚拟列表可能没来得及渲染最后一条）
            this.render();
        }, 60); //稍微延长一点时间到 60ms
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

    // 1. 获取会话信息
    const chats = await window.dbSystem.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const contact = await window.dbSystem.contacts.get(chat.contactId);
    const me = await window.dbSystem.personas.get(chat.personaId);

    // --- 修改开始：设置名字和状态 ---

    // 1. 设置名字
    document.getElementById('chat-title-text').innerText = contact.name;

    // 2. 设置状态 (这里模拟随机在线状态，你可以根据需要改)
    // 假设 ID 是偶数就在线，奇数就离线 (或者直接写死 true)
    const isOnline = Math.random() > 0.3; // 70% 概率在线
    // const isOnline = true; // 如果想永远在线，就用这一行

    const statusDot = document.getElementById('chat-status-dot');
    const statusText = document.getElementById('chat-status-text');

    if (isOnline) {
        statusDot.classList.add('online');
        statusText.innerText = "在线";
    } else {
        statusDot.classList.remove('online');
        statusText.innerText = "离线"; // 或者显示 "15分钟前在线"
    }
    window.openApp('conversation');

    // 2. 准备头像
    let contactStyle = `background:#E8C1C6`;
    if (contact.avatar instanceof Blob) contactStyle = `background-image:url(${URL.createObjectURL(contact.avatar)})`;
    else if (typeof contact.avatar === 'string') contactStyle = `background-image:url(${contact.avatar})`;

    let meStyle = `background:#9B9ECE`;
    if (me.avatar instanceof Blob) meStyle = `background-image:url(${URL.createObjectURL(me.avatar)})`;
    else if (typeof me.avatar === 'string') meStyle = `background-image:url(${me.avatar})`;

    // 3. [重要] 从数据库取历史消息
    const messages = await window.dbSystem.getMessages(chatId);

    // 4. 清理旧列表，新建虚拟列表
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }
    chatScroller = new ChatVirtualScroller('chat-body', messages, meStyle, contactStyle);

    // 5. 绑定回车键
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
    const user = await window.dbSystem.getCurrent();

    // --- A. 渲染“我”的页面 ---
    if (user) {
        const container = document.getElementById('me-content-placeholder');
        if (container) {
            let avatarStyle = "";
            let avatarText = user.name[0];
            if (user.avatar instanceof Blob) {
                const url = URL.createObjectURL(user.avatar);
                activeUrls.push(url);
                avatarStyle = `background-image: url(${url});`;
                avatarText = "";
            } else if (typeof user.avatar === 'string' && user.avatar.length > 0) {
                avatarStyle = `background-image: url(${user.avatar});`;
                avatarText = "";
            }

            container.innerHTML = `
                <div class="me-card">
                    <div class="me-avatar" style="${avatarStyle}" onclick="openModal()">${avatarText}</div>
                    <div class="chat-info" onclick="openModal()" style="flex-grow:1;">
                        <h3 style="margin:0;color:#333;">${user.name}</h3>
                        <p style="margin-top:5px;font-size:12px;color:#999;">ID: ${user.userId}</p>
                    </div>
                    <div style="padding:10px; cursor:pointer;" onclick="editCurrentPersona()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#9B9ECE">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </div>
                </div>
                <div class="menu-item"><div class="chat-info"><h4>通用设置</h4></div></div>
            `;
        }
    }

    // --- B. 渲染“消息”列表 (从数据库读取) ---
    const list = document.getElementById('msg-list');
    if (!list) return;

    list.innerHTML = ''; // 清空列表

    // 检查是否有 getChats 方法
    if (!window.dbSystem.getChats) return;

    const chats = await window.dbSystem.getChats();

    if (chats.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;color:#ccc;margin-top:50px;font-size:14px;">
                暂无消息<br>去好友列表发起聊天吧
            </div>`;
        return;
    }

    // 遍历会话并显示
    for (const chat of chats) {
        const contact = await window.dbSystem.contacts.get(chat.contactId);
        const me = await window.dbSystem.personas.get(chat.personaId);

        // 如果人被删了，就不显示这个会话
        if (!contact || !me) continue;

        let img = contact.name[0];
        let style = "background:#E8C1C6"; // 默认莫兰迪粉

        if (contact.avatar instanceof Blob) {
            const u = URL.createObjectURL(contact.avatar);
            activeUrls.push(u);
            img = "";
            style = `background-image:url(${u})`;
        } else if (typeof contact.avatar === 'string' && contact.avatar) {
            img = "";
            style = `background-image:url(${contact.avatar})`;
        }

        const html = `
        <div class="chat-item" onclick="openChatDetail(${chat.id})">
            <div class="avatar" style="${style}">${img}</div>
            <div class="chat-info">
                <h4>${contact.name}</h4>
                <p>${chat.lastMsg || '暂无消息'}</p>
            </div>
            <div class="chat-meta">刚刚</div>
        </div>`;

        list.insertAdjacentHTML('beforeend', html);
    }
};