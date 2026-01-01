/* =========================================
   main.js - 核心交互逻辑 (完整修复版)
   ========================================= */

// --- 1. APP 开关逻辑 ---
window.openApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.add('open');

        // 1. 如果打开的是聊天主页
        if (id === 'chat') {
            if (window.dbSystem) {
                window.dbSystem.open().then(() => {
                    window.renderChatUI();
                    // 检查当前是否在好友页，如果是则刷新好友
                    const contactTab = document.getElementById('tab-contacts');
                    if (contactTab && contactTab.classList.contains('active')) {
                        if (window.renderContacts) window.renderContacts();
                    }
                });
            }
        }

        // 2. [新增] 如果打开的是世界书，强制刷新一次列表
        if (id === 'worldbook') {
            // 默认切到全局 (global)，你也可以改为上次记住的 Tab
            if (typeof switchWorldBookTab === 'function') {
                // 模拟点击“全局设定”，加载数据
                switchWorldBookTab('global');
            }
        }
    }
};

/* js/main.js - 替换 window.closeApp 部分 */

window.closeApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.remove('open');

        // [核心优化] 针对 'conversation' (聊天详情) 的清理与恢复
        if (id === 'conversation') {
            // 1. 【立刻】重绘消息列表 (不要等动画)
            const msgsTab = document.getElementById('tab-msgs');
            if (msgsTab && msgsTab.classList.contains('active')) {
                // console.log("预渲染消息列表，消除视觉延迟...");
                if (window.renderChatUI) window.renderChatUI();
            }
        }

        // [补全] 针对 'contact-edit' (联系人编辑页) 的清理
        if (id === 'contact-edit') {
            setTimeout(() => {
                // 1. 释放图片 Blob 内存 (最重要的一步，防止内存泄漏)
                const previewImg = document.getElementById('c-preview-file');
                if (previewImg && previewImg.src && previewImg.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImg.src);
                    previewImg.src = ''; // 断开 DOM 引用
                }

                // 2. 重置表单输入框 (调用 main.js 下方已有的重置函数)
                if (typeof resetContactForm === 'function') {
                    resetContactForm();
                }

                // 3. 清理全局临时变量
                window.currentContactEditId = null;
                window.tempContactAvatar = null;

                // 4. 清空暂存的关系网数据
                if (typeof tempRelations !== 'undefined') {
                    tempRelations = [];
                }

                // 5. 清空关系网 DOM (下次打开时由 openContactPage 重新渲染)
                const relContainer = document.getElementById('contact-relation-container');
                if (relContainer) relContainer.innerHTML = '';

                console.log("联系人编辑页资源已释放");
            }, 400);
        }
        if (id === 'sticker-mgr') {
            setTimeout(() => {
                if (window.cleanStickerMemory) window.cleanStickerMemory();
            }, 300);
        }
        // [补充] 针对 'persona-mgr' (我的身份管理) 的清理，逻辑类似
        if (id === 'persona-mgr') {
            setTimeout(() => {
                // 这里的图片预览 ID 是 preview-file
                const pPreview = document.getElementById('preview-file');
                if (pPreview && pPreview.src && pPreview.src.startsWith('blob:')) {
                    URL.revokeObjectURL(pPreview.src);
                    pPreview.src = '';
                }
                // 如果在列表页，清理列表 DOM
                const list = document.getElementById('persona-list-container');
                if (list) list.innerHTML = '';

                console.log("身份管理页资源已释放");
            }, 400);
        }
        if (id === 'worldbook') {
            // 延时一点清理，避免关闭动画还没放完就白屏
            setTimeout(() => {
                if (window.cleanWorldBookMemory) window.cleanWorldBookMemory();
            }, 300);
        }
    }
};

// --- 2. 底部 Tab 切换 ---
// --- 2. 底部 Tab 切换 (极致性能版) ---
window.switchTab = function (name, el) {
    // 1. 获取当前处于激活状态的 Tab 名称 (用于决定清理谁)
    const currentActiveTab = document.querySelector('.tab-content.active');
    const currentId = currentActiveTab ? currentActiveTab.id.replace('tab-', '') : null;

    // 如果点击的是当前 Tab，什么都不做
    if (currentId === name) return;

    // ============================================
    //  A. 离开旧 Tab -> 立即销毁内存
    // ============================================
    if (currentId === 'msgs') {
        window.cleanMsgListMemory(); // 销毁消息列表 DOM + Blob
    } else if (currentId === 'contacts') {
        window.cleanContactMemory(); // 销毁好友列表 DOM + VirtualScroller
    } else if (currentId === 'me') {
        // 个人中心如果比较简单，可以不清，或者也清掉
        document.getElementById('me-content-placeholder').innerHTML = '';
    }

    // ============================================
    //  B. 切换 UI 状态
    // ============================================
    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(e => {
        e.classList.remove('active');
    });
    const targetTab = document.getElementById('tab-' + name);
    targetTab.classList.add('active');

    // 更改标题
    const titles = { 'msgs': '消息', 'contacts': '好友', 'moment': '发现', 'me': '个人中心' };
    const titleEl = document.getElementById('app-title-text');
    if (titleEl) titleEl.innerText = titles[name];

    // 右上角按钮
    const addBtn = document.getElementById('btn-add-contact');
    if (addBtn) addBtn.style.display = (name === 'contacts') ? 'flex' : 'none';

    // ============================================
    //  C. 进入新 Tab -> 重新渲染
    // ============================================
    if (name === 'msgs') {
        // 重新从数据库读取并渲染消息列表
        if (window.renderChatUI) window.renderChatUI();
    }
    else if (name === 'contacts') {
        // 重新构建虚拟列表
        if (window.renderContacts) window.renderContacts();
    }
    else if (name === 'me') {
        // "我"的卡片其实是在 renderChatUI 里一起渲染的
        // 为了复用，这里可以调用 renderChatUI，或者把渲染我的逻辑拆出来
        // 简单起见，直接调 renderChatUI，它会把消息列表也画出来(虽然不可见但影响不大)，
        // 或者你可以去 render.js 把渲染 Me 和 渲染 List 拆开。
        // 现状：调用 renderChatUI 没问题。
        if (window.renderChatUI) window.renderChatUI();
    }
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

    const newId = await window.dbSystem.addMessage(currentActiveChatId, text, senderId, 'text');

    // 【核心修复点 2】：把 newId 塞给虚拟列表
    chatScroller.append({
        id: newId,   // <--- 必须有这个！
        chatId: currentActiveChatId,
        text: text,
        senderId: senderId,
        time: new Date()
    });

    // 更新会话最后一条消息
    await window.dbSystem.chats.update(currentActiveChatId, {
        lastMsg: text,
        updated: new Date()
    });

    // 刷新消息列表预览（如果不加这句，返回首页时可能看不到最新消息）
    if (window.renderChatUI) window.renderChatUI();

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

        // --- [新增] 关闭视觉设置页时，立即释放内存 ---
        if (pageName === 'visual') {
            setTimeout(() => {
                cleanVisualPageMemory();
                // 清空列表DOM，防止残影
                document.getElementById('visual-target-container').innerHTML = '';
            }, 300); // 等动画播完再清
        }
        // -------------------------------------------

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

        // === 平行世界线隔离 ===
        let chatSpecificUser = null;
        for (const mid of chat.members) {
            const char = await window.dbSystem.getChar(mid);
            if (char && char.type === 1) {
                chatSpecificUser = char;
                break;
            }
        }

        // 兜底
        if (!chatSpecificUser) {
            // console.warn("当前聊天未绑定特定User身份，回退到全局身份"); // 调试日志已注释
            chatSpecificUser = await window.dbSystem.getCurrent();
        }

        // console.log(`[平行世界] 当前对话绑定的主角是: ${chatSpecificUser.name} (ID: ${chatSpecificUser.id})`); // 调试日志已注释

        const isGroup = (chat.name || chat.members.length > 2);

        if (isGroup) {
            await handleGroupChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        } else {
            await handlePrivateChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        }

    } catch (e) {
        if (typeof chatScroller !== 'undefined' && chatScroller) chatScroller.removeLast();
        console.error(e); // 报错信息建议保留，万一出问题方便排查
        alert("AI请求中断: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
}; window.triggerAIResponse = async function (btnElement) {
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

        // === 平行世界线隔离 ===
        let chatSpecificUser = null;
        for (const mid of chat.members) {
            const char = await window.dbSystem.getChar(mid);
            if (char && char.type === 1) {
                chatSpecificUser = char;
                break;
            }
        }

        // 兜底
        if (!chatSpecificUser) {
            // console.warn("当前聊天未绑定特定User身份，回退到全局身份"); // 调试日志已注释
            chatSpecificUser = await window.dbSystem.getCurrent();
        }

        // console.log(`[平行世界] 当前对话绑定的主角是: ${chatSpecificUser.name} (ID: ${chatSpecificUser.id})`); // 调试日志已注释

        const isGroup = (chat.name || chat.members.length > 2);

        if (isGroup) {
            await handleGroupChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        } else {
            await handlePrivateChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        }

    } catch (e) {
        if (typeof chatScroller !== 'undefined' && chatScroller) chatScroller.removeLast();
        console.error(e); // 报错信息建议保留，万一出问题方便排查
        alert("AI请求中断: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
};
async function handleGroupChat(chat, userPersona, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);
    const limit = chat.historyLimit || 25;

    // --- 1. 准备表情包上下文 ---
    // 务必确保 main.js 里有 getChatStickerContext 这个辅助函数
    // 如果没有，请把上一条回复里的那个函数加上
    const stickerCtx = await getChatStickerContext(chat);
    // -------------------------

    // 2. 准备群成员信息
    const memberIds = chat.members;
    const memberProfiles = [];
    const idToNameMap = {}; // ID -> 名字 (用于历史记录)
    const nameToIdMap = {}; // 名字 -> ID (用于解析AI回复)

    for (const mid of memberIds) {
        // 获取角色数据
        let char = null;
        if (mid === userPersona.id) {
            char = userPersona;
        } else {
            char = await window.dbSystem.getChar(mid);
        }

        if (char) {
            if (mid !== userPersona.id) memberProfiles.push(char); // 只有NPC进Prompt的角色列表
            idToNameMap[mid] = char.name;
            nameToIdMap[char.name] = mid;
        }
    }

    // 3. 构建 System Prompt
    const charDefs = memberProfiles.map(c => `Name: ${c.name}\nDescription: ${c.desc || "无"}`).join('\n---\n');

    // 注入环境 & 世界书
    const historyForScan = messages.slice(-limit).map(m => ({ content: m.text }));
    const worldInfo = await window.injectWorldInfo(chat, historyForScan);
    let envInfo = "";
    try { envInfo = await window.generateEnvPrompt(chat, userPersona); } catch (e) { }

    const systemPrompt = `
# Group Chat Protocol
你正在参与一个群聊。请根据上下文扮演其中的角色（除了用户 ${userPersona.name}）。
${worldInfo.top}
# Characters
${charDefs}
# World Knowledge

${worldInfo.bottom}

# Context
${envInfo}
当前用户：${userPersona.name} (${userPersona.desc || "无"})

# Sticker System (表情包系统)
${stickerCtx.prompt} 
(规则：若要发送表情，请使用格式 "[表情] 角色名：表情名"。)

# Output Format
请严格遵守指令格式，可以连续输出多条指令：
1. 发送文本："[消息] 角色名：内容"
2. 发送表情："[表情] 角色名：表情名"
3. 示例：
   [消息] 法师：收到，马上行动！
   [表情] 法师：严肃
   [表情] 团长：开心
`.trim();

    // 4. 构建历史记录 (图片 -> 文本反解)
    const recentMessages = messages.slice(-limit);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of recentMessages) {
        let name = idToNameMap[msg.senderId] || "未知";
        let contentText = msg.text;

        // --- 反解逻辑：如果是图片消息，尝试转回 [表情] xxx ---
        if (msg.type === 'image') {
            const stickerName = stickerCtx.srcMap[msg.text];
            if (stickerName) {
                // AI 看到的是： [表情] 法师：开心
                // 这里我们在历史记录里直接模拟成 AI 的输出格式，方便它模仿
                apiMessages.push({
                    role: "assistant", // 假装是 AI 发的指令
                    content: `[表情] ${name}：${stickerName}`
                });
                continue; // 跳过常规 push
            } else {
                contentText = "[图片]";
            }
        }
        // --------------------------------------------------

        const role = (msg.senderId === userPersona.id) ? "user" : "assistant";

        // 用户发的消息，或者无法反解的普通文本消息
        // 为了保持格式统一，我们把历史记录也包装成Tag格式
        apiMessages.push({
            role: role,
            content: `[消息] ${name}：${contentText}`
        });
    }

    // UI Loading
    if (chatScroller) {
        chatScroller.append({
            chatId: chat.id,
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: memberProfiles[0]?.id || 0,
            isTyping: true
        });
        scrollToBottom();
    }

    // 5. 请求 API
    let temperature = tempRec ? parseFloat(tempRec.value) : 0.85;
    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature
        })
    }), dbKeys);

    const data = await response.json();
    if (window.chatScroller) window.chatScroller.removeLast();

    // --- 6. [核心修改] 解析结果 (正则匹配流) ---
    let content = data.choices[0].message.content;

    // 预处理：把中文冒号换成英文，方便正则
    let rawText = content.replace(/：/g, ':');

    // 正则解释：
    // \[ (消息|表情) \]  -> 捕获 Tag 类型
    // \s* ([^:]+?)       -> 捕获 名字 (非贪婪，直到冒号)
    // \s* : \s* -> 匹配 冒号
    // (.+?)              -> 捕获 内容 (非贪婪)
    // (?=\s*\[(?:消息|表情)\]|$) -> 向前看：直到遇到下一个 Tag 或 字符串结尾
    const blockRegex = /\[(消息|表情)\]\s*([^:]+?)\s*:\s*(.+?)(?=\s*\[(?:消息|表情)\]|$)/gis;

    let match;
    let msgQueue = [];

    while ((match = blockRegex.exec(rawText)) !== null) {
        const tagType = match[1]; // "消息" 或 "表情"
        const name = match[2].trim();
        const body = match[3].trim();

        // 查找发言人 ID
        const speakerId = nameToIdMap[name];
        if (!speakerId) {
            console.warn(`无法识别的角色: ${name}，跳过`);
            continue;
        }

        if (tagType === '表情') {
            // --- 处理表情 ---
            const stickerSrc = stickerCtx.nameMap[body]; // body 就是表情名
            if (stickerSrc) {
                msgQueue.push({ senderId: speakerId, text: stickerSrc, type: 'image' });
            } else {
                // AI 乱编了一个表情名，降级为文本发送，或者你要是嫌烦可以不发
                // msgQueue.push({ senderId: speakerId, text: `(试图发送表情: ${body})`, type: 'text' });
            }
        } else {
            // --- 处理消息 ---
            msgQueue.push({ senderId: speakerId, text: body, type: 'text' });
        }
    }

    // 兜底：如果正则没匹配到任何东西 (AI 没按格式输出)，尝试直接当文本发给第一个人
    if (msgQueue.length === 0 && rawText.trim()) {
        const fallbackId = memberProfiles[0]?.id || 0;
        msgQueue.push({ senderId: fallbackId, text: rawText, type: 'text' });
    }

    // 7. 执行发送队列
    for (let i = 0; i < msgQueue.length; i++) {
        const item = msgQueue[i];

        if (i > 0) {
            // 延迟模拟：使用 window.chatScroller
            if (window.chatScroller) {
                window.chatScroller.append({
                    chatId: chat.id,
                    text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
                    senderId: memberProfiles[0]?.id || 0,
                    isTyping: true
                });
                scrollToBottom();
            }
            const delay = 500 + Math.random() * 500;
            await new Promise(r => setTimeout(r, delay));
            if (window.chatScroller) window.chatScroller.removeLast();
        }

        // 1. 写入数据库，并 【获取返回的 ID】
        const newMsgId = await window.dbSystem.addMessage(chat.id, item.text, item.senderId, item.type);

        // 2. 渲染上屏：使用 window.chatScroller 并传入 ID
        if (window.chatScroller) {
            window.chatScroller.append({
                id: newMsgId,  // <--- 关键！传入 ID
                chatId: chat.id,
                text: item.text,
                senderId: item.senderId,
                type: item.type,
                time: new Date()
            });
        }

        const previewText = (item.type === 'image') ? `${idToNameMap[item.senderId]}: [表情]` : item.text;
        await window.dbSystem.chats.update(chat.id, { lastMsg: previewText, updated: new Date() });
    }
}

