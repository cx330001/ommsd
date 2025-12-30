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

        // [核心优化] 针对 'conversation' (聊天详情) 的清理
        if (id === 'conversation') {
            setTimeout(() => {
                // 1. 销毁虚拟列表实例 (移除 scroll 监听，清空 JS 数组)
                // 这一步最重要，释放 JS 内存
                if (window.chatScroller) {
                    window.chatScroller.destroy();
                    window.chatScroller = null;
                }

                // 2. 清空 DOM (移除节点)
                // 这一步释放渲染层内存
                const body = document.getElementById('chat-body');
                if (body) body.innerHTML = '';

                // 3. 释放当前的会话 ID
                window.currentActiveChatId = null;

                console.log("聊天界面资源已彻底释放");
            }, 400); // 等 400ms 是为了让滑出动画播完，避免视觉闪烁
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
let currentEditingId = null;
// 标记当前页面状态：'list' 或 'form'
let personaViewState = 'list';

// 1. 打开身份管理主页 (默认看列表)
window.openPersonaManager = async function () {
    window.openApp('persona-mgr');
    // 默认展示列表视图
    window.showPersonaList();
};

// 2. 渲染并展示列表视图
window.showPersonaList = async function () {
    personaViewState = 'list';
    document.getElementById('view-persona-list').style.display = 'block';
    document.getElementById('view-persona-form').style.display = 'none';

    // 更新Header
    document.getElementById('persona-page-title').innerText = "我的身份";
    document.getElementById('btn-add-persona').style.display = 'flex'; // 显示右上角加号

    // 获取数据并渲染
    const list = await window.dbSystem.getMyPersonas();
    const curr = await window.dbSystem.getCurrent();
    const container = document.getElementById('persona-list-container');

    if (list.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#999">暂无身份，请点击右上角新建</div>';
    } else {
        container.innerHTML = list.map(p => {
            let img = p.name[0];
            let style = "background:#9B9ECE";

            if (p.avatar instanceof Blob) {
                const u = URL.createObjectURL(p.avatar);
                if (window.activeUrls) window.activeUrls.push(u);
                img = ""; style = `background-image:url(${u});`;
            } else if (typeof p.avatar === 'string' && p.avatar) {
                img = ""; style = `background-image:url(${p.avatar});`;
            }

            const activeClass = (curr && curr.id === p.id) ? 'border: 2px solid var(--theme-purple); background:#F4F4FF;' : '';
            const activeBadge = (curr && curr.id === p.id) ? '<span style="font-size:10px;background:var(--theme-purple);color:white;padding:2px 6px;border-radius:4px;margin-left:8px;">当前使用</span>' : '';

            // 注意：这里点击整行是切换身份，点击编辑按钮是编辑
            return `
            <div class="persona-item" onclick="switchPersona(${p.id})" style="position:relative; padding:15px; margin-bottom:12px; border-radius:16px; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,0.05); display:flex; align-items:center; ${activeClass}">
                <div class="avatar" style="width:50px;height:50px;margin-right:15px;font-size:18px;${style}">${img}</div>
                <div style="flex-grow:1;">
                    <div style="font-weight:bold;font-size:16px;display:flex;align-items:center;">
                        ${p.name} ${activeBadge}
                    </div>
                    <div style="font-size:13px;color:#999;margin-top:4px; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${p.desc || '暂无描述'}
                    </div>
                </div>
                <div onclick="event.stopPropagation(); editPersonaById(${p.id})" style="padding:10px; color:#ccc;">
                     <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </div>
            </div>`;
        }).join('');
    }
};

// 3. 切换身份逻辑
window.switchPersona = async function (id) {
    await window.dbSystem.setCurrent(id);
    // 切换完给个视觉反馈（这里简单处理，重新渲染列表即可）
    window.showPersonaList();
    // 同时刷新主页UI
    if (window.renderChatUI) window.renderChatUI();
};

// 4. 处理左上角返回按钮
window.handlePersonaBack = function () {
    if (personaViewState === 'form') {
        // 如果在表单页，返回列表页
        window.showPersonaList();
    } else {
        // 如果在列表页，关闭整个APP窗口
        window.closeApp('persona-mgr');
    }
};

// 5. 显示编辑/新建表单
window.showPersonaForm = function (isEdit = false) {
    personaViewState = 'form';
    document.getElementById('view-persona-list').style.display = 'none';
    document.getElementById('view-persona-form').style.display = 'block';
    document.getElementById('btn-add-persona').style.display = 'none'; // 隐藏新建按钮

    const title = isEdit ? "编辑身份" : "新建身份";
    document.getElementById('persona-page-title').innerText = title;

    if (!isEdit) {
        // 新建模式：重置表单
        window.currentEditingId = null;
        resetForm();
        // 初始化空关系网
        tempRelations = [];
        relationEditMode = 'me';
        renderTempRelations('me-relation-container');
    }
};

// 6. 专门用于“编辑”某个指定ID (列表里的铅笔图标)
window.editPersonaById = async function (id) {
    const user = await window.dbSystem.getChar(id);
    if (!user) return;

    window.currentEditingId = id;
    window.showPersonaForm(true); // true 表示是编辑模式

    // 回显数据
    document.getElementById('inp-name').value = user.name;
    document.getElementById('inp-desc').value = user.desc || '';

    // 头像回显
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
    } else {
        // 无头像
        document.getElementById('preview-file').style.display = 'none';
        document.getElementById('ph-file').style.display = 'flex';
    }

    // 关系网回显
    tempRelations = [];
    const rels = await window.dbSystem.getRelations(id);
    for (const r of rels) {
        const targetId = (r.fromId === id) ? r.toId : r.fromId;
        const target = await window.dbSystem.getChar(targetId);
        if (target) {
            tempRelations.push({ toId: targetId, targetName: target.name, desc: r.desc });
        }
    }
    relationEditMode = 'me';
    renderTempRelations('me-relation-container');
};

