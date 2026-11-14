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

// ==========================================
// 🛡️ نظام الحماية المتقدم لمنع انطفاء البوت (Anti-Crash)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [Anti-Crash] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ [Anti-Crash] Uncaught Exception:', err);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error('⚠️ [Anti-Crash] Uncaught Exception Monitor:', err, origin);
});

// خادم ويب لبقاء البوت شغال 24/7 في السحاب
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District System Bot is alive and running 24/7!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server is listening on port ${PORT}`);
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
    console.log(`✅ Logged in as ${client.user.tag}! District Bot is Online 24/7.`);
    
    // تعيين الحالة District 🌹
    client.user.setActivity('District 🌹', { type: 3 });

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
        console.log('✨ Successfully registered all Slash Commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// الأيدي الخاصة بالرومات والسيرفر واللوغ
const CHANNELS = {
    LOG: '1569093925266784286',          // روم لوغ السيرفر العام (Server Logs)
    ROLES_LOG: '1569094610217861171',   // روم لوغ الرتب (Roles Logs)
    TICKET_LOG: '1565678345037815899',  // روم سجل التذاكر المغلقة
    WELCOME: '1560689193733324910',     // روم الترحيب
    GOODBYE: '1569090865551638709',     // روم المغادرة
    TICKET_SETUP: '1559364091368181870',   // روم إرسال رسالة التذاكر
    STATIC_ROLES: '1565462147100844154',   // روم الرتب الثابتة
    GAMES_ROLES: '1560471208766476298'     // روم رتب الألعاب
};

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

const voiceCooldown = new Set();
const messageLogCooldown = new Set();

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. نظام لوغ السيرفر الشامل (Server Logs) مع التاغ الكامل
// ==========================================

// حظر عضو (Ban)
client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1200);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const entry = logs.entries.first();
        if (entry && entry.target.id === ban.user.id) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`👤 **الضحية:** <@${ban.user.id}>\n🛡️ **صاحب الفعل (By):** ${executor}\n📝 **السبب:** ${ban.reason || 'لا يوجد سبب'}`)
        .setColor('#8b0000').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// فك حظر عضو (Unban)
client.on('guildBanRemove', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;
    await wait(1200);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
        const entry = logs.entries.first();
        if (entry && entry.target.id === ban.user.id) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔓 **Member Unbanned / فك حظر**')
        .setDescription(`👤 **الضحية:** <@${ban.user.id}>\n🛡️ **صاحب الفعل (By):** ${executor}`)
        .setColor('#00ff7f').setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// طرد عضو (Kick) أو تيم آوت (Timeout)
client.on('guildAuditLogEntryCreate', async (auditLogEntry, guild) => {
    if (auditLogEntry.action === AuditLogEvent.MemberKick) {
        const logChannel = guild.channels.cache.get(CHANNELS.LOG);
        if (!logChannel) return;

        const target = auditLogEntry.target;
        const executor = auditLogEntry.executor;

        const embed = new EmbedBuilder()
            .setTitle('👢 **Member Kicked / طرد عضو**')
            .setDescription(`👤 **الضحية:** <@${target.id}>\n🛡️ **صاحب الفعل (By):** <@${executor.id}>\n📝 **السبب:** ${auditLogEntry.reason || 'لا يوجد سبب'}`)
            .setColor('#ff6600').setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    if (auditLogEntry.action === AuditLogEvent.MemberUpdate) {
        const logChannel = guild.channels.cache.get(CHANNELS.LOG);
        if (!logChannel) return;

        const target = auditLogEntry.target;
        const executor = auditLogEntry.executor;
        const changes = auditLogEntry.changes;

        const timeoutChange = changes.find(c => c.key === 'communication_disabled_until');
        if (timeoutChange) {
            const embed = new EmbedBuilder()
                .setTitle('⏳ **Member Timeout / إسكات مؤقت (Time out)**')
                .setDescription(`👤 **الضحية:** <@${target?.id}>\n🛡️ **صاحب الفعل (By):** <@${executor?.id}>\n⏰ **حتى:** ${timeoutChange.new ? `<t:${Math.floor(new Date(timeoutChange.new).getTime() / 1000)}:F>` : 'إزالة التيم آوت'}`)
                .setColor('#ffd700').setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

// الأحداث الصوتية في Server Logs (Disconnect, Move, Undeafen, Deafen, Mute)
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(CHANNELS.LOG) || newState.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const cooldownKey = `${member.id}-${oldState.channelId}-${newState.channelId}`;
    if (voiceCooldown.has(cooldownKey)) return;
    voiceCooldown.add(cooldownKey);
    setTimeout(() => voiceCooldown.delete(cooldownKey), 3000);

    // 1. فصل من الفويس (Disconnect)
    if (oldState.channelId && !newState.channelId) {
        await wait(1000);
        let discBy = `<@${member.id}> (خرج بنفسه)`;
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberDisconnect });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                discBy = `<@${entry.executor.id}> (تم طرده من الفويس بواسطة مشرف)`;
            }
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle('🔇 **Voice Disconnected / فصل أو خروج من الفويس**')
            .setDescription(`👤 **العضو:** <@${member.id}>\n🚪 **كان في روم:** \`${oldState.channel?.name}\`\n🛡️ **صاحب الفعل (By):** ${discBy}`)
            .setColor('#ff9900').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    // انضمام للفويس
    else if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔊 **Voice Joined / انضمام للفويس**')
            .setDescription(`👤 **العضو:** <@${member.id}>\n📥 **إلى روم:** \`${newState.channel?.name}\``)
            .setColor('#00ccff').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    // 2. نقل من روم لآخر (Move)
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await wait(1000);
        let movedBy = `<@${member.id}> (انتقال ذاتي)`;
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                movedBy = `<@${entry.executor.id}> (تم نقله بواسطة مشرف)`;
            }
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle('🔀 **Voice Moved / نقل صوتي بين الرومات**')
            .setDescription(`👤 **العضو:** <@${member.id}>\n📤 **من روم:** \`${oldState.channel?.name}\`\n📥 **إلى روم:** \`${newState.channel?.name}\`\n🛡️ **صاحب الفعل (By):** ${movedBy}`)
            .setColor('#9370db').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // Server Mute
    if (oldState.serverMute !== newState.serverMute) {
        await wait(1000);
        let mutedBy = 'مشرف غير معروف';
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                mutedBy = `<@${entry.executor.id}>`;
            }
        } catch (e) {}

        const status = newState.serverMute ? 'تم عمل Server Mute' : 'تم إزالة Server Mute';
        const embed = new EmbedBuilder()
            .setTitle('🔇 **Server Mute / ميوت سيرفر**')
            .setDescription(`👤 **الضحية:** <@${member.id}>\n⚡ **الحالة:** ${status}\n🛡️ **صاحب الفعل (By):** ${mutedBy}`)
            .setColor('#ff4500').setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 3. إلغاء الصمم (Undeafen) أو الصمم (Deafen)
    if (oldState.serverDeaf !== newState.serverDeaf) {
        await wait(1000);
        let deafBy = 'مشرف غير معروف';
        try {
            const logs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const entry = logs.entries.first();
            if (entry && entry.target.id === member.id && (Date.now() - entry.createdTimestamp < 5000)) {
                deafBy = `<@${entry.executor.id}>`;
            }
        } catch (e) {}

        const isUndeaf = !newState.serverDeaf;
        const statusTitle = isUndeaf ? '🎧 **Server Undeafen / إلغاء صمم السيرفر**' : '🎧 **Server Deafen / صمم السيرفر**';
        const statusDesc = isUndeaf ? 'تم إلغاء الصمم (Undeafen)' : 'تم تفعيل الصمم (Deafen)';

        const embed = new EmbedBuilder()
            .setTitle(statusTitle)
            .setDescription(`👤 **الضحية:** <@${member.id}>\n⚡ **الحالة:** ${statusDesc}\n🛡️ **صاحب الفعل (By):** ${deafBy}`)
            .setColor(isUndeaf ? '#00ff7f' : '#4682b4').setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});