// [修改] 处理单聊：拟人化连发模式 (纯文本协议)
async function handlePrivateChat(chat, userPersona, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);

    // --- [修改点] 获取动态记忆条数 ---
    // 单聊默认稍微多一点，设为 25
    const limit = chat.historyLimit || 25;
    // -----------------------------
    const stickerCtx = await getChatStickerContext(chat);
    // 1. 确定 AI 身份
    const memberIds = chat.members;
    let nextSpeakerId = memberIds.find(id => id !== userPersona.id);
    if (!nextSpeakerId) nextSpeakerId = memberIds[0];

    const speaker = await window.dbSystem.getChar(nextSpeakerId);
    if (!speaker) throw new Error("找不到角色数据");

    // 2. 生成环境信息
    let envInfo = "";
    try {
        envInfo = await window.generateEnvPrompt(chat, userPersona);
    } catch (e) { }

    // 3. 准备扫描历史以触发世界书
    const historyForScan = messages.slice(-limit).map(m => ({ content: m.text }));
    const worldInfo = await window.injectWorldInfo(chat, historyForScan);

    // 4. 构建关系描述
    const relations = await window.dbSystem.getRelations(nextSpeakerId);
    const myRels = relations
        .filter(r => (r.fromId === nextSpeakerId && r.toId === userPersona.id) || (r.toId === nextSpeakerId && r.fromId === userPersona.id))
        .map(r => r.desc)
        .join('、');
    const relationStr = myRels ? `(关系：${myRels})` : "";

    const currentPartnerInfo = `
【对话对象】${userPersona.name} ${relationStr}
【对象设定】${userPersona.desc || "无特殊设定"}
`.trim();
    // 5. [核心修改] 重构 System Prompt：大幅强化人设权重
    const systemPrompt = `
# Roleplay Protocol (最高指令)
你必须完全沉浸在角色中。
# World Knowledge (世界认知)
${worldInfo.top}
你的名字：${speaker.name}
**你的核心设定**：
${speaker.desc || "无"}
${worldInfo.bottom}


# Context (当前环境)
${currentPartnerInfo}
${envInfo}
${stickerCtx.prompt}
# Output Format (输出协议)
请遵循以下规则：
1. **分段发送**：将回复拆分为 2~5 条简短的消息。
2. **口语化**：严禁书面语，使用符合你人设的口癖、语气词。
3. **格式强制**：每一行必须严格使用 "[消息] ${speaker.name}：内容" 的格式。
4. 如果要发表情，请单独一行写 "[消息] ${speaker.name}：[表情] 表情名"。

# Deep Immersion (深度沉浸指令)
1. 你的每一次回复必须严格符合【核心设定】中的性格和背景。
2. 如果【世界认知】中有关于当前话题的设定，必须优先遵守。
3. 不要表现得像个客服，要有情感、有情绪、甚至有偏见。
4. **不要在回复中跳出角色讨论规则。**


`.trim();


    // 6. 构建历史
    // 增加历史记录长度，保证上下文连贯
    const recentMessages = messages.slice(-limit);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of recentMessages) {
        let prefixName = "未知";
        if (msg.senderId === speaker.id) prefixName = speaker.name;
        else if (msg.senderId === userPersona.id) prefixName = userPersona.name;

        // --- 【核心修改：反解图片】 ---
        let contentText = msg.text;
        if (msg.type === 'image') {
            // 尝试从 srcMap 中找到对应的表情名
            const stickerName = stickerCtx.srcMap[msg.text];
            if (stickerName) {
                contentText = `[表情] ${stickerName}`; // AI 看到的是 "[表情] 滑稽"
            } else {
                contentText = "[图片]"; // 没识别出来的图片
            }
        }
        // ---------------------------

        const role = (msg.senderId === userPersona.id) ? "user" : "assistant";
        apiMessages.push({
            role: role,
            content: `[消息] ${prefixName}：${contentText}`
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
    // [建议] 稍微调高温度，让扮演更灵活，不要太死板
    let temperature = tempRec ? parseFloat(tempRec.value) : 0.85;

    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature
        })
    }), dbKeys);

    const data = await response.json();
    if (window.chatScroller) window.chatScroller.removeLast();

    // --- 9. 解析结果 (终极分割版) ---
    let content = data.choices[0].message.content;
    let rawText = content.replace(/：/g, ':').trim();
    let chunks = rawText.split(/\[消息\]/i);

    let msgQueue = [];

    for (let chunk of chunks) {
        let trimmedChunk = chunk.trim();
        if (!trimmedChunk) continue;

        let firstColonIndex = trimmedChunk.indexOf(':');
        if (firstColonIndex !== -1) {
            let name = trimmedChunk.substring(0, firstColonIndex).trim();
            let text = trimmedChunk.substring(firstColonIndex + 1).trim();

            if (text) {
                // --- 【核心修改：检测 AI 是否发了表情】 ---
                // 格式如： [表情] 开心
                const stickerRegex = /^\[表情\]\s*(.+)$/i;
                const match = text.match(stickerRegex);

                if (match) {
                    const stickerName = match[1].trim();
                    const stickerSrc = stickerCtx.nameMap[stickerName]; // 查找图片Base64

                    if (stickerSrc) {
                        // 找到了！推入队列，类型标记为 image
                        msgQueue.push({ speaker: name, text: stickerSrc, type: 'image' });
                    } else {
                        // AI 瞎编了一个不存在的表情，转为普通文本吐槽回去，或者直接显示文本
                        msgQueue.push({ speaker: name, text: `(试图发送表情 "${stickerName}" 失败)`, type: 'text' });
                    }
                } else {
                    // 普通文本
                    msgQueue.push({ speaker: name, text: text, type: 'text' });
                }
                // -------------------------------------
            }
        } else {
            // 处理没有冒号的漏网之鱼
            if (!trimmedChunk.startsWith('#') && !trimmedChunk.startsWith('User')) {
                msgQueue.push({ speaker: null, text: trimmedChunk, type: 'text' });
            }
        }
    }

    // --- 10. 执行发送 (修改：支持 type 传递) ---
    for (let i = 0; i < msgQueue.length; i++) {
        const item = msgQueue[i];
        const text = item.text;
        const type = item.type || 'text';

        if (i > 0) {
            // 连发延迟：使用 window.chatScroller
            if (window.chatScroller) {
                window.chatScroller.append({
                    chatId: chat.id,
                    text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
                    senderId: nextSpeakerId, // 单聊的 nextSpeakerId 在函数开头定义过
                    isTyping: true
                });
                scrollToBottom();
            }
            const delay = 600 + Math.random() * 800 + (type === 'image' ? 500 : text.length * 30);
            await new Promise(r => setTimeout(r, delay));
            if (window.chatScroller) window.chatScroller.removeLast();
        }

        // 1. 写入数据库，并 【获取返回的 ID】
        const newMsgId = await window.dbSystem.addMessage(chat.id, text, nextSpeakerId, type);

        // 2. 渲染上屏：使用 window.chatScroller 并传入 ID
        if (window.chatScroller) {
            window.chatScroller.append({
                id: newMsgId, // <--- 关键！
                chatId: chat.id,
                text: text,
                senderId: nextSpeakerId,
                type: type,
                time: new Date()
            });
        }

        const previewText = (type === 'image') ? '[表情]' : text;
        await window.dbSystem.chats.update(chat.id, { lastMsg: previewText, updated: new Date() });
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
/* =========================================
   [新增] 聊天环境设置 (Env Settings) 逻辑
   ========================================= */

let currentEnvTarget = 'user'; // 'user' or 'char'

// 1. 打开设置页面
window.openChatSettings = async function () {
    if (!window.currentActiveChatId) return;
    window.openApp('chat-settings');

    const chatId = parseInt(window.currentActiveChatId);
    const chat = await window.dbSystem.chats.get(chatId);

    // === 1. [核心修复] 回显世界书挂载状态 ===
    // 这一步之前漏了，导致每次打开都显示默认的“未挂载”
    if (chat) {
        const count = (chat.mountedWorldBooks || []).length;
        const el = document.getElementById('wb-mount-status');
        if (el) {
            el.innerText = count > 0 ? `已挂载 ${count} 个局部设定` : "未挂载局部设定";
            // 给个高亮颜色提示
            el.style.color = count > 0 ? "var(--theme-purple)" : "#999";
        }
    }
    // === [新增] 回显短期记忆条数 ===
    const limitInput = document.getElementById('setting-context-limit');
    if (limitInput) {
        // 如果数据库里没有存(null)，默认显示 25
        limitInput.value = chat.historyLimit || 25;
    }
    // === 2. 环境增强设置回显 (保持原有逻辑) ===
    const switchEl = document.getElementById('env-mode-switch');
    const panel = document.getElementById('env-settings-panel');
    if (chat.envEnabled) {
        switchEl.checked = true;
        panel.style.display = 'block';
    } else {
        switchEl.checked = false;
        panel.style.display = 'none';
    }

    // 更新“我的位置”数据
    if (typeof updateCityUI === 'function') {
        updateCityUI(chat.envUserCity, 'user');
    }

    // === 3. 环境设置分流 (单聊/群聊) ===
    const isGroup = (chat.name || chat.members.length > 2);
    const singleView = document.getElementById('view-mode-single');
    const groupView = document.getElementById('view-mode-group');

    if (isGroup) {
        // 群聊模式
        if (singleView) singleView.style.display = 'none';
        if (groupView) {
            groupView.style.display = 'block';
            if (typeof renderGroupEnvList === 'function') {
                renderGroupEnvList(chat);
            }
        }
    } else {
        // 单聊模式
        if (groupView) groupView.style.display = 'none';
        if (singleView) {
            singleView.style.display = 'flex';
            if (typeof updateCityUI === 'function') {
                updateCityUI(chat.envCharCity, 'char');
            }
        }
    }
};

// [新增] 渲染群成员位置列表
async function renderGroupEnvList(chat) {
    const container = document.getElementById('env-group-list-container');
    container.innerHTML = '<div style="padding:10px;text-align:center;color:#ccc;">加载中...</div>';

    let html = '';
    const memberMap = chat.envMemberMap || {};

    for (const memberId of chat.members) {
        // 跳过自己
        const me = await window.dbSystem.getCurrent();
        if (me && me.id === memberId) continue;

        const char = await window.dbSystem.getChar(memberId);
        if (!char) continue;

        const locData = memberMap[memberId];
        const hasSet = (locData && locData.isValid);

        // 数据准备
        // 如果没设置，大字显示“未设置”，映射显示空
        const displayFake = hasSet ? locData.fake : "未设置";
        const displayReal = hasSet ? `映射: ${locData.real}` : "映射: (空)";
        const statusClass = hasSet ? "active" : ""; // 绿点类名

        // 这里的 class 直接用了 city-card-wide，保证和上面一模一样
        // 额外加了 env-list-item 用来控制间距
        html += `
        <div class="city-card-wide env-list-item" onclick="openCityModal('member-${memberId}')">
            
            <div class="city-card-header">
                <div class="city-label-group">
                    <div class="city-label-title">
                        <span class="char-status-dot ${statusClass}"></span>${char.name}
                    </div>
                    <div class="city-name-main" style="font-size:18px; margin-top:2px;">
                        ${displayFake}
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px solid #f9f9f9; padding-top:8px;">
                <div class="city-name-sub" style="color:${hasSet ? '#9B9ECE' : '#ccc'}">
                    ${displayReal}
                </div>
                <div id="weather-preview-${memberId}" class="city-weather-info" style="color:#9B9ECE;">
                    ${hasSet ? '加载中...' : '--'}
                </div>
            </div>

        </div>`;

        // 异步加载数据
        if (hasSet) {
            fetchEnvData(locData.real).then(res => {
                if (res) {
                    const wEl = document.getElementById(`weather-preview-${memberId}`);
                    // 格式完全统一： 20:47 | -2.5°C, 晴朗
                    if (wEl) wEl.innerText = `${res.time} | ${res.temp}°C, ${res.weather}`;
                }
            });
        }
    }

    if (html === '') {
        html = '<div style="padding:20px;text-align:center;color:#eee;font-size:12px;">没有其他成员</div>';
    }
    container.innerHTML = html;
}

// 2. 切换开关
window.toggleEnvMode = async function (el) {
    const isChecked = el.checked;
    const panel = document.getElementById('env-settings-panel');
    panel.style.display = isChecked ? 'block' : 'none';

    // 保存到数据库
    if (window.currentActiveChatId) {
        await window.dbSystem.chats.update(window.currentActiveChatId, {
            envEnabled: isChecked
        });
    }
};

// 3. 打开城市弹窗
window.openCityModal = async function (target) {
    currentEnvTarget = target; // 可能是 'user', 'char', 'member-5'
    const modal = document.getElementById('modal-city-select');
    modal.style.display = 'flex';

    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);
    let data = null;

    if (target === 'user') {
        data = chat.envUserCity;
    } else if (target === 'char') {
        data = chat.envCharCity;
    } else if (target.startsWith('member-')) {
        const mid = parseInt(target.split('-')[1]);
        if (chat.envMemberMap) {
            data = chat.envMemberMap[mid];
        }
    }

    document.getElementById('city-fake-input').value = data ? data.fake : '';
    document.getElementById('city-real-input').value = data ? data.real : '';
};