// 7. 适配主页那个“编辑当前身份”的小铅笔
window.editCurrentPersona = async function () {
    // 先打开 APP 窗口
    window.openApp('persona-mgr');

    // 获取当前用户ID并直接进入编辑页
    const curr = await window.dbSystem.getCurrent();
    if (curr) {
        window.editPersonaById(curr.id);
    } else {
        window.showPersonaForm(false); // 没用户就直接新建
    }
};

// 8. 保存身份 (Save)
window.savePersona = async function () {
    const name = document.getElementById('inp-name').value;
    const desc = document.getElementById('inp-desc').value;
    if (!name) return alert('姓名必填哦');

    let finalId = window.currentEditingId;

    if (finalId) {
        await window.dbSystem.updateChar(finalId, name, desc, tempAvatar);
    } else {
        finalId = await window.dbSystem.addChar(name, desc, tempAvatar, 1); // type=1 是 Me
    }

    // 保存关系
    const oldRels = await window.dbSystem.getRelations(finalId);
    await Promise.all(oldRels.map(r => window.dbSystem.deleteRelation(r.id)));
    if (tempRelations.length > 0) {
        await Promise.all(tempRelations.map(r => window.dbSystem.addRelation(finalId, r.toId, r.desc)));
    }

    // 如果是新建的，自动设为当前
    if (!window.currentEditingId) {
        await window.dbSystem.setCurrent(finalId);
    }

    // 保存成功后，返回列表页
    window.showPersonaList();

    // 刷新主页
    if (window.renderChatUI) window.renderChatUI();
};

// 辅助函数 (保持不变，确保ID对得上)
function resetForm() {
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('file-input').value = '';
    document.getElementById('url-input').value = '';
    tempAvatar = null;
    window.toggleAvatarMode('file');
    document.getElementById('preview-file').style.display = 'none';
    document.getElementById('ph-file').style.display = 'flex'; // 注意 flex
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
// --- 4. 好友 (Contact) 相关逻辑 [已升级为全页模式] ---

let tempContactAvatar = null;
let contactAvatarMode = 'file';
let currentContactEditId = null;

// [修改] 打开添加页面 (新建)
window.openContactPage = function () {
    window.currentContactEditId = null; // 清空ID，表示新建

    const titleEl = document.getElementById('contact-page-title');
    if (titleEl) titleEl.innerText = "添加新角色";

    // 打开页面 APP
    window.openApp('contact-edit');

    resetContactForm();

    // 初始化关系网
    tempRelations = [];
    relationEditMode = 'contact';
    renderTempRelations('contact-relation-container');
};

// [修改] 打开编辑页面 (修改)
window.editContact = async function (id) {
    const list = await window.dbSystem.getContacts();
    const contact = list.find(c => c.id === id);
    if (!contact) return;

    window.currentContactEditId = id; // 标记正在编辑谁

    // 打开页面 APP
    window.openApp('contact-edit');

    const titleEl = document.getElementById('contact-page-title');
    if (titleEl) titleEl.innerText = "编辑资料";

    document.getElementById('c-inp-name').value = contact.name;
    document.getElementById('c-inp-desc').value = contact.desc || '';

    // 头像回显逻辑
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
    } else {
        // 无头像时重置显示
        document.getElementById('c-preview-file').style.display = 'none';
        document.getElementById('c-ph-file').style.display = 'flex';
    }

    // 关系网回显
    tempRelations = [];
    const rels = await window.dbSystem.getRelations(id);
    for (const r of rels) {
        const targetId = (r.fromId === id) ? r.toId : r.fromId;
        const target = await window.dbSystem.getChar(targetId);
        if (target) {
            tempRelations.push({ toId: targetId, targetName: target.name, desc: r.desc });
        }
    }
    relationEditMode = 'contact';
    renderTempRelations('contact-relation-container');
};

