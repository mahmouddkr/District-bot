const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    EmbedBuilder, 
    ChannelType, 
    PermissionsBitField,
    SlashCommandBuilder,
    AuditLogEvent
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

// خادم ويب لبقاء البوت شغال 24/7 على Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District System Bot is alive and running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// تخزين الدعوات مؤقتاً لمعرفة من قام بالدعوة
const invitesCache = new Map();

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! District Bot is Online 24/7.`);
    client.user.setActivity('Communauté Server', { type: 3 });

    // جلب وحفظ دعوات السيرفر عند الإقلاع
    for (const guild of client.guilds.cache.values()) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (err) {
            console.error(`Could not fetch invites for guild ${guild.name}:`, err);
        }
    }

    // تسجيل جميع أوامر السلاش (Slash Commands) تلقائياً
    const commands = [
        new SlashCommandBuilder().setName('join').setDescription('دخول البوت إلى روم الصوت الخاص بك'),
        new SlashCommandBuilder().setName('leave').setDescription('خروج البوت من روم الصوت'),
        new SlashCommandBuilder().setName('ticket').setDescription('إرسال لوحة نظام التذاكر والدعم الفني'),
        new SlashCommandBuilder().setName('games-roles').setDescription('إرسال لوحة اختيار رتب الألعاب'),
        new SlashCommandBuilder().setName('setup-roles').setDescription('إرسال لوحة أزرار الرتب الثابتة')
    ];

    try {
        await client.application.commands.set(commands);
        console.log('Successfully registered all Slash Commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// الأيدي الخاصة بالرومات والسيرفر واللوغ
const CHANNELS = {
    LOG: '1569093925266784286',          // روم لوغ السيرفر العام
    ROLES_LOG: '1569094610217861171',   // روم لوغ الرتب
    TICKET_LOG: '1565678345037815899',  // روم سجل التذاكر المغلقة
    WELCOME: '1560689193733324910',     // روم الترحيب
    GOODBYE: '1569090865551638709',     // روم المغادرة
    TICKET_SETUP: '1559364091368181870',   // روم إرسال رسالة التذاكر
    STATIC_ROLES: '1565462147100844154',   // روم الرتب الثابتة
    GAMES_ROLES: '1560471208766476298'     // روم رتب الألعاب
};

// الأيدي الخاصة بالشانلات المخصصة لألعاب Fizbo
const GAME_CHANNELS = [
    '1560721542617239602',
    '1560501807602606121'
];

// الأيدي الخاصة بالرتب للصلاحيات والتسليم
const ROLES = {
    STAFF_SUPPORT: '1561461730545115276', // رول الدعم
    PARTNER_1: '1560523485850247168',     // رول الشراكات الأول
    PARTNER_2: '1560523789991813180',     // رول الشراكات الثاني
    DISTRICTIAN: '1560723045222453269',   // رول ديستريكتيان
    MINI_GAMES: '1560453077058850927',    // رول ميني قيمز
    VERIFY: '1560453481217785926',        // رول فيريفاي
    
    GAMES: {
        'cs2': '1560453628790055052',
        'valo': '1560453742774591519',
        'fortnite': '1560453999591956521',
        'fire': '1560454112712335470',
        'rocket': '1560454269688217651',
        'amongus': '1560454367730212984',
        'minecraft': '1560454453906247721',
        'roblox': '1560454686988046439',
        'soccer': '1560454965233852487',
        'bluecar': '1560455333078368366',
        'pes': '1560455046729170984',
        'racecar': '1560455551723241502',
        'fivem': '1560455646644666429'
    }
};

// حماية التكرار والسبام للوغ والنقاط
const voiceCooldown = new Set();
const roleCooldown = new Set();
const messageLogCooldown = new Set();
const userPoints = new Map();
const activeGames = new Map();

// مكتبة ألعاب Fizbo (فكك، عواصم، رياضيات)
const wordGames = [
    { question: '🔤 أسرع واكتب الكلمة مبعثرة: **م د ر س ة**', answer: 'مدرسة' },
    { question: '🔤 أسرع واكتب الكلمة مبعثرة: **ب ر م ج ة**', answer: 'برمجة' },
    { question: '🔤 أسرع واكتب الكلمة مبعثرة: **د ي س ك و ر د**', answer: 'ديسكورد' },
    { question: '🔤 أسرع واكتب الكلمة مبعثرة: **س ي ر ف ر**', answer: 'سيرفر' },
    { question: '🔤 أسرع واكتب الكلمة مبعثرة: **ت ح د ي**', answer: 'تحدي' }
];

const capitalGames = [
    { question: '🌍 ما هي عاصمة **الجزائر**؟', answer: 'الجزائر' },
    { question: '🌍 ما هي عاصمة **فرنسا**؟', answer: 'باريس' },
    { question: '🌍 ما هي عاصمة **المملكة العربية السعودية**؟', answer: 'الرياض' },
    { question: '🌍 ما هي عاصمة **إسبانيا**؟', answer: 'مدريد' },
    { question: '🌍 ما هي عاصمة **إيطاليا**؟', answer: 'روما' }
];

const mathGames = [
    { question: '🔢 كم الناتج الحسابي؟ **15 + 25 = ?**', answer: '40' },
    { question: '🔢 كم الناتج الحسابي؟ **8 × 7 = ?**', answer: '56' },
    { question: '🔢 كم الناتج الحسابي؟ **100 - 35 = ?**', answer: '65' },
    { question: '🔢 كم الناتج الحسابي؟ **12 × 12 = ?**', answer: '144' }
];

function getRandomGame() {
    const types = ['word', 'capital', 'math'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    
    if (selectedType === 'word') return { type: 'word', ...wordGames[Math.floor(Math.random() * wordGames.length)] };
    if (selectedType === 'capital') return { type: 'capital', ...capitalGames[Math.floor(Math.random() * capitalGames.length)] };
    return { type: 'math', ...mathGames[Math.floor(Math.random() * mathGames.length)] };
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. نظام لوغ السيرفر الشامل (Server Logs)
// ==========================================
client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1200);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const entry = logs.entries.first();
        if (entry && entry.target.id === ban.user.id) executor = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`👤 **الضحية:** ${ban.user.tag}\n🛡️ **صاحب الفعل (By):** ${executor}\n📝 **السبب:** ${ban.reason || 'لا يوجد سبب'}`)
        .setColor('#8b0000').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanRemove', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1200);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
        const entry = logs.entries.first();
        if (entry && entry.target.id === ban.user.id) executor = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔓 **Member Unbanned / فك حظر**')
        .setDescription(`👤 **الضحية:** ${ban.user.tag}\n🛡️ **صاحب الفعل (By):** ${executor}`)
        .setColor('#00ff7f').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(CHANNELS.LOG) || newState.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const cooldownKey = `${member.id}-${oldState.channelId}-${newState.channelId}`;
    if (voiceCooldown.has(cooldownKey)) return;
    voiceCooldown.add(cooldownKey);
    setTimeout(() => voiceCooldown.delete(cooldownKey), 3000);

    if (oldState.channelId && !newState.channelId) {
        await wait(1000);
        let discBy = `${member.user.tag} (خرج بنفسه)`;
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberDisconnect });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                discBy = `${entry.executor.tag} (تم طرده بواسطة مشرف)`;
            }
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle('🔇 **Voice Disconnected / خروج أو فصل من الفويس**')
            .setDescription(`👤 **الضحية:** ${member.user.tag}\n🚪 **من روم:** ${oldState.channel?.name}\n🛡️ **صاحب الفعل (By):** ${discBy}`)
            .setColor('#ff9900').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    else if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔊 **Voice Joined / انضمام للفويس**')
            .setDescription(`👤 **العضو:** ${member.user.tag}\n📥 **إلى روم:** ${newState.channel?.name}`)
            .setColor('#00ccff').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await wait(1000);
        let movedBy = `${member.user.tag} (انتقال ذاتي)`;
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                movedBy = `${entry.executor.tag} (سحبه مشرف)`;
            }
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle('🔀 **Voice Moved / نقل صوتي**')
            .setDescription(`👤 **الضحية:** ${member.user.tag}\n📤 **من:** \`${oldState.channel?.name}\`\n📥 **إلى:** \`${newState.channel?.name}\`\n🛡️ **صاحب الفعل (By):** ${movedBy}`)
            .setColor('#9370db').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    if (oldState.serverMute !== newState.serverMute) {
        await wait(1000);
        let mutedBy = 'مشرف غير معروف';
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                mutedBy = `${entry.executor.tag}`;
            }
        } catch (e) {}

        const status = newState.serverMute ? 'تم عمل Server Mute' : 'تم إزالة Server Mute';
        const embed = new EmbedBuilder()
            .setTitle('🔇 **Server Mute / ميوت سيرفر**')
            .setDescription(`👤 **الضحية:** ${member.user.tag}\n⚡ **الحالة:** ${status}\n🛡️ **صاحب الفعل (By):** ${mutedBy}`)
            .setColor('#ff4500').setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    if (oldState.serverDeaf !== newState.serverDeaf) {
        await wait(1000);
        let deafBy = 'مشرف غير معروف';
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                deafBy = `${entry.executor.tag}`;
            }
        } catch (e) {}

        const status = newState.serverDeaf ? 'تم عمل Server Deafen' : 'تم إزالة Deafen';
        const embed = new EmbedBuilder()
            .setTitle('🎧 **Server Deafen / ديفن سيرفر**')
            .setDescription(`👤 **الضحية:** ${member.user.tag}\n⚡ **الحالة:** ${status}\n🛡️ **صاحب الفعل (By):** ${deafBy}`)
            .setColor('#4682b4').setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1000);

    let creator = 'مشرف غير معروف';
    try {
        const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const entry = logs.entries.first();
        if (entry && entry.target.id === channel.id) creator = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('📁 **Channel Created / إنشاء قناة**')
        .setDescription(`📌 **القناة:** ${channel.name}\n🛡️ **صاحب الفعل (By):** ${creator}`)
        .setColor('#00ff7f').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1000);

    let deleter = 'مشرف غير معروف';
    try {
        const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const entry = logs.entries.first();
        if (entry) deleter = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🗑️ **Channel Deleted / حذف قناة**')
        .setDescription(`📌 **القناة المحذوفة:** ${channel.name}\n🛡️ **صاحب الفعل (By):** ${deleter}`)
        .setColor('#dc143c').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});