// 4. 保存城市选择
window.saveCitySelection = async function () {
    const fakeInput = document.getElementById('city-fake-input');
    const realInput = document.getElementById('city-real-input');
    if (!fakeInput || !realInput) return;

    const fake = fakeInput.value.trim();
    const real = realInput.value.trim();

    if (!fake || !real) return alert("请填写完整信息");

    const saveBtn = document.querySelector('#modal-city-select .btn-main');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "正在验证...";

    try {
        const validation = await validateCity(real);
        const data = {
            fake: fake,
            real: validation.success ? validation.realName : real,
            isValid: validation.success,
            lat: validation.lat,
            lon: validation.lon,
            tz: validation.tz
        };

        if (window.currentActiveChatId) {
            const chatId = parseInt(window.currentActiveChatId);
            const chat = await window.dbSystem.chats.get(chatId);

            // --- 关键分支逻辑 ---
            if (currentEnvTarget === 'user') {
                // 保存我的位置
                await window.dbSystem.chats.update(chatId, { envUserCity: data });
                updateCityUI(data, 'user');

            } else if (currentEnvTarget === 'char') {
                // 保存单聊对方
                await window.dbSystem.chats.update(chatId, { envCharCity: data });
                updateCityUI(data, 'char');

            } else if (currentEnvTarget.startsWith('member-')) {
                // [新增] 保存群成员
                const memberId = parseInt(currentEnvTarget.split('-')[1]);

                // 读取旧 map 或新建
                const newMap = chat.envMemberMap || {};
                newMap[memberId] = data; // 更新该成员

                await window.dbSystem.chats.update(chatId, { envMemberMap: newMap });

                // 刷新列表 (局部刷新比重绘整个页面好，但简单起见直接调 render)
                renderGroupEnvList(await window.dbSystem.chats.get(chatId));
            }
        }

        document.getElementById('modal-city-select').style.display = 'none';

    } catch (e) {
        console.error(e);
        alert("保存出错: " + e.message);
    } finally {
        saveBtn.innerText = originalText;
    }
};

// --- [新增] 城市验证函数 ---
async function validateCity(cityName) {
    if (!cityName) return { success: false };

    try {
        // 1. 检测输入是不是纯英文
        const isEnglish = /^[a-zA-Z\s\.\-\,]+$/.test(cityName);

        let url;
        let res, data;

        if (isEnglish) {
            // --- 英文输入模式 ---
            // 策略：先用英文搜 (精度最高)，防止 "New York" 变成 "约克"
            // count=5 是为了让 API 有机会根据人口排序，把大城市排前面
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
            res = await fetch(url);
            data = await res.json();

        } else {
            // --- 中文输入模式 ---
            // 策略：直接用中文搜
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=zh&format=json`;
            res = await fetch(url);
            data = await res.json();
        }

        // 如果第一种策略没搜到，尝试兜底（反向策略）
        if (!data.results || data.results.length === 0) {
            const fallbackLang = isEnglish ? 'zh' : 'en';
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=${fallbackLang}&format=json`;
            res = await fetch(url);
            data = await res.json();
        }

        if (data.results && data.results.length > 0) {
            // 取第一个结果 (API默认按相关性和人口排序，通常第一个就是对的)
            const place = data.results[0];

            // 智能名称显示：
            // 如果 API 返回了中文名 (place.name 随 language 变)，就用中文
            // 如果没有，就用它原本的名字
            const displayName = place.name;

            return {
                success: true,
                realName: displayName, // 这里存入数据库
                lat: place.latitude,
                lon: place.longitude,
                tz: place.timezone,
                country: place.country
            };
        }
        return { success: false };
    } catch (e) {
        console.warn("City Validation Error", e);
        return { success: false };
    }
}




// 辅助：更新界面上的文字
async function updateCityUI(data, type) {
    // 1. 处理“我的位置” (单聊+群聊两处UI)
    if (type === 'user') {
        const ids = [
            { fake: 'ui-user-fake', real: 'ui-user-real', weather: 'ui-user-weather' },
            { fake: 'ui-user-fake-group', real: 'ui-user-real-group', weather: 'ui-user-weather-group' }
        ];

        for (const idSet of ids) {
            const elFake = document.getElementById(idSet.fake);
            const elReal = document.getElementById(idSet.real);
            const elWeather = document.getElementById(idSet.weather);

            if (!elFake) continue;

            if (!data || !data.fake) {
                elFake.innerText = "点击设置";
                if (elReal) elReal.innerText = "映射: --";
                if (elWeather) elWeather.innerText = "--";
            } else {
                elFake.innerText = data.fake;
                if (elReal) {
                    elReal.innerText = data.isValid ? `映射: ${data.real}` : `未验证: ${data.real}`;
                    elReal.style.color = data.isValid ? "#9B9ECE" : "#FF3B30";
                }
                if (elWeather && data.isValid && data.real) {
                    fetchEnvData(data.real).then(w => {
                        if (w) {
                            // 🔴 修改点：加入了 w.time (例如: 14:30 | 25°C, 晴)
                            elWeather.innerText = `${w.time} | ${w.temp}°C, ${w.weather}`;
                        }
                    });
                }
            }
        }
        return;
    }

    // 2. 处理“对方位置” (单聊UI)
    const elFake = document.getElementById(`ui-${type}-fake`);
    const elReal = document.getElementById(`ui-${type}-real`);
    const elWeather = document.getElementById(`ui-${type}-weather`);

    if (!data || !data.fake) {
        if (elFake) elFake.innerText = "点击设置";
        if (elReal) elReal.innerText = "映射: --";
        if (elWeather) elWeather.innerText = "--";
        return;
    }

    if (elFake) elFake.innerText = data.fake;
    if (elReal) {
        elReal.innerText = data.isValid ? `映射: ${data.real}` : `未验证: ${data.real}`;
        elReal.style.color = data.isValid ? "#9B9ECE" : "#FF3B30";
    }
    if (data.isValid && data.real && elWeather) {
        elWeather.innerText = "加载中...";
        fetchEnvData(data.real).then(w => {
            if (w) {
                // 🔴 修改点：加入了 w.time
                elWeather.innerText = `${w.time} | ${w.temp}°C, ${w.weather}`;
            }
        });
    }
}

