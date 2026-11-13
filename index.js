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
    PermissionsBitField 
} = require('discord.js');
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
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// الأيدي الخاصة بالرومات والسيرفر واللوغ
const CHANNELS = {
    LOG: '1569093925266784286',          // روم لوغ السيرفر العام
    ROLES_LOG: '1569094610217861171',   // روم لوغ الرتب
    TICKET_LOG: '1565678345037815899',  // روم سجل التذاكر المغلقة
    WELCOME: '1560689193733324910',     // روم الترحيب
    GOODBYE: '1569090865551638709',     // روم المغادرة
    TICKET_SETUP: '1559364091368181870',   // روم إرسال رسالة التذاكر
    STATIC_ROLES: '1565462147100844154',   // روم الرتب الثابتة (!setup-roles)
    GAMES_ROLES: '1560471208766476298'     // روم رتب الألعاب (!games-roles)
};

// الأيدي الخاصة بالرتب للصلاحيات والتسليم
const ROLES = {
    STAFF_SUPPORT: '1561461730545115276', // رول الدعم لتذاكر Help و Report
    PARTNER_1: '1560523485850247168',     // رول الشراكات الأول
    PARTNER_2: '1560523789991813180',     // رول الشراكات الثاني
    DISTRICTIAN: '1560723045222453269',   // رول ديستريكتيان
    MINI_GAMES: '1560453077058850927',    // رول ميني قيمز
    VERIFY: '1560453481217785926',        // رول فيريفاي
    
    // رتب الألعاب الـ 13 بالترتيب
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

// حماية التكرار والسبام للوغ
const voiceCooldown = new Set();
const roleCooldown = new Set();
const messageLogCooldown = new Set();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}! District Bot is Online 24/7.`);
    client.user.setActivity('District RF Server', { type: 3 });
});

// ==========================================
// 1. نظام لوغ السيرفر (Server Logs)
// ==========================================

// حظر عضو
client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`**User:** ${ban.user.tag}\n**Reason:** ${ban.reason || 'No reason provided'}`)
        .setColor('#8b0000')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// تحديثات الفويس (دخول، خروج، وانتقال)
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(CHANNELS.LOG) || newState.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const cooldownKey = `${member.id}-${oldState.channelId}-${newState.channelId}`;
    if (voiceCooldown.has(cooldownKey)) return;
    voiceCooldown.add(cooldownKey);
    setTimeout(() => voiceCooldown.delete(cooldownKey), 5000);

    if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔇 **Voice Disconnect / خروج من الفويس**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Left Channel:** ${oldState.channel?.name || 'Unknown'}`)
            .setColor('#ff9900')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    } else if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔊 **Voice Join / انضمام للفويس**')
            .setDescription(`**User:** ${member} (${member.user.tag})\n**Joined Channel:** ${newState.channel?.name || 'Unknown'}`)
            .setColor('#00ccff')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

// حذف الرسائل
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

// تعديل الرسائل
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
// 2. نظام لوغ الرتب (Roles Logs)
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

            const embed = new EmbedBuilder()
                .setTitle('➕ **Role Added / منح رتبة**')
                .setDescription(`**User:** ${newMember} (${newMember.user.tag})\n**Role:** ${role.name}`)
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

            const embed = new EmbedBuilder()
                .setTitle('➖ **Role Removed / إزالة رتبة**')
                .setDescription(`**User:** ${newMember} (${newMember.user.tag})\n**Role:** ${role.name}`)
                .setColor('#ff0000')
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});