// ==========================================
// 2. نظام لوغ الرتب الشامل (Roles Logs)
// ==========================================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    // أولاً: فحص ألعاب Fizbo المكتوبة في الشات (إذا حدث تحديث رتب)
    const isGameChannel = GAME_CHANNELS.includes(newMember.id); // للاحتياط

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
            await wait(1000);
            let executor = 'مشرف غير معروف';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.first();
                if (entry && entry.target.id === newMember.id) executor = `${entry.executor.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➕ **Role Added / منح رتبة**')
                .setDescription(`👤 **الضحية (العضو):** ${newMember.user.tag}\n🏷️ **الرول:** ${role.name}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#00ff00').setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    if (removedRoles.size > 0) {
        for (const role of removedRoles.values()) {
            await wait(1000);
            let executor = 'مشرف غير معروف';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.first();
                if (entry && entry.target.id === newMember.id) executor = `${entry.executor.tag}`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➖ **Role Removed / نزع رول**')
                .setDescription(`👤 **الضحية (العضو):** ${newMember.user.tag}\n🏷️ **الرول:** ${role.name}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#ff0000').setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

client.on('roleCreate', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;
    await wait(1000);

    let creator = 'مشرف غير معروف';
    try {
        const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const entry = logs.entries.first();
        if (entry && entry.target.id === role.id) creator = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('✨ **Role Created / إنشاء رول**')
        .setDescription(`🏷️ **الرول:** ${role.name}\n🛡️ **صاحب الفعل (By):** ${creator}`)
        .setColor('#00ffff').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('roleDelete', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;
    await wait(1000);

    let deleter = 'مشرف غير معروف';
    try {
        const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const entry = logs.entries.first();
        if (entry) deleter = `${entry.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔥 **Role Deleted / حذف رول**')
        .setDescription(`🏷️ **الرول المحذوف:** ${role.name}\n🛡️ **صاحب الفعل (By):** ${deleter}`)
        .setColor('#ff4500').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});


// ==========================================
// 3. نظام ألعاب Fizbo والترفيه في الشات (الروليت، النقاط، والحدس)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const isGameChannel = GAME_CHANNELS.includes(message.channel.id);
    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // أمر الروليت: -روليت
    if (command === '-روليت') {
        if (!isGameChannel) {
            return message.reply({ content: '❌ ألعاب الروليت مخصصة فقط في رومات الألعاب المحددة!' }).catch(() => {});
        }

        const outcomes = [
            '🎉 مبروك! لقد ربحت **150 نقطة** في الروليت!',
            '🎉 واو! حظك أسطوري، ربحت **500 نقطة**!',
            '😢 حظاً أوفر، لقد خسرت رهانك في الروليت.',
            '🔥 لقد سحبت الحظ الفائز وربحت **1000 نقطة**!'
        ];
        const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];

        let points = userPoints.get(message.author.id) || 0;
        if (randomOutcome.includes('ربحت')) {
            const added = randomOutcome.includes('500') ? 500 : (randomOutcome.includes('1000') ? 1000 : 150);
            points += added;
        } else {
            points = Math.max(0, points - 50);
        }
        userPoints.set(message.author.id, points);

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🎰 **District Roulette / لعبة الروليت**')
            .setDescription(`👤 **اللاعب:** ${message.author}\n\n${randomOutcome}\n🎯 **رصيدك الجديد:** ${points} نقطة`)
            .setTimestamp();

        return message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    // أمر الاستعلام عن النقاط: -نقاط أو -رصيدي
    if (command === '-نقاط' || command === '-رصيدي') {
        if (!isGameChannel) return;
        const points = userPoints.get(message.author.id) || 0;
        return message.reply(`🎯 رصيدك الحالي من نقاط الألعاب هو: **${points} نقطة**`).catch(() => {});
    }

    // التحقق من الإجابة على لعبة Fizbo النشطة حالياً في الشانل
    if (isGameChannel && activeGames.has(message.channel.id)) {
        const currentGame = activeGames.get(message.channel.id);
        
        if (message.content.trim() === currentGame.answer) {
            activeGames.delete(message.channel.id);

            let points = userPoints.get(message.author.id) || 0;
            points += 20;
            userPoints.set(message.author.id, points);

            const winEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏆 **إجابة صحيحة وكفو!**')
                .setDescription(`كفو ${message.author}! سبقت الجميع وكانت إجابتك صحيحة (\`${currentGame.answer}\`).\n🎯 **تم إضافة 20 نقطة لرصيدك.**\n💎 **إجمالي رصيدك:** ${points} نقطة.`);

            return message.channel.send({ embeds: [winEmbed] }).catch(() => {});
        }
    }
});