// [修改] 获取环境数据 (最终修复版：精准实时时间 + 国际化支持)
async function fetchEnvData(realCityName) {
    if (!realCityName) return null;

    try {
        // 1. 验证并获取坐标与时区
        // (这里直接复用 validateCity 的逻辑，确保拿到正确的 timezone)
        const cityInfo = await validateCity(realCityName);
        if (!cityInfo.success) return null;

        const { lat, lon, tz } = cityInfo;

        // 2. 获取实时天气
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=${encodeURIComponent(tz)}`;
        const weatherRes = await fetch(weatherUrl);
        const wData = await weatherRes.json();

        if (!wData.current_weather) return null;

        // --- 核心修复：计算"墙上的时钟" (Wall Clock Time) ---
        // 不读取 wData.current_weather.time (那是整点报告时间)
        // 而是用当前系统时间 + 目标时区 (tz) 进行投影
        const now = new Date();
        const localTimeStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,       // 强制使用目标城市时区
            hour: '2-digit',    // 两位数小时
            minute: '2-digit',  // 两位数分钟
            hour12: false       // 24小时制
        }).format(now);

        // 3. 天气代码映射
        const weatherMap = {
            0: "晴朗", 1: "多云", 2: "阴天", 3: "阴",
            45: "雾", 48: "雾凇", 51: "小雨", 61: "下雨", 63: "中雨", 65: "大雨",
            71: "下雪", 80: "阵雨", 95: "雷雨"
        };
        const code = wData.current_weather.weathercode;
        const weatherDesc = weatherMap[code] || "多云";
        const temp = wData.current_weather.temperature;

        return {
            time: localTimeStr, // 输出示例: "20:48"
            temp: temp,
            weather: weatherDesc,
            timezone: tz
        };

    } catch (e) {
        console.error("Fetch Env Error:", e);
        return null;
    }
}

// =========================================
// [注入] 注入 Prompt 生成器
// =========================================

// [完整修复版] 注入 Prompt 生成器 (保留所有功能)
window.generateEnvPrompt = async function (chat, userPersona) {
    // 1. 基础开关校验 (如果你想关掉整个环境增强，才return)
    if (!chat.envEnabled) return "";

    const currentUser = userPersona;
    // 如果没有 userPersona，尝试用全局兜底，还是没有才退出
    const safeUser = currentUser || (await window.dbSystem.getCurrent());
    if (!safeUser) return "";

    const userName = safeUser.name;
    const myId = safeUser.id;

    // 获取消息记录
    const messages = await window.dbSystem.getMessages(chat.id);

    // =========================================================
    // 模块一：时间流逝剧本 (已修复重复问题)
    // =========================================================
    let timeGapDesc = "";

    if (messages.length > 0) {
        const now = new Date();
        let userConsecutiveMsgs = [];
        let lastAiMsg = null;

        // 倒序找 User 连发块
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.senderId === myId) {
                userConsecutiveMsgs.unshift(msg);
            } else {
                lastAiMsg = msg;
                break;
            }
        }

        let timeline = [];

        if (lastAiMsg) {
            // A. 第一句的间隔
            const aiTime = new Date(lastAiMsg.time);
            const firstUserTime = new Date(userConsecutiveMsgs[0].time);
            const initialDiff = Math.floor((firstUserTime - aiTime) / 60000);

            if (initialDiff < 2) {
                // 秒回就不废话了，省 Token
            } else if (initialDiff > 60) {
                const hours = (initialDiff / 60).toFixed(1);
                timeline.push(`(距离你上次发言过去了 ${hours} 小时，User 回复了你)`);
            } else if (initialDiff >= 5) {
                timeline.push(`(过了 ${initialDiff} 分钟，User 回复了你)`);
            }

            // B. User 连发中间的间隔 (修复：不再复述内容)
            if (userConsecutiveMsgs.length > 1) {
                for (let i = 1; i < userConsecutiveMsgs.length; i++) {
                    const prevMsg = userConsecutiveMsgs[i - 1];
                    const currMsg = userConsecutiveMsgs[i];

                    const t1 = new Date(prevMsg.time);
                    const t2 = new Date(currMsg.time);
                    const gap = Math.floor((t2 - t1) / 60000);

                    // 间隔 > 10 分钟才提示
                    if (gap > 10) {
                        let gapStr = gap < 60 ? `${gap}分钟` : `${(gap / 60).toFixed(1)}小时`;
                        // 【改动点】只描述动作，不复述内容，避免 AI 混乱
                        timeline.push(`(User 停顿了 ${gapStr} 后发送了下一条)`);
                    }
                }
            }

            // C. 发完最后一句后的等待时间
            const lastUserTime = new Date(userConsecutiveMsgs[userConsecutiveMsgs.length - 1].time);
            const waitDiff = Math.floor((now - lastUserTime) / 60000);

            if (waitDiff > 30) {
                const waitHours = (waitDiff / 60).toFixed(1);
                timeline.push(`(注意：User 发完这句话后，已经在屏幕前等待了 ${waitHours} 小时没有收到回复)`);
            }

            timeGapDesc = timeline.join("\n");

        } else {
            // 开局
            timeGapDesc = "(这是对话的开始)";
        }
    }
    // =========================================================


    // =========================================================
    // 模块二：地理位置与天气 (已修复“注入不进去”的问题)
    // =========================================================
    let locationParts = [];

    // 只有当城市存在且有效时，才去请求天气
    // 关键修复：即使这里失败，也不会 return ""，而是只显示时间
    if (chat.envUserCity && chat.envUserCity.isValid) {
        try {
            const userData = await fetchEnvData(chat.envUserCity.real);

            if (userData) {
                // 计算时段 (上午/下午)
                const getPeriod = (timeStr) => {
                    const hour = parseInt(timeStr.split(':')[0]);
                    if (hour >= 5 && hour < 12) return "早晨";
                    if (hour >= 12 && hour < 18) return "下午";
                    if (hour >= 18 && hour < 22) return "晚上";
                    return "深夜";
                };
                const userPeriod = getPeriod(userData.time);

                // 注入 User 位置
                locationParts.push(`📍 ${userName}的位置 (${chat.envUserCity.fake}): ${userData.time} (${userPeriod}), ${userData.weather}, ${userData.temp}°C`);

                // 处理对方/群成员位置 (依赖于 User 位置获取成功，因为要算时差)
                const isGroup = (chat.name || chat.members.length > 2);

                if (isGroup) {
                    // 群聊位置逻辑
                    const memberMap = chat.envMemberMap || {};
                    let groupStatusList = [];
                    for (const mid of chat.members) {
                        if (mid === myId) continue; // 跳过自己
                        const setting = memberMap[mid];
                        if (setting && setting.isValid) {
                            const char = await window.dbSystem.getChar(mid);
                            const env = await fetchEnvData(setting.real);
                            if (char && env) {
                                const charPeriod = getPeriod(env.time);
                                groupStatusList.push(`- ${char.name} @ ${setting.fake}: ${env.time} (${charPeriod}), ${env.weather}`);
                            }
                        }
                    }
                    if (groupStatusList.length > 0) {
                        locationParts.push("🌍 群成员分布:\n" + groupStatusList.join('\n'));
                    }
                } else {
                    // 单聊位置逻辑
                    if (chat.envCharCity && chat.envCharCity.isValid) {
                        const charData = await fetchEnvData(chat.envCharCity.real);
                        if (charData) {
                            const charPeriod = getPeriod(charData.time);
                            let timeDiffDesc = (userData.timezone === charData.timezone)
                                ? "" : ` (对方是${charPeriod})`;
                            locationParts.push(`📍 你的位置 (${chat.envCharCity.fake}): ${charData.time}, ${charData.weather}, ${charData.temp}°C${timeDiffDesc}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("天气获取失败，仅注入时间感知", e);
        }
    }

    // =========================================================
    // 最终组装
    // =========================================================
    let finalPromptParts = [];

    // 只要有时间描述，就放进去
    if (timeGapDesc) {
        finalPromptParts.push(`⏱️ [时间流逝记录]:\n${timeGapDesc}`);
    }

    // 只要有位置描述，就放进去
    if (locationParts.length > 0) {
        finalPromptParts.push(...locationParts);
    }

    // 只有当两者都为空时，才返回空字符串
    if (finalPromptParts.length === 0) return "";

    return `\n【🌍 实时环境同步】\n${finalPromptParts.join('\n')}\n`;
};
/* =========================================
   [重构] 视觉设置逻辑 (支持群头像 + 成员独立设置)
   ========================================= */

let currentVisualTargetId = null;
let tempVisualData = {};
// [新增] 专门用于管理设置页面的 Blob URL，防止污染全局 activeUrls
let visualPageUrls = [];

// [新增] 清理函数：释放内存
function cleanVisualPageMemory() {
    if (visualPageUrls.length > 0) {
        visualPageUrls.forEach(u => URL.revokeObjectURL(u));
        visualPageUrls = [];
        console.log("视觉设置页内存已释放");
    }
}

// 1. 监听子页面打开，如果是 'visual' 则加载数据
const originalOpenSubPage = window.openSubPage;
window.openSubPage = async function (pageName) {
    if (originalOpenSubPage) originalOpenSubPage(pageName);

    if (pageName === 'visual') {
        await loadVisualSettings();
    }
};

// 2. 加载视觉设置数据
async function loadVisualSettings() {
    if (!window.currentActiveChatId) return;

    // 1. 打开前先清理一次（以防万一上次没关干净）
    cleanVisualPageMemory();

    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);

    // 初始化暂存 (Deep Copy)
    tempVisualData = chat.visualOverrides ? JSON.parse(JSON.stringify(chat.visualOverrides)) : {};

    const container = document.getElementById('visual-target-container');
    container.innerHTML = '';

    // --- A. 添加“本群信息” ---
    if (chat.name || chat.members.length > 2) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'visual-target-item';
        groupDiv.id = 'v-target-GROUP';
        groupDiv.onclick = () => selectVisualTarget('GROUP');

        let groupAvatarStyle = "";
        // 优先读 override
        if (tempVisualData['GROUP'] && tempVisualData['GROUP'].avatar) {
            // 这里是 Base64，不需要释放，但如果是 Blob URL 就要小心
            groupAvatarStyle = `background-image:url(${tempVisualData['GROUP'].avatar})`;
        } else {
            groupAvatarStyle = `background:#9B9ECE; display:flex; align-items:center; justify-content:center;`;
        }

        groupDiv.innerHTML = `
            <div class="avatar" style="width:46px; height:46px; margin:0; ${groupAvatarStyle}; border-radius:14px; color:#fff;">
                ${groupAvatarStyle.includes('url') ? '' : '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'}
            </div>
            <span style="font-size:10px; color:#666; margin-top:6px; font-weight:bold;">本群</span>
        `;
        container.appendChild(groupDiv);
    }

    // --- B. 添加成员列表 (内存泄漏高发区) ---
    let firstId = null;
    for (const mid of chat.members) {
        const char = await window.dbSystem.getChar(mid);
        if (!char) continue;
        if (!firstId) firstId = mid;

        let avatarStyle = "";

        // 1. Override (Base64，安全)
        if (tempVisualData[mid] && tempVisualData[mid].avatar) {
            avatarStyle = `background-image:url(${tempVisualData[mid].avatar})`;
        }
        // 2. Default (Blob，必须追踪！)
        else if (char.avatar instanceof Blob) {
            const u = URL.createObjectURL(char.avatar);
            visualPageUrls.push(u); // <--- [关键] 加入清理列表
            avatarStyle = `background-image:url(${u})`;
        } else if (typeof char.avatar === 'string' && char.avatar) {
            avatarStyle = `background-image:url(${char.avatar})`;
        } else {
            avatarStyle = "background:#ccc";
        }

        const div = document.createElement('div');
        div.className = 'visual-target-item';
        div.id = `v-target-${mid}`;
        div.onclick = () => selectVisualTarget(mid);
        div.innerHTML = `
            <div class="avatar" style="width:46px; height:46px; margin:0; ${avatarStyle}; background-size:cover; background-position:center; border-radius:50%; color:#fff; font-size:14px;">
                ${avatarStyle.includes('url') ? '' : char.name[0]}
            </div>
            <span style="font-size:10px; color:#666; margin-top:6px;">${char.type === 1 ? '我' : char.name}</span>
        `;
        container.appendChild(div);
    }

    if (chat.name && tempVisualData['GROUP'] !== undefined) {
        selectVisualTarget('GROUP');
    } else if (firstId) {
        selectVisualTarget(firstId);
    }
}

// 3. 选中目标 (GROUP 或 memberId)
window.selectVisualTarget = async function (targetId) {
    currentVisualTargetId = targetId;

    // UI Highlight
    document.querySelectorAll('.visual-target-item').forEach(e => e.classList.remove('active'));
    const activeEl = document.getElementById(`v-target-${targetId}`);
    if (activeEl) activeEl.classList.add('active');

    // 准备默认值
    const defaults = {
        alias: '',
        shape: 'circle',
        size: 40,
        hidden: false,
        avatar: null
    };

    const data = tempVisualData[targetId] || defaults;

    // --- 填充表单 ---

    // 名字
    let nameDisplay = "未知";
    if (targetId === 'GROUP') {
        nameDisplay = "群聊设置";
        document.getElementById('visual-alias-input').placeholder = "修改群名";
    } else {
        const char = await window.dbSystem.getChar(targetId);
        nameDisplay = char ? char.name : "未知";
        document.getElementById('visual-alias-input').placeholder = "默认";
    }
    document.getElementById('visual-target-name').innerText = nameDisplay;
    document.getElementById('visual-alias-input').value = data.alias || '';

    // 形状、大小、显隐
    setVisualShapeUI(data.shape || 'circle');
    document.getElementById('visual-size-slider').value = data.size || 40;
    updateVisualSizeVal(data.size || 40);
    document.getElementById('visual-show-switch').checked = !data.hidden;

    // 头像预览
    const preview = document.getElementById('visual-preview');
    if (data.avatar) {
        preview.style.backgroundImage = `url(${data.avatar})`;
    } else {
        // 无 override，显示原始头像
        if (targetId === 'GROUP') {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = '#9B9ECE';
        } else {
            const char = await window.dbSystem.getChar(targetId);
            if (char.avatar instanceof Blob) {
                const u = URL.createObjectURL(char.avatar);
                visualPageUrls.push(u); // <--- [关键] 加入清理列表
                preview.style.backgroundImage = `url(${u})`;
            } else if (typeof char.avatar === 'string' && char.avatar) {
                preview.style.backgroundImage = `url(${char.avatar})`;
            } else {
                preview.style.backgroundImage = 'none';
                preview.style.backgroundColor = '#ccc';
            }
        }
    }

    // 形状同步给预览图
    preview.style.borderRadius = (data.shape === 'square') ? '12px' : '50%';
};

// 4. 辅助 UI 函数
window.updateVisualSizeVal = function (val) {
    document.getElementById('visual-size-val').innerText = val + 'px';
    // 实时更新 temp
    ensureTemp();
    tempVisualData[currentVisualTargetId].size = parseInt(val);
};

window.setVisualShape = function (shape) {
    setVisualShapeUI(shape);
    ensureTemp();
    tempVisualData[currentVisualTargetId].shape = shape;
    // 实时更新预览图形状
    document.getElementById('visual-preview').style.borderRadius = (shape === 'square') ? '12px' : '50%';
};

function setVisualShapeUI(shape) {
    document.getElementById('shape-circle').className = (shape === 'circle' ? 'shape-option active' : 'shape-option');
    document.getElementById('shape-square').className = (shape === 'square' ? 'shape-option active' : 'shape-option');
}

window.toggleVisualVisibility = function (el) {
    ensureTemp();
    tempVisualData[currentVisualTargetId].hidden = !el.checked;
};

// 5. 头像上传
window.handleVisualAvatarFile = function (input) {
    const file = input.files[0];
    if (!file || !currentVisualTargetId) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;
        document.getElementById('visual-preview').style.backgroundImage = `url(${base64})`;
        ensureTemp();
        tempVisualData[currentVisualTargetId].avatar = base64;
    };
    reader.readAsDataURL(file);
};

function ensureTemp() {
    if (!tempVisualData[currentVisualTargetId]) tempVisualData[currentVisualTargetId] = {};
}

// 6. 保存 (保存所有更改)
window.saveVisualSettings = async function () {
    if (!window.currentActiveChatId) return;

    // 保存当前输入框中的别名/群名
    if (currentVisualTargetId) {
        ensureTemp();
        tempVisualData[currentVisualTargetId].alias = document.getElementById('visual-alias-input').value.trim();
    }

    // 检查是否有群设置变化
    let updateData = { visualOverrides: tempVisualData };

    // 特殊处理：如果修改了 GROUP 的 alias，也要同步更新 chat.name
    if (tempVisualData['GROUP'] && tempVisualData['GROUP'].alias) {
        updateData.name = tempVisualData['GROUP'].alias;
    }

    await window.dbSystem.chats.update(window.currentActiveChatId, updateData);

    alert("设置已应用");

    // 刷新聊天页
    if (window.chatScroller) {
        window.openChatDetail(window.currentActiveChatId);
    }
    // 刷新消息列表（因为群头像/群名可能变了）
    if (window.renderChatUI) window.renderChatUI();

    window.closeSubPage('visual');
};
/* =========================================
   [新增] 世界书 (World Book) 逻辑
   ========================================= */

