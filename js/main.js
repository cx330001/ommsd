//chat开关逻辑
window.openApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.add('open');
        if (id === 'chat') {
            if (window.dbSystem) {
                window.dbSystem.open().then(() => {
                    window.renderChatUI();
                    const contactTab = document.getElementById('tab-contacts');
                    if (contactTab && contactTab.classList.contains('active')) {
                        if (window.renderContacts) window.renderContacts();
                    }
                });
            }
        }
        if (id === 'worldbook') {
            if (typeof switchWorldBookTab === 'function') {
                switchWorldBookTab('global');
            }
        }
    }
};

window.closeApp = function (id) {
    const app = document.getElementById('app-' + id);
    if (app) {
        app.classList.remove('open');
        if (id === 'conversation') {
            if (window.cleanChatDetailMemory) {
                window.cleanChatDetailMemory();
            }
            const msgsTab = document.getElementById('tab-msgs');
            if (msgsTab && msgsTab.classList.contains('active')) {
                if (window.renderChatUI) window.renderChatUI();
            }
        }

        if (id === 'contact-edit') {
            setTimeout(() => {
                const previewImg = document.getElementById('c-preview-file');
                if (previewImg && previewImg.src && previewImg.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImg.src);
                    previewImg.src = '';
                }
                if (typeof resetContactForm === 'function') {
                    resetContactForm();
                }

                window.currentContactEditId = null;
                window.tempContactAvatar = null;
                console.log("联系人编辑页资源已释放");
            }, 400);
        }
        if (id === 'sticker-mgr') {
            setTimeout(() => {
                if (window.cleanStickerMemory) window.cleanStickerMemory();
            }, 300);
        }
        if (id === 'persona-mgr') {
            setTimeout(() => {
                const pPreview = document.getElementById('preview-file');
                if (pPreview && pPreview.src && pPreview.src.startsWith('blob:')) {
                    URL.revokeObjectURL(pPreview.src);
                    pPreview.src = '';
                }
                const list = document.getElementById('persona-list-container');
                if (list) list.innerHTML = '';

                console.log("身份管理页资源已释放");
            }, 400);
        }
        if (id === 'worldbook') {
            setTimeout(() => {
                if (window.cleanWorldBookMemory) window.cleanWorldBookMemory();
            }, 300);
        }
    }
};


//底部 Tab 切换
window.switchTab = function (name, el) {
    const currentActiveTab = document.querySelector('.tab-content.active');
    const currentId = currentActiveTab ? currentActiveTab.id.replace('tab-', '') : null;
    if (currentId === name) return;
    if (currentId === 'msgs') {
        window.cleanMsgListMemory();
    } else if (currentId === 'contacts') {
        window.cleanContactMemory();
    } else if (currentId === 'me') {
        document.getElementById('me-content-placeholder').innerHTML = '';
    }

    document.querySelectorAll('.tab-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(e => {
        e.classList.remove('active');
    });
    const targetTab = document.getElementById('tab-' + name);
    targetTab.classList.add('active');
    const titles = { 'msgs': '消息', 'contacts': '好友', 'moment': '发现', 'me': '个人中心' };
    const titleEl = document.getElementById('app-title-text');
    if (titleEl) titleEl.innerText = titles[name];
    const addBtn = document.getElementById('btn-add-contact');
    if (addBtn) addBtn.style.display = (name === 'contacts') ? 'flex' : 'none';
    if (name === 'msgs') {
        if (window.renderChatUI) window.renderChatUI();
    }
    else if (name === 'contacts') {
        if (window.renderContacts) window.renderContacts();
    }
    else if (name === 'me') {
        if (window.renderChatUI) window.renderChatUI();
    }
};

//个人身份
let tempAvatar = null;
let avatarMode = 'file';
let currentEditingId = null;
let personaViewState = 'list';

window.openPersonaManager = async function () {
    window.openApp('persona-mgr');
    window.showPersonaList();
};

window.showPersonaList = async function () {
    personaViewState = 'list';
    document.getElementById('view-persona-list').style.display = 'block';
    document.getElementById('view-persona-form').style.display = 'none';
    document.getElementById('persona-page-title').innerText = "我的身份";
    document.getElementById('btn-add-persona').style.display = 'flex';

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

//切换身份逻辑
window.switchPersona = async function (id) {
    await window.dbSystem.setCurrent(id);
    window.showPersonaList();
    if (window.renderChatUI) window.renderChatUI();
};

window.handlePersonaBack = function () {
    if (personaViewState === 'form') {
        window.showPersonaList();
    } else {
        window.closeApp('persona-mgr');
    }
};

window.showPersonaForm = function (isEdit = false) {
    personaViewState = 'form';
    document.getElementById('view-persona-list').style.display = 'none';
    document.getElementById('view-persona-form').style.display = 'block';
    document.getElementById('btn-add-persona').style.display = 'none';

    const title = isEdit ? "编辑身份" : "新建身份";
    document.getElementById('persona-page-title').innerText = title;

    if (!isEdit) {
        window.currentEditingId = null;
        resetForm();

    }
};

window.editPersonaById = async function (id) {
    const user = await window.dbSystem.getChar(id);
    if (!user) return;

    window.currentEditingId = id;
    window.showPersonaForm(true);

    document.getElementById('inp-name').value = user.name;
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
    } else {
        document.getElementById('preview-file').style.display = 'none';
        document.getElementById('ph-file').style.display = 'flex';
    }



};

window.editCurrentPersona = async function () {
    window.openApp('persona-mgr');
    const curr = await window.dbSystem.getCurrent();
    if (curr) {
        window.editPersonaById(curr.id);
    } else {
        window.showPersonaForm(false);
    }
};

//保存身份
window.savePersona = async function () {
    const name = document.getElementById('inp-name').value;
    const desc = document.getElementById('inp-desc').value;
    if (!name) return alert('姓名必填哦');

    let finalId = window.currentEditingId;

    if (finalId) {
        await window.dbSystem.updateChar(finalId, name, desc, tempAvatar);
    } else {
        finalId = await window.dbSystem.addChar(name, desc, tempAvatar, 1);
    }
    if (!window.currentEditingId) {
        await window.dbSystem.setCurrent(finalId);
    }
    window.showPersonaList();
    if (window.renderChatUI) window.renderChatUI();
};

//辅助函数
function resetForm() {
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-desc').value = '';
    document.getElementById('file-input').value = '';
    document.getElementById('url-input').value = '';
    tempAvatar = null;
    window.toggleAvatarMode('file');
    document.getElementById('preview-file').style.display = 'none';
    document.getElementById('ph-file').style.display = 'flex';
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


//好友 
let tempContactAvatar = null;
let contactAvatarMode = 'file';
let currentContactEditId = null;

window.openContactPage = function () {
    window.currentContactEditId = null;

    const titleEl = document.getElementById('contact-page-title');
    if (titleEl) titleEl.innerText = "添加新角色";
    window.openApp('contact-edit');
    resetContactForm();
};

window.editContact = async function (id) {
    const list = await window.dbSystem.getContacts();
    const contact = list.find(c => c.id === id);
    if (!contact) return;

    window.currentContactEditId = id;
    window.openApp('contact-edit');

    const titleEl = document.getElementById('contact-page-title');
    if (titleEl) titleEl.innerText = "编辑资料";

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
    } else {
        document.getElementById('c-preview-file').style.display = 'none';
        document.getElementById('c-ph-file').style.display = 'flex';
    }


};

window.closeContactPage = function () {
    window.closeApp('contact-edit');

    setTimeout(() => {
        resetContactForm();
    }, 400);
};

window.saveContact = async function () {
    const name = document.getElementById('c-inp-name').value;
    const desc = document.getElementById('c-inp-desc').value;

    if (!name) return alert('请填写姓名');

    let finalId = window.currentContactEditId;

    if (finalId) {
        await window.dbSystem.updateChar(finalId, name, desc, tempContactAvatar);
    } else {
        finalId = await window.dbSystem.addChar(name, desc, tempContactAvatar, 0);
    }
    window.closeContactPage();
    if (window.renderContacts) window.renderContacts();
};

function resetContactForm() {
    document.getElementById('c-inp-name').value = '';
    document.getElementById('c-inp-desc').value = '';
    document.getElementById('c-file-input').value = '';
    document.getElementById('c-url-input').value = '';

    tempContactAvatar = null;
    window.toggleContactMode('file');

    document.getElementById('c-preview-file').src = "";
    document.getElementById('c-preview-file').style.display = 'none';
    document.getElementById('c-ph-file').style.display = 'flex';

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

    const chat = await window.dbSystem.chats.get(currentActiveChatId);
    if (!chat) return;

    let senderId = null;

    for (const memberId of chat.members) {
        const char = await window.dbSystem.getChar(memberId);
        if (char && char.type === 1) {
            senderId = memberId;
            break;
        }
    }

    if (!senderId) {
        const globalUser = await window.dbSystem.getCurrent();
        if (globalUser) senderId = globalUser.id;
    }

    if (!senderId) return alert("无法确定发送者身份");

    const newId = await window.dbSystem.addMessage(currentActiveChatId, text, senderId, 'text');

    chatScroller.append({
        id: newId,
        chatId: currentActiveChatId,
        text: text,
        senderId: senderId,
        time: new Date()
    });

    await window.dbSystem.chats.update(currentActiveChatId, {
        lastMsg: text,
        updated: new Date()
    });

    if (window.renderChatUI) window.renderChatUI();

    input.value = '';
};

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

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


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

        if (pageName === 'visual') {
            setTimeout(() => {
                cleanVisualPageMemory();
                document.getElementById('visual-target-container').innerHTML = '';
            }, 300);
        }

        setTimeout(() => {
            const list = document.getElementById('model-list-container');
            if (list) {
                list.classList.remove('open');
                list.innerHTML = '';
            }
        }, 300);
    }
};

window.toggleApiProvider = function (provider) {
    const hostInput = document.getElementById('api-host');

    if (provider === 'google') {
        hostInput.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
    } else {
        hostInput.value = 'https://api.openai.com/v1';
    }
};

