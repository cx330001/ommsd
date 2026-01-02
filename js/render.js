let activeUrls = []; // 管理 Blob URL 避免内存溢出
let msgListActiveUrls = []; // 专门存消息列表页的图片
let contactListActiveUrls = [];
let targetContactId = null;

window.cleanMsgListMemory = function () {

    if (msgListActiveUrls.length > 0) {
        msgListActiveUrls.forEach(u => URL.revokeObjectURL(u));
        msgListActiveUrls = [];
    }

    const list = document.getElementById('msg-list');
    if (list) list.innerHTML = '';

    const mePlaceholder = document.getElementById('me-content-placeholder');
    if (mePlaceholder) mePlaceholder.innerHTML = '';

    console.log("消息列表内存已释放 (MsgList Cleaned)");
};
window.cleanContactMemory = function () {

    if (typeof virtualScroller !== 'undefined' && virtualScroller) {
        virtualScroller.destroy();
        virtualScroller = null;
    }
    if (contactListActiveUrls.length > 0) {
        contactListActiveUrls.forEach(u => URL.revokeObjectURL(u));
        contactListActiveUrls = [];
    }
    const container = document.getElementById('contact-list-dynamic');
    if (container) container.innerHTML = '';

    if (typeof allContactsCache !== 'undefined') {
        allContactsCache = [];
    }

    console.log("好友列表内存已释放 (ContactList Cleaned)");
};

window.cleanChatDetailMemory = function () {
    // 确保调用 destroy()，触发里面的 URL.revokeObjectURL
    if (typeof chatScroller !== 'undefined' && chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }

    const body = document.getElementById('chat-body');
    if (body) body.innerHTML = '';

    // 清理全局的 activeUrls (用于其他模块的)
    if (window.activeUrls && window.activeUrls.length > 0) {
        window.activeUrls.forEach(u => URL.revokeObjectURL(u));
        window.activeUrls = [];
    }

    console.log("聊天详情页内存已深度释放 (ChatDetail Cleaned)");
};

window.cleanUpMemory = function () {
    window.cleanMsgListMemory();
    window.cleanContactMemory();
    window.cleanChatDetailMemory();
};
window.cleanUpMemory = cleanUpMemory;

//好友列表
let allContactsCache = [];
let virtualScroller = null;

function revokeOldUrls(urls) {
    if (urls && urls.length) {
        urls.forEach(u => URL.revokeObjectURL(u));
    }
}


class VirtualScroller {
    constructor(containerId, listData, itemHeight, renderRowFn) {
        this.container = document.getElementById(containerId);
        this.content = document.getElementById('contact-list-dynamic');
        this.listData = listData;
        this.itemHeight = itemHeight + 12;
        this.renderRowFn = renderRowFn;

        this.visibleCount = 0;
        this.startIndex = 0;
        this.lastStartIndex = -1;
        this.activeRowUrls = [];

        this.init();
    }

    init() {
        const totalHeight = this.listData.length * this.itemHeight + 100;

        this.content.style.height = totalHeight + 'px';

        this.visibleCount = Math.ceil(window.innerHeight / this.itemHeight) + 4;

        this.bindScroll();

        this.render();
    }

    bindScroll() {
        this.onScroll = () => {
            const scrollTop = this.container.scrollTop;
            this.startIndex = Math.floor(scrollTop / this.itemHeight);

            if (this.startIndex !== this.lastStartIndex) {
                this.render();
            }
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    render() {
        this.lastStartIndex = this.startIndex;

        let endIndex = this.startIndex + this.visibleCount;
        if (endIndex > this.listData.length) endIndex = this.listData.length;

        const visibleData = this.listData.slice(this.startIndex, endIndex);

        revokeOldUrls(this.activeRowUrls);
        this.activeRowUrls = [];

        let html = '';
        visibleData.forEach((item, index) => {
            const absoluteIndex = this.startIndex + index;
            const top = absoluteIndex * this.itemHeight;

            html += this.renderRowFn(item, top, this.activeRowUrls);
        });

        this.content.innerHTML = html;
    }

    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this.onScroll);
        }
        revokeOldUrls(this.activeRowUrls);
        this.activeRowUrls = [];
        this.content.innerHTML = '';
        console.log('虚拟列表已销毁，内存已释放');
    }
}