// [修改] 关闭页面
window.closeContactPage = function () {
    window.closeApp('contact-edit');

    // 延迟一点清空内存，防止视觉闪烁
    setTimeout(() => {
        resetContactForm();
    }, 400);
};

// [修改] 保存逻辑
window.saveContact = async function () {
    const name = document.getElementById('c-inp-name').value;
    const desc = document.getElementById('c-inp-desc').value;

    if (!name) return alert('请填写姓名');

    let finalId = window.currentContactEditId;

    // 保存基本信息
    if (finalId) {
        await window.dbSystem.updateChar(finalId, name, desc, tempContactAvatar); // 注意这里用 updateChar 统一接口
    } else {
        // 新增 type=0 (NPC/好友)
        finalId = await window.dbSystem.addChar(name, desc, tempContactAvatar, 0);
    }

    // 保存关系网 (先删旧，再加新)
    const oldRels = await window.dbSystem.getRelations(finalId);
    await Promise.all(oldRels.map(r => window.dbSystem.deleteRelation(r.id)));

    if (tempRelations.length > 0) {
        await Promise.all(tempRelations.map(r => {
            return window.dbSystem.addRelation(finalId, r.toId, r.desc);
        }));
    }

    // 关闭页面并刷新列表
    window.closeContactPage();

    // 如果当前停留在好友列表页，刷新它
    if (window.renderContacts) window.renderContacts();
};

// ... resetContactForm, toggleContactMode 等辅助函数保持不变，或者根据 ID 微调 ...
// 确保 resetContactForm 里的 ID 和 HTML 新写的 ID 一致：
function resetContactForm() {
    document.getElementById('c-inp-name').value = '';
    document.getElementById('c-inp-desc').value = '';
    document.getElementById('c-file-input').value = '';
    document.getElementById('c-url-input').value = '';

    tempContactAvatar = null;
    window.toggleContactMode('file');

    document.getElementById('c-preview-file').src = "";
    document.getElementById('c-preview-file').style.display = 'none';
    document.getElementById('c-ph-file').style.display = 'flex'; // 注意这里改为 flex 配合新样式

    document.getElementById('c-preview-url').src = "";
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

    // --- 核心修复开始 ---

    // 1. 获取当前会话详情
    const chat = await window.dbSystem.chats.get(currentActiveChatId);
    if (!chat) return;

    // 2. 找出“我是谁”：在群成员里找 type=1 (用户) 的角色
    // 这样无论你全局身份切成谁，只要在这个群里你是“蝙蝠侠”，发消息的就是“蝙蝠侠”
    let senderId = null;

    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        // 如果找到了类型为 1 (User) 的成员，就是发送者
        if (char && char.type === 1) {
            senderId = memberId;
            break; // 找到了就停止 (如果是多User的群，这里可能需要更复杂的判断，但目前够用)
        }
    }

    // 兜底：如果没找到(比如全是AI聊)，或者出错了，再用全局身份
    if (!senderId) {
        const globalUser = await window.dbSystem.getCurrent();
        if (globalUser) senderId = globalUser.id;
    }

    if (!senderId) return alert("无法确定发送者身份");

    // --- 核心修复结束 ---

    // 3. 保存到数据库
    await window.dbSystem.addMessage(currentActiveChatId, text, senderId, 'text');

    // 4. UI 渲染 (追加到界面)
    chatScroller.append({
        chatId: currentActiveChatId,
        text: text,
        senderId: senderId,
        time: new Date()
    });

    // 5. 更新最后一条消息
    await window.dbSystem.chats.update(currentActiveChatId, {
        lastMsg: text,
        updated: new Date()
    });

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
/* =========================================
   Settings App Logic (修复增强版)
   ========================================= */

// 1. 打开子页面时加载数据
window.openSubPage = async function (pageName) {
    const el = document.getElementById('sub-page-' + pageName);
    if (el) {
        el.classList.add('active');
        if (pageName === 'api') {
            await loadApiSettings();
        }
    }
};

window.closeSubPage = function (pageName) {
    const el = document.getElementById('sub-page-' + pageName);
    if (el) {
        el.classList.remove('active');
        // 关闭时清理一下下拉列表
        setTimeout(() => {
            const list = document.getElementById('model-list-container');
            if (list) {
                list.classList.remove('open');
                list.innerHTML = '';
            }
        }, 300);
    }
};

// 2. 加载设置到界面
// [新增] 切换 API 提供商逻辑
window.toggleApiProvider = function (provider) {
    const hostInput = document.getElementById('api-host');

    if (provider === 'google') {
        // Google 的 OpenAI 兼容地址
        // 注意：Gemini 免费版通常每分钟有限制，且需要申请 API Key
        hostInput.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
    } else {
        // OpenAI 默认地址
        hostInput.value = 'https://api.openai.com/v1';
    }
};