let currentWbTab = 'global'; // 'global' or 'local'
let currentWbCatId = 'all';  // 当前选中的分类ID，'all' 表示全部
let isWbSelectMode = false;  // 是否处于批量选择模式
let selectedWbIds = new Set(); // 选中的ID集合

// 1. 初始化入口：切换Tab
window.switchWorldBookTab = async function (tab) {
    currentWbTab = tab;
    // UI 切换
    document.getElementById('wb-tab-global').className = tab === 'global' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('wb-tab-local').className = tab === 'local' ? 'avatar-tab active' : 'avatar-tab';

    // 重置状态
    currentWbCatId = 'all';
    exitWbSelectMode();

    // 重新加载分类栏
    await renderCategoryBar();

    // [修改] 使用虚拟列表初始化
    if (window.initWbScroller) {
        window.initWbScroller(currentWbTab, currentWbCatId);
    }
};

// 2. 渲染分类栏 (Horizontal Bar)
async function renderCategoryBar() {
    const container = document.getElementById('wb-category-bar');
    const categories = await window.dbSystem.getCategories(currentWbTab);

    // 渲染 "全部" 胶囊
    let html = `
        <div class="wb-cat-pill ${currentWbCatId === 'all' ? 'active' : ''}" 
             onclick="switchWbCategory('all')">全部</div>`;

    // 渲染数据库里的分类
    categories.forEach(cat => {
        html += `
        <div class="wb-cat-pill ${currentWbCatId === cat.id ? 'active' : ''}" 
             onclick="switchWbCategory(${cat.id})">${cat.name}</div>`;
    });

    // 渲染 "添加/管理" 按钮
    html += `<div class="wb-cat-add-btn" onclick="openCategoryManager()">+</div>`;

    container.innerHTML = html;
}

// 3. 切换分类
window.switchWbCategory = async function (catId) {
    currentWbCatId = catId;
    await renderCategoryBar(); // 刷新高亮

    // [修改] 使用虚拟列表初始化
    if (window.initWbScroller) {
        window.initWbScroller(currentWbTab, currentWbCatId);
    }
};



// --- 批量操作逻辑 ---

// 切换选择模式
/* --- 替换 js/main.js 中的 window.toggleWbSelectMode --- */

window.toggleWbSelectMode = function () {
    isWbSelectMode = !isWbSelectMode;
    const btn = document.getElementById('wb-btn-select');
    const addBtn = document.getElementById('wb-btn-add');
    const bottomBar = document.getElementById('wb-bottom-bar');

    if (isWbSelectMode) {
        // 选中模式：图标变色或变成“取消”图标
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="#333"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
        addBtn.style.display = 'none';
        bottomBar.classList.add('active');
        selectedWbIds.clear();
    } else {
        // 恢复为“多选”图标
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>`;
        addBtn.style.display = 'flex';
        bottomBar.classList.remove('active');
        selectedWbIds.clear();
    }

    // 【修改点】：不再调用 renderWorldBookList()，而是刷新虚拟列表以显示/隐藏 Checkbox
    if (window.refreshWbScroller) {
        window.refreshWbScroller();
    }
};

window.exitWbSelectMode = function () {
    if (isWbSelectMode) toggleWbSelectMode();
};

// 点击单项 (在选择模式下)
window.toggleWbSelection = function (id, el) {
    if (selectedWbIds.has(id)) {
        selectedWbIds.delete(id);
        el.classList.remove('checked');
    } else {
        selectedWbIds.add(id);
        el.classList.add('checked');
    }
};

// 批量删除
window.batchDeleteWb = async function () {
    if (selectedWbIds.size === 0) return alert("请先选择词条");
    if (!confirm(`确定要删除选中的 ${selectedWbIds.size} 条设定吗？`)) return;

    await window.dbSystem.deleteWorldBooks(Array.from(selectedWbIds));
    toggleWbSelectMode(); // 退出模式并刷新
};

// 打开批量移动弹窗
window.openWbMoveModal = async function () {
    if (selectedWbIds.size === 0) return alert("请先选择词条");

    const categories = await window.dbSystem.getCategories(currentWbTab);
    const listEl = document.getElementById('move-cat-list');

    listEl.innerHTML = categories.map(c => `
        <div onclick="confirmBatchMove(${c.id})" 
             style="padding:15px; border-bottom:1px solid #eee; cursor:pointer; display:flex; justify-content:space-between;">
             <span>${c.name}</span>
        </div>
    `).join('');

    document.getElementById('modal-wb-move').style.display = 'flex';
};

window.confirmBatchMove = async function (targetCatId) {
    await window.dbSystem.moveWorldBooks(Array.from(selectedWbIds), targetCatId);
    document.getElementById('modal-wb-move').style.display = 'none';
    toggleWbSelectMode(); // 退出并刷新
};

// --- 分类管理逻辑 ---

window.openCategoryManager = async function () {
    const modal = document.getElementById('modal-cat-mgr');
    modal.style.display = 'flex';
    renderCatMgrList();
};

async function renderCatMgrList() {
    const listEl = document.getElementById('cat-mgr-list');
    const categories = await window.dbSystem.getCategories(currentWbTab);

    listEl.innerHTML = categories.map(c => {
        // "未分类" 不允许删除
        const isDefault = (c.name === '未分类' || c.name === '默认');

        // [修改] 使用 SVG 垃圾桶图标
        const delBtn = isDefault ? '<div style="width:32px;"></div>' : // 占位保持对齐 
            `<div class="cat-mgr-del" onclick="deleteCategory(${c.id})" style="padding:4px; display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>`;

        return `
        <div class="cat-mgr-item">
            <span class="cat-mgr-name">${c.name}</span>
            ${delBtn}
        </div>`;
    }).join('');
}

window.addNewCategory = async function () {
    const input = document.getElementById('new-cat-name');
    const name = input.value.trim();
    if (!name) return;

    await window.dbSystem.addCategory(name, currentWbTab);
    input.value = '';
    renderCatMgrList(); // 刷新管理列表
    renderCategoryBar(); // 刷新外面横条
};

window.deleteCategory = async function (id) {
    if (!confirm("删除分类后，内容将移入'未分类'。继续吗？")) return;

    // 1. 尝试找到兜底分类
    const cats = await window.dbSystem.getCategories(currentWbTab);
    // 模糊匹配：找叫“未分类”或“默认”的，或者如果找不到，就找列表里的第一个不是要删除的那个
    let defaultCat = cats.find(c => c.name === '未分类' || c.name === '默认');

    // 如果还没找到，就随便找一个不是当前要删的ID
    if (!defaultCat) {
        defaultCat = cats.find(c => c.id !== id);
    }

    // 2. 移动内容 (如果有兜底分类)
    if (defaultCat) {
        const books = await window.dbSystem.worldbooks.where('categoryId').equals(id).toArray();
        const bookIds = books.map(b => b.id);
        if (bookIds.length > 0) {
            await window.dbSystem.moveWorldBooks(bookIds, defaultCat.id);
        }
    } else {
        // 如果实在连个兜底的都没有（比如只剩这一个分类了），提示用户
        const books = await window.dbSystem.worldbooks.where('categoryId').equals(id).count();
        if (books > 0) {
            alert("这是最后一个分类，且里面还有内容，无法删除！请先新建一个分类转移内容。");
            return;
        }
    }

    // 3. 执行删除
    await window.dbSystem.deleteCategory(id);
    renderCatMgrList();
    renderCategoryBar();
    if (currentWbCatId === id) switchWbCategory('all');
};


// --- 修改：编辑页面的加载与保存 (适配分类) ---

// [修改] 打开编辑页
window.openWorldBookEdit = async function (id = null) {
    window.openApp('worldbook-edit');
    currentWbEditId = id;

    // 获取当前类型
    const currentEditType = id ? (await window.dbSystem.worldbooks.get(id)).type : currentWbTab;
    const categories = await window.dbSystem.getCategories(currentEditType);
    const select = document.getElementById('wb-category-select');

    // 渲染下拉框
    select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const title = id ? "编辑词条" : "新建词条";
    document.getElementById('wb-edit-title').innerText = title;

    if (id) {
        // === 编辑模式 ===
        const entry = await window.dbSystem.worldbooks.get(id);
        // ... (保持原有的回显代码: name, content, keys, constant, position, order) ...
        document.getElementById('wb-name').value = entry.name;
        document.getElementById('wb-content').value = entry.content;
        document.getElementById('wb-keys').value = entry.keys ? entry.keys.join(', ') : '';
        document.getElementById('wb-constant').checked = entry.constant;
        document.getElementById('wb-position').value = entry.position || 'top';
        document.getElementById('wb-order').value = entry.order || 100;

        // 选中保存的分类
        if (entry.categoryId) select.value = entry.categoryId;

        document.getElementById('btn-del-wb').style.display = 'flex';
        toggleWbKeywords(document.getElementById('wb-constant'));
        if (typeof switchWbEditType === 'function') switchWbEditType(entry.type);

    } else {
        // === 新建模式 ===
        // ... (保持原有的重置代码) ...
        document.getElementById('wb-name').value = '';
        document.getElementById('wb-content').value = '';
        document.getElementById('wb-keys').value = '';
        document.getElementById('wb-constant').checked = false;
        document.getElementById('wb-position').value = 'top';
        document.getElementById('wb-order').value = 100;

        // [核心修复] 默认选中逻辑
        if (currentWbCatId !== 'all') {
            // 如果外面选了具体分类，就用外面的
            select.value = currentWbCatId;
        } else {
            // 如果外面是“全部”，则尝试选中“未分类”
            const defaultCat = categories.find(c => c.name === '未分类' || c.name === '默认');
            if (defaultCat) select.value = defaultCat.id;
        }

        document.getElementById('btn-del-wb').style.display = 'none';
        document.getElementById('wb-keyword-group').style.display = 'block';
        if (typeof switchWbEditType === 'function') switchWbEditType(currentWbTab);
    }
};

// [新增辅助] 编辑页切换类型时，也要刷新分类下拉框
window.switchWbEditType = async function (type) {
    // UI 样式切换
    const segGlobal = document.getElementById('wb-edit-segment-global');
    const segLocal = document.getElementById('wb-edit-segment-local');
    if (type === 'global') {
        segGlobal.classList.add('active'); segLocal.classList.remove('active');
    } else {
        segGlobal.classList.remove('active'); segLocal.classList.add('active');
    }

    // 刷新分类下拉框
    const categories = await window.dbSystem.getCategories(type);
    const select = document.getElementById('wb-category-select');
    // 保持当前选中的值（如果兼容），或者切到第一个
    const oldVal = select.value;
    select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    // 尝试恢复选中，如果不行就默认第一个
    // 注意：如果是新建，我们无法知道 oldVal 是否属于新 Type，所以简单处理
};


// [修改] 保存逻辑
window.saveWorldBookEntry = async function () {
    const name = document.getElementById('wb-name').value.trim();
    const content = document.getElementById('wb-content').value.trim();
    const isConstant = document.getElementById('wb-constant').checked;
    const keysStr = document.getElementById('wb-keys').value.trim();
    const position = document.getElementById('wb-position').value;
    const order = parseInt(document.getElementById('wb-order').value) || 100;

    // 获取分类ID (必须转Int)
    const categoryId = parseInt(document.getElementById('wb-category-select').value);

    if (!name || !content) return alert("名称和内容不能为空");
    if (!categoryId) return alert("请至少创建一个分类 (前往管理页)");

    const keys = keysStr ? keysStr.split(/[,，]/).map(k => k.trim()).filter(k => k) : [];

    const segGlobal = document.getElementById('wb-edit-segment-global');
    const finalType = (segGlobal && segGlobal.classList.contains('active')) ? 'global' : 'local';

    const data = {
        name,
        content,
        constant: isConstant,
        keys,
        position,
        order,
        type: finalType,
        categoryId: categoryId,
        updated: new Date()
    };

    if (currentWbEditId) {
        await window.dbSystem.worldbooks.update(currentWbEditId, data);
    } else {
        await window.dbSystem.worldbooks.add(data);
    }

    window.closeApp('worldbook-edit');

    // 【修改点】：刷新逻辑改为操作虚拟列表
    if (currentWbTab !== finalType) {
        // 如果你添加的类型和当前显示的Tab不一样（比如在局部Tab加了全局设定），就切换Tab
        // switchWorldBookTab 内部已经调用了 initWbScroller，所以不用手动调
        switchWorldBookTab(finalType);
    } else {
        // 如果类型一样，直接重新初始化当前列表
        if (window.initWbScroller) {
            window.initWbScroller(currentWbTab, currentWbCatId);
        }
    }
};

// --- 挂载逻辑 (Mounting) ---