window.renderContacts = async function () {
    allContactsCache = await window.dbSystem.getContacts();
    const container = document.getElementById('tab-contacts');

    let listContainer = document.getElementById('contact-list-dynamic');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.id = 'contact-list-dynamic';
        container.appendChild(listContainer);
    }

    if (virtualScroller) {
        virtualScroller.destroy();
    }

    if (allContactsCache.length > 0) {
        virtualScroller = new VirtualScroller(
            'tab-contacts',
            allContactsCache,
            70,

            (p, top, urlTracker) => {
                let img = p.name[0];
                let style = "";

                if (p.avatar instanceof Blob) {
                    const url = URL.createObjectURL(p.avatar);
                    urlTracker.push(url);
                    img = "";
                    style = `background-image:url(${url});`;
                } else if (typeof p.avatar === 'string' && p.avatar) {
                    img = "";
                    style = `background-image:url(${p.avatar});`;
                }

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

const originalCleanUp = window.cleanUpMemory;
window.cleanUpMemory = function () {
    if (originalCleanUp) originalCleanUp();
    if (virtualScroller) {
        virtualScroller.destroy();
        virtualScroller = null;
    }
    allContactsCache = [];
};

window.prepareChat = async function (contactId) {
    targetContactId = contactId;

    const modal = document.getElementById('modal-select-me');
    if (!modal) return alert("请检查 index.html 是否添加了 modal-select-me");

    modal.style.display = 'flex';

    const listEl = document.getElementById('persona-select-list');

    const myPersonas = await window.dbSystem.getMyPersonas();

    if (myPersonas.length === 0) {
        listEl.innerHTML = `
            <div style="padding:20px;text-align:center;color:#999">
                还没有“面具”哦<br>
                <span style="font-size:12px;color:var(--theme-purple);cursor:pointer;" onclick="document.getElementById('modal-select-me').style.display='none';switchTab('me', document.querySelector('.tab-item:last-child'))">去“我”的页面创建一个吧</span>
            </div>`;
        return;
    }

    listEl.innerHTML = myPersonas.map(p => {
        let imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;font-size:14px;background:#9B9ECE;">${p.name[0]}</div>`;

        if (p.avatar instanceof Blob) {
            const u = URL.createObjectURL(p.avatar);
            if (window.activeUrls) window.activeUrls.push(u);
            imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;background-image:url(${u})"></div>`;
        } else if (typeof p.avatar === 'string' && p.avatar) {
            imgHtml = `<div class="avatar" style="width:40px;height:40px;margin-right:10px;background-image:url(${p.avatar})"></div>`;
        }

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


window.confirmChat = async function (myPersonaId) {
    if (!targetContactId) return;

    const chatId = await window.dbSystem.createOrGetChat([targetContactId, myPersonaId]);

    document.getElementById('modal-select-me').style.display = 'none';
    await window.renderChatUI();
    window.openChatDetail(chatId);
};


window.chatScroller = null;
let currentActiveChatId = null;

class ChatVirtualScroller {
    constructor(containerId, messages, avatarMap, configMap, currentUserId, chatId) {
        this.container = document.getElementById(containerId);
        this.messages = messages || [];

        // avatarMap 现在存储原始数据 (Blob 或 String)，而不是生成的 URL
        this.avatarDataMap = avatarMap || {};
        this.configMap = configMap || {};
        this.currentUserId = currentUserId;
        this.chatId = chatId;

        // 缓存：Key=ID (msgId 或 memberId), Value=BlobURL string
        this.imageUrlCache = new Map();
        this.avatarUrlCache = new Map();

        this.isLoading = false;
        this.isFinished = false;

        this.heightCache = new Map();
        this.estimatedItemHeight = 80;
        this.visibleCount = 20;
        this.buffer = 10; // 缓冲区大小，缓冲区外的图片会被释放

        this.container.innerHTML = '';
        this.content = document.createElement('div');
        this.content.id = 'chat-list-dynamic';
        this.container.appendChild(this.content);

        this.bindScroll();
        this.render();

        setTimeout(() => this.scrollToBottom(), 0);
    }

    toggleExpand(msgId) {
        const targetId = String(msgId);
        const index = this.messages.findIndex(m => String(m.id) === targetId);
        if (index === -1) return;
        const msg = this.messages[index];
        msg.isExpanded = !msg.isExpanded;
        this.heightCache.delete(index);
        this.render();
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
            if (this.container.scrollTop < 50 && !this.isLoading && !this.isFinished) {
                this.loadMoreHistory();
            }
        };
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
    }

    async loadMoreHistory() {
        if (this.isLoading) return;
        this.isLoading = true;
        const oldScrollHeight = this.container.scrollHeight;
        const oldScrollTop = this.container.scrollTop;

        const moreMsgs = await window.dbSystem.getMessagesPaged(this.chatId, 20, this.messages.length);
        if (moreMsgs.length === 0) {
            this.isFinished = true;
            this.isLoading = false;
            return;
        }

        this.messages = [...moreMsgs, ...this.messages];
        this.heightCache.clear();
        this.render();

        const newScrollHeight = this.container.scrollHeight;
        this.container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
        this.isLoading = false;
    }

    removeMessageById(id) {
        if (!this.messages) return;
        const targetId = String(id);
        const index = this.messages.findIndex(m => String(m.id) === targetId);
        if (index !== -1) {
            this.messages.splice(index, 1);
            // 尝试释放该消息关联的图片
            if (this.imageUrlCache.has(targetId)) {
                URL.revokeObjectURL(this.imageUrlCache.get(targetId));
                this.imageUrlCache.delete(targetId);
            }
        }
        this.heightCache.clear();
        this.render();
    }

    // ★★★ 核心修复：内存回收逻辑 ★★★
    destroy() {
        if (this.container) this.container.removeEventListener('scroll', this.onScroll);
        this.container.innerHTML = '';
        this.messages = [];
        this.heightCache.clear();

        // 释放所有图片 URL
        this.imageUrlCache.forEach(url => URL.revokeObjectURL(url));
        this.imageUrlCache.clear();

        // 释放所有头像 URL
        this.avatarUrlCache.forEach(url => URL.revokeObjectURL(url));
        this.avatarUrlCache.clear();

        console.log(`ChatScroller 销毁: 深度释放所有 Blob URL`);
    }

    // ★★★ 核心修复：获取并管理 Blob URL ★★★
    // 只有在渲染时才调用此方法，它会生成 URL 并缓存
    getOrUpdateBlobUrl(key, blob, cacheMap) {
        if (cacheMap.has(key)) {
            return cacheMap.get(key);
        }
        const url = URL.createObjectURL(blob);
        cacheMap.set(key, url);
        return url;
    }

    // ★★★ 核心修复：清理视野外的 URL ★★★
    pruneCache(startIndex, endIndex) {
        // 安全范围：当前视野 + 上下 buffer
        const safeStart = Math.max(0, startIndex - this.buffer);
        const safeEnd = Math.min(this.messages.length, endIndex + this.buffer);

        // 1. 清理消息图片 (real-image / image)
        // 收集安全范围内的 msgId
        const safeMsgIds = new Set();
        for (let i = safeStart; i < safeEnd; i++) {
            safeMsgIds.add(String(this.messages[i].id));
        }

        for (const [msgId, url] of this.imageUrlCache) {
            if (!safeMsgIds.has(msgId)) {
                URL.revokeObjectURL(url);
                this.imageUrlCache.delete(msgId);
                // console.log('GC: 释放消息图片', msgId);
            }
        }

        // 2. 清理头像
        // 收集安全范围内涉及的 senderId
        const safeSenderIds = new Set();
        for (let i = safeStart; i < safeEnd; i++) {
            safeSenderIds.add(String(this.messages[i].senderId));
        }
        // 加上当前用户ID，防止自己头像闪烁
        if (this.currentUserId) safeSenderIds.add(String(this.currentUserId));

        for (const [memberId, url] of this.avatarUrlCache) {
            if (!safeSenderIds.has(memberId)) {
                URL.revokeObjectURL(url);
                this.avatarUrlCache.delete(memberId);
                // console.log('GC: 释放头像', memberId);
            }
        }
    }

    render() {
        const scrollTop = this.container.scrollTop;
        const totalCount = this.messages.length;

        let sum = 0;
        let start = 0;
        for (let i = 0; i < totalCount; i++) {
            sum += this.getItemHeight(i);
            if (sum >= scrollTop) { start = i; break; }
        }

        let end = start + this.visibleCount;
        start = Math.max(0, start - this.buffer);
        end = Math.min(totalCount, end + this.buffer);

        // ★ 执行内存清理
        this.pruneCache(start, end);

        const paddingTop = this.getOffsetTop(start);
        let paddingBottom = 0;
        for (let i = end; i < totalCount; i++) paddingBottom += this.getItemHeight(i);

        this.content.style.paddingTop = paddingTop + 'px';
        this.content.style.paddingBottom = paddingBottom + 'px';

        let html = '';
        const visibleData = this.messages.slice(start, end);

        visibleData.forEach((msg, i) => {
            const realIndex = start + i;
            const isRight = (this.currentUserId && msg.senderId === this.currentUserId);
            const msgIdStr = String(msg.id);
            const senderIdStr = String(msg.senderId);

            const config = this.configMap[msg.senderId] || { size: 40, shape: 'circle', hidden: false };
            const rowClass = `${isRight ? 'msg-row me' : 'msg-row'} ${config.hidden ? 'no-avatar' : ''}`;

            // --- 动态处理头像 ---
            let avatarUrl = "";
            let avatarText = "";
            const rawAvatar = this.avatarDataMap[msg.senderId];

            if (rawAvatar instanceof Blob) {
                avatarUrl = this.getOrUpdateBlobUrl(senderIdStr, rawAvatar, this.avatarUrlCache);
            } else if (typeof rawAvatar === 'string' && rawAvatar) {
                avatarUrl = rawAvatar; // 字符串URL不需要revoke
            } else {
                avatarText = ""; // 默认头像逻辑可在此补充
            }

            const sizePx = config.size + 'px';
            const radius = config.shape === 'square' ? '6px' : '50%';
            let avatarStyle = `width: ${sizePx}; height: ${sizePx}; border-radius: ${radius}; ${isRight ? 'margin-left:10px;' : 'margin-right:10px;'}`;

            if (avatarUrl) {
                avatarStyle += `background-image:url(${avatarUrl}); background-size: cover; background-position: center;`;
            } else {
                avatarStyle += `background-color: #ccc;`; // 默认灰底
            }
            if (msg.senderId === -1) avatarStyle += "background: transparent; box-shadow: none;";


            // --- 动态处理消息内容 ---
            let contentHtml = "";
            let bubbleStyleOverride = "";

            if (msg.type === 'image') {
                bubbleStyleOverride = "background: transparent; box-shadow: none; padding: 0; width: auto; height: auto; line-height: 0;";
                let imgSrc = msg.text;
                if (msg.text instanceof Blob) {
                    // ★ 使用 image cache
                    imgSrc = this.getOrUpdateBlobUrl(msgIdStr, msg.text, this.imageUrlCache);
                }
                contentHtml = `<img src="${imgSrc}" onclick="window.previewImage && window.previewImage(this.src)" style="width: 100px; height: 100px; object-fit: contain; border-radius: 6px; cursor: pointer; display: block; background: rgba(0,0,0,0.03);" loading="lazy">`;
            }
            else if (msg.type === 'real-image') {
                bubbleStyleOverride = "background: transparent; box-shadow: none; padding: 0; width: auto; height: auto; line-height: 0;";
                let imgSrc = msg.text;
                if (msg.text instanceof Blob) {
                    // ★ 使用 image cache
                    imgSrc = this.getOrUpdateBlobUrl(msgIdStr, msg.text, this.imageUrlCache);
                }
                contentHtml = `<div style="position:relative; overflow:hidden; border-radius:12px; border:1px solid rgba(0,0,0,0.1);"><img src="${imgSrc}" onclick="window.openImageViewer(this.src)" style="width: 150px; height: 150px; object-fit: cover; cursor: zoom-in; display: block; background: #f0f0f0;" loading="lazy"></div>`;
            }
            else if (msg.type === 'audio') {
                // ... (保持原有的 audio 逻辑不变) ...
                const len = msg.text ? msg.text.length : 0;
                const duration = Math.min(60, Math.max(2, Math.ceil(len / 2)));
                const safeText = this.escapeHtml(msg.text || "语音转文字...");
                const textClass = msg.isExpanded ? "voice-transcription show" : "voice-transcription";
                bubbleStyleOverride = "padding: 8px 13px; display: flex; align-items: center; min-height: 40px; box-sizing: border-box; flex-wrap: wrap;";
                contentHtml = `<div class="voice-msg-container" style="width:100%" onclick="event.stopPropagation(); window.chatScroller.toggleExpand(${msg.id})"><div class="voice-bar-wrapper"><div class="voice-wave-icon"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div><span class="voice-duration">${duration}"</span></div><div class="${textClass}">${safeText}</div></div>`;
            }
            else if (msg.type === 'image-card') {
                // ... (保持原有的 image-card 逻辑不变) ...
                bubbleStyleOverride = "background: transparent; box-shadow: none; padding: 0; width: auto; height: auto; line-height: 0;";
                const placeholderUrl = "https://file.icve.com.cn/file_doc/qdqqd/2161767359654214.jpeg";
                const safeDesc = this.escapeHtml(msg.text);
                contentHtml = `<div onclick="window.showCardDetail('${safeDesc.replace(/'/g, "\\'")}')" style="position: relative; cursor: pointer; transition: transform 0.1s;"><img src="${placeholderUrl}" style="width: 140px; height: 140px; object-fit: cover; border-radius: 12px; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.4); border-radius: 6px; padding: 2px 6px; color: white; font-size: 10px; backdrop-filter: blur(4px);">查看</div></div>`;
            }
            else {
                // Text
                contentHtml = this.escapeHtml(msg.text);
                if (msg.text && (msg.text.includes('typing-dots') || msg.text.includes('typing-bubble'))) {
                    contentHtml = msg.text;
                }
            }

            let safeDataText = (typeof msg.text === 'string') ? msg.text : '[多媒体消息]';

            html += `
            <div class="virtual-item" data-index="${realIndex}">
                <div class="${rowClass}" style="align-items: flex-start;"> 
                    <div class="avatar" style="${avatarStyle}">${avatarText}</div>
                    <div class="msg-bubble" 
                         style="${bubbleStyleOverride}"
                         data-msg-id="${msg.id}" 
                         data-msg-text="${this.escapeHtml(safeDataText)}" 
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
        this.render();
        requestAnimationFrame(() => {
            this.scrollToBottom();
        });
    }

    removeLast() {
        if (this.messages.length > 0) {
            // 检查并释放最后一条的资源
            const lastMsg = this.messages[this.messages.length - 1];
            const msgIdStr = String(lastMsg.id);
            if (this.imageUrlCache.has(msgIdStr)) {
                URL.revokeObjectURL(this.imageUrlCache.get(msgIdStr));
                this.imageUrlCache.delete(msgIdStr);
            }
            this.messages.pop();
            this.render();
        }
    }

    scrollToBottom() {
        const body = this.container;
        if (body) body.scrollTop = body.scrollHeight;
    }

    escapeHtml(text) {
        if (!text) return "";
        if (typeof text !== 'string') return "";
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}

window.openChatDetail = async function (chatId) {
    window.cleanMsgListMemory();
    window.cleanContactMemory();
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }
    currentActiveChatId = chatId;
    window.currentActiveChatId = chatId;
    const chats = await window.dbSystem.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const titleEl = document.getElementById('chat-title-text');
    const statusContainer = document.querySelector('.status-container');

    if (chat.name) {
        titleEl.innerText = chat.name + ` (${chat.members.length}人)`;
        if (statusContainer) statusContainer.style.display = 'none';
    } else {

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
        titleEl.innerText = targetChar ? targetChar.name : "未知用户";

        if (statusContainer) {
            statusContainer.style.display = 'flex';
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
    const avatarDataMap = {}; // 改名 avatarDataMap 以示区别
    const configMap = {};
    const overrides = chat.visualOverrides || {};

    // 预处理群头像 (如果有)
    // 注意：VirtualScroller 目前逻辑主要针对 user/char 头像，
    // 群头像是在标题栏显示的，这里暂不影响 Scroller 内部

    // 处理成员头像数据
    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        let rawData = null; // 存储 Blob 或 String URL

        // 1. 优先使用覆盖设置
        if (overrides[memberId] && overrides[memberId].avatar) {
            rawData = overrides[memberId].avatar; //这通常是 Base64 string
        }
        // 2. 其次使用角色原始头像
        else if (char) {
            rawData = char.avatar; // Blob 或 String
        }

        avatarDataMap[memberId] = rawData;

        const setting = overrides[memberId] || {};
        configMap[memberId] = {
            shape: setting.shape || 'circle',
            size: setting.size || 40,
            hidden: setting.hidden || false,
            alias: setting.alias
        };
    }

    const messages = await window.dbSystem.getMessagesPaged(chatId, 20, 0);

    let myIdentityIdInChat = null;
    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        if (char && char.type === 1) {
            myIdentityIdInChat = char.id;
            break;
        }
    }
    const currentUser = await window.dbSystem.getCurrent(); // 获取一下currentUser
    if (!myIdentityIdInChat && currentUser) {
        myIdentityIdInChat = currentUser.id;
    }

    // 初始化 Scroller，传入原始数据 Map
    window.chatScroller = new ChatVirtualScroller(
        'chat-body',
        messages,
        avatarDataMap, // 传入数据对象
        configMap,
        myIdentityIdInChat,
        chatId
    );

    const input = document.querySelector('.chat-input');
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter') window.sendMessage();
        };
        setTimeout(() => input.focus(), 300);
    }
};

window.cleanUpMemory = function () {
    if (chatScroller) {
        chatScroller.destroy();
        chatScroller = null;
    }
    if (window.activeUrls) {
        window.activeUrls.forEach(u => URL.revokeObjectURL(u));
        window.activeUrls = [];
    }
};

function scrollToBottom() {
    const body = document.getElementById('chat-body');
    if (body) {
        setTimeout(() => {
            body.scrollTop = body.scrollHeight;
        }, 50);
    }
}

window.renderChatUI = async function () {

    window.cleanMsgListMemory();

    const currentUser = await window.dbSystem.getCurrent();
    const meContainer = document.getElementById('me-content-placeholder');

    if (meContainer) {
        if (currentUser) {
            let avatarStyle = "background:#9B9ECE";
            let avatarText = currentUser.name[0];

            if (currentUser.avatar instanceof Blob) {
                const url = URL.createObjectURL(currentUser.avatar);
                msgListActiveUrls.push(url);
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

    const list = document.getElementById('msg-list');


    const chats = await window.dbSystem.getChats();
    if (chats.length === 0) return;

    for (const chat of chats) {
        let title = "未知会话";
        let avatarStyle = "background:#E8C1C6";
        let avatarContent = "";

        const overrides = chat.visualOverrides || {};

        if (chat.name) {
            title = (overrides['GROUP'] && overrides['GROUP'].alias)
                ? overrides['GROUP'].alias
                : (chat.name + ` (${chat.members.length}人)`);

            if (overrides['GROUP'] && overrides['GROUP'].avatar) {
                avatarContent = "";
                avatarStyle = `background-image:url(${overrides['GROUP'].avatar})`;
            } else {
                avatarContent = "群";
                avatarStyle = "background:#9B9ECE; display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px;";
            }

        } else {
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

            if (overrides[targetId] && overrides[targetId].alias) {
                title = overrides[targetId].alias;
            } else {
                title = targetChar.name;
            }

            if (overrides[targetId] && overrides[targetId].avatar) {
                avatarContent = "";
                avatarStyle = `background-image:url(${overrides[targetId].avatar})`;
            }
            else if (targetChar.avatar instanceof Blob) {
                const u = URL.createObjectURL(targetChar.avatar);
                msgListActiveUrls.push(u);
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
let wbScroller = null;

window.cleanWorldBookMemory = function () {
    if (wbScroller) {
        wbScroller.destroy();
        wbScroller = null;
    }
    const container = document.getElementById('worldbook-list-container');
    if (container) container.innerHTML = '';

    console.log("世界书内存已释放 (WorldBook Cleaned)");
};

class WbVirtualScroller {
    constructor(containerId, type, categoryId) {
        this.container = document.getElementById(containerId);
        this.type = type;
        this.categoryId = categoryId;

        this.listData = [];
        this.isLoading = false;
        this.isFinished = false;
        this.offset = 0;
        this.pageSize = 20;

        this.itemHeight = 110;
        this.buffer = 5;
        this.renderState = { start: 0, end: 0 };

        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        this.container.innerHTML = '';
        this.container.appendChild(this.content);

        this.bindScroll();

        this.loadMore();
    }

    bindScroll() {
        this.onScroll = () => {
            requestAnimationFrame(() => {
                this.render();

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

        const newItems = await window.dbSystem.getWorldBooksPaged(this.type, this.categoryId, this.pageSize, this.offset);

        if (newItems.length < this.pageSize) {
            this.isFinished = true;
        }

        if (newItems.length > 0) {
            this.listData = [...this.listData, ...newItems];
            this.offset += newItems.length;

            const totalHeight = this.listData.length * this.itemHeight;
            this.content.style.height = totalHeight + 'px';

            this.render();
        }
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

    refresh() {
        this.render(true);
    }

    render(force = false) {
        const scrollTop = this.container.scrollTop;
        const visibleCount = Math.ceil(this.container.clientHeight / this.itemHeight);

        let start = Math.floor(scrollTop / this.itemHeight) - this.buffer;
        let end = start + visibleCount + (this.buffer * 2);

        if (start < 0) start = 0;
        if (end > this.listData.length) end = this.listData.length;

        if (!force && start === this.renderState.start && end === this.renderState.end) return;
        this.renderState = { start, end };

        let html = '';
        const visibleData = this.listData.slice(start, end);

        visibleData.forEach((b, index) => {
            const absoluteTop = (start + index) * this.itemHeight;

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

            const isSelectMode = window.isWbSelectMode || false;
            const selectedSet = window.selectedWbIds || new Set();

            const isChecked = selectedSet.has(b.id) ? 'checked' : '';
            const clickAction = isSelectMode ? `toggleWbSelection(${b.id}, this)` : `openWorldBookEdit(${b.id})`;
            const cardClass = isSelectMode ? 'wb-card selected-mode' : 'wb-card';
            const checkedClass = (isSelectMode && selectedSet.has(b.id)) ? 'checked' : '';

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

window.initWbScroller = function (type, catId) {
    if (wbScroller) {
        wbScroller.destroy();
    }
    wbScroller = new WbVirtualScroller('worldbook-list-container', type, catId);
};

window.refreshWbScroller = function () {
    if (wbScroller) wbScroller.refresh();
};
let longPressTimer = null;
let longPressStartPos = { x: 0, y: 0 };
let currentLongPressMsgId = null;
let currentLongPressText = "";


let globalLongPressTimer = null;
let globalLongPressStart = { x: 0, y: 0 };
let currentLongPressBubble = null;

document.addEventListener('touchstart', function (e) {

    const bubble = e.target.closest('.msg-bubble');

    if (!bubble || bubble.classList.contains('msg-system')) return;

    currentLongPressBubble = bubble;
    globalLongPressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    bubble.classList.add('long-pressed');

    globalLongPressTimer = setTimeout(() => {
        if (currentLongPressBubble) {
            window.showMsgMenu(globalLongPressStart.x, globalLongPressStart.y, currentLongPressBubble);

            if (navigator.vibrate) navigator.vibrate(10);
        }
    }, 500);

}, { passive: true });

document.addEventListener('touchmove', function (e) {
    if (!globalLongPressTimer) return;

    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;

    if (Math.abs(moveX - globalLongPressStart.x) > 10 || Math.abs(moveY - globalLongPressStart.y) > 10) {
        clearTimeout(globalLongPressTimer);
        globalLongPressTimer = null;

        if (currentLongPressBubble) {
            currentLongPressBubble.classList.remove('long-pressed');
            currentLongPressBubble = null;
        }
    }
}, { passive: true });

document.addEventListener('touchend', function (e) {
    if (globalLongPressTimer) {
        clearTimeout(globalLongPressTimer);
        globalLongPressTimer = null;
    }
    if (currentLongPressBubble) {
        currentLongPressBubble.classList.remove('long-pressed');
        currentLongPressBubble = null;
    }
}, { passive: true });



let stickerScroller = null;


window.cleanStickerMemory = function () {
    if (stickerScroller) {
        stickerScroller.destroy();
        stickerScroller = null;
    }
    const container = document.getElementById('sticker-grid-container');
    if (container) container.innerHTML = '';
    console.log("表情包内存已释放 (Sticker Cleaned)");
};

class StickerVirtualScroller {
    constructor(containerId, packId) {
        this.container = document.getElementById(containerId);

        this.scrollParent = this.container.closest('.app-body') || this.container;

        this.packId = packId;
        this.listData = [];
        this.isLoading = false;
        this.isFinished = false;

        this.offset = 0;
        this.pageSize = 30;

        this.colCount = 3;
        this.gap = 12;
        this.paddingX = 0;

        const clientW = this.container.clientWidth || window.innerWidth;
        this.itemWidth = (clientW - (this.gap * (this.colCount - 1))) / this.colCount;

        this.itemHeight = this.itemWidth + 26;

        this.buffer = 4;
        this.activeUrls = [];

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
            this.listData = [...this.listData, ...newItems];
            this.offset += newItems.length;

            const rowCount = Math.ceil(this.listData.length / this.colCount);
            const totalHeight = rowCount * (this.itemHeight + this.gap);
            this.content.style.height = totalHeight + 'px';

            this.render();
        }
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

        this.isLoading = false;
    }

    refresh() {
        this.render(true);
    }

    render(force = false) {
        if (!this.scrollParent) return;

        const scrollTop = this.scrollParent.scrollTop;
        const visibleHeight = this.scrollParent.clientHeight;

        const startRow = Math.floor(scrollTop / (this.itemHeight + this.gap)) - this.buffer;
        const endRow = Math.floor((scrollTop + visibleHeight) / (this.itemHeight + this.gap)) + this.buffer;

        let startIndex = startRow * this.colCount;
        let endIndex = (endRow + 1) * this.colCount;

        if (startIndex < 0) startIndex = 0;
        if (endIndex > this.listData.length) endIndex = this.listData.length;

        if (this.activeUrls.length > 0) {
            this.activeUrls.forEach(u => URL.revokeObjectURL(u));
            this.activeUrls = [];
        }

        let html = '';
        const visibleData = this.listData.slice(startIndex, endIndex);

        visibleData.forEach((s, i) => {
            const realIndex = startIndex + i;

            const row = Math.floor(realIndex / this.colCount);
            const col = realIndex % this.colCount;

            const top = row * (this.itemHeight + this.gap);
            const left = col * (this.itemWidth + this.gap);

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

window.initStickerScroller = function (packId) {
    if (stickerScroller) stickerScroller.destroy();
    stickerScroller = new StickerVirtualScroller('sticker-grid-container', packId);
};

window.refreshStickerScroller = function () {
    if (stickerScroller) stickerScroller.refresh();
};
let chatStickerScroller = null;
let chatPanelActiveUrls = [];

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
class ChatStickerVirtualScroller {
    constructor(containerId, packId) {
        this.container = document.getElementById(containerId);
        this.packId = packId;
        this.listData = [];
        this.isLoading = false;

        this.colCount = 4;
        this.gap = 10;

        const clientW = this.container.clientWidth;
        const usableW = clientW;
        this.itemSize = (usableW - (this.gap * (this.colCount - 1))) / this.colCount;

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
        this.listData = await window.dbSystem.stickers.where('packId').equals(this.packId).reverse().toArray();

        const rowCount = Math.ceil(this.listData.length / this.colCount);
        this.content.style.height = (rowCount * (this.itemSize + this.gap)) + 'px';

        this.render();
    }

    render() {
        if (!this.container) return;
        const scrollTop = this.container.scrollTop;
        const visibleHeight = this.container.clientHeight;
        const buffer = 2;

        const rowHeight = this.itemSize + this.gap;

        let startRow = Math.floor(scrollTop / rowHeight) - buffer;
        let endRow = Math.ceil((scrollTop + visibleHeight) / rowHeight) + buffer;

        if (startRow < 0) startRow = 0;

        let startIndex = startRow * this.colCount;
        let endIndex = endRow * this.colCount;
        if (endIndex > this.listData.length) endIndex = this.listData.length;


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


window.initChatStickerScroller = async function (packId) {
    const container = document.getElementById('chat-sticker-body');
    if (!container) return;

    container.innerHTML = '<div style="padding:20px;text-align:center;color:#ccc;">加载中...</div>';

    const stickers = await window.dbSystem.stickers
        .where('packId').equals(packId)
        .reverse()
        .toArray();

    if (stickers.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#ddd;font-size:12px;">这里是空的</div>';
        return;
    }

    let html = `<div class="chat-sticker-grid-layout">`;

    stickers.forEach(s => {
        let src = s.src;
        if (s.src instanceof Blob) {
            src = URL.createObjectURL(s.src);
        }

        html += `
        <div class="chat-sticker-grid-item" onclick="handleStickerClick(${s.id})">
            <img src="${src}" loading="lazy">
            <div class="chat-sticker-name">${s.name || '表情'}</div>
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
};

window.refreshChatStickerGrid = function () {
    if (chatStickerScroller) chatStickerScroller.render();
};

window.handleStickerClick = async function (id) {

    const sticker = await window.dbSystem.stickers.get(id);
    if (sticker) {
        window.sendStickerMsg(sticker.src);
    }
};
window.showCardDetail = function (text) {
    const modal = document.getElementById('modal-card-detail');
    const content = document.getElementById('card-detail-text');


    content.innerText = text;

    modal.style.display = 'flex';
};
