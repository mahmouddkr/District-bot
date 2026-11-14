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
    client.user.setActivity('District RF Server', { type: 3 });

    for (const guild of client.guilds.cache.values()) {
        try {
            const firstInvites = await guild.invites.fetch();
            invitesCache.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (err) {
            console.error(`Could not fetch invites for guild ${guild.name}:`, err);
        }
    }

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

const ROLES = {
    STAFF_SUPPORT: '1561461730545115276',
    PARTNER_1: '1560523485850247168',
    PARTNER_2: '1560523789991813180',
    DISTRICTIAN: '1560723045222453269',
    MINI_GAMES: '1560453077058850927',
    VERIFY: '1560453481217785926',
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
const roleCooldown = new Set();
const messageLogCooldown = new Set();

// ==========================================
// 1. نظام لوغ السيرفر الشامل (Server Logs) مع تحديد الفاعل
// ==========================================

client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const banLog = fetchedLogs.entries.first();
        if (banLog && banLog.target.id === ban.user.id) executor = `${banLog.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`**User:** ${ban.user.tag}\n**By (المشرف):** ${executor}\n**Reason:** ${ban.reason || 'No reason provided'}`)
        .setColor('#8b0000')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanRemove', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    let executor = 'غير معروف';
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove });
        const unbanLog = fetchedLogs.entries.first();
        if (unbanLog && unbanLog.target.id === ban.user.id) executor = `${unbanLog.executor.tag}`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔓 **Member Unbanned / فك حظر عضو**')
        .setDescription(`**User:** ${ban.user.tag}\n**By (المشرف):** ${executor}`)
        .setColor('#00ff7f')
        .setTimestamp();

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

    // 1. خروج من الفويس
    if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔇 **Voice Disconnected / خروج من الفويس**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Left Channel:** ${oldState.channel?.name || 'Unknown'}`)
            .setColor('#ff9900')
            .setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    // 2. انضمام للفويس
    else if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔊 **Voice Joined / انضمام للفويس**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Joined Channel:** ${newState.channel?.name || 'Unknown'}`)
            .setColor('#00ccff')
            .setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    // 3. انتقل أو نُقل بين الرومات (Move)
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        let movedBy = `${member.user.tag} (انتقال ذاتي)`;
        try {
            const fetchedLogs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
            const moveLog = fetchedLogs.entries.first();
            if (moveLog && moveLog.target.id === member.id && (Date.now() - moveLog.createdTimestamp < 4000)) {
                movedBy = `${moveLog.executor.tag} (بواسطة مشرف)`;
            }
        } catch (err) {}

        const embed = new EmbedBuilder()
            .setTitle('🔀 **Voice Moved / نقل صوتي**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**From:** \`${oldState.channel?.name}\`\n**To:** \`${newState.channel?.name}\`\n**Moved By (بواسطة):** ${movedBy}`)
            .setColor('#9370db')
            .setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 4. Server Mute / Unmute
    if (oldState.serverMute !== newState.serverMute) {
        let mutedBy = 'مشرف غير معروف';
        try {
            const fetchedLogs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const mLog = fetchedLogs.entries.first();
            if (mLog && mLog.target.id === member.id && (Date.now() - mLog.createdTimestamp < 4000)) {
                mutedBy = mLog.executor.tag;
            }
        } catch (e) {}

        const status = newState.serverMute ? 'تم إعطاؤه Server Mute' : 'تم إزالة Server Mute عنه';
        const embed = new EmbedBuilder()
            .setTitle('🔇 **Server Mute Update / ميوت سيرفر**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Status:** ${status}\n**By (المشرف):** ${mutedBy}`)
            .setColor('#ff4500')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 5. Server Deafen / Undeafen
    if (oldState.serverDeaf !== newState.serverDeaf) {
        let deafBy = 'مشرف غير معروف';
        try {
            const fetchedLogs = await oldState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const dLog = fetchedLogs.entries.first();
            if (dLog && dLog.target.id === member.id && (Date.now() - dLog.createdTimestamp < 4000)) {
                deafBy = dLog.executor.tag;
            }
        } catch (e) {}

        const status = newState.serverDeaf ? 'تم إعطاؤه Server Deafen' : 'تم إزالة Server Deafen عنه';
        const embed = new EmbedBuilder()
            .setTitle('🎧 **Server Deafen Update / ديفن سيرفر**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Status:** ${status}\n**By (المشرف):** ${deafBy}`)
            .setColor('#4682b4')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;

    if (oldTimeout !== newTimeout) {
        let timeoutBy = 'مشرف غير معروف';
        try {
            const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const tLog = fetchedLogs.entries.first();
            if (tLog && tLog.target.id === newMember.id && (Date.now() - tLog.createdTimestamp < 4000)) {
                timeoutBy = tLog.executor.tag;
            }
        } catch (e) {}

        const embed = new EmbedBuilder().setTimestamp();
        if (newTimeout && newTimeout > Date.now()) {
            embed.setTitle('⏰ **Timeout Added / تعيين تايم أوت**')
                .setDescription(`**User:** ${newMember} (${newMember.user.tag})\n**By (المشرف):** ${timeoutBy}\n**Expires:** <t:${Math.floor(newTimeout / 1000)}:R>`)
                .setColor('#ff8c00');
            logChannel.send({ embeds: [embed] }).catch(() => {});
        } else if (!newTimeout && oldTimeout) {
            embed.setTitle('✅ **Timeout Removed / إزالة التايم أوت**')
                .setDescription(`**User:** ${newMember} (${newMember.user.tag})\n**By (المشرف):** ${timeoutBy}`)
                .setColor('#00fa9a');
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    let creator = 'مشرف غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const cLog = fetchedLogs.entries.first();
        if (cLog && cLog.target.id === channel.id) creator = cLog.executor.tag;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('📁 **Channel Created / إنشاء قناة**')
        .setDescription(`**Name:** ${channel.name}\n**Type:** ${channel.type}\n**By (المشرف):** ${creator}`)
        .setColor('#00ff7f')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const logChannel = channel.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    let deleter = 'مشرف غير معروف';
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const dLog = fetchedLogs.entries.first();
        if (dLog) deleter = dLog.executor.tag;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🗑️ **Channel Deleted / حذف قناة**')
        .setDescription(`**Name:** ${channel.name}\n**By (المشرف):** ${deleter}`)
        .setColor('#dc143c')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const logChannel = message.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const mKey = `del-${message.id}`;
    if (messageLogCooldown.has(mKey)) return;
    messageLogCooldown.add(mKey);
    setTimeout(() => messageLogCooldown.delete(mKey), 5000);

    const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ **Message Deleted / حذف رسالة**')
        .setDescription(`**Author:** ${message.author}\n**Channel:** ${message.channel}\n**Content:** \`${message.content || 'None'}\``)
        .setColor('#ff0000')
        .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const logChannel = oldMessage.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const mKey = `edit-${newMessage.id}`;
    if (messageLogCooldown.has(mKey)) return;
    messageLogCooldown.add(mKey);
    setTimeout(() => messageLogCooldown.delete(mKey), 5000);

    const logEmbed = new EmbedBuilder()
        .setTitle('✏️ **Message Edited / تعديل رسالة**')
        .setDescription(`**Author:** ${oldMessage.author}\n**Channel:** ${oldMessage.channel}\n\n**Before:** \`${oldMessage.content}\`\n**After:** \`${newMessage.content}\``)
        .setColor('#ffa500')
        .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(() => {});
});


// ==========================================
// 2. نظام لوغ الرتب الشامل (Roles Logs) مع تحديد الفاعل بدقة
// ==========================================

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
            const rKey = `add-${newMember.id}-${role.id}`;
            if (roleCooldown.has(rKey)) continue;
            roleCooldown.add(rKey);
            setTimeout(() => roleCooldown.delete(rKey), 5000);

            let executor = 'مشرف غير معروف';
            try {
                const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                const rLog = fetchedLogs.entries.first();
                if (rLog && rLog.target.id === newMember.id) executor = rLog.executor.tag;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➕ **Role Added / منح رتبة**')
                .setDescription(`**User (العضو):** ${newMember} (${newMember.user.tag})\n**Role (الرتبة):** ${role.name}\n**By (المشرف):** ${executor}`)
                .setColor('#00ff00')
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    if (removedRoles.size > 0) {
        for (const role of removedRoles.values()) {
            const rKey = `rem-${newMember.id}-${role.id}`;
            if (roleCooldown.has(rKey)) continue;
            roleCooldown.add(rKey);
            setTimeout(() => roleCooldown.delete(rKey), 5000);

            let executor = 'مشرف غير معروف';
            try {
                const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
                const rLog = fetchedLogs.entries.first();
                if (rLog && rLog.target.id === newMember.id) executor = rLog.executor.tag;
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➖ **Role Removed / إزالة رتبة**')
                .setDescription(`**User (العضو):** ${newMember} (${newMember.user.tag})\n**Role (الرتبة):** ${role.name}\n**By (المشرف):** ${executor}`)
                .setColor('#ff0000')
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

client.on('roleCreate', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    let creator = 'مشرف غير معروف';
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const cLog = fetchedLogs.entries.first();
        if (cLog && cLog.target.id === role.id) creator = cLog.executor.tag;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('✨ **Role Created / إنشاء رول**')
        .setDescription(`**Role Name:** ${role.name}\n**By (المشرف):** ${creator}`)
        .setColor('#00ffff')
        .setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('roleDelete', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    let deleter = 'مشرف غير معروف';
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const dLog = fetchedLogs.entries.first();
        if (dLog) deleter = dLog.executor.tag;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🔥 **Role Deleted / حذف رول**')
        .setDescription(`**Role Name:** ${role.name}\n**By (المشرف):** ${deleter}`)
        .setColor('#ff4500')
        .setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('roleUpdate', async (oldRole, newRole) => {
    const logChannel = newRole.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    let updater = 'مشرف غير معروف';
    try {
        const fetchedLogs = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate });
        const uLog = fetchedLogs.entries.first();
        if (uLog && uLog.target.id === newRole.id) updater = uLog.executor.tag;
    } catch (e) {}

    // تعديل الاسم أو اللون
    if (oldRole.name !== newRole.name || oldRole.hexColor !== newRole.hexColor) {
        const embed = new EmbedBuilder()
            .setTitle('✏️ **Role Updated / تعديل رول**')
            .setDescription(`**Role:** ${newRole.name}\n**Before Name:** ${oldRole.name} | **After Name:** ${newRole.name}\n**By (المشرف):** ${updater}`)
            .setColor('#ffd700')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // تعديل الصلاحيات (Permissions)
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
        const embed = new EmbedBuilder()
            .setTitle('🔐 **Role Permissions Updated / تعديل صلاحيات رول**')
            .setDescription(`**Role:** ${newRole.name}\n**By (المشرف):** ${updater}`)
            .setColor('#ff00ff')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // تغيير مكان وترتيب الرول (Position)
    if (oldRole.position !== newRole.position) {
        const embed = new EmbedBuilder()
            .setTitle('📊 **Role Position Changed / تغيير ترتيب رول**')
            .setDescription(`**Role:** ${newRole.name}\n**Old Position:** ${oldRole.position}\n**New Position:** ${newRole.position}\n**By (المشرف):** ${updater}`)
            .setColor('#da70d6')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});


// ==========================================
// 3. نظام الترحيب والمغادرة والتذاكر وألعاب السلاش
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
                invitedBy = `${usedInvite.inviter} (${usedInvite.inviter.tag})`;
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
                .setTitle('الدعم الفني - District')
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
            const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('🌟 أهلاً بك في سيرفر District 🌟').setDescription('اضغط على الأزرار بالأسفل لتبدأ!');
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