// ==========================================
// 2. نظام لوغ الرتب (Roles Logs) مع التاغ الكامل والمشرف
// ==========================================

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
            await wait(1000);
            let executor = 'مشرف غير معروف (أو إزالة ذاتية / بوت)';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.find(e => e.target.id === newMember.id && (Date.now() - e.createdTimestamp < 10000));
                if (entry?.executor) executor = `<@${entry.executor.id}>`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➕ **Role Added / منح رتبة لعضو**')
                .setDescription(`👤 **العضو (الضحية):** <@${newMember.id}>\n🏷️ **الرول المضاف:** ${role}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#00ff00').setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    if (removedRoles.size > 0) {
        for (const role of removedRoles.values()) {
            await wait(1000);
            let executor = 'مشرف غير معروف (أو إزالة ذاتية / بوت)';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.find(e => e.target.id === newMember.id && (Date.now() - e.createdTimestamp < 10000));
                if (entry?.executor) executor = `<@${entry.executor.id}>`;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➖ **Role Removed / نزع رول من عضو**')
                .setDescription(`👤 **العضو (الضحية):** <@${newMember.id}>\n🏷️ **الرول المنزوع:** ${role}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#ff0000').setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

client.on('roleUpdate', async (oldRole, newRole) => {
    const logChannel = newRole.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;
    
    await wait(1500);

    let executor = 'غير مسجل';
    try {
        const logs = await newRole.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleUpdate });
        const entry = logs.entries.find(e => e.target?.id === newRole.id && (Date.now() - e.createdTimestamp < 15000));
        if (entry?.executor) {
            executor = `<@${entry.executor.id}>`;
        }
    } catch (e) {}

    let changes = [];

    if (oldRole.name !== newRole.name) {
        changes.push(`📌 **تغيير الاسم:** من \`${oldRole.name}\` إلى \`${newRole.name}\``);
    }

    if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`🎨 **تغيير اللون:** من \`${oldRole.hexColor}\` إلى \`${newRole.hexColor}\``);
    }

    if (oldRole.position !== newRole.position) {
        changes.push(`↕️ **تغيير الموقع (Move Role):** تم تحريك الرول من الترتيب \`${oldRole.position}\` إلى \`${newRole.position}\``);
    }

    const oldPerms = new PermissionsBitField(oldRole.permissions.bitfield);
    const newPerms = new PermissionsBitField(newRole.permissions.bitfield);

    const addedPerms = newPerms.toArray().filter(p => !oldPerms.has(p));
    const removedPerms = oldPerms.toArray().filter(p => !newPerms.has(p));

    if (addedPerms.length > 0) {
        changes.push(`✅ **الصلاحيات المضافة:** \`${addedPerms.join(', ')}\``);
    }

    if (removedPerms.length > 0) {
        changes.push(`❌ **الصلاحيات المنفية (المزالة):** \`${removedPerms.join(', ')}\``);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('🛠️ **Role Updated / تعديل رول**')
        .setDescription(`🏷️ **الرول المعدل:** ${newRole}\n\n${changes.join('\n')}\n\n🛡️ **صاحب الفعل (By):** ${executor}`)
        .setColor('#ffa500')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});