// [修改] 加载设置到界面
async function loadApiSettings() {
    const hostRec = await window.dbSystem.settings.get('apiHost');
    const keyRec = await window.dbSystem.settings.get('apiKey');
    const modelRec = await window.dbSystem.settings.get('apiModel');
    const providerRec = await window.dbSystem.settings.get('apiProvider'); // 获取保存的厂商
    const tempRec = await window.dbSystem.settings.get('apiTemperature');
    const tempSlider = document.getElementById('api-temp');
    const tempDisplay = document.getElementById('temp-display');

    if (tempRec) {
        tempSlider.value = tempRec.value;
        tempDisplay.innerText = tempRec.value;
    } else {
        // 默认值
        tempSlider.value = 0.7;
        tempDisplay.innerText = 0.7;
    }
    // 1. 设置厂商下拉框
    const providerSelect = document.getElementById('api-provider');
    if (providerRec) {
        providerSelect.value = providerRec.value;
    } else {
        providerSelect.value = 'openai'; // 默认
    }

    // 2. 设置 Host
    if (hostRec) {
        document.getElementById('api-host').value = hostRec.value;
    } else {
        // 如果没有存过 Host，根据当前厂商设个默认值
        window.toggleApiProvider(providerSelect.value);
    }

    // 3. 设置 Key
    if (keyRec) document.getElementById('api-key').value = keyRec.value;

    // 4. 设置模型文字
    const displayEl = document.getElementById('current-model-text');
    if (modelRec && modelRec.value) {
        displayEl.innerText = modelRec.value;
        displayEl.style.color = "#333";
    } else {
        displayEl.innerText = "请点击右侧按钮拉取模型 ->";
        displayEl.style.color = "#ccc";
    }
}

// [修改] 点击“保存配置”按钮
// [修改] 点击“保存配置”按钮
window.manualSaveApi = async function () {
    const provider = document.getElementById('api-provider').value; // 获取厂商
    const host = document.getElementById('api-host').value.trim();
    const key = document.getElementById('api-key').value.trim();
    const currentModel = document.getElementById('current-model-text').innerText;

    // --- 新增代码 1：获取滑块的值 ---
    // 如果还没添加HTML，这里可能会报错，所以要确保 index.html 那步先做好了
    const tempElement = document.getElementById('api-temp');
    const temp = tempElement ? tempElement.value : '0.7';
    // -----------------------------

    const modelToSave = (currentModel.includes('请点击') || currentModel.includes('->'))
        ? '' : currentModel;

    // 保存所有配置
    await window.dbSystem.settings.put({ key: 'apiProvider', value: provider }); // 保存厂商
    await window.dbSystem.settings.put({ key: 'apiHost', value: host });
    await window.dbSystem.settings.put({ key: 'apiKey', value: key });

    // --- 新增代码 2：保存温度到数据库 ---
    await window.dbSystem.settings.put({ key: 'apiTemperature', value: temp });
    // --------------------------------

    if (modelToSave) {
        await window.dbSystem.settings.put({ key: 'apiModel', value: modelToSave });
    }

    alert("配置已保存！");
};


// 1. 获取 Key 列表 (自动处理逗号分隔)
function getApiKeys() {
    const raw = document.getElementById('api-key').value.trim();
    if (!raw) return [];
    // 按逗号切割，去空格，去空值
    return raw.split(',').map(k => k.trim()).filter(k => k);
}

// 2. [核心] 轮询请求器 (自动换 Key 重试)
// 参数: url, optionsBuilder(key) -> 返回 fetch 的 options
async function requestWithKeyRotation(url, optionsBuilder, overrideKeys = null) {
    // 1. 优先使用传入的 Keys (来自数据库)，如果没有传，才去读输入框 (来自设置页)
    const keys = overrideKeys || getApiKeys();

    if (keys.length === 0) {
        throw new Error("未填写 API Key");
    }

    let lastError = null;

    // 遍历所有 Key 尝试
    for (let i = 0; i < keys.length; i++) {
        const currentKey = keys[i];

        try {
            // console.log(`正在尝试第 ${i + 1} 个 Key...`); // 调试用，可注释

            // 构建带当前 Key 的请求头
            const options = optionsBuilder(currentKey);

            const response = await fetch(url, options);

            // 如果成功，直接返回结果
            if (response.ok) {
                return response;
            }

            // 如果是 429 (超限) 或 403 (被封/权限不足)，则尝试下一个 Key
            if (response.status === 429 || response.status === 403) {
                console.warn(`Key ${i + 1} 失效或限流 (Status ${response.status})，尝试下一个...`);
                continue; // 进入下一次循环
            }

            // 其他错误 (比如 404, 500) 通常换 Key 也没用，直接抛出
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);

        } catch (e) {
            lastError = e;
            console.warn(`Key ${i + 1} 网络错误`, e);
        }
    }

    // 如果循环结束还没返回，说明所有 Key 都挂了
    throw new Error("所有 API Key 均请求失败，请检查配额或网络。\n最后一次错误: " + (lastError ? lastError.message : "未知"));
}
window.fetchModels = async function (event) {
    event.stopPropagation();

    // 1. 获取基础配置
    const host = document.getElementById('api-host').value.trim();
    const box = document.querySelector('.model-selector-box');

    // 简单的校验
    const keys = getApiKeys();
    if (keys.length === 0) return alert("请至少填写一个 API Key");

    box.classList.add('fetching');

    try {
        // 2. 使用轮询请求器
        const response = await requestWithKeyRotation(
            `${host}/models`, // URL
            (key) => {        // Options 构建函数
                return {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    }
                };
            }
        );

        // 3. 处理成功结果
        const data = await response.json();
        const models = data.data || [];
        renderModelList(models);

        // 提示一下用户
        // alert(`成功拉取！当前使用的是第 ${keys.length} 个Key中的有效Key。`);

    } catch (e) {
        alert("拉取失败: " + e.message);
    } finally {
        box.classList.remove('fetching');
    }
};

