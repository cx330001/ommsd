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
    document.getElementById('modal-persona').style.display = 'flex';
    document.getElementById('persona-list-view').style.display = 'block';
    document.getElementById('persona-add-view').style.display = 'none';

    // 关键修改：使用 getMyPersonas() 获取所有 type=1 的角色
    const list = await window.dbSystem.getMyPersonas();
    const curr = await window.dbSystem.getCurrent();

    // 渲染列表
    const listContainer = document.getElementById('persona-list');
    if (list.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#999">暂无身份，请新建</div>';
    } else {
        listContainer.innerHTML = list.map(p => {
            let img = p.name[0];
            let style = "background:#9B9ECE"; // 默认紫色

            if (p.avatar instanceof Blob) {
                const u = URL.createObjectURL(p.avatar);
                img = ""; style = `background-image:url(${u});`;
            } else if (typeof p.avatar === 'string' && p.avatar) {
                img = ""; style = `background-image:url(${p.avatar});`;
            }

            const activeClass = (curr && curr.id === p.id) ? 'active' : '';

            return `
            <div class="persona-item ${activeClass}" onclick="switchPersona(${p.id})">
                <div class="avatar" style="width:40px;height:40px;margin-right:10px;font-size:14px;${style}">${img}</div>
                <div>
                    <div style="font-weight:bold;font-size:14px;">${p.name}</div>
                    <div style="font-size:12px;color:#999;">${p.desc || '无描述'}</div>
                </div>
            </div>`;
        }).join('');
    }
};

window.closeModal = function () {
    document.getElementById('modal-persona').style.display = 'none';
};

window.switchPersona = async function (id) {
    await window.dbSystem.setCurrent(id);
    window.closeModal();
    window.renderChatUI(); // 刷新界面
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
    if (!user) return alert("请先新建或选择一个身份");

    currentEditingId = user.id; // 标记正在编辑 ID

    document.getElementById('modal-persona').style.display = 'flex';
    document.getElementById('persona-list-view').style.display = 'none';
    document.getElementById('persona-add-view').style.display = 'block';
    document.querySelector('#modal-persona h3').innerText = "编辑资料";

    // 填充表单
    document.getElementById('inp-name').value = user.name;
    document.getElementById('inp-desc').value = user.desc || '';

    // 处理头像回显
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
        resetForm(); // 如果没头像，重置一下显示状态
        document.getElementById('inp-name').value = user.name; // 重置会被清空，重新填回去
        document.getElementById('inp-desc').value = user.desc || '';
    }
};

window.savePersona = async function () {
    const name = document.getElementById('inp-name').value;
    const desc = document.getElementById('inp-desc').value;

    if (!name) return alert('姓名必填哦');

    // 关键修改：调用 addChar / updateChar，并指定 type=1 (代表用户)
    if (currentEditingId) {
        await window.dbSystem.updateChar(currentEditingId, name, desc, tempAvatar);
    } else {
        // 最后一个参数 1 表示这是“我” (User Type)
        await window.dbSystem.addChar(name, desc, tempAvatar, 1);
    }

    // 保存后逻辑
    if (currentEditingId) {
        // 如果是编辑当前正在用的身份，记得刷新UI
        window.closeModal();
        window.renderChatUI();
    } else {
        // 如果是新建，回到列表页
        window.openModal();
    }
};

function resetForm() {
    document.getElementById('inp-name').value = '';

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

    const desc = document.getElementById('c-inp-desc').value;

    if (!name) return alert('请填写好友姓名');

    if (currentContactEditId) {
        await window.dbSystem.updateContact(currentContactEditId, name, desc, tempContactAvatar);
    } else {
        await window.dbSystem.addContact(name, desc, tempContactAvatar);
    }

    window.closeContactModal();
    window.renderContacts();
};

