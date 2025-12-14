/* =========================================
   main.js - 核心交互逻辑 (完整修复版)
   ========================================= */

// --- 1. APP 开关逻辑 ---
window.openApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.add('open');
        if (id === 'chat') {
            // 这里加个判断，防止 dbSystem 没加载时报错
            if (window.dbSystem) {
                // 修改开始：打开数据库后，不仅渲染UI，还要检查当前Tab
                window.dbSystem.open().then(() => {
                    // 1. 渲染基础界面 (个人中心、消息列表等)
                    window.renderChatUI();

                    // 2. [关键修复] 检查当前是否停留在"好友"标签页
                    // 如果是，必须重新触发 renderContacts，因为 cleanUpMemory 把它清空了
                    const contactTab = document.getElementById('tab-contacts');
                    if (contactTab && contactTab.classList.contains('active')) {
                        // 重新渲染好友列表
                        if (window.renderContacts) window.renderContacts();
                    }
                });
                // 修改结束
            } else {
                console.error("数据库未加载，请检查 index.html 是否引入了 dexie.js 和 db.js");
            }
        }
    }
};

window.closeApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.remove('open');

        // 针对 'chat' (主页) 的清理
        if (id === 'chat') {
            setTimeout(() => {
                if (window.cleanUpMemory) window.cleanUpMemory();
            }, 400);
        }

        // [新增] 针对 'conversation' (聊天详情) 的清理
        if (id === 'conversation') {
            setTimeout(() => {
                const body = document.getElementById('chat-body');
                if (body) body.innerHTML = ''; // 清空聊天记录 DOM
            }, 400);
        }
    }
};

// --- 2. 底部 Tab 切换 ---
window.switchTab = function (name, el) {
    // 1. UI 状态切换 (Active class)
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(e => {
        e.classList.remove('active');
    });
    const targetTab = document.getElementById('tab-' + name);
    targetTab.classList.add('active');

    // 2. 更改标题
    const titles = { 'msgs': '消息', 'contacts': '好友', 'moment': '发现', 'me': '个人中心' };
    const titleEl = document.getElementById('app-title-text');
    if (titleEl) titleEl.innerText = titles[name];

    // 3. 右上角按钮逻辑
    const addBtn = document.getElementById('btn-add-contact');
    if (addBtn) addBtn.style.display = (name === 'contacts') ? 'flex' : 'none';

    // ============================================
    //  严格内存管理：离开即销毁，进入即渲染
    // ============================================

    // A. 如果切走的不是好友页，清理好友列表 (销毁虚拟列表实例)
    if (name !== 'contacts') {
        const contactContainer = document.getElementById('contact-list-dynamic');
        if (contactContainer) contactContainer.innerHTML = ''; // 清空 DOM
        if (window.virtualScroller) { // 全局变量在 render.js 定义
            // 调用我们在 render.js 里写的销毁方法
            // 假设 render.js 暴露了 virtualScroller 变量，
            // 或者你可以直接调用 cleanUpMemory 但那会清空所有。
            // 这里建议直接操作 DOM 清空，render.js 的 renderContacts 会处理重建。
            window.cleanUpMemory(); // 简单粗暴：切 Tab 就把所有缓存清了
        }
    }

    // B. 根据进入的 Tab 重新渲染
    if (name === 'contacts') {
        // 重新构建虚拟列表
        if (window.renderContacts) window.renderContacts();
    }
    else if (name === 'msgs') {
        // 重新渲染消息列表
        if (window.renderChatUI) window.renderChatUI();
    }
    else if (name === 'me') {
        // 重新渲染个人中心（因为 cleanUpMemory 可能把它清了）
        // 你可能需要把 renderChatUI 里的渲染逻辑拆分，
        // 但目前 renderChatUI 包含了 "我" 和 "消息"，所以调用它没问题。
        if (window.renderChatUI) window.renderChatUI();
    }

    // "发现" 页暂时没有动态数据，静态写死即可，不需要重渲染
};

// --- 3. 个人身份 (Persona) 相关逻辑 ---
let tempAvatar = null;
let avatarMode = 'file';
let currentEditingId = null; // 标记是否在编辑个人资料

window.openModal = async function () {
    // 默认打开列表视图
    document.getElementById('modal-persona').style.display = 'flex';
    document.getElementById('persona-list-view').style.display = 'block';
    document.getElementById('persona-add-view').style.display = 'none';

    // 渲染列表
    const list = await window.dbSystem.getAll();
    const curr = await window.dbSystem.getCurrent();

    document.getElementById('persona-list').innerHTML = list.map(p => {
        let img = p.name[0];
        let style = "";
        if (p.avatar instanceof Blob) {
            const u = URL.createObjectURL(p.avatar);
            img = ""; style = `background-image:url(${u});`;
        } else if (typeof p.avatar === 'string' && p.avatar) {
            img = ""; style = `background-image:url(${p.avatar});`;
        }
        return `
        <div class="persona-item ${curr && curr.id === p.id ? 'active' : ''}" onclick="switchPersona(${p.id})">
            <div class="avatar" style="width:40px;height:40px;margin-right:10px;font-size:14px;${style}">${img}</div>
            <div>
                <div style="font-weight:bold;font-size:14px;">${p.name}</div>
                <div style="font-size:12px;color:#999;">ID: ${p.userId}</div>
            </div>
        </div>`;
    }).join('');
};

