/* =========================================
   db.js - 核心数据库逻辑 (去冗余轻量版)
   ========================================= */

const db = new Dexie('sisi_db');

// 1. 定义表结构
// chars: 统一存储所有角色。type=0为AI/好友，type=1为当前用户(我)
// chats: members 是一个包含 charId 的数组，例如 [1, 5]
db.version(8).stores({
    chars: '++id, type, name',
    chats: '++id, name, *members, updated',
    settings: 'key',
    messages: '++id, chatId, senderId, time',

    // [新增] wb_categories 表，以及在 worldbooks 里增加 categoryId 索引
    wb_categories: '++id, name, type', // type='global' or 'local'
    worldbooks: '++id, name, type, categoryId',
    // --- 新增下面两行 ---
    sticker_packs: '++id, name',     // 表情包分类 (例如: "猫猫头", "常用")
    stickers: '++id, packId, src, name'
});

const dbSystem = {
    chars: db.chars,
    chats: db.chats,
    settings: db.settings,
    messages: db.messages,
    relations: db.relations, // [新增] 暴露表对象
    worldbooks: db.worldbooks,
    sticker_packs: db.sticker_packs,
    stickers: db.stickers,
    getMessagesPaged: async function (chatId, limit = 20, offset = 0) {
        // 1. reverse(): 倒序，从最新的时间往前找
        // 2. offset(offset): 跳过已经加载的
        // 3. limit(limit): 只拿 20 条
        const arr = await db.messages
            .where('chatId').equals(chatId)
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();

        // 4. 因为拿到的是[新...旧]，为了显示正常，要反转回 [旧...新]
        return arr.reverse();
    },
    deleteMessage: async function (id) {
        return await db.messages.delete(id);
    },


    getWorldBooksPaged: async function (type, categoryId, limit = 20, offset = 0) {
        let collection = db.worldbooks.where('type').equals(type);

        // 如果不是 'all'，则过滤分类
        // 注意：Dexie 的 filter 在大数据量下性能不如索引，但对于世界书这个量级通常够用
        if (categoryId !== 'all') {
            collection = collection.filter(b => b.categoryId === categoryId);
        }

        // 倒序 (新创建的在前) -> 跳过 offset -> 取 limit
        return await collection.reverse().offset(offset).limit(limit).toArray();
    },



    open: async function () {
        if (!db.isOpen()) await db.open();
        await this.initDefault();
    },

    getCategories: function (type) {
        return db.wb_categories.where('type').equals(type).toArray();
    },
    addCategory: function (name, type) {
        return db.wb_categories.add({ name, type });
    },
    deleteCategory: function (id) {
        return db.wb_categories.delete(id);
    },
    // 批量移动设定到新分类
    moveWorldBooks: async function (ids, newCategoryId) {
        // Dexie 的 bulkUpdate 需要主键数组
        return db.transaction('rw', db.worldbooks, async () => {
            for (const id of ids) {
                await db.worldbooks.update(id, { categoryId: newCategoryId });
            }
        });
    },
    // 批量删除
    deleteWorldBooks: function (ids) {
        return db.worldbooks.bulkDelete(ids);
    },
    deleteStickerPack: async function (id) {
        return db.transaction('rw', db.sticker_packs, db.stickers, async () => {
            // 1. 先删里面的表情
            await db.stickers.where('packId').equals(id).delete();
            // 2. 再删分类本身
            await db.sticker_packs.delete(id);
        });
    },
    getStickersPaged: async function (packId, limit = 20, offset = 0) {
        // 倒序 (新加的在前面) -> 跳过 offset -> 取 limit
        return await db.stickers
            .where('packId').equals(packId)
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
    },
    // [修改] initDefault 初始化默认分类
    initDefault: async function () {
        const count = await db.chars.count();
        if (count === 0) {
            await this.addChar("我 (User)", "默认用户", null, 1);
            await this.addChar("小助手 (AI)", "我是一个AI。", null, 0);
            const firstUser = await db.chars.where({ type: 1 }).first();
            if (firstUser) await this.setCurrent(firstUser.id);
        }

        // --- [修复] 初始化默认分类 ---
        // 逻辑升级：如果没有“未分类”，就创建一个
        const catsGlobal = await db.wb_categories.where('type').equals('global').toArray();
        if (!catsGlobal.find(c => c.name === '未分类')) {
            await this.addCategory("未分类", "global");
        }

        const catsLocal = await db.wb_categories.where('type').equals('local').toArray();
        if (!catsLocal.find(c => c.name === '未分类')) {
            await this.addCategory("未分类", "local");
        }
        const packs = await db.sticker_packs.toArray();
        if (packs.length === 0) {
            await db.sticker_packs.add({ name: "默认收藏" });
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
window.toggleWbKeywords = function (el) {
    const group = document.getElementById('wb-keyword-group');
    if (group) {
        group.style.display = el.checked ? 'none' : 'block';
    }
};