// إرسال تحديات ألعاب Fizbo تلقائياً كل فترة في الشانلين
setInterval(async () => {
    for (const channelId of GAME_CHANNELS) {
        const channel = client.channels.cache.get(channelId);
        if (!channel) continue;

        if (!activeGames.has(channelId)) {
            const newGame = getRandomGame();
            activeGames.set(channelId, newGame);

            const gameEmbed = new EmbedBuilder()
                .setColor('#00ccff')
                .setTitle('⚡ **تحدي جديد من بوت Communauté**')
                .setDescription(`${newGame.question}\n\n*(أول شخص يكتب الإجابة الصحيحة في الشات يربح النقاط!)*`)
                .setTimestamp();

            channel.send({ embeds: [gameEmbed] }).catch(() => {});
        }
    }
}, 50000);


// ==========================================
// 4. الترحيب، المغادرة، التذاكر، وأوامر السلاش
// ==========================================
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get(CHANNELS.WELCOME);
    if (!channel) return;

    let invitedBy = 'Unknown / رابط مباشر أو غير معروف';
    try {
        const guildInvites = await member.guild.invites.fetch();
        const cachedInvites = invitesCache.get(member.guild.id);

        if (cachedInvites) {
            const usedInvite = guildInvites.find(inv => cachedInvites.get(inv.code) < inv.uses);
            if (usedInvite && usedInvite.inviter) {
                invitedBy = `${usedInvite.inviter.tag}`;
            }
        }
        invitesCache.set(member.guild.id, new Map(guildInvites.map((invite) => [invite.code, invite.uses])));
    } catch (err) {}

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTitle('🌹 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐂𝐎𝐌𝐌𝐔𝐍𝐀𝐔𝐓𝐄́! 🌹')
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n\n🎮 Choisis tes jeux et partage tes meilleurs moments avec nous.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: '👤 MEMBER', value: `${member}`, inline: true },
            { name: '📅 ACCOUNT CREATED', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '✨ MEMBER COUNT', value: `${member.guild.memberCount}`, inline: true },
            { name: '🌹 INVITED BY', value: `${invitedBy}`, inline: false }
        )
        .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] });
});