window.closeModal = function () {
    document.getElementById('modal-persona').style.display = 'none';
};

window.switchPersona = async function (id) {
    await window.dbSystem.setCurrent(id);
    window.closeModal();
    window.renderChatUI();
};

// 点击“新建身份”
window.showAddForm = function () {
    currentEditingId = null;
    document.getElementById('persona-list-view').style.display = 'none';
    document.getElementById('persona-add-view').style.display = 'block';
    document.querySelector('#modal-persona h3').innerText = "新建身份";
    resetForm();
};

window.hideAddForm = function () {
    document.getElementById('persona-list-view').style.display = 'block';
    document.getElementById('persona-add-view').style.display = 'none';
};

// 点击“编辑当前身份” (那个紫色小铅笔)
window.editCurrentPersona = async function () {
    const user = await window.dbSystem.getCurrent();
    if (!user) return;
    currentEditingId = user.id;

    document.getElementById('modal-persona').style.display = 'flex';
    document.getElementById('persona-list-view').style.display = 'none';
    document.getElementById('persona-add-view').style.display = 'block';
    document.querySelector('#modal-persona h3').innerText = "编辑资料";

    document.getElementById('inp-name').value = user.name;
    document.getElementById('inp-id').value = user.userId;
    document.getElementById('inp-desc').value = user.desc || '';

    tempAvatar = user.avatar;
    if (user.avatar instanceof Blob) {
        window.toggleAvatarMode('file');
        const u = URL.createObjectURL(user.avatar);
        document.getElementById('preview-file').src = u;
        document.getElementById('preview-file').style.display = 'block';
        document.getElementById('ph-file').style.display = 'none';
    } else if (typeof user.avatar === 'string' && user.avatar) {
        window.toggleAvatarMode('url');
        document.getElementById('url-input').value = user.avatar;
        document.getElementById('preview-url').src = user.avatar;
        document.getElementById('preview-url').style.display = 'block';
    }
};

window.savePersona = async function () {
    const name = document.getElementById('inp-name').value;
    const id = document.getElementById('inp-id').value;
    const desc = document.getElementById('inp-desc').value;

    if (!name || !id) return alert('昵称和ID必填哦');

    if (currentEditingId) {
        await window.dbSystem.update(currentEditingId, name, id, desc, tempAvatar);
        await window.renderChatUI();
    } else {
        await window.dbSystem.add(name, id, desc, tempAvatar);
    }
    // 保存后回到列表，或者关闭
    if (currentEditingId) window.closeModal();
    else window.openModal();
};

function resetForm() {
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-id').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('file-input').value = '';
    document.getElementById('url-input').value = '';
    tempAvatar = null;
    window.toggleAvatarMode('file');
    document.getElementById('preview-file').style.display = 'none';
    document.getElementById('ph-file').style.display = 'block';
    document.getElementById('preview-url').style.display = 'none';
}

window.toggleAvatarMode = function (mode) {
    avatarMode = mode;
    document.getElementById('tab-file').className = mode === 'file' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('tab-url').className = mode === 'url' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('input-group-file').style.display = mode === 'file' ? 'flex' : 'none';
    document.getElementById('input-group-url').style.display = mode === 'url' ? 'block' : 'none';
};

window.handleFile = function (input) {
    const file = input.files[0];
    if (!file) return;
    tempAvatar = file;
    const u = URL.createObjectURL(file);
    document.getElementById('preview-file').src = u;
    document.getElementById('preview-file').style.display = 'block';
    document.getElementById('ph-file').style.display = 'none';
};

window.handleUrl = function (input) {
    const url = input.value.trim();
    if (!url) return;
    tempAvatar = url;
    document.getElementById('preview-url').src = url;
    document.getElementById('preview-url').style.display = 'block';
};


// --- 4. 好友 (Contact) 相关逻辑 ---
// ⚠️ 之前你的报错就是因为缺少下面的 closeContactModal 等函数
let tempContactAvatar = null;
let contactAvatarMode = 'file';
let currentContactEditId = null;

window.openContactModal = function () {
    currentContactEditId = null;
    const titleEl = document.querySelector('#modal-add-friend h3');
    if (titleEl) titleEl.innerText = "添加好友";
    document.getElementById('modal-add-friend').style.display = 'flex';
    resetContactForm();
};