async function loadApiSettings() {
    const hostRec = await window.dbSystem.settings.get('apiHost');
    const keyRec = await window.dbSystem.settings.get('apiKey');
    const modelRec = await window.dbSystem.settings.get('apiModel');
    const providerRec = await window.dbSystem.settings.get('apiProvider');
    const tempRec = await window.dbSystem.settings.get('apiTemperature');
    const tempSlider = document.getElementById('api-temp');
    const tempDisplay = document.getElementById('temp-display');

    if (tempRec) {
        tempSlider.value = tempRec.value;
        tempDisplay.innerText = tempRec.value;
    } else {
        tempSlider.value = 0.7;
        tempDisplay.innerText = 0.7;
    }
    const providerSelect = document.getElementById('api-provider');
    if (providerRec) {
        providerSelect.value = providerRec.value;
    } else {
        providerSelect.value = 'openai';
    }

    if (hostRec) {
        document.getElementById('api-host').value = hostRec.value;
    } else {
        window.toggleApiProvider(providerSelect.value);
    }

    if (keyRec) document.getElementById('api-key').value = keyRec.value;

    const displayEl = document.getElementById('current-model-text');
    if (modelRec && modelRec.value) {
        displayEl.innerText = modelRec.value;
        displayEl.style.color = "#333";
    } else {
        displayEl.innerText = "请点击右侧按钮拉取模型 ->";
        displayEl.style.color = "#ccc";
    }
}

window.manualSaveApi = async function () {
    const provider = document.getElementById('api-provider').value;
    const host = document.getElementById('api-host').value.trim();
    const key = document.getElementById('api-key').value.trim();
    const currentModel = document.getElementById('current-model-text').innerText;

    const tempElement = document.getElementById('api-temp');
    const temp = tempElement ? tempElement.value : '0.7';

    const modelToSave = (currentModel.includes('请点击') || currentModel.includes('->'))
        ? '' : currentModel;

    await window.dbSystem.settings.put({ key: 'apiProvider', value: provider });
    await window.dbSystem.settings.put({ key: 'apiHost', value: host });
    await window.dbSystem.settings.put({ key: 'apiKey', value: key });

    await window.dbSystem.settings.put({ key: 'apiTemperature', value: temp });

    if (modelToSave) {
        await window.dbSystem.settings.put({ key: 'apiModel', value: modelToSave });
    }

    alert("配置已保存！");
};


function getApiKeys() {
    const raw = document.getElementById('api-key').value.trim();
    if (!raw) return [];
    return raw.split(',').map(k => k.trim()).filter(k => k);
}

async function requestWithKeyRotation(url, optionsBuilder, overrideKeys = null) {
    const keys = overrideKeys || getApiKeys();

    if (keys.length === 0) {
        throw new Error("未填写 API Key");
    }

    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
        const currentKey = keys[i];

        try {

            const options = optionsBuilder(currentKey);
            const response = await fetch(url, options);

            if (response.ok) {
                return response;
            }

            if (response.status === 429 || response.status === 403) {
                console.warn(`Key ${i + 1} 失效或限流 (Status ${response.status})，尝试下一个...`);
                continue;
            }

            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);

        } catch (e) {
            lastError = e;
            console.warn(`Key ${i + 1} 网络错误`, e);
        }
    }

    throw new Error("所有 API Key 均请求失败，请检查配额或网络。\n最后一次错误: " + (lastError ? lastError.message : "未知"));
}
window.fetchModels = async function (event) {
    event.stopPropagation();
    const host = document.getElementById('api-host').value.trim();
    const box = document.querySelector('.model-selector-box');
    const keys = getApiKeys();
    if (keys.length === 0) return alert("请至少填写一个 API Key");

    box.classList.add('fetching');

    try {
        const response = await requestWithKeyRotation(
            `${host}/models`,
            (key) => {
                return {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    }
                };
            }
        );

        const data = await response.json();
        const models = data.data || [];
        renderModelList(models);

    } catch (e) {
        alert("拉取失败: " + e.message);
    } finally {
        box.classList.remove('fetching');
    }
};


async function renderModelList(models) {
    const container = document.getElementById('model-list-container');
    const currentText = document.getElementById('current-model-text').innerText;

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
    container.classList.add('open');
}


window.selectModel = async function (modelId) {
    const displayEl = document.getElementById('current-model-text');
    displayEl.innerText = modelId;
    displayEl.style.color = "#333";
    const container = document.getElementById('model-list-container');
    container.classList.remove('open');
};


window.toggleModelList = function () {
    const container = document.getElementById('model-list-container');
    if (container.innerHTML.trim() === '') return;
    container.classList.toggle('open');
};

window.triggerAIResponse = async function (btnElement) {
    if (!window.currentActiveChatId) return alert("当前没有打开的聊天窗口");
    if (btnElement.classList.contains('loading')) return;

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
        let chatSpecificUser = null;
        for (const mid of chat.members) {
            const char = await window.dbSystem.getChar(mid);
            if (char && char.type === 1) {
                chatSpecificUser = char;
                break;
            }
        }

        if (!chatSpecificUser) {
            chatSpecificUser = await window.dbSystem.getCurrent();
        }

        const isGroup = (chat.name || chat.members.length > 2);

        if (isGroup) {
            await handleGroupChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        } else {
            await handlePrivateChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        }

    } catch (e) {
        if (typeof chatScroller !== 'undefined' && chatScroller) chatScroller.removeLast();
        console.error(e);
        alert("AI请求中断: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
}; window.triggerAIResponse = async function (btnElement) {
    if (!window.currentActiveChatId) return alert("当前没有打开的聊天窗口");
    if (btnElement.classList.contains('loading')) return;

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
        let chatSpecificUser = null;
        for (const mid of chat.members) {
            const char = await window.dbSystem.getChar(mid);
            if (char && char.type === 1) {
                chatSpecificUser = char;
                break;
            }
        }

        if (!chatSpecificUser) {
            chatSpecificUser = await window.dbSystem.getCurrent();
        }

        const isGroup = (chat.name || chat.members.length > 2);

        if (isGroup) {
            await handleGroupChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        } else {
            await handlePrivateChat(chat, chatSpecificUser, hostRec, modelRec, dbKeys, tempRec);
        }

    } catch (e) {
        if (typeof chatScroller !== 'undefined' && chatScroller) chatScroller.removeLast();
        console.error(e);
        alert("AI请求中断: " + e.message);
    } finally {
        btnElement.classList.remove('loading');
    }
};
// ================== 1. 群聊逻辑 (handleGroupChat) ==================
async function handleGroupChat(chat, userPersona, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);
    const limit = chat.historyLimit || 25;

    const stickerCtx = await getChatStickerContext(chat);

    const memberIds = chat.members;
    const memberProfiles = [];
    const idToNameMap = {};
    const nameToIdMap = {};

    for (const mid of memberIds) {
        let char = null;
        if (mid === userPersona.id) {
            char = userPersona;
        } else {
            char = await window.dbSystem.getChar(mid);
        }
        if (char) {
            if (mid !== userPersona.id) memberProfiles.push(char);
            idToNameMap[mid] = char.name;
            nameToIdMap[char.name] = mid;
        }
    }

    const charDefs = memberProfiles.map(c => `Name: ${c.name}\nDescription: ${c.desc || "无"}`).join('\n---\n');
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

# Capabilities
1. **视觉能力**：若消息中包含图片数据，请根据画面内容进行自然互动。若显示为 [图片]，说明你之前已经看过了，请根据记忆回复。
2. **表情系统**：参考 ${stickerCtx.prompt}。