// 1. 打开挂载选择器
window.openWorldBookMountSelector = async function () {
    if (!window.currentActiveChatId) return alert("未找到当前会话ID");
    const chatId = parseInt(window.currentActiveChatId);
    const chat = await window.dbSystem.chats.get(chatId);
    if (!chat) return;

    document.getElementById('modal-wb-mount').style.display = 'flex';

    // 1. 准备数据
    let mountedIds = (chat.mountedWorldBooks || []).map(id => parseInt(id));

    // 获取分类 和 所有局部设定
    const categories = await window.dbSystem.getCategories('local');
    const books = await window.dbSystem.worldbooks.where('type').equals('local').toArray();

    const listEl = document.getElementById('wb-mount-list');
    if (books.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999">没有可用的局部设定</div>';
        return;
    }

    // 2. 分组逻辑
    // 结构: { catId: { info: CategoryObj, items: [BookObj...] } }
    const groups = {};

    // 先初始化所有分类容器
    categories.forEach(c => {
        groups[c.id] = { info: c, items: [] };
    });
    // 添加一个"未分类"容器
    groups['uncat'] = { info: { id: 'uncat', name: '未分类' }, items: [] };

    // 将书分配到组
    books.forEach(b => {
        // 如果有分类且分类存在，放进去；否则放进未分类
        if (b.categoryId && groups[b.categoryId]) {
            groups[b.categoryId].items.push(b);
        } else {
            groups['uncat'].items.push(b);
        }
    });

    // 3. 渲染 HTML
    let html = '';

    // 辅助：生成组 HTML
    const renderGroup = (group) => {
        if (group.items.length === 0) return ''; // 空分类不显示

        // 检查该组是否全选 (用于初始化分类勾选框状态)
        // 逻辑：如果组内所有 items 都在 mountedIds 里，则分类框打勾
        const allChecked = group.items.every(b => mountedIds.includes(b.id));
        const groupCheckState = allChecked ? 'checked' : '';

        // 生成子项 HTML
        const itemsHtml = group.items.map(b => {
            const isChecked = mountedIds.includes(b.id) ? 'checked' : '';
            return `
            <label class="wb-mount-subitem">
                <input type="checkbox" class="wb-mount-cb group-${group.info.id}" value="${b.id}" ${isChecked} 
                       onchange="updateGroupCheckState('${group.info.id}')">
                <div class="wb-mount-info">
                    <div class="name">${b.name}</div>
                    <div class="preview">${b.content.substring(0, 15)}...</div>
                </div>
            </label>`;
        }).join('');

        return `
        <div class="wb-mount-group">
            <div class="wb-mount-group-header">
                <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <input type="checkbox" id="cat-cb-${group.info.id}" ${groupCheckState} 
                           onchange="toggleMountGroup(this, '${group.info.id}')"
                           style="margin-right:10px; accent-color:var(--theme-purple);">
                    <span style="font-weight:bold; color:#555;">${group.info.name}</span>
                    <span style="font-size:12px; color:#999; margin-left:auto;">${group.items.length}项</span>
                </label>
            </div>
            <div class="wb-mount-group-body">
                ${itemsHtml}
            </div>
        </div>`;
    };

    // 先渲染有分类的
    categories.forEach(c => {
        html += renderGroup(groups[c.id]);
    });
    // 最后渲染未分类
    html += renderGroup(groups['uncat']);

    listEl.innerHTML = html;
};

// [新增] 辅助：点击分类全选/全不选
window.toggleMountGroup = function (catCheckbox, groupId) {
    const isChecked = catCheckbox.checked;
    // 找到该组下面所有的子 checkbox
    const subCBs = document.querySelectorAll(`.group-${groupId}`);
    subCBs.forEach(cb => {
        cb.checked = isChecked;
    });
};

// [新增] 辅助：点击子项时，检查是否需要更新分类的全选状态
// (可选功能：为了体验更好，如果子项取消了一个，分类头也应该取消)
window.updateGroupCheckState = function (groupId) {
    const catCheckbox = document.getElementById(`cat-cb-${groupId}`);
    if (!catCheckbox) return;

    const subCBs = document.querySelectorAll(`.group-${groupId}`);
    // 检查是否全都选中了
    let all = true;
    for (let i = 0; i < subCBs.length; i++) {
        if (!subCBs[i].checked) {
            all = false;
            break;
        }
    }
    catCheckbox.checked = all;
};

// 2. 保存挂载
window.saveWbMount = async function () {
    if (!window.currentActiveChatId) return;
    const chatId = parseInt(window.currentActiveChatId);

    // [关键] 只获取 class="wb-mount-cb" 的复选框 (即具体的书，不包含分类头)
    const checkboxes = document.querySelectorAll('.wb-mount-cb');
    const selectedIds = [];

    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.value));
        }
    });

    try {
        await window.dbSystem.chats.update(chatId, { mountedWorldBooks: selectedIds });

        // 更新设置页文字
        const el = document.getElementById('wb-mount-status');
        if (el) el.innerText = selectedIds.length > 0 ? `已挂载 ${selectedIds.length} 个局部设定` : "未挂载局部设定";
        if (el) el.style.color = selectedIds.length > 0 ? "var(--theme-purple)" : "#999";

        document.getElementById('modal-wb-mount').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("保存失败");
    }
};

// 3. 在 settings 打开时刷新状态
// (你需要手动去 main.js 的 openChatSettings 函数里加一行调用 updateWbMountStatus())
window.updateWbMountStatus = async function (chatId) {
    const chat = await window.dbSystem.chats.get(chatId);
    const count = (chat.mountedWorldBooks || []).length;
    const el = document.getElementById('wb-mount-status');
    if (el) el.innerText = count > 0 ? `已挂载 ${count} 个局部设定` : "未挂载局部设定";
};

/* =========================================
   [核心] AI 认知注入逻辑 (Prompt Injection)
   ========================================= */

// 这个函数需要在 triggerAIResponse 内部被调用
window.injectWorldInfo = async function (chat, historyMessages) {
    // console.log("--- 开始世界书注入流程 ---"); // 调试日志

    // 1. 获取所有候选词条
    // A. 全局设定
    const globalBooks = await window.dbSystem.worldbooks.where('type').equals('global').toArray();
    // console.log(`1. 找到全局设定: ${globalBooks.length} 条`);

    // B. 局部设定 (修复点：使用 bulkGet 替代 anyOf，更稳定)
    const mountedIds = chat.mountedWorldBooks || [];
    // console.log(`2. 当前会话挂载ID:`, mountedIds);

    let localBooks = [];
    if (mountedIds.length > 0) {
        // bulkGet 返回的顺序对应 ID 顺序，如果 ID 不存在会返回 undefined，需要过滤掉
        const results = await window.dbSystem.worldbooks.bulkGet(mountedIds);
        localBooks = results.filter(item => !!item);
    }
    // console.log(`3. 实际读取到局部设定: ${localBooks.length} 条`);

    const allCandidates = [...globalBooks, ...localBooks];
    if (allCandidates.length === 0) {
        // console.log("没有候选词条，跳过注入");
        return { top: "", bottom: "" };
    }

    // 2. 扫描触发 (Trigger Scan)
    // 获取最近 10 条消息作为上下文
    const scanText = historyMessages.slice(-10).map(m => m.content).join('\n').toLowerCase();

    let activeEntries = [];

    for (const book of allCandidates) {
        let isHit = false;
        let reason = "";

        // 情况一：常驻 (Constant) -> 必定注入
        if (book.constant) {
            isHit = true;
            reason = "常驻激活";
        }
        // 情况二：关键词触发
        else if (book.keys && book.keys.length > 0) {
            // 遍历所有关键词，只要有一个匹配就命中
            for (const key of book.keys) {
                // 简单的包含匹配 (大小写已在外部转为 lower)
                if (scanText.includes(key.toLowerCase())) {
                    isHit = true;
                    reason = `命中关键词 [${key}]`;
                    break;
                }
            }
        }

        if (isHit) {
            // console.log(`✅ 激活词条: [${book.name}] (${book.type}) - 原因: ${reason}`);
            activeEntries.push(book);
        } else {
            // console.log(`❌ 忽略词条: [${book.name}] - 未满足触发条件`);
        }
    }

    // 3. 排序 (Order 大的在后面)
    activeEntries.sort((a, b) => a.order - b.order);

    // 4. 构建 Prompt
    let topPrompts = [];
    let bottomPrompts = [];

    for (const entry of activeEntries) {
        const text = `【${entry.name}】：${entry.content}`;
        if (entry.position === 'top') {
            topPrompts.push(text);
        } else {
            bottomPrompts.push(text);
        }
    }

    const result = {
        top: topPrompts.length > 0 ? `\n[世界基础认知/绝对公理]\n${topPrompts.join('\n')}\n` : "",
        bottom: bottomPrompts.length > 0 ? `\n[当前场景/潜意识关联]\n${bottomPrompts.join('\n')}\n` : ""
    };

    // console.log("--- 注入流程结束 ---");
    return result;
};
// [新增] 保存聊天记忆条数设置
window.saveContextLimit = async function (val) {
    if (!window.currentActiveChatId) return;

    // HTML 中传入的是 this.value (字符串)，所以直接转数字
    let limitNum = parseInt(val);

    // 简单的校验：不能小于 1，如果用户清空了或者乱填，就存为 25 (默认值)
    if (isNaN(limitNum) || limitNum < 1) {
        limitNum = 25;
    }

    // 写入数据库
    await window.dbSystem.chats.update(parseInt(window.currentActiveChatId), {
        historyLimit: limitNum
    });

    console.log(`短期记忆条数已更新为: ${limitNum}`);

    // 可选：给个轻提示
    // alert("记忆条数已保存");
};
function switchWbEditType(type) {
    const segGlobal = document.getElementById('wb-edit-segment-global');
    const segLocal = document.getElementById('wb-edit-segment-local');

    if (!segGlobal || !segLocal) return;

    if (type === 'global') {
        segGlobal.classList.add('active');
        segLocal.classList.remove('active');
    } else {
        segGlobal.classList.remove('active');
        segLocal.classList.add('active');
    }
}
/* --- js/main.js 末尾添加 --- */

// --- 消息长按菜单逻辑 ---

let activeMenuMsgId = null; // 记录当前正在操作哪条消息
let activeMenuMsgText = "";