// 点击 "i" 按钮触发
window.editContact = async function (id) {
    const list = await window.dbSystem.getContacts();
    const contact = list.find(c => c.id === id);
    if (!contact) return;

    currentContactEditId = id;

    document.getElementById('modal-add-friend').style.display = 'flex';
    const titleEl = document.querySelector('#modal-add-friend h3');
    if (titleEl) titleEl.innerText = "编辑好友资料";

    document.getElementById('c-inp-name').value = contact.name;
    document.getElementById('c-inp-id').value = contact.userId;
    document.getElementById('c-inp-desc').value = contact.desc || '';

    tempContactAvatar = contact.avatar;
    if (contact.avatar instanceof Blob) {
        window.toggleContactMode('file');
        const u = URL.createObjectURL(contact.avatar);
        document.getElementById('c-preview-file').src = u;
        document.getElementById('c-preview-file').style.display = 'block';
        document.getElementById('c-ph-file').style.display = 'none';
    } else if (typeof contact.avatar === 'string' && contact.avatar) {
        window.toggleContactMode('url');
        document.getElementById('c-url-input').value = contact.avatar;
        document.getElementById('c-preview-url').src = contact.avatar;
        document.getElementById('c-preview-url').style.display = 'block';
    }
};

// ⚠️ 这就是你报错缺失的函数
window.closeContactModal = function () {
    document.getElementById('modal-add-friend').style.display = 'none';
};

window.saveContact = async function () {
    const name = document.getElementById('c-inp-name').value;
    const id = document.getElementById('c-inp-id').value;
    const desc = document.getElementById('c-inp-desc').value;

    if (!name) return alert('请填写好友昵称');

    if (currentContactEditId) {
        await window.dbSystem.updateContact(currentContactEditId, name, id, desc, tempContactAvatar);
    } else {
        await window.dbSystem.addContact(name, id, desc, tempContactAvatar);
    }

    window.closeContactModal();
    window.renderContacts();
};

function resetContactForm() {
    document.getElementById('c-inp-name').value = '';
    document.getElementById('c-inp-id').value = '';
    document.getElementById('c-inp-desc').value = '';
    document.getElementById('c-file-input').value = '';
    document.getElementById('c-url-input').value = '';
    tempContactAvatar = null;
    window.toggleContactMode('file');
    document.getElementById('c-preview-file').style.display = 'none';
    document.getElementById('c-ph-file').style.display = 'block';
    document.getElementById('c-preview-url').style.display = 'none';
}

window.toggleContactMode = function (mode) {
    contactAvatarMode = mode;
    document.getElementById('tab-c-file').className = mode === 'file' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('tab-c-url').className = mode === 'url' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('c-input-group-file').style.display = mode === 'file' ? 'flex' : 'none';
    document.getElementById('c-input-group-url').style.display = mode === 'url' ? 'block' : 'none';
};

window.handleContactFile = function (input) {
    const file = input.files[0];
    if (!file) return;
    tempContactAvatar = file;
    const u = URL.createObjectURL(file);
    document.getElementById('c-preview-file').src = u;
    document.getElementById('c-preview-file').style.display = 'block';
    document.getElementById('c-ph-file').style.display = 'none';
};

window.handleContactUrl = function (input) {
    const url = input.value.trim();
    if (!url) return;
    tempContactAvatar = url;
    document.getElementById('c-preview-url').src = url;
    document.getElementById('c-preview-url').style.display = 'block';
};
window.sendMessage = async function () {
    const input = document.querySelector('.chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (!currentActiveChatId || !chatScroller) return;

    // 1. 保存到数据库
    // addMessage(chatId, text, isMe, type)
    await window.dbSystem.addMessage(currentActiveChatId, text, true, 'text');

    // 2. 构造消息对象 (格式必须和数据库读出来的一样)
    const newMsg = {
        chatId: currentActiveChatId,
        text: text,
        isMe: 1, // 必须是数字1，对应上面 render.js 的判断
        time: new Date()
    };

    // 3. 告诉虚拟列表追加数据
    chatScroller.append(newMsg);

    // 4. 更新会话列表的“最后一条消息”
    await window.dbSystem.chats.update(currentActiveChatId, {
        lastMsg: text,
        updated: new Date()
    });

    // 5. 清空输入框
    input.value = '';
};

// [新增] 模拟接收消息 (可选，测试用)
// 你可以在控制台调用 window.receiveMockMsg("你好") 来测试对方发消息
window.receiveMockMsg = async function (text) {
    if (!currentActiveChatId || !chatScroller) return;

    await window.dbSystem.addMessage(currentActiveChatId, text, false, 'text');

    const newMsg = {
        chatId: currentActiveChatId,
        text: text,
        isMe: 0,
        time: new Date()
    };

    chatScroller.append(newMsg);

    await window.dbSystem.chats.update(currentActiveChatId, {
        lastMsg: text,
        updated: new Date()
    });
};

// [辅助] 防止 XSS 攻击的简单转义
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}