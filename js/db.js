/* =========================================
   db.js - 核心数据库逻辑 (修复版)
   ========================================= */

// 1. 定义数据库
const db = new Dexie('sisi_db');

// 定义表结构
// 注意：chats 表增加了复合索引 [contactId+personaId] 以消除黄色警告
db.version(1).stores({
    personas: '++id',
    contacts: '++id',
    chats: '++id, [contactId+personaId], updated',
    settings: 'key',
    // [新增] 消息表：chatId用于查询某个会话的所有消息
    messages: '++id, chatId, time'
});


// 2. 封装数据库接口
const dbSystem = {
    // --- 【关键修复】直接暴露表对象，供 render.js 调用 ---
    personas: db.personas,
    contacts: db.contacts,
    chats: db.chats,
    settings: db.settings,
    messages: db.messages,
    // 打开数据库
    open: async function () {
        if (!db.isOpen()) {
            await db.open();
        }
        await this.initDefault();
        return;
    },

    // 初始化默认数据
    initDefault: async function () {
        const count = await db.personas.count();
        if (count === 0) {
            console.log("初始化默认人设...");
            await this.add("小可爱", "9527", "我是一个快乐的默认人设。", null);
            const first = await db.personas.toArray();
            await this.setCurrent(first[0].id);
        }
    },

    // --- 人设 (Persona) ---
    add: function (name, userId, desc, avatar) {
        return db.personas.add({ name, userId, desc, avatar, date: new Date() });
    },
    getAll: function () {
        return db.personas.toArray();
    },
    update: function (id, name, userId, desc, avatar) {
        return db.personas.put({ id, name, userId, desc, avatar, date: new Date() });
    },
    setCurrent: function (id) {
        return db.settings.put({ key: 'currId', value: id });
    },
    getCurrent: async function () {
        const setting = await db.settings.get('currId');
        if (!setting) return null;
        return await db.personas.get(setting.value);
    },

    // --- 好友 (Contacts) ---
    addContact: function (name, userId, desc, avatar) {
        return db.contacts.add({ name, userId, desc, avatar, date: new Date() });
    },
    updateContact: function (id, name, userId, desc, avatar) {
        return db.contacts.put({ id, name, userId, desc, avatar, date: new Date() });
    },
    getContacts: function () {
        return db.contacts.toArray();
    },

    // --- 聊天会话 (Chats) ---
    createOrGetChat: async function (contactId, personaId) {
        // 使用复合索引查询，速度更快，也不会报错了
        const existing = await db.chats
            .where({ contactId: contactId, personaId: personaId })
            .first();

        if (existing) {
            // 更新时间，让它排到前面
            await db.chats.update(existing.id, { updated: new Date() });
            return existing.id;
        } else {
            // 创建新会话
            return await db.chats.add({
                contactId,
                personaId,
                updated: new Date(),
                lastMsg: "开始聊天吧！"
            });
        }
    },

    getChats: async function () {
        // 按时间倒序获取所有会话
        return db.chats.orderBy('updated').reverse().toArray();
    },
    getMessages: async function (chatId) {
        return await db.messages.where('chatId').equals(chatId).toArray();
    },

    // [新增] 保存一条消息
    addMessage: async function (chatId, text, isMe, type = 'text') {
        return await db.messages.add({
            chatId,
            text,
            isMe: isMe ? 1 : 0, // 1代表我发的，0代表对方发的
            type,
            time: new Date()
        });
    }
};

// 暴露给全局
window.dbSystem = dbSystem;