// ==========================================
// 3. الترحيب، المغادرة، والأوامر العامة والتذاكر (مع حل مشكلة App ne répond pas)
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
                invitedBy = `<@${usedInvite.inviter.id}>`;
            }
        }
        invitesCache.set(member.guild.id, new Map(guildInvites.map((invite) => [invite.code, invite.uses])));
    } catch (err) {}

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTitle('🌹 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓! 🌹')
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n\n🎮 Choisis tes jeux et partage tes meilleurs moments avec nous.\n\n❤️ مرحبًا بك في عائلة District!\n✨ هنا تبدأ المتعة، الصداقة والتحديات. نتمنى لك إقامة ممتعة معنا! 🏆`)
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
        .setTitle('👋 Goodbye from District')
        .setDescription(`غادر العضو ${member} السيرفر. نتمنى له التوفيق!\n📊 عدد الأعضاء الحالي: **${member.guild.memberCount}**`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] });
});

// الأوامر والتذاكر (محدثة بالكامل بمنع App ne répond pas)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild } = interaction;

        if (commandName === 'join') {
            await interaction.deferReply({ ephemeral: true });
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) return interaction.editReply({ content: '❌ يجب أن تكون متواجداً في روم صوتي!' });
            try {
                joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
                await interaction.editReply({ content: `✅ تم انضمام البوت إلى روم الصوت: **${voiceChannel.name}**` });
            } catch (error) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء محاولة الانضمام.' });
            }
        }

        if (commandName === 'leave') {
            await interaction.deferReply({ ephemeral: true });
            const connection = getVoiceConnection(guild.id);
            if (!connection) return interaction.editReply({ content: '❌ البوت ليس متواجداً في أي روم صوتي!' });
            try {
                connection.destroy();
                await interaction.editReply({ content: '🚪 تم مغادرة البوت لروم الصوت.' });
            } catch (error) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء المغادرة.' });
            }
        }

        if (commandName === 'ticket') {
            if (interaction.channel.id !== CHANNELS.TICKET_SETUP) {
                return interaction.reply({ content: '❌ استخدم هذا الأمر في روم التذاكر المحدد!', ephemeral: true });
            }

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
                .setTitle('الدعم الفني - District')
                .setDescription('اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.');

            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        await interaction.deferReply({ ephemeral: true });
        const choice = interaction.values[0];
        let ticketName = 'ticket';
        let pingRoles = `<@&${ROLES.STAFF_SUPPORT}>`;

        if (choice === 'ticket_help') ticketName = 'help';
        if (choice === 'ticket_report') ticketName = 'report';
        if (choice === 'ticket_partner') { ticketName = 'partner'; pingRoles = `<@&${ROLES.PARTNER_1}> <@&${ROLES.PARTNER_2}>`; }

        const guild = interaction.guild;
        const member = interaction.member;

        try {
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
            await interaction.editReply({ content: `✅ تم إنشاء تذكرتك: ${channel}` });
        } catch (err) {
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء روم التذكرة، تأكد من صلاحيات البوت.' });
        }
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