// 5. 渲染下拉列表
async function renderModelList(models) {
    const container = document.getElementById('model-list-container');
    const currentText = document.getElementById('current-model-text').innerText;

    // 排序
    models.sort((a, b) => a.id.localeCompare(b.id));

    let html = '';
    if (models.length === 0) {
        html = '<div class="model-option" style="color:#999">未找到模型</div>';
    } else {
        models.forEach(m => {
            const isSelected = m.id === currentText;
            html += `
                <div class="model-option ${isSelected ? 'selected' : ''}" onclick="selectModel('${m.id}')">
                    ${m.id}
                </div>
            `;
        });
    }

    container.innerHTML = html;
    container.classList.add('open'); // 展开列表
}

// 6. 选中模型
window.selectModel = async function (modelId) {
    // 1. 更新显示文字
    const displayEl = document.getElementById('current-model-text');
    displayEl.innerText = modelId;
    displayEl.style.color = "#333";

    // 2. 收起列表
    const container = document.getElementById('model-list-container');
    container.classList.remove('open');

    // 3. 自动保存模型选择 (可选，既然有保存按钮，这里也可以只更新UI)
    // 但为了体验好，建议选中即存这一项
    // await window.dbSystem.settings.put({ key: 'apiModel', value: modelId });
};

// 切换列表显示/隐藏 (点击文字区域时)
window.toggleModelList = function () {
    const container = document.getElementById('model-list-container');
    if (container.innerHTML.trim() === '') return; // 没内容不展开
    container.classList.toggle('open');
};
/* main.js */

