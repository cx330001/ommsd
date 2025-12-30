/* =========================================
   db.js - 核心数据库逻辑 (去冗余轻量版)
   ========================================= */

const db = new Dexie('sisi_db');

// 1. 定义表结构
// chars: 统一存储所有角色。type=0为AI/好友，type=1为当前用户(我)
// chats: members 是一个包含 charId 的数组，例如 [1, 5]
db.version(4).stores({
    chars: '++id, type, name',
    chats: '++id, name, *members, updated', // <--- 这里加了 name
    settings: 'key',
    messages: '++id, chatId, senderId, time',
    relations: '++id, fromId, toId'
});

const dbSystem = {
    chars: db.chars,
    chats: db.chats,
    settings: db.settings,
    messages: db.messages,
    relations: db.relations, // [新增] 暴露表对象

    // [新增] 获取某人的所有关系网 (无论是作为源头还是目标)
    getRelations: async function (charId) {
        // 找出 "我关联别人" 和 "别人关联我" 的所有记录
        const from = await db.relations.where('fromId').equals(charId).toArray();
        const to = await db.relations.where('toId').equals(charId).toArray();
        return [...from, ...to];
    },

    // [新增] 添加/更新关系
    addRelation: async function (fromId, toId, desc) {
        // 简单的去重逻辑：如果已经存在这两个人的关系，则更新描述
        // 这里为了简单，我们允许单向多重定义，或者你可以先查一下
        return await db.relations.add({ fromId, toId, desc });
    },

    // [新增] 删除关系
    deleteRelation: async function (id) {
        return await db.relations.delete(id);
    },
    open: async function () {
        if (!db.isOpen()) await db.open();
        await this.initDefault();
    },

    initDefault: async function () {
        const count = await db.chars.count();
        if (count === 0) {
            // 初始化一个默认用户(我)
            await this.addChar("我 (User)", "默认用户", null, 1);
            // 初始化一个默认AI
            await this.addChar("小助手 (AI)", "我是一个AI。", null, 0);

            // 设置当前默认身份
            const firstUser = await db.chars.where({ type: 1 }).first();
            if (firstUser) await this.setCurrent(firstUser.id);
        }
    },

    // --- 统一角色管理 ---
    // type: 1=用户(Me), 0=AI/Contact
    addChar: function (name, desc, avatar, type = 0) {
        return db.chars.add({ name, desc, avatar, type, date: new Date() });
    },
    updateChar: function (id, name, desc, avatar) {
        return db.chars.update(id, { name, desc, avatar });
    },
    getChar: function (id) {
        return db.chars.get(id);
    },
    // 获取所有的“我”
    getMyPersonas: function () {
        return db.chars.where('type').equals(1).toArray();
    },
    // 获取所有的“好友/AI”
    getContacts: function () {
        return db.chars.where('type').equals(0).toArray();
    },

    // --- 当前操作身份 ---
    setCurrent: function (id) {
        return db.settings.put({ key: 'currId', value: id });
    },
    getCurrent: async function () {
        const setting = await db.settings.get('currId');
        if (!setting) return null;
        return await db.chars.get(setting.value);
    },

    // --- 聊天会话 ---
    // 创建或获取会话 (支持 Char-to-Char)
    // memberIds: [id1, id2]
    createOrGetChat: async function (memberIds) {
        // 排序以确保 [1,2] 和 [2,1] 查到的是同一个
        const sortedIds = memberIds.sort((a, b) => a - b);

        // Dexie 不支持直接查询数组全匹配，这里先查包含第一个人的，再在内存过滤
        // (对于轻量级应用性能足够)
        const candidates = await db.chats.where('members').equals(sortedIds[0]).toArray();

        const existing = candidates.find(c =>
            c.members.length === sortedIds.length &&
            c.members.every((val, index) => val === sortedIds[index])
        );

        if (existing) {
            await db.chats.update(existing.id, { updated: new Date() });
            return existing.id;
        } else {
            return await db.chats.add({
                members: sortedIds,
                updated: new Date(),
                lastMsg: "新对话"
            });
        }
    },

    getChats: async function () {
        return db.chats.orderBy('updated').reverse().toArray();
    },

    getMessages: async function (chatId) {
        return await db.messages.where('chatId').equals(chatId).toArray();
    },

    // 发送消息：记录是谁发的 (senderId) 而不是 isMe
    addMessage: async function (chatId, text, senderId, type = 'text') {
        return await db.messages.add({
            chatId,
            text,
            senderId, // 关键修改
            type,
            time: new Date()
        });
    }
};

window.dbSystem = dbSystem;