# Output Format
1. 文本："[消息] 角色名：内容"
2. 表情："[表情] 角色名：表情名"
3. 语音："[语音] 角色名：语音转文字内容"
4. 图片："[图片] 角色名：图片画面描述"
`.trim();

    const recentMessages = messages.slice(-limit);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    // 【关键变量】用来记录本次请求中，哪些图片是第一次发送 Base64
    // 等 API 成功后，我们要把它们标记为“已识图”
    let pendingImageIds = [];

    for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];
        let name = idToNameMap[msg.senderId] || "未知";
        let msgTag = "[消息]";
        let contentText = msg.text;

        const role = (msg.senderId === userPersona.id) ? "user" : "assistant";

        // === 处理真实图片 (real-image) ===
        if (msg.type === 'real-image') {
            // 判断是否已经识别过 (is_recognized)
            // 如果还没识别过 (!msg.is_recognized)，则发送 Base64，并加入待处理列表
            if (!msg.is_recognized) {
                let base64 = "";
                if (msg.text instanceof Blob) {
                    try {
                        base64 = await blobToBase64(msg.text);
                    } catch (err) {
                        console.error("图片转换失败", err);
                        continue;
                    }
                } else {
                    continue; // 旧数据没有Blob，跳过
                }

                apiMessages.push({
                    role: role,
                    content: [
                        { type: "text", text: `[图片] ${name} 发送了一张图片：` },
                        { type: "image_url", image_url: { url: base64 } }
                    ]
                });

                // 记录下来，等待成功后打标记
                pendingImageIds.push(msg.id);

            } else {
                // 如果已经识别过 (is_recognized === 1/true)，直接发文字占位符
                // AI 应该通过之前的上下文记忆知道这图是什么
                apiMessages.push({
                    role: role,
                    content: `[图片] ${name}：(发送过的图片)`
                });
            }
            continue; // 图片处理完毕
        }
        // === 图片逻辑结束 ===

        if (msg.type === 'image') {
            const stickerName = stickerCtx.srcMap[msg.text];
            if (stickerName) {
                apiMessages.push({
                    role: "assistant",
                    content: `[表情] ${name}：${stickerName}`
                });
                continue;
            } else {
                contentText = "[图片]";
                msgTag = "[消息]";
            }
        } else if (msg.type === 'image-card') {
            msgTag = "[图片]";
            contentText = msg.text;
        }
        else if (msg.type === 'audio') {
            msgTag = "[语音]";
        }

        apiMessages.push({
            role: role,
            content: `${msgTag} ${name}：${contentText}`
        });
    }

    if (chatScroller) {
        chatScroller.append({
            chatId: chat.id,
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: memberProfiles[0]?.id || 0,
            isTyping: true
        });
        scrollToBottom();
    }

    let temperature = tempRec ? parseFloat(tempRec.value) : 0.85;

    // === 发起请求 ===
    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature
        })
    }), dbKeys);

    // === 【关键步骤】API 请求成功后，更新数据库标记 ===
    // 这样下次读取时，is_recognized 就会变为 true，从而只发文字
    if (pendingImageIds.length > 0) {
        for (const pid of pendingImageIds) {
            // 给消息对象增加 is_recognized: 1 字段
            await window.dbSystem.messages.update(pid, { is_recognized: 1 });
        }
        console.log(`已标记 ${pendingImageIds.length} 张图片为已识别。`);
    }

    const data = await response.json();
    if (window.chatScroller) window.chatScroller.removeLast();

    let content = data.choices[0].message.content;
    let rawText = content.replace(/：/g, ':');
    const blockRegex = /\[(消息|表情|语音|图片)\]\s*([^:]+?)\s*:\s*(.+?)(?=\s*\[(?:消息|表情|语音|图片)\]|$)/gis;

    let match;
    let msgQueue = [];

    while ((match = blockRegex.exec(rawText)) !== null) {
        const tagType = match[1];
        const n = match[2].trim();
        const body = match[3].trim();

        const speakerId = nameToIdMap[n];
        if (!speakerId) continue;

        if (tagType === '表情') {
            const stickerSrc = stickerCtx.nameMap[body];
            msgQueue.push({ senderId: speakerId, text: stickerSrc || body, type: stickerSrc ? 'image' : 'text' });
        } else if (tagType === '语音') {
            msgQueue.push({ senderId: speakerId, text: body, type: 'audio' });
        } else if (tagType === '图片') {
            msgQueue.push({ senderId: speakerId, text: body, type: 'image-card' });
        } else {
            msgQueue.push({ senderId: speakerId, text: body, type: 'text' });
        }
    }

    if (msgQueue.length === 0 && rawText.trim()) {
        const fallbackId = memberProfiles[0]?.id || 0;
        msgQueue.push({ senderId: fallbackId, text: rawText, type: 'text' });
    }

    for (let i = 0; i < msgQueue.length; i++) {
        const item = msgQueue[i];
        if (i > 0) {
            if (window.chatScroller) {
                window.chatScroller.append({
                    chatId: chat.id,
                    text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
                    senderId: memberProfiles[0]?.id || 0,
                    isTyping: true
                });
                scrollToBottom();
            }
            await new Promise(r => setTimeout(r, 800));
            if (window.chatScroller) window.chatScroller.removeLast();
        }

        const newMsgId = await window.dbSystem.addMessage(chat.id, item.text, item.senderId, item.type);
        if (window.chatScroller) {
            window.chatScroller.append({
                id: newMsgId,
                chatId: chat.id,
                text: item.text,
                senderId: item.senderId,
                type: item.type,
                time: new Date()
            });
        }
        let previewText = item.text;
        if (item.type === 'image') previewText = '[表情]';
        else if (item.type === 'image-card') previewText = '[图文卡片]';
        else if (item.type === 'audio') previewText = '[语音]';
        await window.dbSystem.chats.update(chat.id, { lastMsg: previewText, updated: new Date() });
    }
}


// ================== 2. 私聊逻辑 (handlePrivateChat) ==================
async function handlePrivateChat(chat, userPersona, hostRec, modelRec, dbKeys, tempRec) {
    const messages = await window.dbSystem.getMessages(chat.id);
    const limit = chat.historyLimit || 25;
    const stickerCtx = await getChatStickerContext(chat);

    const memberIds = chat.members;
    let nextSpeakerId = memberIds.find(id => id !== userPersona.id);
    if (!nextSpeakerId) nextSpeakerId = memberIds[0];

    const speaker = await window.dbSystem.getChar(nextSpeakerId);
    if (!speaker) throw new Error("找不到角色数据");

    let envInfo = "";
    try { envInfo = await window.generateEnvPrompt(chat, userPersona); } catch (e) { }

    const historyForScan = messages.slice(-limit).map(m => ({ content: m.text }));
    const worldInfo = await window.injectWorldInfo(chat, historyForScan);
    const currentPartnerInfo = `当前对话对象：${userPersona.name}\n对象简介：${userPersona.desc || "无"}`;

    const systemPrompt = `
# Roleplay Protocol
你必须完全沉浸在角色中。
# World Knowledge
${worldInfo.top}
你的名字：${speaker.name}
**你的核心设定**：
${speaker.desc || "无"}
${worldInfo.bottom}

# Context
${currentPartnerInfo}
${envInfo}
${stickerCtx.prompt}

# Capabilities
1. **视觉能力**：若消息中包含图片数据，请根据图片内容进行反应。若消息显示 [图片] 而无画面，说明那是历史图片，请依靠上下文记忆。
2. **多模态**：你可以发送语音、表情或描述一张图片。

# Output Format
1. 文本："[消息] ${speaker.name}：内容"
2. 表情："[表情] ${speaker.name}：表情名"
3. 语音："[语音] ${speaker.name}：语音内容"
4. 图片："[图片] ${speaker.name}：图片画面描述"
`.trim();

    const recentMessages = messages.slice(-limit);
    const apiMessages = [{ role: "system", content: systemPrompt }];

    // 【关键变量】待标记的图片ID
    let pendingImageIds = [];

    for (let i = 0; i < recentMessages.length; i++) {
        const msg = recentMessages[i];

        let prefixName = "未知";
        if (msg.senderId === speaker.id) prefixName = speaker.name;
        else if (msg.senderId === userPersona.id) prefixName = userPersona.name;

        let msgTag = "[消息]";
        let contentText = msg.text;

        const role = (msg.senderId === userPersona.id) ? "user" : "assistant";

        // === 处理真实图片 (real-image) ===
        if (msg.type === 'real-image') {
            // 逻辑：如果没识别过 (is_recognized 为空或false)，发 Base64
            // 如果识别过了 (is_recognized 为 true)，发纯文本
            if (!msg.is_recognized) {
                let base64 = "";
                if (msg.text instanceof Blob) {
                    try {
                        base64 = await blobToBase64(msg.text);
                    } catch (err) {
                        console.error("图片转换Base64失败", err);
                        continue;
                    }
                } else {
                    continue;
                }

                apiMessages.push({
                    role: role,
                    content: [
                        { type: "text", text: `[图片] ${prefixName} 发送了一张图片：` },
                        { type: "image_url", image_url: { url: base64 } }
                    ]
                });

                // 加入待标记队列
                pendingImageIds.push(msg.id);

            } else {
                // 已识别过，只发送文字描述
                apiMessages.push({
                    role: role,
                    content: `[图片] ${prefixName}：(发送过的图片)`
                });
            }
            continue;
        }
        // === 图片逻辑结束 ===

        if (msg.type === 'image') {
            const stickerName = stickerCtx.srcMap[msg.text];
            if (stickerName) {
                contentText = stickerName;
                msgTag = "[表情]";
            } else {
                contentText = "[图片]";
                msgTag = "[消息]";
            }
        }
        else if (msg.type === 'audio') {
            msgTag = "[语音]";
        }
        else if (msg.type === 'image-card') {
            msgTag = "[图片]";
            contentText = msg.text;
        }

        apiMessages.push({
            role: role,
            content: `${msgTag} ${prefixName}：${contentText}`
        });
    }

    if (chatScroller) {
        chatScroller.append({
            chatId: chat.id,
            text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
            senderId: nextSpeakerId,
            isTyping: true
        });
    }

    let temperature = tempRec ? parseFloat(tempRec.value) : 0.85;

    // === 发送 API 请求 ===
    const response = await requestWithKeyRotation(`${hostRec.value}/chat/completions`, (key) => ({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: modelRec.value || "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: temperature
        })
    }), dbKeys);

    // === 【关键步骤】成功后，标记图片已处理 ===
    if (pendingImageIds.length > 0) {
        for (const pid of pendingImageIds) {
            await window.dbSystem.messages.update(pid, { is_recognized: 1 });
        }
        console.log(`私聊：已标记 ${pendingImageIds.length} 张图片为已识别。`);
    }

    const data = await response.json();
    if (window.chatScroller) window.chatScroller.removeLast();

    let content = data.choices[0].message.content;
    let rawText = content.replace(/：/g, ':').trim();

    const blockRegex = /\[(消息|表情|语音|图片)\]\s*([^:]+?)\s*:\s*(.+?)(?=\s*\[(?:消息|表情|语音|图片)\]|$)/gis;

    let match;
    let msgQueue = [];
    let hasMatch = false;

    while ((match = blockRegex.exec(rawText)) !== null) {
        hasMatch = true;
        const tagType = match[1];
        const n = match[2].trim();
        const body = match[3].trim();

        if (tagType === '表情') {
            const stickerSrc = stickerCtx.nameMap[body];
            msgQueue.push({ senderId: nextSpeakerId, text: stickerSrc || body, type: stickerSrc ? 'image' : 'text' });
        } else if (tagType === '语音') {
            msgQueue.push({ senderId: nextSpeakerId, text: body, type: 'audio' });
        } else if (tagType === '图片') {
            msgQueue.push({ senderId: nextSpeakerId, text: body, type: 'image-card' });
        } else {
            msgQueue.push({ senderId: nextSpeakerId, text: body, type: 'text' });
        }
    }

    if (!hasMatch && rawText) {
        msgQueue.push({ senderId: nextSpeakerId, text: rawText, type: 'text' });
    }

    for (let i = 0; i < msgQueue.length; i++) {
        const item = msgQueue[i];
        if (i > 0) {
            if (window.chatScroller) {
                window.chatScroller.append({
                    chatId: chat.id,
                    text: `<div class="typing-bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`,
                    senderId: nextSpeakerId,
                    isTyping: true
                });
                scrollToBottom();
            }
            await new Promise(r => setTimeout(r, 800));
            if (window.chatScroller) window.chatScroller.removeLast();
        }
        const newMsgId = await window.dbSystem.addMessage(chat.id, item.text, nextSpeakerId, item.type || 'text');
        if (window.chatScroller) {
            window.chatScroller.append({
                id: newMsgId,
                chatId: chat.id,
                text: item.text,
                senderId: nextSpeakerId,
                type: item.type || 'text',
                time: new Date()
            });
        }
        let previewText = item.text;
        if (item.type === 'image') previewText = '[表情]';
        else if (item.type === 'image-card') previewText = '[图文卡片]';
        else if (item.type === 'audio') previewText = '[语音]';

        await window.dbSystem.chats.update(chat.id, { lastMsg: previewText, updated: new Date() });
    }
}

/*[新增] 群聊创建逻辑 */

let groupSelectedMeId = null;
let groupSelectedContacts = new Set();
window.openGroupCreateUI = async function () {
    window.openApp('group-create');

    document.getElementById('group-name-input').value = '';
    groupSelectedMeId = null;
    groupSelectedContacts.clear();

    const myPersonas = await window.dbSystem.getMyPersonas();
    const meContainer = document.getElementById('group-me-list');

    const curr = await window.dbSystem.getCurrent();
    if (curr) groupSelectedMeId = curr.id;

    meContainer.innerHTML = myPersonas.map(p => {
        const isSel = (groupSelectedMeId === p.id);
        return renderSelectRow(p, 'me', isSel);
    }).join('');

    const contacts = await window.dbSystem.getContacts();
    const contactContainer = document.getElementById('group-contact-list');
    contactContainer.innerHTML = contacts.map(c => {
        return renderSelectRow(c, 'contact', false);
    }).join('');
};