// [修改] main.js: 总入口，负责分流
window.triggerAIResponse = async function (btnElement) {
    if (!window.currentActiveChatId) return alert("当前没有打开的聊天窗口");
    if (btnElement.classList.contains('loading')) return;

    // --- 基础配置 ---
    const hostRec = await window.dbSystem.settings.get('apiHost');
    const modelRec = await window.dbSystem.settings.get('apiModel');
    const keyRec = await window.dbSystem.settings.get('apiKey');
    const tempRec = await window.dbSystem.settings.get('apiTemperature');

    if (!hostRec || !hostRec.value) return alert("请配置 API Host");
    const dbKeys = keyRec ? keyRec.value.split(',').map(k => k.trim()).filter(k => k) : [];
    if (dbKeys.length === 0) return alert("请配置 API Key");

    btnElement.classList.add('loading');

    try {
        const chat = await window.dbSystem.chats.get(window.currentActiveChatId);
        const currentUser = await window.dbSystem.getCurrent();

        // --- 核心分流：是群聊还是单聊？ ---
        // 判定标准：有群名 OR 成员超过2人
        const isGroupChat = (chat.name || chat.members.length > 2);

        if (isGroupChat) {
            console.log("进入群聊模式 (导演模式)");
            await handleGroupChat(chat, currentUser, hostRec, modelRec, dbKeys, tempRec);
        } else {
            console.log("进入单聊模式 (沉浸模式)");
            await handlePrivateChat(chat, currentUser, hostRec, modelRec, dbKeys, tempRec);
        }

    } catch (e) {
        if (typeof chatScroller !== 'undefined' && chatScroller) chatScroller.removeLast();
        console.error(e);
        alert("AI请求中断: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
};
// [新增] 处理群聊：AI 导演模式
async function handleGroupChat(chat, currentUser, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);

    // 1. 准备群成员数据
    const memberData = [];
    const nameToIdMap = {};

    for (const uid of chat.members) {
        const u = await window.dbSystem.getChar(uid);
        if (u) {
            memberData.push({
                name: u.name,
                desc: u.desc || "无特殊设定",
                isMe: (u.id === currentUser.id)
            });
            nameToIdMap[u.name] = u.id;
        }
    }

    // 2. 构建导演 System Prompt (强制多条回复)
    const characterListText = memberData.map(m =>
        `- ${m.name} ${m.isMe ? '(User扮演)' : ''}: ${m.desc}`
    ).join('\n');

    const systemPrompt = `
你现在是一个“群聊剧场导演”。
【场景】这是一个多人聊天群${chat.name ? '，群名为：' + chat.name : ''}。
【当前群成员】
${characterListText}

【任务】
User (扮演 ${currentUser.name}) 刚刚发送了消息。
请根据人物关系和语境，**安排 2 到 4 条回复**，让群聊热闹起来！
**不要只让一个人回复，允许其他群友插嘴、吐槽、复读或互动。**

【规则】
1. 必须返回 JSON 数组格式。
2. 必须模拟真实的群聊短句风格。
3. speaker 必须完全匹配上面的【当前群成员】名字。

【返回格式示例】
[
    {"speaker": "角色A", "text": "哈哈哈哈笑死我了"},
    {"speaker": "角色B", "text": "确实，我也看到了"},
    {"speaker": "角色A", "text": "下次一起去啊"}
]
`.trim();

    // 3. 构建历史消息
    const recentMessages = messages.slice(-15);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of recentMessages) {
        const senderChar = await window.dbSystem.getChar(msg.senderId);
        const senderName = senderChar ? senderChar.name : "未知";
        apiMessages.push({
            role: (msg.senderId === currentUser.id) ? "user" : "assistant",
            content: `${senderName}: ${msg.text}`
        });
    }

    // 4. UI 反馈：换成【三个跳动的小点】+ 【senderId: -1】
    // 这样配合 render.js 的修改，头像就会透明，只显示气泡
    if (chatScroller) {
        chatScroller.append({
            chatId: chat.id,
            // 这里换成了和单聊一样的动画代码
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: -1, // -1 代表系统/加载中，render.js 会把头像变透明
            isTyping: true
        });
    }

    // 5. 请求 API (调高温度，增加随机性)
    const temperature = 1.1; // 温度设高一点，让 AI 更活跃，更愿意让不同人说话
    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature,
            response_format: { type: "json_object" }
        })
    }), dbKeys);

    const data = await response.json();
    if (chatScroller) chatScroller.removeLast(); // 移除正在输入气泡

    // 6. 解析并执行多条回复
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let actions = [];
    try {
        const parsed = JSON.parse(content);
        // 兼容各种可能的 AI 返回结构
        if (Array.isArray(parsed)) actions = parsed;
        else if (parsed.actions) actions = parsed.actions;
        else if (parsed.messages) actions = parsed.messages;
        else if (parsed.speaker) actions = [parsed]; // 如果如果不幸只回了一条
    } catch (e) {
        console.error("JSON解析失败", content);
    }

    // 7. 循环发送消息 (制造一点点时间间隔，看起来像真人在发)
    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const speakerName = action.speaker;
        const text = action.text;
        const speakerId = nameToIdMap[speakerName];

        if (speakerId) {
            // 简单的延时效果，第一条立刻发，后面每条间隔 800ms
            if (i > 0) await new Promise(r => setTimeout(r, 800));

            await window.dbSystem.addMessage(chat.id, text, speakerId, 'text');
            if (chatScroller) {
                chatScroller.append({
                    chatId: chat.id, text: text, senderId: speakerId, time: new Date()
                });
            }
            // 更新最后一条消息预览
            await window.dbSystem.chats.update(chat.id, { lastMsg: `${speakerName}: ${text}`, updated: new Date() });
        }
    }
}
// [新增] 处理单聊：沉浸角色模式 (保留你的原始逻辑)
async function handlePrivateChat(chat, currentUser, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);

    // --- 你的原始逻辑：确定 Listener 和 Speaker ---
    let lastSenderId = -1;
    if (messages.length > 0) lastSenderId = messages[messages.length - 1].senderId;

    const memberIds = chat.members;
    // 在单聊中，简单的轮询是没问题的
    let nextSpeakerId = memberIds.find(id => id !== lastSenderId);
    if (!nextSpeakerId) nextSpeakerId = memberIds[0];

    // 确定对话对象（Listener）
    let listenerId = memberIds.find(id => id !== nextSpeakerId);

    const speaker = await window.dbSystem.getChar(nextSpeakerId);
    const listener = await window.dbSystem.getChar(listenerId);

    if (!speaker) throw new Error("找不到角色数据");

    // --- 优化后的关系网构建 (极简模式：只给名片) ---
    const relations = await window.dbSystem.getRelations(nextSpeakerId);
    let socialNetworkList = [];
    const uniqueMap = new Map();

    // 1. 整理关系数据
    for (const r of relations) {
        const targetId = (r.fromId === nextSpeakerId) ? r.toId : r.fromId;

        // 排除当前正在对话的对象（Listener），因为 Listener 的信息后面会单独详细加
        if (targetId === listenerId) continue;

        if (!uniqueMap.has(targetId)) {
            const charData = await window.dbSystem.getChar(targetId);
            if (charData) uniqueMap.set(targetId, { char: charData, rels: [] });
        }
        const item = uniqueMap.get(targetId);
        if (item && !item.rels.includes(r.desc)) item.rels.push(r.desc);
    }

    // 2. 构建列表：严格只给 姓名 + 关系
    for (const [id, data] of uniqueMap) {
        const { char, rels } = data;
        const relStr = rels.join('、');

        // 【核心修改】绝不包含 char.desc，只给关系名片
        socialNetworkList.push(`- ${char.name} (关系: ${relStr})`);
    }

    // 3. 构建当前对话对象的详细信息 (正在聊天的对象，必须给详细设定)
    let currentPartnerInfo = "";
    if (listener) {
        // 获取你们之间的关系（如果有）
        const myRels = relations
            .filter(r => (r.fromId === nextSpeakerId && r.toId === listenerId) || (r.toId === nextSpeakerId && r.fromId === listenerId))
            .map(r => r.desc)
            .join('、');

        currentPartnerInfo = `
【当前对话对象】(请重点关注)
- 姓名：${listener.name}
- 关系：${myRels || "暂无定义"}
- 设定：${listener.desc || "无"}
`.trim();
    }

    // 4. 组合背景信息
    let backgroundInfo = "";
    if (socialNetworkList.length > 0) {
        backgroundInfo = `
【其他关系网络】
${socialNetworkList.join('\n')}
`.trim();
    }

    const systemPrompt = `
你现在扮演：${speaker.name}。
你的核心设定：${speaker.desc || "无"}。

${currentPartnerInfo}

${backgroundInfo}

【回复规则】
1. 请完全沉浸在 ${speaker.name} 的人设中。
2. 严禁扮演【当前对话对象】或【其他关系网络】中的人物。
3. 必须以 JSON 数组格式返回: [{"text": "回复内容"}]
`.trim();

    // --- 构造历史 ---
    const recentMessages = messages.slice(-20);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of recentMessages) {
        const msgSender = await window.dbSystem.getChar(msg.senderId);
        const prefix = msgSender ? `${msgSender.name}: ` : "";
        apiMessages.push({
            role: (msg.senderId === nextSpeakerId) ? "assistant" : "user",
            content: prefix + msg.text
        });
    }

    // --- UI Typing ---
    if (chatScroller) {
        chatScroller.append({
            chatId: chat.id,
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: nextSpeakerId,
            isTyping: true
        });
    }

    // --- 请求 API ---
    const temperature = tempRec ? parseFloat(tempRec.value) : 0.7;
    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature,
            response_format: { type: "json_object" }
        })
    }), dbKeys);

    const data = await response.json();
    if (chatScroller) chatScroller.removeLast();

    // --- 解析结果 ---
    let content = data.choices[0].message.content;
    let replyArray = [];
    try {
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(content);
        replyArray = Array.isArray(parsed) ? parsed : (parsed.messages || [parsed]);
    } catch (e) {
        replyArray = [{ text: content }];
    }

    for (const item of replyArray) {
        if (!item.text) continue;
        await window.dbSystem.addMessage(chat.id, item.text, nextSpeakerId, 'text');
        if (chatScroller) {
            chatScroller.append({
                chatId: chat.id, text: item.text, senderId: nextSpeakerId, time: new Date()
            });
        }
        await window.dbSystem.chats.update(chat.id, { lastMsg: item.text, updated: new Date() });
    }
}
/* =========================================
   [新增] 关系网核心逻辑 (请复制到 main.js 末尾)
   ========================================= */