// 1. 显示菜单
window.showMsgMenu = function (x, y, targetBubble) {
    const menu = document.getElementById('msg-menu-box');
    const overlay = document.getElementById('msg-context-menu-overlay');
    if (!menu || !overlay) return;

    // --- 【关键修复点在这里】 ---
    // 从传进来的 DOM 对象中获取 ID，并赋值给全局变量
    if (targetBubble) {
        activeMenuMsgId = targetBubble.getAttribute('data-msg-id');
    }

    // 如果没获取到 ID，就别弹菜单了，防止误操作
    if (!activeMenuMsgId) {
        console.error("未获取到消息 ID，无法显示菜单");
        return;
    }
    // -------------------------

    // 显示遮罩和菜单
    overlay.style.display = 'block';
    menu.style.display = 'flex';

    // 计算位置（包含之前的边缘检测修复）
    const screenW = window.innerWidth || document.documentElement.clientWidth;
    const menuW = menu.offsetWidth;

    let left = x;
    let top = y - 30;

    // 防止左溢出
    if (left < 10) left = 10;

    // 防止右溢出
    if (left + menuW > screenW - 10) {
        left = screenW - menuW - 10;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
};

// 2. 隐藏菜单
window.hideMsgMenu = function () {
    document.getElementById('msg-context-menu-overlay').style.display = 'none';
};

// 3. 执行删除
window.handleDeleteMsg = async function () {
    // 1. 隐藏菜单
    window.hideMsgMenu();

    // 2. 校验 ID
    if (!activeMenuMsgId || activeMenuMsgId === "undefined") {
        console.error("无法删除：消息 ID 无效");
        return;
    }
    const msgIdToDelete = parseInt(activeMenuMsgId);

    try {
        // --- A. 数据库删除 (最重要的一步) ---
        await window.dbSystem.messages.delete(msgIdToDelete);

        // --- B. 更新会话最后一条消息预览 (防止退出去看到旧消息) ---
        const latestMsgs = await window.dbSystem.getMessagesPaged(window.currentActiveChatId, 1, 0);
        let newLastMsg = "暂无消息";
        if (latestMsgs.length > 0) {
            const last = latestMsgs[latestMsgs.length - 1];
            newLastMsg = last.type === 'image' ? '[图片]' : last.text;
        }
        await window.dbSystem.chats.update(window.currentActiveChatId, {
            lastMsg: newLastMsg,
            updated: new Date()
        });

        // --- C. 【核弹级修复】强制刷新当前聊天窗口 ---
        // 这行代码会重新从数据库拉取最新消息，重新构建列表
        // 从而彻底解决“删不掉”、“有残留”的问题
        if (window.openChatDetail && window.currentActiveChatId) {
            await window.openChatDetail(window.currentActiveChatId);

            // 保持滚动条在底部 (可选，体验更好)
            setTimeout(() => {
                const body = document.getElementById('chat-body');
                if (body) body.scrollTop = body.scrollHeight;
            }, 50);
        }

        // --- D. 顺便刷新首页列表 ---
        if (window.renderChatUI) window.renderChatUI();

    } catch (e) {
        console.error("删除失败:", e);
        alert("删除出错，请刷新页面重试");
    }
};

// 4. 执行复制
window.handleCopyMsg = function () {
    if (activeMenuMsgText) {
        navigator.clipboard.writeText(activeMenuMsgText).then(() => {
            // 可以加个简单的 Toast 提示，这里用 alert 替代或者静默
            // alert('已复制'); 
        });
    }
    hideMsgMenu();
};
let currentStickerPackId = null;
let isStickerSelectMode = false; // 是否处于选择模式
let selectedStickerIds = new Set(); // 选中的ID集合

// 1. 打开表情包管理器
window.openStickerManager = async function () {
    window.openApp('sticker-mgr');
    exitStickerSelectMode(); // 重置状态
    await loadStickerPacks();
};

// 2. 加载分类 (保持不变)
async function loadStickerPacks() {
    const packs = await window.dbSystem.sticker_packs.toArray();
    const container = document.getElementById('sticker-pack-bar');

    // 默认选中第一个
    if (!currentStickerPackId && packs.length > 0) {
        currentStickerPackId = packs[0].id;
    }

    let html = '';

    // 1. 渲染分类胶囊 (复用 wb-cat-pill 样式)
    packs.forEach(p => {
        const activeClass = (p.id === currentStickerPackId) ? 'active' : '';
        html += `<div class="wb-cat-pill ${activeClass}" onclick="switchStickerPack(${p.id})">${p.name}</div>`;
    });

    // 2. 【核心修改】在末尾追加“管理按钮” (复用 wb-cat-add-btn 样式)
    // 这样长得就和世界书那个加号完全一样了
    html += `
    <div class="wb-cat-add-btn" onclick="openStickerPackManager()">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
    </div>`;

    container.innerHTML = html;

    // 加载内容
    if (currentStickerPackId) {
        await loadStickersInPack(currentStickerPackId);
    } else {
        document.getElementById('sticker-grid-container').innerHTML =
            '<div style="width:100%;text-align:center;color:#ccc;padding:40px;">暂无表情包<br>点击右侧 + 号添加</div>';
    }
}

// 3. 切换分类
window.switchStickerPack = async function (id) {
    currentStickerPackId = id;
    // 切换分类时，如果是选择模式，建议退出，或者清空选择
    selectedStickerIds.clear();
    await loadStickerPacks();
};

// 4. [重构] 加载表情 (网格)
async function loadStickersInPack(packId) {
    // 不再一次性读取 array，而是直接调用虚拟列表初始化
    if (window.initStickerScroller) {
        window.initStickerScroller(packId);
    } else {
        console.error("render.js 未加载或未定义 initStickerScroller");
    }
}

// 5. [新增] 预览大图
window.openStickerPreview = function (src) {
    const overlay = document.getElementById('sticker-preview-overlay');
    const img = document.getElementById('sticker-preview-img');
    img.src = src;
    overlay.style.display = 'flex';
};

// --- 批量选择逻辑 ---

// 6. 切换选择模式
window.toggleStickerSelectMode = function () {
    isStickerSelectMode = !isStickerSelectMode;

    const btnIcon = document.querySelector('#st-btn-select svg');
    const addBtn = document.getElementById('st-btn-add');
    const bottomBar = document.getElementById('st-bottom-bar');

    if (isStickerSelectMode) {
        // 进入选择模式：图标变叉号或完成
        btnIcon.innerHTML = `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`; // X
        addBtn.style.display = 'none'; // 隐藏添加按钮
        bottomBar.classList.add('active'); // 弹出底部栏
    } else {
        // 退出选择模式
        exitStickerSelectMode();
    }

    // 刷新网格以更新点击事件和样式
    if (window.refreshStickerScroller) {
        window.refreshStickerScroller();
    }
};

// 辅助：彻底退出选择模式
function exitStickerSelectMode() {
    isStickerSelectMode = false;
    selectedStickerIds.clear();

    const btnIcon = document.querySelector('#st-btn-select svg');
    if (btnIcon) btnIcon.innerHTML = `<path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>`;

    const addBtn = document.getElementById('st-btn-add');
    if (addBtn) addBtn.style.display = 'flex';

    const bottomBar = document.getElementById('st-bottom-bar');
    if (bottomBar) bottomBar.classList.remove('active');
}

// 7. 单选/取消
window.toggleStickerSelection = function (id, el) {
    if (selectedStickerIds.has(id)) {
        selectedStickerIds.delete(id);
        el.classList.remove('selected');
    } else {
        selectedStickerIds.add(id);
        el.classList.add('selected');
    }
};

// 8. 全选
window.selectAllStickers = async function () {
    // 直接查库获取所有 ID
    const allIds = await window.dbSystem.stickers.where('packId').equals(currentStickerPackId).primaryKeys();

    if (selectedStickerIds.size === allIds.length && allIds.length > 0) {
        selectedStickerIds.clear();
    } else {
        selectedStickerIds.clear(); // 先清空，防止有旧的
        allIds.forEach(id => selectedStickerIds.add(id));
    }

    // 刷新视图
    if (window.refreshStickerScroller) window.refreshStickerScroller();
};

// 9. 批量删除
window.batchDeleteStickers = async function () {
    if (selectedStickerIds.size === 0) return alert("请至少选择一张表情");
    if (!confirm(`确定要删除选中的 ${selectedStickerIds.size} 张表情吗？`)) return;

    await window.dbSystem.stickers.bulkDelete(Array.from(selectedStickerIds));

    selectedStickerIds.clear();
    // 保持在选择模式，方便继续操作，或者退出都可以。这里保持
    loadStickersInPack(currentStickerPackId);
};

// 10. 批量移动 - 打开弹窗
window.openStickerMoveModal = async function () {
    if (selectedStickerIds.size === 0) return alert("请至少选择一张表情");

    // 获取所有分类
    const packs = await window.dbSystem.sticker_packs.toArray();
    const listEl = document.getElementById('st-move-list');

    listEl.innerHTML = packs.map(p => {
        // 判断是否是当前所在的分类
        const isCurrent = (p.id === currentStickerPackId);

        // 如果是当前分类，显示为灰色且不可点击；否则可点击
        // 视觉上：当前分类给个淡灰色背景，别人给个白色背景
        const bgStyle = isCurrent ? "background:#f5f5f5; color:#999; cursor:not-allowed;" : "background:#fff; cursor:pointer;";
        const clickAction = isCurrent ? "" : `onclick="confirmBatchMoveStickers(${p.id})"`;
        const statusText = isCurrent ? '<span style="font-size:12px;">(当前位置)</span>' : '';

        return `
        <div ${clickAction} 
             style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; ${bgStyle}">
             <span style="font-weight:500;">${p.name}</span>
             ${statusText}
        </div>`;
    }).join('');

    document.getElementById('modal-sticker-move').style.display = 'flex';
};

// 11. 批量移动 - 执行
window.confirmBatchMoveStickers = async function (targetPackId) {
    // 1. 防止移动到当前分类
    if (targetPackId === currentStickerPackId) return alert("不能移动到同一个分类");

    // 2. 获取所有要移动的 ID
    const ids = Array.from(selectedStickerIds);

    // 3. 【修复报错的核心】
    // 原来的写法用了 window.dbSystem.transaction(...)，但 db.js 没暴露这个功能。
    // 改用 Promise.all 并行执行更新，效果一样且兼容性更好。
    const tasks = ids.map(id => {
        return window.dbSystem.stickers.update(id, { packId: targetPackId });
    });

    // 等待所有移动操作完成
    await Promise.all(tasks);

    // 4. 关闭弹窗并提示
    document.getElementById('modal-sticker-move').style.display = 'none';
    alert("移动完成");

    // 5. 清空选择状态
    selectedStickerIds.clear();

    // 6. 【修复“空空如也”的问题】
    // 移动完成后，直接跳转到目标分类，这样你就能立刻看到移动过去的内容了
    await switchStickerPack(targetPackId);
};

// --- 添加弹窗逻辑 ---

let tempStickerFile = null;

// 2. [修改] 显示弹窗时重置批量输入框
const originalShowAddStickerModal = window.showAddStickerModal;
window.showAddStickerModal = function () {
    const modal = document.getElementById('modal-sticker-add');
    if (modal) modal.style.display = 'flex';

    // 1. 重置“单张”表单
    const urlInput = document.getElementById('st-url-input');
    if (urlInput) urlInput.value = '';

    const nameInput = document.getElementById('st-item-name');
    if (nameInput) nameInput.value = '';

    // 2. 重置“批量”表单
    const batchInput = document.getElementById('st-batch-input');
    if (batchInput) batchInput.value = '';

    // 3. 🔴 [关键修复] 移除对 'st-pack-name' 的操作
    // 因为我们把"新库"页面删了，这行代码如果不删就会报错
    // if (document.getElementById('st-pack-name')) ... 

    // 4. 重置预览区域
    const preview = document.getElementById('st-preview');
    if (preview) {
        preview.src = "";
        preview.style.display = 'none';
    }

    const ph = document.getElementById('st-ph');
    if (ph) {
        // 注意：如果你用了我上一步给的 Flex 布局 HTML，这里要设为 'flex' 才能居中
        // 如果设为 'block' 可能会导致图标靠左
        ph.style.display = 'flex';
    }

    // 5. 清理临时变量
    tempStickerFile = null;

    // 6. 默认切回“单张”标签页
    if (typeof switchStickerAddTab === 'function') {
        switchStickerAddTab('item');
    }
};

// 3. [新增] 核心：批量导入逻辑
window.saveStickerBatch = async function () {
    if (!currentStickerPackId) return alert("请先在上方选择一个表情包分类库");

    const rawText = document.getElementById('st-batch-input').value;
    if (!rawText.trim()) return alert("请粘贴内容");

    const lines = rawText.split('\n');
    let successCount = 0;
    const tasks = [];

    // 显示加载状态
    const btn = document.querySelector('#form-sticker-batch .btn-main');
    const oldText = btn.innerText;
    btn.innerText = "正在分析并导入...";
    btn.disabled = true;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // --- 智能宽容解析 ---
        // 策略：寻找第一个 'http' 的位置，以此为界
        const httpIndex = line.indexOf('http');

        if (httpIndex !== -1) {
            // 1. 提取链接 (从 http 开始直到行尾)
            const url = line.substring(httpIndex).trim();

            // 2. 提取名字 (http 之前的部分)
            let name = line.substring(0, httpIndex).trim();

            // 3. 清理名字末尾的垃圾字符 (冒号、空格)
            // 正则含义：去除末尾的 中文冒号、英文冒号、空格
            name = name.replace(/[:：\s]+$/, '');

            // 如果没名字，给个默认的
            if (!name) name = "未命名表情";

            // 加入写入队列
            tasks.push(window.dbSystem.stickers.add({
                packId: currentStickerPackId,
                src: url,
                name: name // 存入数据库
            }));

            successCount++;
        }
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
        alert(`成功导入 ${successCount} 个表情！`);
        document.getElementById('modal-sticker-add').style.display = 'none';
        loadStickersInPack(currentStickerPackId); // 刷新网格
    } else {
        alert("未能识别有效链接，请检查格式 (需包含 http/https)");
    }

    btn.innerText = oldText;
    btn.disabled = false;
};
// 处理文件选择
window.handleStickerFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        tempStickerFile = e.target.result; // Base64
        const preview = document.getElementById('st-preview');
        preview.src = tempStickerFile;
        preview.style.display = 'block';
        document.getElementById('st-ph').style.display = 'none';
        // 清空 URL 输入框避免冲突
        document.getElementById('st-url-input').value = '';
    };
    reader.readAsDataURL(file);
};

// 处理 URL 输入
window.handleStickerUrl = function (input) {
    const val = input.value.trim();
    if (!val) return;
    tempStickerFile = val; // 直接存 URL
    const preview = document.getElementById('st-preview');
    preview.src = val;
    preview.style.display = 'block';
    document.getElementById('st-ph').style.display = 'none';
};



// 保存新表情
window.saveStickerItem = async function () {
    if (!currentStickerPackId) return alert("请先创建一个分类");
    if (!tempStickerFile) return alert("请先上传图片或输入链接");

    // [新增] 获取输入的名字，没填就默认
    let name = document.getElementById('st-item-name').value.trim();
    if (!name) name = "未命名表情";

    await window.dbSystem.stickers.add({
        packId: currentStickerPackId,
        src: tempStickerFile,
        name: name // [关键] 保存名字
    });

    document.getElementById('modal-sticker-add').style.display = 'none';
    loadStickersInPack(currentStickerPackId);
};
/* js/main.js - 追加备份还原逻辑 */

// 1. 更新 Tab 切换逻辑，加入 backup
window.switchStickerAddTab = function (tab) {
    // 1. 注意这里：把 'pack' 删掉了，只保留存在的 tab
    const tabs = ['item', 'batch', 'backup'];

    tabs.forEach(t => {
        const elTab = document.getElementById('st-tab-' + t);
        const elForm = document.getElementById('form-sticker-' + t);

        // 2. 安全检查：只有当元素真的存在时才操作
        // 这样就算 HTML 里删错了东西，JS 也不会报错卡死
        if (elTab && elForm) {
            if (t === tab) {
                elTab.classList.add('active');
                elForm.style.display = 'block';
            } else {
                elTab.classList.remove('active');
                elForm.style.display = 'none';
            }
        }
    });
};