function renderSelectRow(char, type, isSelected) {
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

window.selectGroupMe = function (id, el) {
    groupSelectedMeId = id;
    const all = document.querySelectorAll('#group-me-list .select-item');
    all.forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
};

window.toggleGroupContact = function (id, el) {
    if (groupSelectedContacts.has(id)) {
        groupSelectedContacts.delete(id);
        el.classList.remove('selected');
    } else {
        groupSelectedContacts.add(id);
        el.classList.add('selected');
    }
};

window.submitCreateGroup = async function () {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) return alert("起个群名吧！");
    if (!groupSelectedMeId) return alert("请选择你在群里的身份");
    if (groupSelectedContacts.size === 0) return alert("群里至少得拉一个人吧？");

    const members = [groupSelectedMeId, ...Array.from(groupSelectedContacts)];

    const chatId = await window.dbSystem.chats.add({
        name: name,
        members: members,
        updated: new Date(),
        lastMsg: "群聊已创建"
    });

    window.closeApp('group-create');

    if (window.renderChatUI) window.renderChatUI();

    await window.dbSystem.setCurrent(groupSelectedMeId);

    window.openChatDetail(chatId);
};
/*聊天环境设置 */

let currentEnvTarget = 'user';

window.openChatSettings = async function () {
    if (!window.currentActiveChatId) return;
    window.openApp('chat-settings');

    const chatId = parseInt(window.currentActiveChatId);
    const chat = await window.dbSystem.chats.get(chatId);

    if (chat) {
        const count = (chat.mountedWorldBooks || []).length;
        const el = document.getElementById('wb-mount-status');
        if (el) {
            el.innerText = count > 0 ? `已挂载 ${count} 个局部设定` : "未挂载局部设定";
            el.style.color = count > 0 ? "var(--theme-purple)" : "#999";
        }
    }
    const limitInput = document.getElementById('setting-context-limit');
    if (limitInput) {
        limitInput.value = chat.historyLimit || 25;
    }
    const switchEl = document.getElementById('env-mode-switch');
    const panel = document.getElementById('env-settings-panel');
    if (chat.envEnabled) {
        switchEl.checked = true;
        panel.style.display = 'block';
    } else {
        switchEl.checked = false;
        panel.style.display = 'none';
    }

    if (typeof updateCityUI === 'function') {
        updateCityUI(chat.envUserCity, 'user');
    }

    const isGroup = (chat.name || chat.members.length > 2);
    const singleView = document.getElementById('view-mode-single');
    const groupView = document.getElementById('view-mode-group');

    if (isGroup) {
        if (singleView) singleView.style.display = 'none';
        if (groupView) {
            groupView.style.display = 'block';
            if (typeof renderGroupEnvList === 'function') {
                renderGroupEnvList(chat);
            }
        }
    } else {
        if (groupView) groupView.style.display = 'none';
        if (singleView) {
            singleView.style.display = 'flex';
            if (typeof updateCityUI === 'function') {
                updateCityUI(chat.envCharCity, 'char');
            }
        }
    }
};