// 1. 全局变量：暂存正在编辑的关系
let tempRelations = [];
let relationEditMode = 'me'; // 'me' 或者 'contact'

// 2. 渲染紫色胶囊标签
function renderTempRelations(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 保留最后的加号按钮
    const addBtnHTML = `<div class="btn-add-relation" onclick="openRelationSelector('${relationEditMode}')">+</div>`;

    // 生成标签 HTML
    const tagsHTML = tempRelations.map((r, index) => {
        return `
        <div class="relation-tag">
            <strong>${r.targetName}</strong> 
            <span>${r.desc}</span>
            <div class="relation-del" onclick="removeTempRelation(${index}, '${containerId}')">×</div>
        </div>`;
    }).join('');

    container.innerHTML = tagsHTML + addBtnHTML;
}

// 3. 点击标签上的 X 删除
window.removeTempRelation = function (index, containerId) {
    tempRelations.splice(index, 1); // 从数组里删掉
    renderTempRelations(containerId); // 重新画
};

// 4. 打开“添加关系”的小弹窗
window.openRelationSelector = async function (mode) {
    relationEditMode = mode;
    const modal = document.getElementById('modal-relation-select');
    const select = document.getElementById('rel-target-select');

    modal.style.display = 'flex';
    document.getElementById('rel-desc-input').value = '';

    // 获取当前正在编辑的主角ID (为了在列表中排除自己)
    let currentId = (mode === 'me') ? window.currentEditingId : window.currentContactEditId;

    // 获取数据库里所有人
    const allChars = await window.dbSystem.chars.toArray();

    // 渲染下拉框：排除掉自己
    select.innerHTML = allChars
        .filter(c => c.id !== currentId)
        .map(c => `<option value="${c.id}">${c.name} (${c.type === 1 ? '我' : 'NPC'})</option>`)
        .join('');
};