client.on('guildMemberRemove', async member => {
    const channel = member.guild.channels.cache.get(CHANNELS.GOODBYE);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#ff4747')
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTitle('👋 Goodbye from Communauté')
        .setDescription(`غادر العضو ${member} السيرفر. نتمنى له التوفيق!\n📊 عدد الأعضاء الحالي: **${member.guild.memberCount}**`)
        .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] });
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild } = interaction;

        if (commandName === 'join') {
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) return interaction.reply({ content: '❌ يجب أن تكون متواجداً في روم صوتي!', ephemeral: true });
            try {
                joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
                await interaction.reply({ content: `✅ تم انضمام البوت إلى روم الصوت: **${voiceChannel.name}**`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: '❌ حدث خطأ.', ephemeral: true });
            }
        }

        if (commandName === 'leave') {
            const connection = getVoiceConnection(guild.id);
            if (!connection) return interaction.reply({ content: '❌ البوت ليس متواجداً في أي روم صوتي!', ephemeral: true });
            try {
                connection.destroy();
                await interaction.reply({ content: '🚪 تم مغادرة البوت لروم الصوت.', ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: '❌ حدث خطأ.', ephemeral: true });
            }
        }

        if (commandName === 'ticket') {
            if (interaction.channel.id !== CHANNELS.TICKET_SETUP) return interaction.reply({ content: '❌ استخدم هذا الأمر في روم التذاكر المحدد!', ephemeral: true });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('اختر خيار التذكرة...')
                .addOptions([
                    { label: 'NEED HELP', description: 'للمساعدة العامة والاستفسارات.', value: 'ticket_help', emoji: '❓' },
                    { label: 'REPORTS', description: 'للإبلاغ عن المخالفات.', value: 'ticket_report', emoji: '🚨' },
                    { label: 'PARTNERSHIP', description: 'لطلب الشراكات.', value: 'ticket_partner', emoji: '🤝' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('الدعم الفني - Communauté')
                .setDescription('اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.');

            await interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'games-roles') {
            if (interaction.channel.id !== CHANNELS.GAMES_ROLES) return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#ffffff')
                .setTitle('🎮 Choisis tes jeux préférés !')
                .setDescription('تفاعل بالريأكشن المناسب بالأسفل للحصول على الرتبة!');
            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
            const emojis = ['🇨🇸', '🇻🇦', '🇫🇳', '🔥', '🚀', '👾', '⛏️', '🤖', '⚽', '🚗', '🏟️', '🏎️', '🖥️'];
            for (const emoji of emojis) { await msg.react(emoji).catch(() => {}); }
        }

        if (commandName === 'setup-roles') {
            if (interaction.channel.id !== CHANNELS.STATIC_ROLES) return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_districtian').setLabel('🌌 𝑫𝒊𝒔𝒕𝒓𝒊𝒄𝒕𝒊𝒂𝒏').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_minigames').setLabel('Mini Games 🎮').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('role_verify').setLabel('Verify ✅').setStyle(ButtonStyle.Success)
            );
            const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('🌟 أهلاً بك في سيرفر Communauté 🌟').setDescription('اضغط على الأزرار بالأسفل لتبدأ!');
            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('role_')) {
        await interaction.deferReply({ ephemeral: true });
        let roleId = '';
        if (interaction.customId === 'role_districtian') roleId = ROLES.DISTRICTIAN;
        if (interaction.customId === 'role_minigames') roleId = ROLES.MINI_GAMES;
        if (interaction.customId === 'role_verify') roleId = ROLES.VERIFY;

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ الرتبة غير موجودة!' });
        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            await interaction.editReply({ content: `✅ تمت إزالة رتبة **${role.name}** منك.` });
        } else {
            await member.roles.add(roleId);
            await interaction.editReply({ content: `✅ تم إعطاؤك رتبة **${role.name}** بنجاح!` });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const choice = interaction.values[0];
        let ticketName = 'ticket';
        let pingRoles = `<@&${ROLES.STAFF_SUPPORT}>`;

        if (choice === 'ticket_help') ticketName = 'help';
        if (choice === 'ticket_report') ticketName = 'report';
        if (choice === 'ticket_partner') { ticketName = 'partner'; pingRoles = `<@&${ROLES.PARTNER_1}> <@&${ROLES.PARTNER_2}>`; }

        const guild = interaction.guild;
        const member = interaction.member;

        const channel = await guild.channels.create({
            name: `${ticketName}-${member.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ROLES.STAFF_SUPPORT, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim 🙋‍♂️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close 🔒').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder().setColor('#ffffff').setTitle(`تذكرة جديدة: ${ticketName.toUpperCase()}`).setDescription(`مرحباً ${member}، تم فتح تذكرتك.`);
        await channel.send({ content: `${pingRoles} ${member}`, embeds: [embed], components: [ticketButtons] });
        await interaction.reply({ content: `✅ تم إنشاء تذكرتك: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `🙋‍♂️ تم استلام التذكرة بواسطة ${interaction.member}.` });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 سيتم إغلاق التذكرة...' });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
    }
});

client.login(process.env.TOKEN);
