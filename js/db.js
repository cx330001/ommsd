const db = new Dexie('sisi_db');

// 定义表结构
db.version(8).stores({
    chars: '++id, type, name',
    chats: '++id, name, *members, updated',
    settings: 'key',
    messages: '++id, chatId, senderId, time',
    wb_categories: '++id, name, type',
    worldbooks: '++id, name, type, categoryId',
    sticker_packs: '++id, name',
    stickers: '++id, packId, src, name'
});

const dbSystem = {
    chars: db.chars,
    chats: db.chats,
    settings: db.settings,
    messages: db.messages,
    relations: db.relations,
    worldbooks: db.worldbooks,
    sticker_packs: db.sticker_packs,
    stickers: db.stickers,
    getMessagesPaged: async function (chatId, limit = 20, offset = 0) {
        const arr = await db.messages
            .where('chatId').equals(chatId)
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
        return arr.reverse();
    },
    deleteMessage: async function (id) {
        return await db.messages.delete(id);
    },


    getWorldBooksPaged: async function (type, categoryId, limit = 20, offset = 0) {
        let collection = db.worldbooks.where('type').equals(type);
        if (categoryId !== 'all') {
            collection = collection.filter(b => b.categoryId === categoryId);
        }
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
    moveWorldBooks: async function (ids, newCategoryId) {
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
            await db.stickers.where('packId').equals(id).delete();
            await db.sticker_packs.delete(id);
        });
    },
    getStickersPaged: async function (packId, limit = 20, offset = 0) {
        return await db.stickers
            .where('packId').equals(packId)
            .reverse()
            .offset(offset)
            .limit(limit)
            .toArray();
    },
    //initDefault 初始化默认分类
    initDefault: async function () {
        const count = await db.chars.count();
        if (count === 0) {
            await this.addChar("我 (User)", "默认用户", null, 1);
            await this.addChar("小助手 (AI)", "我是一个AI。", null, 0);
            const firstUser = await db.chars.where({ type: 1 }).first();
            if (firstUser) await this.setCurrent(firstUser.id);
        }
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

    //统一角色管理
    addChar: function (name, desc, avatar, type = 0) {
        return db.chars.add({ name, desc, avatar, type, date: new Date() });
    },
    updateChar: function (id, name, desc, avatar) {
        return db.chars.update(id, { name, desc, avatar });
    },
    getChar: function (id) {
        return db.chars.get(id);
    },

    getMyPersonas: function () {
        return db.chars.where('type').equals(1).toArray();
    },

    getContacts: function () {
        return db.chars.where('type').equals(0).toArray();
    },

    setCurrent: function (id) {
        return db.settings.put({ key: 'currId', value: id });
    },
    getCurrent: async function () {
        const setting = await db.settings.get('currId');
        if (!setting) return null;
        return await db.chars.get(setting.value);
    },

    //聊天会话
    createOrGetChat: async function (memberIds) {
        const sortedIds = memberIds.sort((a, b) => a - b);
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
    addMessage: async function (chatId, text, senderId, type = 'text') {
        return await db.messages.add({
            chatId,
            text,
            senderId,
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