// ==========================================
// 3. نظام الترحيب والمغادرة
// ==========================================
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get(CHANNELS.WELCOME);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTitle('🌹 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓! 🎮')
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n\n🎮 Choisis tes jeux et partage tes meilleurs moments avec nous.\n\n❤️ مرحبًا بك في عائلة District!\n✨ هنا تبدأ المتعة، الصداقة والتحديات. نتمنى لك إقامة ممتعة معنا! 🏆`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: '👤 MEMBER', value: `${member}`, inline: true },
            { name: '📅 ACCOUNT CREATED', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '✨ MEMBER COUNT', value: `${member.guild.memberCount}`, inline: true }
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


// ==========================================
// 4. الأوامر المكتوبة (Setup Roles & Tickets)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // أمر رتب الألعاب
    if (message.content === '/games roles' || message.content === '!games-roles') {
        if (message.channel.id !== CHANNELS.GAMES_ROLES) return message.reply({ content: '❌ هذا ليس الروم المخصص لهذا الأمر!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setTitle('🎮 Choisis tes jeux préférés et récupère tes rôles ! 🎯🔥')
            .setDescription(`🌹 اختر ألعابك المفضلة واحصل على رتبها تلقائيًا ! 🎮⚡\n\n` +
                `:00000_purple_moon: **GAMES**\n\n` +
                `:cs2: ➔ <@&${ROLES.GAMES.cs2}>\n` +
                `:valo: ➔ <@&${ROLES.GAMES.valo}>\n` +
                `:fortnite: ➔ <@&${ROLES.GAMES.fortnite}>\n` +
                `:fire: ➔ <@&${ROLES.GAMES.fire}>\n` +
                `:rocket_leauge: ➔ <@&${ROLES.GAMES.rocket}>\n` +
                `:amongus: ➔ <@&${ROLES.GAMES.amongus}>\n` +
                `:minecraft: ➔ <@&${ROLES.GAMES.minecraft}>\n` +
                `:roblox: ➔ <@&${ROLES.GAMES.roblox}>\n` +
                `:soccer: ➔ <@&${ROLES.GAMES.soccer}>\n` +
                `:blue_car: ➔ <@&${ROLES.GAMES.bluecar}>\n` +
                `:pes: ➔ <@&${ROLES.GAMES.pes}>\n` +
                `:race_car: ➔ <@&${ROLES.GAMES.racecar}>\n` +
                `:fivem: ➔ <@&${ROLES.GAMES.fivem}>\n\n` +
                `🌹・𝑪𝒉𝒐𝒐𝒔𝒆 𝒀𝒐𝒖𝒓 𝑹𝒐𝒍𝒆`)
            .setFooter({ text: 'تفاعل بالريأكشن المناسب بالأسفل للحصول على الرتبة!' });

        const msg = await message.channel.send({ embeds: [embed] });
        message.delete().catch(() => {});

        const emojis = ['🇨🇸', '🇻🇦', '🇫🇳', '🔥', '🚀', '👾', '⛏️', '🤖', '⚽', '🚗', '🏟️', '🏎️', '🖥️'];
        for (const emoji of emojis) {
            await msg.react(emoji).catch(() => {});
        }
    }

    // أمر الرتب الثابتة
    if (message.content === '/setup roles' || message.content === '!setup-roles') {
        if (message.channel.id !== CHANNELS.STATIC_ROLES) return message.reply({ content: '❌ هذا ليس الروم المخصص لهذا الأمر!', ephemeral: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('role_districtian').setLabel('🌌 𝑫𝒊𝒔𝒕𝒓𝒊𝒄𝒕𝒊𝒂𝒏').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('role_minigames').setLabel('Mini Games 🎮').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('role_verify').setLabel('Verify ✅').setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🌟 أهلاً بك في سيرفر 🌹District 🌟')
            .setDescription('مرحباً بك يا صديقي في مجتمعنا!\n\n' +
                '✅ **Verify** : زر التحقق الأساسي؛ اضغط عليه لتأكيد دخولك، حماية السيرفر، وفتح جميع القنوات والرتب.\n' +
                '🌌 **Districtian** : الرول الرئيسي لكل أعضاء السيرفر لفتح الشات العام والتفاعل بحرية.\n' +
                '🎮 **Mini Games** : رول خاص بمحبي الألعاب للمشاركة في التحديات والفعاليات المصغرة\n\n' +
                '👇 اضغط على الأزرار بالأسفل لتبدأ معنا!');

        await message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(() => {});
    }

    // أمر التذاكر
    if (message.content === '/ticket' || message.content === '!setup-ticket') {
        if (message.channel.id !== CHANNELS.TICKET_SETUP) return message.reply({ content: '❌ يرجى استخدام هذا الأمر في روم التذاكر المحدد!', ephemeral: true });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('اختر خيار التذكرة...')
            .addOptions([
                { label: 'NEED HELP', description: 'للمساعدة العامة والاستفسارات والأوامر وقوانين السيرفر.', value: 'ticket_help', emoji: '❓' },
                { label: 'REPORTS', description: 'للإبلاغ عن المخالفات والمشاكل (بسرية تامة).', value: 'ticket_report', emoji: '🚨' },
                { label: 'PARTNERSHIP', description: 'لطلب الشراكات ونشر السيرفرات وتعريفها.', value: 'ticket_partner', emoji: '🤝' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setTitle('الدعم الفني - District')
            .setDescription('أهلاً بك في قسم الدعم لـ District. اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.\n\n' +
                '❓ **NEED HELP / الاستفسارات**\nللمساعدة العامة والأوامر وقوانين السيرفر.\n\n' +
                '🚨 **REPORTS / الإبلاغات**\nللإبلاغ عن المخالفات والمشاكل (بسرية تامة).\n\n' +
                '🤝 **PARTNERSHIP / الشراكات**\nلطلب الشراكات ونشر السيرفرات.\n\n' +
                '📌 يرجى فتح التذكرة فقط عند الحاجة لضمان أسرع خدمة.')
            .setImage('https://cdn.discordapp.com/attachments/1545845446172344422/1570914348078207006/IMG_1212.jpg?ex=6af8d37e&is=6af781fe&hm=c6b8b2cce5ecd32c1fab31c6b775a16d1592560222f0c9dbac5a8ec779304025&')
            .setFooter({ text: 'District Server © 2026' });

        await message.channel.send({ embeds: [embed], components: [row] });
        message.delete().catch(() => {});
    }
});


// ==========================================
// 5. التفاعلات (أزرار الرتب، التذاكر، والريأكشن)
// ==========================================
client.on('interactionCreate', async interaction => {
    // الأزرار للرتب الثابتة
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

    // القائمة المنسدلة للتذاكر
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_menu') {
        const choice = interaction.values[0];
        let ticketName = 'ticket';
        let pingRoles = `<@&${ROLES.STAFF_SUPPORT}>`;

        if (choice === 'ticket_help') ticketName = 'help';
        if (choice === 'ticket_report') ticketName = 'report';
        if (choice === 'ticket_partner') {
            ticketName = 'partner';
            pingRoles = `<@&${ROLES.PARTNER_1}> <@&${ROLES.PARTNER_2}>`;
        }

        const guild = interaction.guild;
        const member = interaction.member;

        const channel = await guild.channels.create({
            name: `${ticketName}-${member.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: ROLES.STAFF_SUPPORT, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: ROLES.PARTNER_1, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: ROLES.PARTNER_2, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            ],
        });

        const ticketButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim 🙋‍♂️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close 🔒').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setTitle(`تذكرة جديدة: ${ticketName.toUpperCase()}`)
            .setDescription(`مرحباً ${member}، تم فتح تذكرتك بنجاح.\nالرجاء الانتظار ريثما يرد عليك فريق الإدارة.`);

        await channel.send({ content: `${pingRoles} ${member}`, embeds: [embed], components: [ticketButtons] });
        await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${channel}`, ephemeral: true });
    }

    // أزرار داخل التذكرة (Claim & Close)
    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            const member = interaction.member;
            const hasPermission = member.roles.cache.has(ROLES.STAFF_SUPPORT) || member.roles.cache.has(ROLES.PARTNER_1) || member.roles.cache.has(ROLES.PARTNER_2);
            if (!hasPermission) {
                return interaction.reply({ content: '❌ عذراً، هذا الزر مخصص لفريق الإدارة فقط!', ephemeral: true });
            }
            await interaction.reply({ content: `🙋‍♂️ تم استلام التذكرة بواسطة ${member}.` });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 سيتم إغلاق التذكرة وحفظ السجل...' });
            
            const logChannel = interaction.guild.channels.cache.get(CHANNELS.TICKET_LOG);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#ff4747')
                    .setTitle('🔒 تذكرة مغلقة (Log)')
                    .setDescription(`تم إغلاق التذكرة **${interaction.channel.name}** بواسطة ${interaction.user.tag}`);
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }

            setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
        }
    }
});

// التفاعل بالريأكشن لرتب الألعاب
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const guild = reaction.message.guild;
    if (!guild) return;
    const member = guild.members.cache.get(user.id);
    if (!member) return;

    const emojiName = reaction.emoji.name;
    const roleMapEmoji = {
        '🇨🇸': ROLES.GAMES.cs2,
        '🇻🇦': ROLES.GAMES.valo,
        '🇫🇳': ROLES.GAMES.fortnite,
        '🔥': ROLES.GAMES.fire,
        '🚀': ROLES.GAMES.rocket,
        '👾': ROLES.GAMES.amongus,
        '⛏️': ROLES.GAMES.minecraft,
        '🤖': ROLES.GAMES.roblox,
        '⚽': ROLES.GAMES.soccer,
        '🚗': ROLES.GAMES.bluecar,
        '🏟️': ROLES.GAMES.pes,
        '🏎️': ROLES.GAMES.racecar,
        '🖥️': ROLES.GAMES.fivem
    };

    const roleId = roleMapEmoji[emojiName];
    if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
        }
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const guild = reaction.message.guild;
    if (!guild) return;
    const member = guild.members.cache.get(user.id);
    if (!member) return;

    const emojiName = reaction.emoji.name;
    const roleMapEmoji = {
        '🇨🇸': ROLES.GAMES.cs2,
        '🇻🇦': ROLES.GAMES.valo,
        '🇫🇳': ROLES.GAMES.fortnite,
        '🔥': ROLES.GAMES.fire,
        '🚀': ROLES.GAMES.rocket,
        '👾': ROLES.GAMES.amongus,
        '⛏️': ROLES.GAMES.minecraft,
        '🤖': ROLES.GAMES.roblox,
        '⚽': ROLES.GAMES.soccer,
        '🚗': ROLES.GAMES.bluecar,
        '🏟️': ROLES.GAMES.pes,
        '🏎️': ROLES.GAMES.racecar,
        '🖥️': ROLES.GAMES.fivem
    };

    const roleId = roleMapEmoji[emojiName];
    if (roleId) {
        const role = guild.roles.cache.get(roleId);
        if (role && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN);