// 5. 弹窗点击“确定添加”
window.confirmAddRelation = function () {
    const select = document.getElementById('rel-target-select');
    const input = document.getElementById('rel-desc-input');

    const targetId = parseInt(select.value);
    // 获取选中的名字，方便显示
    let targetName = "未知";
    if (select.selectedIndex >= 0) {
        targetName = select.options[select.selectedIndex].text.split(' (')[0];
    }
    const desc = input.value.trim() || "关联";

    if (!targetId) return;

    // 加入临时数组
    tempRelations.push({
        toId: targetId,
        targetName: targetName,
        desc: desc
    });

    document.getElementById('modal-relation-select').style.display = 'none';

    // 重新渲染标签区域
    const containerId = (relationEditMode === 'me') ? 'me-relation-container' : 'contact-relation-container';
    renderTempRelations(containerId);
};
/* =========================================
   [新增] 群聊创建逻辑
   ========================================= */

let groupSelectedMeId = null;   // 选中的“我”
let groupSelectedContacts = new Set(); // 选中的“好友”ID集合

// 1. 打开创建界面
window.openGroupCreateUI = async function () {
    // 如果当前不在“消息”tab，可能不需要打开，或者是其他逻辑，这里默认允许打开
    window.openApp('group-create');

    // 重置数据
    document.getElementById('group-name-input').value = '';
    groupSelectedMeId = null;
    groupSelectedContacts.clear();

    // 加载“我”的身份
    const myPersonas = await window.dbSystem.getMyPersonas();
    const meContainer = document.getElementById('group-me-list');

    // 如果有当前使用的身份，默认选中
    const curr = await window.dbSystem.getCurrent();
    if (curr) groupSelectedMeId = curr.id;

    meContainer.innerHTML = myPersonas.map(p => {
        const isSel = (groupSelectedMeId === p.id);
        return renderSelectRow(p, 'me', isSel);
    }).join('');

    // 加载“好友”
    const contacts = await window.dbSystem.getContacts();
    const contactContainer = document.getElementById('group-contact-list');
    contactContainer.innerHTML = contacts.map(c => {
        return renderSelectRow(c, 'contact', false);
    }).join('');
};

// 辅助：渲染单行
function renderSelectRow(char, type, isSelected) {
    // 简单的头像处理
    let avatarStyle = "background:#ccc";
    if (char.avatar instanceof Blob) {
        avatarStyle = `background-image:url(${URL.createObjectURL(char.avatar)})`;
    } else if (typeof char.avatar === 'string' && char.avatar) {
        avatarStyle = `background-image:url(${char.avatar})`;
    }

    const clickFn = type === 'me'
        ? `selectGroupMe(${char.id}, this)`
        : `toggleGroupContact(${char.id}, this)`;

    return `
    <div class="select-item ${isSelected ? 'selected' : ''}" onclick="${clickFn}">
        <div class="check-circle"></div>
        <div class="avatar" style="width:40px;height:40px;margin-right:10px;${avatarStyle}"></div>
        <div style="font-weight:500;">${char.name}</div>
    </div>`;
}

// 2. 选择“我” (单选)
window.selectGroupMe = function (id, el) {
    groupSelectedMeId = id;
    // 视觉更新：清除其他，选中这个
    const all = document.querySelectorAll('#group-me-list .select-item');
    all.forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
};

// 3. 选择“好友” (多选)
window.toggleGroupContact = function (id, el) {
    if (groupSelectedContacts.has(id)) {
        groupSelectedContacts.delete(id);
        el.classList.remove('selected');
    } else {
        groupSelectedContacts.add(id);
        el.classList.add('selected');
    }
};

// 4. 提交创建
window.submitCreateGroup = async function () {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) return alert("起个群名吧！");
    if (!groupSelectedMeId) return alert("请选择你在群里的身份");
    if (groupSelectedContacts.size === 0) return alert("群里至少得拉一个人吧？");

    // 组合成员数组 [我的ID, 好友1, 好友2...]
    const members = [groupSelectedMeId, ...Array.from(groupSelectedContacts)];

    // 写入数据库
    const chatId = await window.dbSystem.chats.add({
        name: name,         // 群名
        members: members,   // 成员ID数组
        updated: new Date(),
        lastMsg: "群聊已创建"
    });

    // 关闭创建页
    window.closeApp('group-create');

    // 刷新消息列表
    if (window.renderChatUI) window.renderChatUI();

    // 直接进入聊天
    // 注意：我们需要切换当前的全局身份为选中的这个身份，否则进去后可能发不了言
    await window.dbSystem.setCurrent(groupSelectedMeId);

    // 打开窗口
    window.openChatDetail(chatId);
};