async function renderGroupEnvList(chat) {
    const container = document.getElementById('env-group-list-container');
    container.innerHTML = '<div style="padding:10px;text-align:center;color:#ccc;">加载中...</div>';

    let html = '';
    const memberMap = chat.envMemberMap || {};

    for (const memberId of chat.members) {
        const me = await window.dbSystem.getCurrent();
        if (me && me.id === memberId) continue;

        const char = await window.dbSystem.getChar(memberId);
        if (!char) continue;

        const locData = memberMap[memberId];
        const hasSet = (locData && locData.isValid);

        const displayFake = hasSet ? locData.fake : "未设置";
        const displayReal = hasSet ? `映射: ${locData.real}` : "映射: (空)";
        const statusClass = hasSet ? "active" : "";

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

        if (hasSet) {
            fetchEnvData(locData.real).then(res => {
                if (res) {
                    const wEl = document.getElementById(`weather-preview-${memberId}`);
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

window.toggleEnvMode = async function (el) {
    const isChecked = el.checked;
    const panel = document.getElementById('env-settings-panel');
    panel.style.display = isChecked ? 'block' : 'none';

    if (window.currentActiveChatId) {
        await window.dbSystem.chats.update(window.currentActiveChatId, {
            envEnabled: isChecked
        });
    }
};

window.openCityModal = async function (target) {
    currentEnvTarget = target;
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

            if (currentEnvTarget === 'user') {
                await window.dbSystem.chats.update(chatId, { envUserCity: data });
                updateCityUI(data, 'user');

            } else if (currentEnvTarget === 'char') {
                await window.dbSystem.chats.update(chatId, { envCharCity: data });
                updateCityUI(data, 'char');

            } else if (currentEnvTarget.startsWith('member-')) {
                const memberId = parseInt(currentEnvTarget.split('-')[1]);

                const newMap = chat.envMemberMap || {};
                newMap[memberId] = data;

                await window.dbSystem.chats.update(chatId, { envMemberMap: newMap });

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

//城市验证函数
async function validateCity(cityName) {
    if (!cityName) return { success: false };

    try {
        const isEnglish = /^[a-zA-Z\s\.\-\,]+$/.test(cityName);

        let url;
        let res, data;

        if (isEnglish) {
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=en&format=json`;
            res = await fetch(url);
            data = await res.json();

        } else {
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=zh&format=json`;
            res = await fetch(url);
            data = await res.json();
        }

        if (!data.results || data.results.length === 0) {
            const fallbackLang = isEnglish ? 'zh' : 'en';
            url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=${fallbackLang}&format=json`;
            res = await fetch(url);
            data = await res.json();
        }

        if (data.results && data.results.length > 0) {
            const place = data.results[0];
            const displayName = place.name;

            return {
                success: true,
                realName: displayName,
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




async function updateCityUI(data, type) {
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
                            elWeather.innerText = `${w.time} | ${w.temp}°C, ${w.weather}`;
                        }
                    });
                }
            }
        }
        return;
    }

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
                elWeather.innerText = `${w.time} | ${w.temp}°C, ${w.weather}`;
            }
        });
    }
}

//获取环境数据 
async function fetchEnvData(realCityName) {
    if (!realCityName) return null;

    try {
        const cityInfo = await validateCity(realCityName);
        if (!cityInfo.success) return null;

        const { lat, lon, tz } = cityInfo;
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=${encodeURIComponent(tz)}`;
        const weatherRes = await fetch(weatherUrl);
        const wData = await weatherRes.json();

        if (!wData.current_weather) return null;
        const now = new Date();
        const localTimeStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(now);

        const weatherMap = {
            0: "晴朗", 1: "多云", 2: "阴天", 3: "阴",
            45: "雾", 48: "雾凇", 51: "小雨", 61: "下雨", 63: "中雨", 65: "大雨",
            71: "下雪", 80: "阵雨", 95: "雷雨"
        };
        const code = wData.current_weather.weathercode;
        const weatherDesc = weatherMap[code] || "多云";
        const temp = wData.current_weather.temperature;

        return {
            time: localTimeStr,
            temp: temp,
            weather: weatherDesc,
            timezone: tz
        };

    } catch (e) {
        console.error("Fetch Env Error:", e);
        return null;
    }
}


window.generateEnvPrompt = async function (chat, userPersona) {
    if (!chat.envEnabled) return "";

    const currentUser = userPersona;
    const safeUser = currentUser || (await window.dbSystem.getCurrent());
    if (!safeUser) return "";

    const userName = safeUser.name;
    const myId = safeUser.id;

    const messages = await window.dbSystem.getMessages(chat.id);

    let timeGapDesc = "";

    if (messages.length > 0) {
        const now = new Date();
        let userConsecutiveMsgs = [];
        let lastAiMsg = null;

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
            const aiTime = new Date(lastAiMsg.time);
            const firstUserTime = new Date(userConsecutiveMsgs[0].time);
            const initialDiff = Math.floor((firstUserTime - aiTime) / 60000);

            if (initialDiff < 2) {
            } else if (initialDiff > 60) {
                const hours = (initialDiff / 60).toFixed(1);
                timeline.push(`(距离你上次发言过去了 ${hours} 小时，User 回复了你)`);
            } else if (initialDiff >= 5) {
                timeline.push(`(过了 ${initialDiff} 分钟，User 回复了你)`);
            }

            if (userConsecutiveMsgs.length > 1) {
                for (let i = 1; i < userConsecutiveMsgs.length; i++) {
                    const prevMsg = userConsecutiveMsgs[i - 1];
                    const currMsg = userConsecutiveMsgs[i];

                    const t1 = new Date(prevMsg.time);
                    const t2 = new Date(currMsg.time);
                    const gap = Math.floor((t2 - t1) / 60000);

                    if (gap > 10) {
                        let gapStr = gap < 60 ? `${gap}分钟` : `${(gap / 60).toFixed(1)}小时`;
                        timeline.push(`(User 停顿了 ${gapStr} 后发送了下一条)`);
                    }
                }
            }

            const lastUserTime = new Date(userConsecutiveMsgs[userConsecutiveMsgs.length - 1].time);
            const waitDiff = Math.floor((now - lastUserTime) / 60000);

            if (waitDiff > 30) {
                const waitHours = (waitDiff / 60).toFixed(1);
                timeline.push(`(注意：User 发完这句话后，已经在屏幕前等待了 ${waitHours} 小时没有收到回复)`);
            }

            timeGapDesc = timeline.join("\n");

        } else {
            timeGapDesc = "(这是对话的开始)";
        }
    }
    let locationParts = [];

    if (chat.envUserCity && chat.envUserCity.isValid) {
        try {
            const userData = await fetchEnvData(chat.envUserCity.real);

            if (userData) {
                const getPeriod = (timeStr) => {
                    const hour = parseInt(timeStr.split(':')[0]);
                    if (hour >= 5 && hour < 12) return "早晨";
                    if (hour >= 12 && hour < 18) return "下午";
                    if (hour >= 18 && hour < 22) return "晚上";
                    return "深夜";
                };
                const userPeriod = getPeriod(userData.time);

                locationParts.push(`📍 ${userName}的位置 (${chat.envUserCity.fake}): ${userData.time} (${userPeriod}), ${userData.weather}, ${userData.temp}°C`);

                const isGroup = (chat.name || chat.members.length > 2);

                if (isGroup) {
                    const memberMap = chat.envMemberMap || {};
                    let groupStatusList = [];
                    for (const mid of chat.members) {
                        if (mid === myId) continue;
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
    let finalPromptParts = [];

    if (timeGapDesc) {
        finalPromptParts.push(`⏱️ [时间流逝记录]:\n${timeGapDesc}`);
    }

    if (locationParts.length > 0) {
        finalPromptParts.push(...locationParts);
    }

    if (finalPromptParts.length === 0) return "";

    return `\n【🌍 实时环境同步】\n${finalPromptParts.join('\n')}\n`;
};

let currentVisualTargetId = null;
let tempVisualData = {};
let visualPageUrls = [];

function cleanVisualPageMemory() {
    if (visualPageUrls.length > 0) {
        visualPageUrls.forEach(u => URL.revokeObjectURL(u));
        visualPageUrls = [];
        console.log("视觉设置页内存已释放");
    }
}

const originalOpenSubPage = window.openSubPage;
window.openSubPage = async function (pageName) {
    if (originalOpenSubPage) originalOpenSubPage(pageName);

    if (pageName === 'visual') {
        await loadVisualSettings();
    }
};

async function loadVisualSettings() {
    if (!window.currentActiveChatId) return;

    cleanVisualPageMemory();

    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);

    tempVisualData = chat.visualOverrides ? JSON.parse(JSON.stringify(chat.visualOverrides)) : {};

    const container = document.getElementById('visual-target-container');
    container.innerHTML = '';

    if (chat.name || chat.members.length > 2) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'visual-target-item';
        groupDiv.id = 'v-target-GROUP';
        groupDiv.onclick = () => selectVisualTarget('GROUP');

        let groupAvatarStyle = "";
        if (tempVisualData['GROUP'] && tempVisualData['GROUP'].avatar) {
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

    let firstId = null;
    for (const mid of chat.members) {
        const char = await window.dbSystem.getChar(mid);
        if (!char) continue;
        if (!firstId) firstId = mid;

        let avatarStyle = "";

        if (tempVisualData[mid] && tempVisualData[mid].avatar) {
            avatarStyle = `background-image:url(${tempVisualData[mid].avatar})`;
        }
        else if (char.avatar instanceof Blob) {
            const u = URL.createObjectURL(char.avatar);
            visualPageUrls.push(u);
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

window.selectVisualTarget = async function (targetId) {
    currentVisualTargetId = targetId;
    document.querySelectorAll('.visual-target-item').forEach(e => e.classList.remove('active'));
    const activeEl = document.getElementById(`v-target-${targetId}`);
    if (activeEl) activeEl.classList.add('active');
    const defaults = {
        alias: '',
        shape: 'circle',
        size: 40,
        hidden: false,
        avatar: null
    };

    const data = tempVisualData[targetId] || defaults;

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

    setVisualShapeUI(data.shape || 'circle');
    document.getElementById('visual-size-slider').value = data.size || 40;
    updateVisualSizeVal(data.size || 40);
    document.getElementById('visual-show-switch').checked = !data.hidden;

    const preview = document.getElementById('visual-preview');
    if (data.avatar) {
        preview.style.backgroundImage = `url(${data.avatar})`;
    } else {
        if (targetId === 'GROUP') {
            preview.style.backgroundImage = 'none';
            preview.style.backgroundColor = '#9B9ECE';
        } else {
            const char = await window.dbSystem.getChar(targetId);
            if (char.avatar instanceof Blob) {
                const u = URL.createObjectURL(char.avatar);
                visualPageUrls.push(u);
                preview.style.backgroundImage = `url(${u})`;
            } else if (typeof char.avatar === 'string' && char.avatar) {
                preview.style.backgroundImage = `url(${char.avatar})`;
            } else {
                preview.style.backgroundImage = 'none';
                preview.style.backgroundColor = '#ccc';
            }
        }
    }

    preview.style.borderRadius = (data.shape === 'square') ? '12px' : '50%';
};

window.updateVisualSizeVal = function (val) {
    document.getElementById('visual-size-val').innerText = val + 'px';
    ensureTemp();
    tempVisualData[currentVisualTargetId].size = parseInt(val);
};

window.setVisualShape = function (shape) {
    setVisualShapeUI(shape);
    ensureTemp();
    tempVisualData[currentVisualTargetId].shape = shape;
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

window.saveVisualSettings = async function () {
    if (!window.currentActiveChatId) return;

    if (currentVisualTargetId) {
        ensureTemp();
        tempVisualData[currentVisualTargetId].alias = document.getElementById('visual-alias-input').value.trim();
    }

    let updateData = { visualOverrides: tempVisualData };

    if (tempVisualData['GROUP'] && tempVisualData['GROUP'].alias) {
        updateData.name = tempVisualData['GROUP'].alias;
    }

    await window.dbSystem.chats.update(window.currentActiveChatId, updateData);

    alert("设置已应用");

    if (window.chatScroller) {
        window.openChatDetail(window.currentActiveChatId);
    }
    if (window.renderChatUI) window.renderChatUI();

    window.closeSubPage('visual');
};
/* 世界书 (World Book) */

let currentWbTab = 'global';
let currentWbCatId = 'all';
let isWbSelectMode = false;
let selectedWbIds = new Set();

window.switchWorldBookTab = async function (tab) {
    currentWbTab = tab;
    document.getElementById('wb-tab-global').className = tab === 'global' ? 'avatar-tab active' : 'avatar-tab';
    document.getElementById('wb-tab-local').className = tab === 'local' ? 'avatar-tab active' : 'avatar-tab';

    currentWbCatId = 'all';
    exitWbSelectMode();

    await renderCategoryBar();

    if (window.initWbScroller) {
        window.initWbScroller(currentWbTab, currentWbCatId);
    }
};

async function renderCategoryBar() {
    const container = document.getElementById('wb-category-bar');
    const categories = await window.dbSystem.getCategories(currentWbTab);

    let html = `
        <div class="wb-cat-pill ${currentWbCatId === 'all' ? 'active' : ''}" 
             onclick="switchWbCategory('all')">全部</div>`;

    categories.forEach(cat => {
        html += `
        <div class="wb-cat-pill ${currentWbCatId === cat.id ? 'active' : ''}" 
             onclick="switchWbCategory(${cat.id})">${cat.name}</div>`;
    });

    html += `<div class="wb-cat-add-btn" onclick="openCategoryManager()">+</div>`;

    container.innerHTML = html;
}

window.switchWbCategory = async function (catId) {
    currentWbCatId = catId;
    await renderCategoryBar();

    if (window.initWbScroller) {
        window.initWbScroller(currentWbTab, currentWbCatId);
    }
};


window.toggleWbSelectMode = function () {
    isWbSelectMode = !isWbSelectMode;
    const btn = document.getElementById('wb-btn-select');
    const addBtn = document.getElementById('wb-btn-add');
    const bottomBar = document.getElementById('wb-bottom-bar');

    if (isWbSelectMode) {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="#333"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
        addBtn.style.display = 'none';
        bottomBar.classList.add('active');
        selectedWbIds.clear();
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>`;
        addBtn.style.display = 'flex';
        bottomBar.classList.remove('active');
        selectedWbIds.clear();
    }
    if (window.refreshWbScroller) {
        window.refreshWbScroller();
    }
};

window.exitWbSelectMode = function () {
    if (isWbSelectMode) toggleWbSelectMode();
};

window.toggleWbSelection = function (id, el) {
    if (selectedWbIds.has(id)) {
        selectedWbIds.delete(id);
        el.classList.remove('checked');
    } else {
        selectedWbIds.add(id);
        el.classList.add('checked');
    }
};

window.batchDeleteWb = async function () {
    if (selectedWbIds.size === 0) return alert("请先选择词条");
    if (!confirm(`确定要删除选中的 ${selectedWbIds.size} 条设定吗？`)) return;

    await window.dbSystem.deleteWorldBooks(Array.from(selectedWbIds));
    toggleWbSelectMode();
};

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
    toggleWbSelectMode();
};

//分类管理逻辑

window.openCategoryManager = async function () {
    const modal = document.getElementById('modal-cat-mgr');
    modal.style.display = 'flex';
    renderCatMgrList();
};

async function renderCatMgrList() {
    const listEl = document.getElementById('cat-mgr-list');
    const categories = await window.dbSystem.getCategories(currentWbTab);

    listEl.innerHTML = categories.map(c => {
        const isDefault = (c.name === '未分类' || c.name === '默认');
        const delBtn = isDefault ? '<div style="width:32px;"></div>' :
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
    renderCatMgrList();
    renderCategoryBar();
};

window.deleteCategory = async function (id) {
    if (!confirm("删除分类后，内容将移入'未分类'。继续吗？")) return;

    const cats = await window.dbSystem.getCategories(currentWbTab);

    let defaultCat = cats.find(c => c.name === '未分类' || c.name === '默认');

    if (!defaultCat) {
        defaultCat = cats.find(c => c.id !== id);
    }

    if (defaultCat) {
        const books = await window.dbSystem.worldbooks.where('categoryId').equals(id).toArray();
        const bookIds = books.map(b => b.id);
        if (bookIds.length > 0) {
            await window.dbSystem.moveWorldBooks(bookIds, defaultCat.id);
        }
    } else {
        const books = await window.dbSystem.worldbooks.where('categoryId').equals(id).count();
        if (books > 0) {
            alert("这是最后一个分类，且里面还有内容，无法删除！请先新建一个分类转移内容。");
            return;
        }
    }

    await window.dbSystem.deleteCategory(id);
    renderCatMgrList();
    renderCategoryBar();
    if (currentWbCatId === id) switchWbCategory('all');
};


// 编辑页面的加载与保存

window.openWorldBookEdit = async function (id = null) {
    window.openApp('worldbook-edit');
    currentWbEditId = id;

    const currentEditType = id ? (await window.dbSystem.worldbooks.get(id)).type : currentWbTab;
    const categories = await window.dbSystem.getCategories(currentEditType);
    const select = document.getElementById('wb-category-select');

    select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const title = id ? "编辑词条" : "新建词条";
    document.getElementById('wb-edit-title').innerText = title;

    if (id) {
        const entry = await window.dbSystem.worldbooks.get(id);
        document.getElementById('wb-name').value = entry.name;
        document.getElementById('wb-content').value = entry.content;
        document.getElementById('wb-keys').value = entry.keys ? entry.keys.join(', ') : '';
        document.getElementById('wb-constant').checked = entry.constant;
        document.getElementById('wb-position').value = entry.position || 'top';
        document.getElementById('wb-order').value = entry.order || 100;

        if (entry.categoryId) select.value = entry.categoryId;

        document.getElementById('btn-del-wb').style.display = 'flex';
        toggleWbKeywords(document.getElementById('wb-constant'));
        if (typeof switchWbEditType === 'function') switchWbEditType(entry.type);

    } else {
        document.getElementById('wb-name').value = '';
        document.getElementById('wb-content').value = '';
        document.getElementById('wb-keys').value = '';
        document.getElementById('wb-constant').checked = false;
        document.getElementById('wb-position').value = 'top';
        document.getElementById('wb-order').value = 100;

        if (currentWbCatId !== 'all') {
            select.value = currentWbCatId;
        } else {
            const defaultCat = categories.find(c => c.name === '未分类' || c.name === '默认');
            if (defaultCat) select.value = defaultCat.id;
        }

        document.getElementById('btn-del-wb').style.display = 'none';
        document.getElementById('wb-keyword-group').style.display = 'block';
        if (typeof switchWbEditType === 'function') switchWbEditType(currentWbTab);
    }
};

window.switchWbEditType = async function (type) {
    const segGlobal = document.getElementById('wb-edit-segment-global');
    const segLocal = document.getElementById('wb-edit-segment-local');
    if (type === 'global') {
        segGlobal.classList.add('active'); segLocal.classList.remove('active');
    } else {
        segGlobal.classList.remove('active'); segLocal.classList.add('active');
    }
    const categories = await window.dbSystem.getCategories(type);
    const select = document.getElementById('wb-category-select');
    const oldVal = select.value;
    select.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
};


window.saveWorldBookEntry = async function () {
    const name = document.getElementById('wb-name').value.trim();
    const content = document.getElementById('wb-content').value.trim();
    const isConstant = document.getElementById('wb-constant').checked;
    const keysStr = document.getElementById('wb-keys').value.trim();
    const position = document.getElementById('wb-position').value;
    const order = parseInt(document.getElementById('wb-order').value) || 100;

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

    if (currentWbTab !== finalType) {
        switchWorldBookTab(finalType);
    } else {
        if (window.initWbScroller) {
            window.initWbScroller(currentWbTab, currentWbCatId);
        }
    }
};

//挂载逻辑
window.openWorldBookMountSelector = async function () {
    if (!window.currentActiveChatId) return alert("未找到当前会话ID");
    const chatId = parseInt(window.currentActiveChatId);
    const chat = await window.dbSystem.chats.get(chatId);
    if (!chat) return;

    document.getElementById('modal-wb-mount').style.display = 'flex';

    let mountedIds = (chat.mountedWorldBooks || []).map(id => parseInt(id));

    const categories = await window.dbSystem.getCategories('local');
    const books = await window.dbSystem.worldbooks.where('type').equals('local').toArray();

    const listEl = document.getElementById('wb-mount-list');
    if (books.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999">没有可用的局部设定</div>';
        return;
    }

    const groups = {};

    categories.forEach(c => {
        groups[c.id] = { info: c, items: [] };
    });
    groups['uncat'] = { info: { id: 'uncat', name: '未分类' }, items: [] };

    books.forEach(b => {
        if (b.categoryId && groups[b.categoryId]) {
            groups[b.categoryId].items.push(b);
        } else {
            groups['uncat'].items.push(b);
        }
    });

    let html = '';

    const renderGroup = (group) => {
        if (group.items.length === 0) return '';

        const allChecked = group.items.every(b => mountedIds.includes(b.id));
        const groupCheckState = allChecked ? 'checked' : '';

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

    categories.forEach(c => {
        html += renderGroup(groups[c.id]);
    });

    html += renderGroup(groups['uncat']);

    listEl.innerHTML = html;
};

window.toggleMountGroup = function (catCheckbox, groupId) {
    const isChecked = catCheckbox.checked;
    const subCBs = document.querySelectorAll(`.group-${groupId}`);
    subCBs.forEach(cb => {
        cb.checked = isChecked;
    });
};

window.updateGroupCheckState = function (groupId) {
    const catCheckbox = document.getElementById(`cat-cb-${groupId}`);
    if (!catCheckbox) return;

    const subCBs = document.querySelectorAll(`.group-${groupId}`);
    let all = true;
    for (let i = 0; i < subCBs.length; i++) {
        if (!subCBs[i].checked) {
            all = false;
            break;
        }
    }
    catCheckbox.checked = all;
};

window.saveWbMount = async function () {
    if (!window.currentActiveChatId) return;
    const chatId = parseInt(window.currentActiveChatId);

    const checkboxes = document.querySelectorAll('.wb-mount-cb');
    const selectedIds = [];

    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedIds.push(parseInt(cb.value));
        }
    });

    try {
        await window.dbSystem.chats.update(chatId, { mountedWorldBooks: selectedIds });

        const el = document.getElementById('wb-mount-status');
        if (el) el.innerText = selectedIds.length > 0 ? `已挂载 ${selectedIds.length} 个局部设定` : "未挂载局部设定";
        if (el) el.style.color = selectedIds.length > 0 ? "var(--theme-purple)" : "#999";

        document.getElementById('modal-wb-mount').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("保存失败");
    }
};

window.updateWbMountStatus = async function (chatId) {
    const chat = await window.dbSystem.chats.get(chatId);
    const count = (chat.mountedWorldBooks || []).length;
    const el = document.getElementById('wb-mount-status');
    if (el) el.innerText = count > 0 ? `已挂载 ${count} 个局部设定` : "未挂载局部设定";
};


window.injectWorldInfo = async function (chat, historyMessages) {
    const globalBooks = await window.dbSystem.worldbooks.where('type').equals('global').toArray();
    const mountedIds = chat.mountedWorldBooks || [];

    let localBooks = [];
    if (mountedIds.length > 0) {
        const results = await window.dbSystem.worldbooks.bulkGet(mountedIds);
        localBooks = results.filter(item => !!item);
    }

    const allCandidates = [...globalBooks, ...localBooks];
    if (allCandidates.length === 0) {
        return { top: "", bottom: "" };
    }

    const scanText = historyMessages.slice(-10).map(m => m.content).join('\n').toLowerCase();

    let activeEntries = [];

    for (const book of allCandidates) {
        let isHit = false;
        let reason = "";

        if (book.constant) {
            isHit = true;
            reason = "常驻激活";
        }

        else if (book.keys && book.keys.length > 0) {
            for (const key of book.keys) {
                if (scanText.includes(key.toLowerCase())) {
                    isHit = true;
                    reason = `命中关键词 [${key}]`;
                    break;
                }
            }
        }

        if (isHit) {
            activeEntries.push(book);
        } else {
        }
    }

    activeEntries.sort((a, b) => a.order - b.order);

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


    return result;
};

window.saveContextLimit = async function (val) {
    if (!window.currentActiveChatId) return;

    let limitNum = parseInt(val);

    if (isNaN(limitNum) || limitNum < 1) {
        limitNum = 25;
    }

    await window.dbSystem.chats.update(parseInt(window.currentActiveChatId), {
        historyLimit: limitNum
    });

    console.log(`短期记忆条数已更新为: ${limitNum}`);

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


let activeMenuMsgId = null;
let activeMenuMsgText = "";

window.showMsgMenu = function (x, y, targetBubble) {
    const menu = document.getElementById('msg-menu-box');
    const overlay = document.getElementById('msg-context-menu-overlay');
    if (!menu || !overlay) return;

    if (targetBubble) {
        activeMenuMsgId = targetBubble.getAttribute('data-msg-id');
    }

    if (!activeMenuMsgId) {
        console.error("未获取到消息 ID，无法显示菜单");
        return;
    }

    overlay.style.display = 'block';
    menu.style.display = 'flex';

    const screenW = window.innerWidth || document.documentElement.clientWidth;
    const menuW = menu.offsetWidth;

    let left = x;
    let top = y - 30;

    if (left < 10) left = 10;

    if (left + menuW > screenW - 10) {
        left = screenW - menuW - 10;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
};

window.hideMsgMenu = function () {
    document.getElementById('msg-context-menu-overlay').style.display = 'none';
};

window.handleDeleteMsg = async function () {
    window.hideMsgMenu();

    if (!activeMenuMsgId || activeMenuMsgId === "undefined") {
        console.error("无法删除：消息 ID 无效");
        return;
    }
    const msgIdToDelete = parseInt(activeMenuMsgId);

    try {
        await window.dbSystem.messages.delete(msgIdToDelete);
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

        if (window.openChatDetail && window.currentActiveChatId) {
            await window.openChatDetail(window.currentActiveChatId);

            setTimeout(() => {
                const body = document.getElementById('chat-body');
                if (body) body.scrollTop = body.scrollHeight;
            }, 50);
        }

        if (window.renderChatUI) window.renderChatUI();

    } catch (e) {
        console.error("删除失败:", e);
        alert("删除出错，请刷新页面重试");
    }
};

window.handleCopyMsg = function () {
    if (activeMenuMsgText) {
        navigator.clipboard.writeText(activeMenuMsgText).then(() => {
        });
    }
    hideMsgMenu();
};
let currentStickerPackId = null;
let isStickerSelectMode = false;
let selectedStickerIds = new Set();


window.openStickerManager = async function () {
    window.openApp('sticker-mgr');
    exitStickerSelectMode();
    await loadStickerPacks();
};

async function loadStickerPacks() {
    const packs = await window.dbSystem.sticker_packs.toArray();
    const container = document.getElementById('sticker-pack-bar');

    if (!currentStickerPackId && packs.length > 0) {
        currentStickerPackId = packs[0].id;
    }

    let html = '';

    packs.forEach(p => {
        const activeClass = (p.id === currentStickerPackId) ? 'active' : '';
        html += `<div class="wb-cat-pill ${activeClass}" onclick="switchStickerPack(${p.id})">${p.name}</div>`;
    });

    html += `
    <div class="wb-cat-add-btn" onclick="openStickerPackManager()">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
    </div>`;

    container.innerHTML = html;

    if (currentStickerPackId) {
        await loadStickersInPack(currentStickerPackId);
    } else {
        document.getElementById('sticker-grid-container').innerHTML =
            '<div style="width:100%;text-align:center;color:#ccc;padding:40px;">暂无表情包<br>点击右侧 + 号添加</div>';
    }
}

window.switchStickerPack = async function (id) {
    currentStickerPackId = id;
    selectedStickerIds.clear();
    await loadStickerPacks();
};

async function loadStickersInPack(packId) {
    if (window.initStickerScroller) {
        window.initStickerScroller(packId);
    } else {
        console.error("render.js 未加载或未定义 initStickerScroller");
    }
}

window.openStickerPreview = function (src) {
    const overlay = document.getElementById('sticker-preview-overlay');
    const img = document.getElementById('sticker-preview-img');
    img.src = src;
    overlay.style.display = 'flex';
};

window.toggleStickerSelectMode = function () {
    isStickerSelectMode = !isStickerSelectMode;

    const btnIcon = document.querySelector('#st-btn-select svg');
    const addBtn = document.getElementById('st-btn-add');
    const bottomBar = document.getElementById('st-bottom-bar');

    if (isStickerSelectMode) {
        btnIcon.innerHTML = `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`; // X
        addBtn.style.display = 'none';
        bottomBar.classList.add('active');
    } else {
        exitStickerSelectMode();
    }
    if (window.refreshStickerScroller) {
        window.refreshStickerScroller();
    }
};

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

window.toggleStickerSelection = function (id, el) {
    if (selectedStickerIds.has(id)) {
        selectedStickerIds.delete(id);
        el.classList.remove('selected');
    } else {
        selectedStickerIds.add(id);
        el.classList.add('selected');
    }
};


window.selectAllStickers = async function () {
    const allIds = await window.dbSystem.stickers.where('packId').equals(currentStickerPackId).primaryKeys();

    if (selectedStickerIds.size === allIds.length && allIds.length > 0) {
        selectedStickerIds.clear();
    } else {
        selectedStickerIds.clear();
        allIds.forEach(id => selectedStickerIds.add(id));
    }

    if (window.refreshStickerScroller) window.refreshStickerScroller();
};

window.batchDeleteStickers = async function () {
    if (selectedStickerIds.size === 0) return alert("请至少选择一张表情");
    if (!confirm(`确定要删除选中的 ${selectedStickerIds.size} 张表情吗？`)) return;

    await window.dbSystem.stickers.bulkDelete(Array.from(selectedStickerIds));

    selectedStickerIds.clear();
    loadStickersInPack(currentStickerPackId);
};

window.openStickerMoveModal = async function () {
    if (selectedStickerIds.size === 0) return alert("请至少选择一张表情");

    const packs = await window.dbSystem.sticker_packs.toArray();
    const listEl = document.getElementById('st-move-list');

    listEl.innerHTML = packs.map(p => {
        const isCurrent = (p.id === currentStickerPackId);

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

window.confirmBatchMoveStickers = async function (targetPackId) {
    if (targetPackId === currentStickerPackId) return alert("不能移动到同一个分类");

    const ids = Array.from(selectedStickerIds);

    const tasks = ids.map(id => {
        return window.dbSystem.stickers.update(id, { packId: targetPackId });
    });

    await Promise.all(tasks);

    document.getElementById('modal-sticker-move').style.display = 'none';
    alert("移动完成");

    selectedStickerIds.clear();

    await switchStickerPack(targetPackId);
};

let tempStickerFile = null;

const originalShowAddStickerModal = window.showAddStickerModal;
window.showAddStickerModal = function () {
    const modal = document.getElementById('modal-sticker-add');
    if (modal) modal.style.display = 'flex';

    const urlInput = document.getElementById('st-url-input');
    if (urlInput) urlInput.value = '';

    const nameInput = document.getElementById('st-item-name');
    if (nameInput) nameInput.value = '';

    const batchInput = document.getElementById('st-batch-input');
    if (batchInput) batchInput.value = '';

    const preview = document.getElementById('st-preview');
    if (preview) {
        preview.src = "";
        preview.style.display = 'none';
    }

    const ph = document.getElementById('st-ph');
    if (ph) {
        ph.style.display = 'flex';
    }

    tempStickerFile = null;

    if (typeof switchStickerAddTab === 'function') {
        switchStickerAddTab('item');
    }
};

window.saveStickerBatch = async function () {
    if (!currentStickerPackId) return alert("请先在上方选择一个表情包分类库");

    const rawText = document.getElementById('st-batch-input').value;
    if (!rawText.trim()) return alert("请粘贴内容");

    const lines = rawText.split('\n');
    let successCount = 0;
    const tasks = [];

    const btn = document.querySelector('#form-sticker-batch .btn-main');
    const oldText = btn.innerText;
    btn.innerText = "正在分析并导入...";
    btn.disabled = true;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        const httpIndex = line.indexOf('http');

        if (httpIndex !== -1) {
            const url = line.substring(httpIndex).trim();
            let name = line.substring(0, httpIndex).trim();
            name = name.replace(/[:：\s]+$/, '');
            if (!name) name = "未命名表情";
            tasks.push(window.dbSystem.stickers.add({
                packId: currentStickerPackId,
                src: url,
                name: name
            }));

            successCount++;
        }
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
        alert(`成功导入 ${successCount} 个表情！`);
        document.getElementById('modal-sticker-add').style.display = 'none';
        loadStickersInPack(currentStickerPackId);
    } else {
        alert("未能识别有效链接，请检查格式 (需包含 http/https)");
    }

    btn.innerText = oldText;
    btn.disabled = false;
};
window.handleStickerFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        tempStickerFile = e.target.result;
        const preview = document.getElementById('st-preview');
        preview.src = tempStickerFile;
        preview.style.display = 'block';
        document.getElementById('st-ph').style.display = 'none';
        document.getElementById('st-url-input').value = '';
    };
    reader.readAsDataURL(file);
};

window.handleStickerUrl = function (input) {
    const val = input.value.trim();
    if (!val) return;
    tempStickerFile = val;
    const preview = document.getElementById('st-preview');
    preview.src = val;
    preview.style.display = 'block';
    document.getElementById('st-ph').style.display = 'none';
};


window.saveStickerItem = async function () {
    if (!currentStickerPackId) return alert("请先创建一个分类");
    if (!tempStickerFile) return alert("请先上传图片或输入链接");

    let name = document.getElementById('st-item-name').value.trim();
    if (!name) name = "未命名表情";

    await window.dbSystem.stickers.add({
        packId: currentStickerPackId,
        src: tempStickerFile,
        name: name
    });

    document.getElementById('modal-sticker-add').style.display = 'none';
    loadStickersInPack(currentStickerPackId);
};

window.switchStickerAddTab = function (tab) {
    const tabs = ['item', 'batch', 'backup'];

    tabs.forEach(t => {
        const elTab = document.getElementById('st-tab-' + t);
        const elForm = document.getElementById('form-sticker-' + t);

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

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

window.exportCurrentPack = async function () {
    if (!currentStickerPackId) return alert("未选中任何分类");

    const btn = document.querySelector('#form-sticker-backup .btn-main');
    const oldText = btn.innerText;
    btn.innerText = "正在打包...";
    btn.disabled = true;

    try {
        const pack = await window.dbSystem.sticker_packs.get(currentStickerPackId);
        const stickers = await window.dbSystem.stickers.where('packId').equals(currentStickerPackId).toArray();
        const exportData = {
            packName: pack.name,
            version: 1.0,
            createDate: new Date().toISOString(),
            items: []
        };

        for (const s of stickers) {
            let srcStr = s.src;
            if (s.src instanceof Blob) {
                srcStr = await blobToBase64(s.src);
            }
            exportData.items.push({
                name: s.name,
                src: srcStr
            });
        }

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

            const newPackName = json.packName + " (导入)";
            const newPackId = await window.dbSystem.sticker_packs.add({ name: newPackName });

            const tasks = json.items.map(item => {
                return window.dbSystem.stickers.add({
                    packId: newPackId,
                    name: item.name || "未命名",
                    src: item.src
                });
            });

            await Promise.all(tasks);

            alert(`导入成功！创建了新分类: ${newPackName}`);

            document.getElementById('modal-sticker-add').style.display = 'none';
            await loadStickerPacks();
            switchStickerPack(newPackId);

        } catch (err) {
            console.error(err);
            alert("导入失败: JSON 格式错误或文件损坏");
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
};
window.openStickerPackManager = async function () {
    document.getElementById('modal-st-pack-mgr').style.display = 'flex';
    renderStickerPackMgrList();
};


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

window.doDeleteStickerPack = async function (id) {
    if (!confirm("⚠️ 高能预警：\n这将删除该分类下的所有表情图片！\n确定要继续吗？")) return;

    await window.dbSystem.deleteStickerPack(id);

    renderStickerPackMgrList();

    currentStickerPackId = null;
    loadStickerPacks();
};
window.openStickerPackManager = async function () {
    document.getElementById('modal-st-pack-mgr').style.display = 'flex';
    renderStickerPackMgrList();
};


async function renderStickerPackMgrList() {
    const listEl = document.getElementById('st-pack-mgr-list');
    const packs = await window.dbSystem.sticker_packs.toArray();

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

window.doDeleteStickerPack = async function (id) {
    if (!confirm("⚠️ 确定要删除这个分类吗？\n里面的所有表情图片也会被删除！")) return;

    await window.dbSystem.deleteStickerPack(id);

    await renderStickerPackMgrList();

    currentStickerPackId = null;
    await loadStickerPacks();
};

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

window.toggleChatStickerPanel = async function () {
    const panel = document.getElementById('chat-sticker-panel');

    if (!isChatPanelOpen) {
        isChatPanelOpen = true;

        currentChatStickerPackId = null;

        panel.style.display = 'flex';
        requestAnimationFrame(() => {
            panel.classList.add('show');
        });

        await loadChatStickerTabs();

    } else {
        closeChatStickerPanel();
    }
};

window.closeChatStickerPanel = function () {
    if (!isChatPanelOpen) return;

    isChatPanelOpen = false;
    const panel = document.getElementById('chat-sticker-panel');

    panel.classList.remove('show');

    setTimeout(() => {
        panel.style.display = 'none';
        if (window.cleanChatStickerMemory) window.cleanChatStickerMemory();
    }, 300);
};

document.getElementById('chat-body').addEventListener('click', function () {

    if (isChatPanelOpen) {
        closeChatStickerPanel();
    }
});

async function loadChatStickerTabs() {
    const container = document.getElementById('chat-sticker-tabs');
    if (!container) return;

    if (!window.currentActiveChatId) return;
    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);

    const mountedIds = chat.mountedStickerPacks || [];

    if (mountedIds.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:#999;padding:0 10px;">本窗口未挂载表情包</div>';
        if (window.cleanChatStickerMemory) window.cleanChatStickerMemory();
        return;
    }

    const allPacks = await window.dbSystem.sticker_packs.toArray();
    const visiblePacks = allPacks.filter(p => mountedIds.includes(p.id));

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

//表情包挂载逻辑
window.openStickerMountModal = async function () {
    if (!window.currentActiveChatId) return;

    const modal = document.getElementById('modal-sticker-mount');
    modal.style.display = 'flex';

    const listEl = document.getElementById('st-mount-list');
    listEl.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';

    const chat = await window.dbSystem.chats.get(window.currentActiveChatId);
    const mountedIds = new Set(chat.mountedStickerPacks || []);

    const allPacks = await window.dbSystem.sticker_packs.toArray();

    if (allPacks.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">系统里还没有表情包，请去“我-我的表情”添加</div>';
        return;
    }

    listEl.innerHTML = allPacks.map(p => {
        const isChecked = mountedIds.has(p.id) ? 'checked' : '';
        return `
        <label class="st-mount-item">
            <span style="font-size:15px; color:#333;">${p.name}</span>
            <input type="checkbox" class="st-mount-checkbox" value="${p.id}" ${isChecked}>
        </label>`;
    }).join('');
};

window.saveStickerMount = async function () {
    if (!window.currentActiveChatId) return;

    const checkboxes = document.querySelectorAll('.st-mount-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    await window.dbSystem.chats.update(window.currentActiveChatId, {
        mountedStickerPacks: selectedIds
    });

    document.getElementById('modal-sticker-mount').style.display = 'none';

    const panel = document.getElementById('chat-sticker-panel');
    if (panel.style.display !== 'none') {
        await loadChatStickerTabs();
    }
};

window.switchChatStickerPack = async function (id) {
    currentChatStickerPackId = id;

    const tabs = document.querySelectorAll('#chat-sticker-tabs .wb-cat-pill');
    loadChatStickerTabs();

    if (window.initChatStickerScroller) {
        window.initChatStickerScroller(id);
    }
};


window.sendStickerMsg = async function (blobOrUrl) {
    if (!window.currentActiveChatId) return;

    const globalUser = await window.dbSystem.getCurrent();
    const senderId = globalUser ? globalUser.id : null;
    if (!senderId) return alert("身份错误");

    let uiContent = blobOrUrl;
    let dbContent = blobOrUrl;

    if (blobOrUrl instanceof Blob) {
        dbContent = await blobToBase64(blobOrUrl);
    }

    const newId = await window.dbSystem.addMessage(window.currentActiveChatId, dbContent, senderId, 'image');

    if (window.chatScroller) {
        window.chatScroller.append({
            id: newId,
            chatId: window.currentActiveChatId,
            text: uiContent,
            senderId: senderId,
            type: 'image',
            time: new Date()
        });

        setTimeout(() => {
            const body = document.getElementById('chat-body');
            if (body) body.scrollTop = body.scrollHeight;
        }, 10);
    } else {
        console.error("找不到 chatScroller，请检查 render.js 是否已修改为 window.chatScroller");
    }

    await window.dbSystem.chats.update(window.currentActiveChatId, {
        lastMsg: '[表情]',
        updated: new Date()
    });

    if (window.renderChatUI) window.renderChatUI();
};


async function getChatStickerContext(chat) {
    const mountedIds = chat.mountedStickerPacks || [];
    if (mountedIds.length === 0) return { prompt: "", nameMap: {}, srcMap: {} };

    const stickers = await window.dbSystem.stickers
        .where('packId').anyOf(mountedIds)
        .toArray();

    if (stickers.length === 0) return { prompt: "", nameMap: {}, srcMap: {} };

    const nameMap = {};
    const srcMap = {};
    const names = [];

    stickers.forEach(s => {
        if (s.name) {
            nameMap[s.name] = s.src;
            srcMap[s.src] = s.name;
            names.push(s.name);
        }
    });


    const prompt = `\n# Sticker Usage (表情包能力)\n当前会话已挂载表情包，你可以使用表情生动地表达情感。\n**发送规则**：若要发送表情，请严格输出 "[表情] 表情名" (例如: [表情] ${names[0] || '开心'})。\n**可用表情列表**：${names.join(', ')}\n`;

    return { prompt, nameMap, srcMap };
}
let isFeaturePanelOpen = false;

window.toggleFeaturePanel = function () {
    const panel = document.getElementById('chat-feature-panel');
    const stickerPanel = document.getElementById('chat-sticker-panel');


    if (window.closeChatStickerPanel && stickerPanel && stickerPanel.classList.contains('show')) {
        window.closeChatStickerPanel();
    }

    if (!isFeaturePanelOpen) {
        isFeaturePanelOpen = true;
        panel.style.display = 'flex';
        requestAnimationFrame(() => {
            panel.classList.add('show');
        });
    } else {
        window.closeFeaturePanel();
    }
};

window.closeFeaturePanel = function () {
    if (!isFeaturePanelOpen) return;
    isFeaturePanelOpen = false;

    const panel = document.getElementById('chat-feature-panel');
    panel.classList.remove('show');

    setTimeout(() => {
        panel.style.display = 'none';
    }, 300);
};


window.handleVoiceSend = function () {
    window.closeFeaturePanel();

    const modal = document.getElementById('modal-voice-input');
    const input = document.getElementById('voice-text-input');

    input.value = '';
    modal.style.display = 'flex';

    setTimeout(() => input.focus(), 100);
};

window.submitVoiceInput = function () {
    const input = document.getElementById('voice-text-input');
    const text = input.value.trim();

    if (!text) return;

    window.sendVoiceMsg(text);

    document.getElementById('modal-voice-input').style.display = 'none';
};

window.sendVoiceMsg = async function (content) {
    if (!window.currentActiveChatId) return;

    const user = await window.dbSystem.getCurrent();
    const senderId = user ? user.id : null;
    if (!senderId) return;

    const newId = await window.dbSystem.addMessage(window.currentActiveChatId, content, senderId, 'audio');

    if (window.chatScroller) {
        window.chatScroller.append({
            id: newId,
            chatId: window.currentActiveChatId,
            text: content,
            senderId: senderId,
            type: 'audio',
            time: new Date()
        });
        const body = document.getElementById('chat-body');
        if (body) setTimeout(() => body.scrollTop = body.scrollHeight, 10);
    }

    await window.dbSystem.chats.update(window.currentActiveChatId, {
        lastMsg: '[语音]',
        updated: new Date()
    });
};
window.toggleVoiceText = function (el) {
    console.log("请更新 render.js 中的 onclick 事件");
};
window.handlePhotoPanel = function () {
    window.closeFeaturePanel();
    const modal = document.getElementById('modal-photo-card');
    const input = document.getElementById('photo-card-desc');

    input.value = '';
    modal.style.display = 'flex';

    setTimeout(() => input.focus(), 100);
};

window.submitPhotoCard = async function () {
    const input = document.getElementById('photo-card-desc');
    const text = input.value.trim();

    if (!text) return alert("请输入描述内容");


    if (!window.currentActiveChatId) return;

    const user = await window.dbSystem.getCurrent();
    const senderId = user ? user.id : null;
    if (!senderId) return;

    const newId = await window.dbSystem.addMessage(window.currentActiveChatId, text, senderId, 'image-card');

    if (window.chatScroller) {
        window.chatScroller.append({
            id: newId,
            chatId: window.currentActiveChatId,
            text: text,
            senderId: senderId,
            type: 'image-card',
            time: new Date()
        });
        const body = document.getElementById('chat-body');
        if (body) setTimeout(() => body.scrollTop = body.scrollHeight, 10);
    }

    await window.dbSystem.chats.update(window.currentActiveChatId, {
        lastMsg: '[图文卡片]',
        updated: new Date()
    });

    document.getElementById('modal-photo-card').style.display = 'none';
};

let currentPhotoTab = 'local';
let tempLocalImgBlob = null;

window.switchPhotoTab = function (tab) {
    currentPhotoTab = tab;

    document.getElementById('tab-photo-local').className = tab === 'local' ? 'wb-edit-segment-item active' : 'wb-edit-segment-item';
    document.getElementById('tab-photo-card').className = tab === 'card' ? 'wb-edit-segment-item active' : 'wb-edit-segment-item';


    document.getElementById('panel-photo-local').style.display = tab === 'local' ? 'block' : 'none';
    document.getElementById('panel-photo-card').style.display = tab === 'card' ? 'block' : 'none';
};

window.handleLocalImgFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) return alert("图片太大了，请选择 5MB 以内的图片");

    tempLocalImgBlob = file;
    const url = URL.createObjectURL(file);

    const preview = document.getElementById('preview-local-img');
    const ph = document.getElementById('placeholder-local-img');

    preview.src = url;
    preview.style.display = 'block';
    ph.style.display = 'none';
};


window.submitPhotoUnified = async function () {
    if (!window.currentActiveChatId) return;
    const user = await window.dbSystem.getCurrent();
    if (!user) return;

    if (currentPhotoTab === 'card') {
        window.submitPhotoCard();
    } else {
        if (!tempLocalImgBlob) return alert("请先选择一张图片");

        const newId = await window.dbSystem.addMessage(window.currentActiveChatId, tempLocalImgBlob, user.id, 'real-image');

        if (window.chatScroller) {
            window.chatScroller.append({
                id: newId,
                chatId: window.currentActiveChatId,
                text: tempLocalImgBlob,
                senderId: user.id,
                type: 'real-image',
                time: new Date()
            });
            scrollToBottom();
        }

        await window.dbSystem.chats.update(window.currentActiveChatId, {
            lastMsg: '[图片]',
            updated: new Date()
        });

        document.getElementById('modal-photo-card').style.display = 'none';


        tempLocalImgBlob = null;
        document.getElementById('preview-local-img').src = "";
        document.getElementById('preview-local-img').style.display = 'none';
        document.getElementById('placeholder-local-img').style.display = 'flex';
        document.getElementById('inp-local-img').value = '';
    }
};


window.openImageViewer = function (src) {
    const viewer = document.getElementById('global-image-viewer');
    const img = document.getElementById('global-image-viewer-img');

    if (viewer && img) {
        img.src = src;
        viewer.style.display = 'flex';
    } else {
        console.error("未找到 id='global-image-viewer'，请检查 index.html");
    }
};