// 2. 辅助工具：Blob 转 Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 3. 导出当前分类 (Export)
window.exportCurrentPack = async function () {
    if (!currentStickerPackId) return alert("未选中任何分类");

    const btn = document.querySelector('#form-sticker-backup .btn-main');
    const oldText = btn.innerText;
    btn.innerText = "正在打包...";
    btn.disabled = true;

    try {
        // 获取分类信息
        const pack = await window.dbSystem.sticker_packs.get(currentStickerPackId);
        // 获取所有表情
        const stickers = await window.dbSystem.stickers.where('packId').equals(currentStickerPackId).toArray();

        // 处理数据：如果是 Blob，转为 Base64 字符串以便存入 JSON
        const exportData = {
            packName: pack.name,
            version: 1.0,
            createDate: new Date().toISOString(),
            items: []
        };

        for (const s of stickers) {
            let srcStr = s.src;
            // 如果是二进制对象，转 Base64
            if (s.src instanceof Blob) {
                srcStr = await blobToBase64(s.src);
            }
            exportData.items.push({
                name: s.name,
                src: srcStr
            });
        }

        // 生成文件并下载
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pack.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`导出成功！包含 ${exportData.items.length} 个表情。`);

    } catch (e) {
        console.error(e);
        alert("导出失败: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

// 4. 导入分类 (Import)
window.importStickerPack = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const json = JSON.parse(e.target.result);

            if (!json.packName || !Array.isArray(json.items)) {
                throw new Error("文件格式不正确，缺少 packName 或 items");
            }

            // 1. 创建新分类
            // 为了防止重名，加个 (导入) 后缀，或者直接用 json 里的名字
            const newPackName = json.packName + " (导入)";
            const newPackId = await window.dbSystem.sticker_packs.add({ name: newPackName });

            // 2. 写入表情
            // Base64 字符串可以直接存入 DB，img src 能直接读
            const tasks = json.items.map(item => {
                return window.dbSystem.stickers.add({
                    packId: newPackId,
                    name: item.name || "未命名",
                    src: item.src
                });
            });

            await Promise.all(tasks);

            alert(`导入成功！创建了新分类: ${newPackName}`);

            // 关闭弹窗并跳转到新分类
            document.getElementById('modal-sticker-add').style.display = 'none';
            // 刷新侧边栏
            await loadStickerPacks();
            // 切换到新导入的包
            switchStickerPack(newPackId);

        } catch (err) {
            console.error(err);
            alert("导入失败: JSON 格式错误或文件损坏");
        } finally {
            // 清空 input 也就是允许重复导入同一个文件
            input.value = '';
        }
    };
    reader.readAsText(file);
};
window.openStickerPackManager = async function () {
    document.getElementById('modal-st-pack-mgr').style.display = 'flex';
    renderStickerPackMgrList();
};

// 2. 渲染列表
async function renderStickerPackMgrList() {
    const listEl = document.getElementById('st-pack-mgr-list');
    const packs = await window.dbSystem.sticker_packs.toArray();

    listEl.innerHTML = packs.map(p => {
        return `
        <div class="cat-mgr-item">
            <span class="cat-mgr-name">${p.name}</span>
            <div class="cat-mgr-del" onclick="doDeleteStickerPack(${p.id})" style="padding:4px; display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>
        </div>`;
    }).join('');
}

// 3. 执行删除
window.doDeleteStickerPack = async function (id) {
    if (!confirm("⚠️ 高能预警：\n这将删除该分类下的所有表情图片！\n确定要继续吗？")) return;

    await window.dbSystem.deleteStickerPack(id);

    // 刷新列表
    renderStickerPackMgrList();

    // 刷新外面的横条
    currentStickerPackId = null; // 重置当前选中
    loadStickerPacks();
};
window.openStickerPackManager = async function () {
    // 显示弹窗 (HTML在下面定义)
    document.getElementById('modal-st-pack-mgr').style.display = 'flex';
    renderStickerPackMgrList();
};

// 2. 渲染管理列表 (带删除按钮)
async function renderStickerPackMgrList() {
    const listEl = document.getElementById('st-pack-mgr-list');
    const packs = await window.dbSystem.sticker_packs.toArray();

    // 如果没有分类
    if (packs.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;color:#ccc;padding:20px;">暂无分类</div>';
        return;
    }

    listEl.innerHTML = packs.map(p => {
        return `
        <div class="cat-mgr-item">
            <span class="cat-mgr-name">${p.name}</span>
            <div class="cat-mgr-del" onclick="doDeleteStickerPack(${p.id})">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </div>
        </div>`;
    }).join('');
}

// 3. 执行删除操作
window.doDeleteStickerPack = async function (id) {
    if (!confirm("⚠️ 确定要删除这个分类吗？\n里面的所有表情图片也会被删除！")) return;

    await window.dbSystem.deleteStickerPack(id);

    // 刷新管理列表
    await renderStickerPackMgrList();

    // 刷新外面的横条
    currentStickerPackId = null; // 重置选中状态
    await loadStickerPacks();
};

// 4. 快速新建 (在管理弹窗里直接加)
window.quickAddStickerPack = async function () {
    const input = document.getElementById('quick-pack-name');
    const name = input.value.trim();
    if (!name) return;

    await window.dbSystem.sticker_packs.add({ name });
    input.value = '';

    await renderStickerPackMgrList();
    await loadStickerPacks();
};
let isChatPanelOpen = false;
let currentChatStickerPackId = null;

// 1. 切换面板开关
window.toggleChatStickerPanel = async function () {
    const panel = document.getElementById('chat-sticker-panel');

    if (!isChatPanelOpen) {
        // === 打开 ===
        isChatPanelOpen = true;

        // 🔴 核心修复：每次打开时，强制清空“当前选中的分类ID”
        // 这样系统就会重新计算应该显示哪个分类，不会残留上个窗口的状态
        currentChatStickerPackId = null;

        panel.style.display = 'flex';
        // 强制重绘触发动画
        requestAnimationFrame(() => {
            panel.classList.add('show');
        });

        // 加载内容
        await loadChatStickerTabs();

    } else {
        // === 关闭 ===
        closeChatStickerPanel();
    }
};

// 2. 关闭面板
window.closeChatStickerPanel = function () {
    if (!isChatPanelOpen) return;

    isChatPanelOpen = false;
    const panel = document.getElementById('chat-sticker-panel');

    // 移除 class 触发下沉动画
    panel.classList.remove('show');

    // 等待 300ms 动画结束后再隐藏
    setTimeout(() => {
        panel.style.display = 'none';
        if (window.cleanChatStickerMemory) window.cleanChatStickerMemory();
    }, 300);
};

// [补充] 点击消息列表区域时，自动关闭表情面板 (提升体验)
// 在 openChatDetail 或 renderChatUI 绑定的点击事件里，或者全局加一个：
document.getElementById('chat-body').addEventListener('click', function () {
    if (isChatPanelOpen) {
        closeChatStickerPanel();
    }
});

// 3. 加载分类 Tab
async function loadChatStickerTabs() {
    const container = document.getElementById('chat-sticker-tabs');
    if (!container) return;

    if (!window.currentActiveChatId) return;
    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);

    // 获取挂载列表
    const mountedIds = chat.mountedStickerPacks || [];

    // 🔴 核心修复：如果没有挂载，直接显示空提示，不加载所有
    if (mountedIds.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:#999;padding:0 10px;">本窗口未挂载表情包</div>';
        if (window.cleanChatStickerMemory) window.cleanChatStickerMemory();
        return;
    }

    // --- 下面是正常的加载逻辑 ---
    const allPacks = await window.dbSystem.sticker_packs.toArray();
    // 只显示挂载的
    const visiblePacks = allPacks.filter(p => mountedIds.includes(p.id));

    // 自动选中第一个有效的包
    if (!currentChatStickerPackId || !visiblePacks.find(p => p.id === currentChatStickerPackId)) {
        currentChatStickerPackId = visiblePacks.length > 0 ? visiblePacks[0].id : null;
    }

    let html = '';
    visiblePacks.forEach(p => {
        const active = p.id === currentChatStickerPackId ? 'active' : '';
        html += `<div class="wb-cat-pill ${active}" onclick="switchChatStickerPack(${p.id})">${p.name}</div>`;
    });

    container.innerHTML = html;

    if (currentChatStickerPackId && window.initChatStickerScroller) {
        window.initChatStickerScroller(currentChatStickerPackId);
    }
}
/* =========================================
   在 main.js 末尾追加以下新逻辑
   ========================================= */

// --- 表情包挂载逻辑 ---

// 1. 打开挂载选择器
window.openStickerMountModal = async function () {
    if (!window.currentActiveChatId) return;

    const modal = document.getElementById('modal-sticker-mount');
    modal.style.display = 'flex';

    const listEl = document.getElementById('st-mount-list');
    listEl.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';

    // 获取当前会话
    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);
    const mountedIds = new Set(chat.mountedStickerPacks || []); // 转Set方便查询

    // 获取所有库
    const allPacks = await window.dbSystem.sticker_packs.toArray();

    if (allPacks.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">系统里还没有表情包，请去“我-我的表情”添加</div>';
        return;
    }

    // 渲染列表
    listEl.innerHTML = allPacks.map(p => {
        const isChecked = mountedIds.has(p.id) ? 'checked' : '';
        return `
        <label class="st-mount-item">
            <span style="font-size:15px; color:#333;">${p.name}</span>
            <input type="checkbox" class="st-mount-checkbox" value="${p.id}" ${isChecked}>
        </label>`;
    }).join('');
};

// 2. 保存挂载设置
window.saveStickerMount = async function () {
    if (!window.currentActiveChatId) return;

    // 获取所有勾选的 checkbox
    const checkboxes = document.querySelectorAll('.st-mount-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    // 更新数据库
    await window.dbSystem.chats.update(window.currentActiveChatId, {
        mountedStickerPacks: selectedIds
    });

    // 关闭弹窗
    document.getElementById('modal-sticker-mount').style.display = 'none';

    // 刷新面板显示
    // 只有当面板是打开状态时才刷新，避免不必要的渲染
    const panel = document.getElementById('chat-sticker-panel');
    if (panel.style.display !== 'none') {
        // 如果当前选中的包被移除了，这里会在 loadChatStickerTabs 内部处理
        await loadChatStickerTabs();
    }
};

// 4. 切换分类
window.switchChatStickerPack = async function (id) {
    currentChatStickerPackId = id;

    // 刷新 Tab 样式
    const tabs = document.querySelectorAll('#chat-sticker-tabs .wb-cat-pill');
    // 重新渲染一遍简单点，或者手动操作 DOM class
    loadChatStickerTabs();

    // 刷新列表
    if (window.initChatStickerScroller) {
        window.initChatStickerScroller(id);
    }
};

// 5. 发送表情
// 5. 发送表情 (修复版：解决不显示问题 + 提速)
window.sendStickerMsg = async function (blobOrUrl) {
    if (!window.currentActiveChatId) return;

    // 1. 获取当前 User 身份
    const globalUser = await window.dbSystem.getCurrent();
    const senderId = globalUser ? globalUser.id : null;
    if (!senderId) return alert("身份错误");

    // --- 准备两份数据 ---
    // uiContent: 给界面展示用 (如果是Blob直接用，显示快)
    // dbContent: 给数据库存库用 (必须是Base64字符串)
    let uiContent = blobOrUrl;
    let dbContent = blobOrUrl;

    // 如果是 Blob (刚上传的图)，先异步转 Base64 备用
    if (blobOrUrl instanceof Blob) {
        dbContent = await blobToBase64(blobOrUrl);
    }

    // 2. 写入数据库
    const newId = await window.dbSystem.addMessage(window.currentActiveChatId, dbContent, senderId, 'image');

    // 3. 更新 UI (立即上屏)
    // 注意：这里使用的是 window.chatScroller，前提是你已经按第一步修改了 render.js
    if (window.chatScroller) {
        window.chatScroller.append({
            id: newId,
            chatId: window.currentActiveChatId,
            text: uiContent, // 🔴 传原始 Blob 给 UI，避免卡顿
            senderId: senderId,
            type: 'image',
            time: new Date()
        });

        // 强制滚动到底部
        setTimeout(() => {
            const body = document.getElementById('chat-body');
            if (body) body.scrollTop = body.scrollHeight;
        }, 10);
    } else {
        console.error("找不到 chatScroller，请检查 render.js 是否已修改为 window.chatScroller");
    }

    // 4. 更新会话列表预览
    await window.dbSystem.chats.update(window.currentActiveChatId, {
        lastMsg: '[表情]',
        updated: new Date()
    });

    // 5. 刷新首页列表预览
    if (window.renderChatUI) window.renderChatUI();
};

// 辅助：在 main.js 里如果还没这个函数就加上
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
async function getChatStickerContext(chat) {
    // 1. 获取挂载的包 ID
    const mountedIds = chat.mountedStickerPacks || [];
    if (mountedIds.length === 0) return { prompt: "", nameMap: {}, srcMap: {} };

    // 2. 从数据库查询这些包里的所有表情
    const stickers = await window.dbSystem.stickers
        .where('packId').anyOf(mountedIds)
        .toArray();

    if (stickers.length === 0) return { prompt: "", nameMap: {}, srcMap: {} };

    // 3. 构建映射表
    // nameMap: 名字 -> 图片数据 (用于 AI 发送 -> 渲染)
    // srcMap:  图片数据 -> 名字 (用于 用户发送 -> AI 理解)
    const nameMap = {};
    const srcMap = {};
    const names = [];

    stickers.forEach(s => {
        if (s.name) {
            nameMap[s.name] = s.src;
            srcMap[s.src] = s.name; // 注意：如果是Base64，作为Key可能会比较长，但对于几百个表情是没问题的
            names.push(s.name);
        }
    });

    // 4. 生成提示词
    const prompt = `\n# Sticker Usage (表情包能力)\n当前会话已挂载表情包，你可以使用表情生动地表达情感。\n**发送规则**：若要发送表情，请严格输出 "[表情] 表情名" (例如: [表情] ${names[0] || '开心'})。\n**可用表情列表**：${names.join(', ')}\n`;

    return { prompt, nameMap, srcMap };
}