function resetContactForm() {
    document.getElementById('c-inp-name').value = '';

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

    // 获取当前选中的用户身份 ID
    const currentUser = await window.dbSystem.getCurrent();
    if (!currentUser) return alert("未选择当前身份");

    // 1. 保存到数据库 (使用 senderId)
    await window.dbSystem.addMessage(currentActiveChatId, text, currentUser.id, 'text');

    // 2. 构造消息对象 (UI渲染用)
    const newMsg = {
        chatId: currentActiveChatId,
        text: text,
        senderId: currentUser.id, // 关键
        time: new Date()
    };

    chatScroller.append(newMsg);

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

// --- 替换 main.js 末尾的整个 triggerAIResponse 函数 ---

/* js/main.js */

window.triggerAIResponse = async function (btnElement) {
    if (!window.currentActiveChatId) return alert("当前没有打开的聊天窗口");
    if (btnElement.classList.contains('loading')) return;

    // --- 1. 获取配置 ---
    const hostRec = await window.dbSystem.settings.get('apiHost');
    const modelRec = await window.dbSystem.settings.get('apiModel');
    const keyRec = await window.dbSystem.settings.get('apiKey');
    const tempRec = await window.dbSystem.settings.get('apiTemperature');

    if (!hostRec || !hostRec.value) return alert("请配置 API Host");
    const dbKeys = keyRec ? keyRec.value.split(',').map(k => k.trim()).filter(k => k) : [];
    if (dbKeys.length === 0) return alert("请配置 API Key");

    btnElement.classList.add('loading');

    try {
        // --- 2. 智能判断：谁该回复？ ---
        // 获取会话成员
        const chat = await window.dbSystem.chats.get(window.currentActiveChatId);
        const messages = await window.dbSystem.getMessages(window.currentActiveChatId);

        // 找出最后一条消息的发送者
        let lastSenderId = -1;
        if (messages.length > 0) {
            lastSenderId = messages[messages.length - 1].senderId;
        }

        // 确定 Role (Sender) 和 Receiver
        // 逻辑：聊天室成员里，只要不是最后发消息的那个人，就是下一个要说话的人 (简单轮询)
        // 如果是新对话(无消息)，默认让成员列表里第一个是AI的人说话，或者随机

        const memberIds = chat.members; // 例如 [UserID, AI_ID] 或 [AI_A, AI_B]

        // 找到“下一位发言者”的ID
        let nextSpeakerId = memberIds.find(id => id !== lastSenderId);
        if (!nextSpeakerId) nextSpeakerId = memberIds[0]; // 如果找不到（比如自己跟自己聊），默认自己

        // 获取角色数据
        const speaker = await window.dbSystem.getChar(nextSpeakerId);
        const listener = await window.dbSystem.getChar(memberIds.find(id => id !== nextSpeakerId));

        if (!speaker) throw new Error("找不到发言者角色数据");

        // --- 3. 构造 Prompt ---
        const recentMessages = messages.slice(-20);

        // 构建 System Prompt
        const systemPrompt = `
你现在扮演：${speaker.name}。
设定：${speaker.desc || "无"}。
对话对象：${listener ? listener.name : "未知"}。

【回复规则】
1. 必须以 JSON 数组格式返回。
2. 保持角色性格。
3. 格式：[{"text": "内容..."}]
`.trim();

        const apiMessages = [{ role: "system", content: systemPrompt }];

        // 构建历史记录 (关键：映射 role)
        // 对于 API 来说，speaker 讲的话是 "assistant"，别人讲的话是 "user"
        for (const msg of recentMessages) {
            // 获取发送这条消息的人的名字
            const msgSender = await window.dbSystem.getChar(msg.senderId);
            const prefix = msgSender ? `${msgSender.name}: ` : "";

            apiMessages.push({
                role: (msg.senderId === nextSpeakerId) ? "assistant" : "user",
                content: prefix + msg.text
            });
        }

        // --- 4. 显示 Typing 动画 ---
        // 注意：Typing 气泡的 senderId 设为 nextSpeakerId，这样会显示在对方（左侧）位置
        const typingMsg = {
            chatId: window.currentActiveChatId,
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: nextSpeakerId,
            time: new Date(),
            isTyping: true
        };
        if (chatScroller) chatScroller.append(typingMsg);

        // --- 5. 请求 API (保持原有逻辑不变) ---
        const temperature = tempRec ? parseFloat(tempRec.value) : 0.7;
        const apiUrl = `${hostRec.value}/chat/completions`;

        const response = await requestWithKeyRotation(apiUrl, (key) => ({
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

        // 移除 loading
        if (chatScroller) chatScroller.removeLast();

        // --- 6. 解析结果并上屏 ---
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

            // 存入数据库 (senderId = nextSpeakerId)
            await window.dbSystem.addMessage(window.currentActiveChatId, item.text, nextSpeakerId, 'text');

            // 渲染
            if (chatScroller) {
                chatScroller.append({
                    chatId: window.currentActiveChatId,
                    text: item.text,
                    senderId: nextSpeakerId,
                    time: new Date()
                });
            }

            await window.dbSystem.chats.update(window.currentActiveChatId, {
                lastMsg: item.text,
                updated: new Date()
            });
        }

    } catch (e) {
        if (chatScroller) chatScroller.removeLast();
        console.error(e);
        alert("AI请求失败: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
};