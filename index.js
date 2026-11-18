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
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction, Partials.User]
});

// تخزين الدعوات مؤقتاً لمعرفة من قام بالدعوة
const invitesCache = new Map();

// الأيدي الخاصة بالرومات
const CHANNELS = {
    LOG: '1569093925266784286',          
    ROLES_LOG: '1569094610217861171',   
    TICKET_LOG: '1565678345037815899',  
    WELCOME: '1560689193733324910',     
    GOODBYE: '1569090865551638709',     
    TICKET_SETUP: '1559364091368181870',   
    STATIC_ROLES: '1565462147100844154',   
    GAMES_ROLES: '1560471208766476298',
    CLUB_ROLES: '1571652064960839821',
    HOBBIES_ROLES: '1571672023317479505'     
};

// الأيدي الخاصة بالرتب
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
    },

    CLUBS: {
        'rma': '1571652873689763850',
        'fcb': '1571653166284546048',
        'psg': '1571653321326858271',
        'mci': '1571653464260616285',
        'arsenal': '1571653762005864528',
        'bayern': '1571653954595459192',
        'mca': '1571654308863152158',
        'mco': '1571654389695905832',
        'usma': '1571654560341032960'
    },

    HOBBIES: {
        'streamer': '1571675233138647210',
        'gamer': '1571675471459123292',
        'movie': '1571675600207216701',
        'music': '1571675726208307352',
        'football': '1571675867204165662',
        'developer': '1571676042534588506',
        'gym': '1571676203792994455',
        'designer': '1571676315722055691',
        'trading': '1571685695737565244'
    }
};

const voiceCooldown = new Set();
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

client.on('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}! District Bot is Online 24/7.`);
    client.user.setActivity('District 🌹', { type: 3 });

    for (const guild of client.guilds.cache.values()) {
        try {
            const firstInvites = await guild.invites.fetch().catch(() => null);
            if (firstInvites) {
                invitesCache.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
            }
        } catch (err) {
            console.error(`Could not fetch invites for guild ${guild.name}:`, err);
        }

        // ==========================================
        // 🚀 الإرسال التلقائي للوحات 
        // ==========================================
        try {
            // 1. إرسال لوحة التذاكر
            const ticketChannel = guild.channels.cache.get(CHANNELS.TICKET_SETUP);
            if (ticketChannel) {
                const messages = await ticketChannel.messages.fetch({ limit: 10 }).catch(() => null);
                const hasBotTicket = messages ? messages.some(m => m.author.id === client.user.id && m.components.length > 0) : false;
                
                if (!hasBotTicket) {
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('ticket_menu')
                        .setPlaceholder('اختر خيار التذكرة...')
                        .addOptions([
                            { label: 'NEED HELP', description: 'للمساعدة العامة والاستفسارات وقوانين السيرفر', value: 'ticket_help', emoji: '❓' },
                            { label: 'REPORTS', description: 'للإبلاغ عن المخالفات والمشاكل بسرية تامة', value: 'ticket_report', emoji: '🚨' },
                            { label: 'PARTNERSHIP', description: 'لتقديم طلبات الشراكة ونشر السيرفرات', value: 'ticket_partner', emoji: '🤝' }
                        ]);

                    const row = new ActionRowBuilder().addComponents(selectMenu);
                    const ticketEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('الدعم الفني - 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓')
                        .setDescription(
                            'أهلاً بك في قسم الدعم لـ District. اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.\n\n' +
                            '❓ **NEED HELP**\nللمساعدة العامة والاستفسارات وقوانين السيرفر.\n\n' +
                            '🚨 **REPORTS**\nللإبلاغ عن المخالفات والمشاكل بسرية تامة.\n\n' +
                            '🤝 **PARTNERSHIP**\nلتقديم طلبات الشراكة ونشر السيرفرات.'
                        )
                        .setImage('https://cdn.discordapp.com/attachments/1545845446172344422/1570914348078207006/IMG_1212.jpg?ex=6af8d37e&is=6af781fe&hm=c6b8b2cce5ecd32c1fab31c6b775a16d1592560222f0c9dbac5a8ec779304025&');

                    await ticketChannel.send({ embeds: [ticketEmbed], components: [row] }).catch(() => {});
                }
            }

            // 2. إرسال لوحة الرتب الثابتة
            const staticRolesChannel = guild.channels.cache.get(CHANNELS.STATIC_ROLES);
            if (staticRolesChannel) {
                const messages = await staticRolesChannel.messages.fetch({ limit: 10 }).catch(() => null);
                const hasBotRoles = messages ? messages.some(m => m.author.id === client.user.id && m.components.length > 0) : false;

                if (!hasBotRoles) {
                    const rolesEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle('🌟 أهلاً بك في سيرفر 🌹 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓 🌟')
                        .setDescription(
                            'مرحباً بك يا صديقي في مجتمعنا!\n\n' +
                            '✅ **Verify** : زر التحقق الأساسي؛ اضغط عليه لتأكيد دخولك.\n' +
                            '🌌 **Districtian** : الرول الرئيسي لكل أعضاء السيرفر.\n' +
                            '🎮 **Mini Games** : رول خاص بمحبي الألعاب.\n\n' +
                            'اضغط على الأزرار بالأسفل لتبدأ معنا! 👇'
                        );

                    const rowRoles = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('role_districtian').setLabel('🌌 𝑫𝒊𝒔𝒕𝒓𝒊𝒄𝒕𝒊𝒂𝒏').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('role_minigames').setLabel('𝐌𝐢𝐧𝐢 𝐆𝐚𝐦𝐞𝐬 🎮').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('role_verify').setLabel('𝐕𝐄𝐑𝐈𝐅𝐘 ✅').setStyle(ButtonStyle.Success)
                    );

                    await staticRolesChannel.send({ embeds: [rolesEmbed], components: [rowRoles] }).catch(() => {});
                }
            }

            // 3. إرسال لوحة رتب الألعاب
            const gamesRolesChannel = guild.channels.cache.get(CHANNELS.GAMES_ROLES);
            if (gamesRolesChannel) {
                const messages = await gamesRolesChannel.messages.fetch({ limit: 5 }).catch(() => null);
                const hasGameMsg = messages ? messages.some(m => m.author.id === client.user.id && m.embeds.length > 0) : false;

                if (!hasGameMsg) {
                    const gamesEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setDescription(
                            `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                            `### 🌹 اختر ألعابك المفضلة واحصل على رتبها تلقائيًا !\n\n` +
                            `## 𝑮𝑨𝑴𝑬𝑺 🌑\n\n` +
                            `<:CS2:1571567392373346405> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.cs2}>\n` +
                            `<:Valorant:1571567223259271319> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.valo}>\n` +
                            `<:emoji_6:1571337470816165968> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fortnite}>\n` +
                            `<:Free_Fire:1571338358452519034> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fire}>\n` +
                            `<:RocketLeague:1571339257149263872> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.rocket}>\n` +
                            `<:Amongus:1571565515535814819> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.amongus}>\n` +
                            `<:emoji_12:1571562285267419337> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.minecraft}>\n` +
                            `<:Roblox:1571566690062442671> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.roblox}>\n` +
                            `<:EaSportFc:1571568452232024155> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.soccer}>\n` +
                            `<:Asseto_Corsa:1571567502343798905> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.bluecar}>\n` +
                            `<:emoji_12:1571566973022638230> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.pes}>\n` +
                            `<:Forza_Horizon:1571568011859468328> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.racecar}>\n` +
                            `<:Fivem:1571598558422110331> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fivem}>`
                        );

                    const sentMsg = await gamesRolesChannel.send({ embeds: [gamesEmbed] }).catch(() => {});
                    if (sentMsg) {
                        const emojisToReact = [
                            '1571567392373346405', '1571567223259271319', '1571337470816165968',
                            '1571338358452519034', '1571339257149263872', '1571565515535814819',
                            '1571562285267419337', '1571566690062442671', '1571568452232024155',
                            '1571567502343798905', '1571566973022638230', '1571568011859468328',
                            '1571598558422110331'
                        ];
                        for (const emId of emojisToReact) {
                            await sentMsg.react(emId).catch(() => {});
                        }
                    }
                }
            }

            // 4. إرسال لوحة أندية كرة القدم
            const clubRolesChannel = guild.channels.cache.get(CHANNELS.CLUB_ROLES);
            if (clubRolesChannel) {
                const messages = await clubRolesChannel.messages.fetch({ limit: 5 }).catch(() => null);
                const hasClubMsg = messages ? messages.some(m => m.author.id === client.user.id && m.embeds.length > 0) : false;

                if (!hasClubMsg) {
                    const clubEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setDescription(
                            `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                            `### 🌹 اختر ناديك المفضل واحصل على رتبته تلقائيًا !\n\n` +
                            `## 𝐂𝐋𝐔𝐁𝐒 🌍\n\n` +
                            `<:RMA:1571660508053114912> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.rma}>\n` +
                            
                            `<:FCB:1571660548615966781> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.fcb}>\n` +
                            
                            `<:PSG:1571659218761687232> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.psg}>\n` +
                            
                            `<:MCI:1571663050124038254> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mci}>\n` +
                            
                            `<:Arsenal:1571663557207265290> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.arsenal}>\n` +
                            
                            `<:Bayern_Munich:1571663424763461754> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.bayern}>\n` +
                            
                            `<:MCA:1571659714188808282> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mca}>\n` +
                            
                            `<:MCO:1571659571003392082> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mco}>\n` +
                            
                            `<:USMA:1571659813442691173> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.usma}>`
                        );

                    const sentClubMsg = await clubRolesChannel.send({ embeds: [clubEmbed] }).catch(() => {});
                    if (sentClubMsg) {
                        const clubEmojis = [
                            '1571660508053114912', '1571660548615966781', '1571659218761687232',
                            '1571663050124038254', '1571663557207265290', '1571663424763461754',
                            '1571659714188808282', '1571659571003392082', '1571659813442691173'
                        ];
                        for (const emId of clubEmojis) {
                            await sentClubMsg.react(emId).catch(() => {});
                        }
                    }
                }
            }

            // 5. إرسال لوحة الهوايات (Hobbies Roles)
            const hobbiesRolesChannel = guild.channels.cache.get(CHANNELS.HOBBIES_ROLES);
            if (hobbiesRolesChannel) {
                const messages = await hobbiesRolesChannel.messages.fetch({ limit: 5 }).catch(() => null);
                const hasHobbiesMsg = messages ? messages.some(m => m.author.id === client.user.id && m.embeds.length > 0) : false;

                if (!hasHobbiesMsg) {
                    const hobbiesEmbed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setDescription(
                            `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                            `### 🌹 اختر اهتماماتك المفضلة واحصل على رتبك تلقائيًا !\n\n` +
                            `## 𝐇𝐎𝐁𝐁𝐈𝐄𝐒 ⭐\n\n` +
                            `<:Streamer:1571681414498488361> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.streamer}>\n` +
                            
                            `<:Gamer:1571681755969229013> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.gamer}>\n` +
                            
                            `<:Football:1571683136495165500> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.football}>\n` +
                            
                            `<:Movie:1571682278030184519> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.movie}>\n` +
                            
                            `<:Music:1571682535371706429> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.music}>\n` +
                            
                            `<:Devloper:1571686904263348476> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.developer}>\n` +
                            
                            `<:Gym:1571684136144605225> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.gym}>\n` +
                            
                            `<:Designer:1571686439706697738> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.designer}>\n` +
                            
                            `<:Trading:1571685791472812163> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.trading}>`
                        );

                    const sentHobbiesMsg = await hobbiesRolesChannel.send({ embeds: [hobbiesEmbed] }).catch(() => {});
                    if (sentHobbiesMsg) {
                        const hobbiesEmojis = [
                            '1571681414498488361', '1571681755969229013', '1571683136495165500',
                            '1571682278030184519', '1571682535371706429', '1571686904263348476',
                            '1571684136144605225', '1571686439706697738', '1571685791472812163'
                        ];
                        for (const emId of hobbiesEmojis) {
                            await sentHobbiesMsg.react(emId).catch(() => {});
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error auto-sending panels:', e);
        }
    }

    // تسجيل أوامر السلاش
    const commands = [
        new SlashCommandBuilder().setName('join').setDescription('دخول البوت إلى روم الصوت الخاص بك'),
        new SlashCommandBuilder().setName('leave').setDescription('خروج البوت من روم الصوت'),
        new SlashCommandBuilder().setName('ticket').setDescription('إرسال لوحة نظام التذاكر والدعم الفني'),
        new SlashCommandBuilder().setName('games-roles').setDescription('إرسال لوحة اختيار رتب الألعاب'),
        new SlashCommandBuilder().setName('club-roles').setDescription('إرسال لوحة اختيار رتب الأندية'),
        new SlashCommandBuilder().setName('hobbies-roles').setDescription('إرسال لوحة اختيار رتب الهوايات والاهتمامات'),
        new SlashCommandBuilder().setName('setup-roles').setDescription('إرسال لوحة أزرار الرتب الثابتة')
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✨ Successfully registered all Slash Commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// ==========================================
// 1. نظام لوغ السيرفر والرتب والتعديلات (Role & Server Logs)
// ==========================================
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

// مراقبة إنشاء رول جديد
client.on('roleCreate', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;
    await wait(1500);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await role.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleCreate });
        const entry = logs.entries.find(e => e.target?.id === role.id && (Date.now() - e.createdTimestamp < 15000));
        if (entry?.executor) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('➕ **Role Created / إنشاء رول جديد**')
        .setDescription(`🏷️ **الرول:** ${role}\n🛡️ **صاحب الفعل (By):** ${executor}`)
        .setColor('#00ff00')
        .setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// مراقبة حذف رول
client.on('roleDelete', async role => {
    const logChannel = role.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;
    await wait(1500);

    let executor = 'مشرف غير معروف';
    try {
        const logs = await role.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleDelete });
        const entry = logs.entries.find(e => e.target?.id === role.id && (Date.now() - e.createdTimestamp < 15000));
        if (entry?.executor) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const embed = new EmbedBuilder()
        .setTitle('🗑️ **Role Deleted / حذف رول**')
        .setDescription(`🏷️ **اسم الرول المحذوف:** \`${role.name}\`\n🛡️ **صاحب الفعل (By):** ${executor}`)
        .setColor('#ff0000')
        .setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// مراقبة تعديل الرولات (تغيير الصلاحيات المسموحة والممنوعة + تحريك الترتيب)
client.on('roleUpdate', async (oldRole, newRole) => {
    const guild = newRole.guild;
    const logChannel = guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    await wait(1500);
    let executor = 'مشرف غير معروف';

    // 1. مراقبة تغيير الصلاحيات (Permissions) أو الاسم
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield || oldRole.name !== newRole.name) {
        try {
            const logs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleUpdate });
            const entry = logs.entries.find(e => e.target?.id === newRole.id && (Date.now() - e.createdTimestamp < 15000));
            if (entry?.executor) executor = `<@${entry.executor.id}>`;
        } catch (e) {}

        let changes = [];
        if (oldRole.name !== newRole.name) {
            changes.push(`📌 **تغيير الاسم:** من \`${oldRole.name}\` إلى \`${newRole.name}\``);
        }

        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const oldPerms = new PermissionsBitField(oldRole.permissions.bitfield);
            const newPerms = new PermissionsBitField(newRole.permissions.bitfield);

            const addedPerms = newPerms.toArray().filter(p => !oldPerms.has(p));
            const removedPerms = oldPerms.toArray().filter(p => !newPerms.has(p));

            if (addedPerms.length > 0) {
                changes.push(`✅ **تم السماح (Allow):** \`${addedPerms.join(', ')}\``);
            }
            if (removedPerms.length > 0) {
                changes.push(`❌ **تم الرفض/الإزالة (Deny/Remove):** \`${removedPerms.join(', ')}\``);
            }
        }

        if (changes.length === 0) return;

        const embed = new EmbedBuilder()
            .setTitle('🛠️ **Role Permissions Updated / تعديل صلاحيات رول**')
            .setDescription(`🏷️ **الرول المعدل:** ${newRole}\n\n${changes.join('\n')}\n\n🛡️ **صاحب الفعل (By):** ${executor}`)
            .setColor('#e67e22')
            .setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // 2. مراقبة تحريك مكان رول (الترتيب)
    if (oldRole.position !== newRole.position) {
        try {
            const logs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleUpdate });
            const entry = logs.entries.find(e => e.target?.id === newRole.id && (Date.now() - e.createdTimestamp < 15000));
            if (entry?.executor) executor = `<@${entry.executor.id}>`;
        } catch (e) {}

        const sortedRoles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
        const oldIndex = sortedRoles.findIndex(r => r.id === oldRole.id) + 1;
        const newIndex = sortedRoles.findIndex(r => r.id === newRole.id) + 1;

        if (oldIndex === newIndex) return;

        const embed = new EmbedBuilder()
            .setTitle('↕️ **Role Position Updated / تغيير ترتيب رول**')
            .setDescription(
                `🏷️ **الرول المتحرك:** ${newRole}\n` +
                `📊 **من الترتيب:** \`${oldIndex}\` ➔ **إلى الترتيب:** \`${newIndex}\`\n\n` +
                `🛡️ **صاحب الفعل (By):** ${executor}`
            )
            .setColor('#3498db')
            .setTimestamp();

        return logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    const logChannel = newChannel.guild.channels.cache.get(CHANNELS.LOG);
    if (!logChannel) return;

    await wait(1500);
    let executor = 'مشرف غير معروف';
    try {
        const logs = await newChannel.guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.ChannelOverwriteUpdate });
        const entry = logs.entries.find(e => e.target?.id === newChannel.id && (Date.now() - e.createdTimestamp < 15000));
        if (entry?.executor) executor = `<@${entry.executor.id}>`;
    } catch (e) {}

    const oldOverwrites = oldChannel.permissionOverwrites.cache;
    const newOverwrites = newChannel.permissionOverwrites.cache;
    let changesDescription = [];

    if (oldChannel.name !== newChannel.name) {
        changesDescription.push(`📌 **تغيير اسم الروم:** من \`${oldChannel.name}\` إلى \`${newChannel.name}\``);
    }

    newOverwrites.forEach((newOv, id) => {
        const oldOv = oldOverwrites.get(id);
        const targetName = newOv.type === 0 ? `<@&${id}>` : `<@${id}>`;

        if (!oldOv) {
            changesDescription.push(`➕ **إضافة صلاحيات لـ ${targetName}**`);
        } else {
            const addedAllow = newOv.allow.toArray().filter(p => !oldOv.allow.has(p));
            const removedAllow = oldOv.allow.toArray().filter(p => !newOv.allow.has(p));
            const addedDeny = newOv.deny.toArray().filter(p => !oldOv.deny.has(p));
            const removedDeny = oldOv.deny.toArray().filter(p => !newOv.deny.has(p));

            if (addedAllow.length > 0) changesDescription.push(`✅ **السماح بصلاحيات لـ ${targetName}:** \`${addedAllow.join(', ')}\``);
            if (removedAllow.length > 0) changesDescription.push(`❌ **إزالة صلاحيات السماح لـ ${targetName}:** \`${removedAllow.join(', ')}\``);
            if (addedDeny.length > 0) changesDescription.push(`⛔ **منع صلاحيات لـ ${targetName}:** \`${addedDeny.join(', ')}\``);
            if (removedDeny.length > 0) changesDescription.push(`🔄 **إزالة المنع لـ ${targetName}:** \`${removedDeny.join(', ')}\``);
        }
    });

    if (changesDescription.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('🔐 **Channel Permissions Updated / تعديل صلاحيات روم**')
        .setDescription(`📢 **الروم المعدل:** <#${newChannel.id}>\n🛡️ **صاحب الفعل (By):** ${executor}\n\n${changesDescription.join('\n')}`)
        .setColor('#00bcd4')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

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
    else if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setTitle('🔊 **Voice Joined / انضمام للفويس**')
            .setDescription(`👤 **العضو:** <@${member.id}>\n📥 **إلى روم:** \`${newState.channel?.name}\``)
            .setColor('#00ccff').setTimestamp();
        return logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
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
});

// مراقبة تعديل رولات الأعضاء (تتجاهل تماماً البروفايل، الاسم، أو الديكور ولا تسجل إلا الإزالة أو الإضافة الحقيقية)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(CHANNELS.ROLES_LOG);
    if (!logChannel) return;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    // إذا لم تتغير أيدي الرولات مطلقاً (أي تم تغيير الصورة أو الاسم أو البوستر فقط)، يتم الخروج فوراً
    if (oldRoles.size === newRoles.size && oldRoles.every(role => newRoles.has(role.id))) {
        return;
    }

    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
            await wait(2000);
            let executor = 'مشرف غير معروف';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.find(e => e.target.id === newMember.id && (Date.now() - e.createdTimestamp < 20000));
                if (entry?.executor) {
                    executor = `<@${entry.executor.id}>`;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➕ **Role Added / منح رتبة لعضو**')
                .setDescription(`👤 **العضو:** <@${newMember.id}>\n🏷️ **الرول المضاف:** ${role}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#00ff00')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }

    if (removedRoles.size > 0) {
        for (const role of removedRoles.values()) {
            await wait(2000);
            let executor = 'مشرف غير معروف';
            try {
                const logs = await newMember.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberRoleUpdate });
                const entry = logs.entries.find(e => e.target.id === newMember.id && (Date.now() - e.createdTimestamp < 20000));
                if (entry?.executor) {
                    executor = `<@${entry.executor.id}>`;
                }
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setTitle('➖ **Role Removed / نزع رول من عضو**')
                .setDescription(`👤 **العضو:** <@${newMember.id}>\n🏷️ **الرول المنزوع:** ${role}\n🛡️ **صاحب الفعل (By):** ${executor}`)
                .setColor('#ff0000')
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    }
});

// ==========================================
// 2. خرائط تفاعلات الرتب والألعاب والأندية والهوايات
// ==========================================
const reactionRoleMap = {
    // الألعاب
    '1571567392373346405': ROLES.GAMES.cs2,
    '1571567223259271319': ROLES.GAMES.valo,
    '1571337470816165968': ROLES.GAMES.fortnite,
    '1571338358452519034': ROLES.GAMES.fire,
    '1571339257149263872': ROLES.GAMES.rocket,
    '1571565515535814819': ROLES.GAMES.amongus,
    '1571562285267419337': ROLES.GAMES.minecraft,
    '1571566690062442671': ROLES.GAMES.roblox,
    '1571568452232024155': ROLES.GAMES.soccer,
    '1571567502343798905': ROLES.GAMES.bluecar,
    '1571566973022638230': ROLES.GAMES.pes,
    '1571568011859468328': ROLES.GAMES.racecar,
    '1571598558422110331': ROLES.GAMES.fivem,

    // الأندية
    '1571660508053114912': ROLES.CLUBS.rma,
    '1571660548615966781': ROLES.CLUBS.fcb,
    '1571659218761687232': ROLES.CLUBS.psg,
    '1571663050124038254': ROLES.CLUBS.mci,
    '1571663557207265290': ROLES.CLUBS.arsenal,
    '1571663424763461754': ROLES.CLUBS.bayern,
    '1571659714188808282': ROLES.CLUBS.mca,
    '1571659571003392082': ROLES.CLUBS.mco,
    '1571659813442691173': ROLES.CLUBS.usma,

    // الهوايات والاهتمامات (Hobbies)
    '1571681414498488361': ROLES.HOBBIES.streamer,
    '1571681755969229013': ROLES.HOBBIES.gamer,
    '1571683136495165500': ROLES.HOBBIES.football,
    '1571682278030184519': ROLES.HOBBIES.movie,
    '1571682535371706429': ROLES.HOBBIES.music,
    '1571686904263348476': ROLES.HOBBIES.developer,
    '1571684136144605225': ROLES.HOBBIES.gym,
    '1571686439706697738': ROLES.HOBBIES.designer,
    '1571685791472812163': ROLES.HOBBIES.trading
};

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    if ([CHANNELS.GAMES_ROLES, CHANNELS.CLUB_ROLES, CHANNELS.HOBBIES_ROLES].includes(reaction.message.channel.id)) {
        const emojiKey = reaction.emoji.id;
        const roleId = reactionRoleMap[emojiKey];
        if (!roleId) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => {});
        if (member) {
            await member.roles.add(roleId).catch(() => {});
        }
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

    if ([CHANNELS.GAMES_ROLES, CHANNELS.CLUB_ROLES, CHANNELS.HOBBIES_ROLES].includes(reaction.message.channel.id)) {
        const emojiKey = reaction.emoji.id;
        const roleId = reactionRoleMap[emojiKey];
        if (!roleId) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => {});
        if (member) {
            await member.roles.remove(roleId).catch(() => {});
        }
    }
});

// ==========================================
// 3. الترحيب، المغادرة، والأوامر
// ==========================================
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get(CHANNELS.WELCOME);
    if (!channel) return;

    let invitedBy = 'Unknown / رابط مباشر';
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
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n\n❤️ مرحبًا بك في عائلة District! نتمنى لك إقامة ممتعة معنا! 🏆`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: '👤 MEMBER', value: `${member}`, inline: true },
            { name: '📅 ACCOUNT CREATED', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '✨ MEMBER COUNT', value: `${member.guild.memberCount}`, inline: true },
            { name: '🌹 INVITED BY', value: `${invitedBy}`, inline: false }
        )
        .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
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

    await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

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
                await interaction.editReply({ content: '❌ حدث خطأ أثناء الانضمام.' });
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
            await interaction.deferReply({ ephemeral: true });
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_menu')
                .setPlaceholder('اختر خيار التذكرة...')
                .addOptions([
                    { label: 'NEED HELP', description: 'للمساعدة العامة والاستفسارات وقوانين السيرفر', value: 'ticket_help', emoji: '❓' },
                    { label: 'REPORTS', description: 'للإبلاغ عن المخالفات والمشاكل بسرية تامة', value: 'ticket_report', emoji: '🚨' },
                    { label: 'PARTNERSHIP', description: 'لتقديم طلبات الشراكة ونشر السيرفرات', value: 'ticket_partner', emoji: '🤝' }
                ]);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('الدعم الفني - 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓')
                .setDescription(
                    'أهلاً بك في قسم الدعم لـ District. اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.\n\n' +
                    '❓ **NEED HELP**\nللمساعدة العامة والاستفسارات وقوانين السيرفر.\n\n' +
                    '🚨 **REPORTS**\nللإبلاغ عن المخالفات والمشاكل بسرية تامة.\n\n' +
                    '🤝 **PARTNERSHIP**\nلتقديم طلبات الشراكة ونشر السيرفرات.'
                )
                .setImage('https://cdn.discordapp.com/attachments/1545845446172344422/1570914348078207006/IMG_1212.jpg?ex=6af8d37e&is=6af781fe&hm=c6b8b2cce5ecd32c1fab31c6b775a16d1592560222f0c9dbac5a8ec779304025&');
            await interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setup-roles') {
            if (interaction.channel.id !== CHANNELS.STATIC_ROLES) {
                return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🌟 أهلاً بك في سيرفر 🌹 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓 🌟')
                .setDescription(
                    'مرحباً بك يا صديقي في مجتمعنا!\n\n' +
                    '✅ **Verify** : زر التحقق الأساسي؛ اضغط عليه لتأكيد دخولك.\n' +
                    '🌌 **Districtian** : الرول الرئيسي لكل أعضاء السيرفر.\n' +
                    '🎮 **Mini Games** : رول خاص بمحبي الألعاب.\n\n' +
                    'اضغط على الأزرار بالأسفل لتبدأ معنا! 👇'
                );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('role_districtian').setLabel('🌌 𝑫𝒊𝒔𝒕𝒓𝒊𝒄𝒕𝒊𝒂𝒏').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('role_minigames').setLabel('𝐌𝐢𝐧𝐢 𝐆𝐚𝐦𝐞𝐬 🎮').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('role_verify').setLabel('𝐕𝐄𝐑𝐈𝐅𝐘 ✅').setStyle(ButtonStyle.Success)
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'games-roles') {
            if (interaction.channel.id !== CHANNELS.GAMES_ROLES) {
                return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 50 });
                await interaction.channel.bulkDelete(fetched, true).catch(() => {});
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setDescription(
                    `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                    `### 🌹 اختر ألعابك المفضلة واحصل على رتبها تلقائيًا !\n\n` +
                    `## 𝑮𝑨𝑴𝑬𝑺 🌑\n\n` +
                    `<:CS2:1571567392373346405> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.cs2}>\n` +
                    `<:Valorant:1571567223259271319> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.valo}>\n` +
                    `<:emoji_6:1571337470816165968> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fortnite}>\n` +
                    `<:Free_Fire:1571338358452519034> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fire}>\n` +
                    `<:RocketLeague:1571339257149263872> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.rocket}>\n` +
                    `<:Amongus:1571565515535814819> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.amongus}>\n` +
                    `<:emoji_12:1571562285267419337> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.minecraft}>\n` +
                    `<:Roblox:1571566690062442671> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.roblox}>\n` +
                    `<:EaSportFc:1571568452232024155> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.soccer}>\n` +
                    `<:Asseto_Corsa:1571567502343798905> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.bluecar}>\n` +
                    `<:emoji_12:1571566973022638230> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.pes}>\n` +
                    `<:Forza_Horizon:1571568011859468328> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.racecar}>\n` +
                    `<:Fivem:1571598558422110331> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.GAMES.fivem}>`
                );

            const sentMsg = await interaction.channel.send({ embeds: [embed] });
            const emojisToReact = [
                '1571567392373346405', '1571567223259271319', '1571337470816165968',
                '1571338358452519034', '1571339257149263872', '1571565515535814819',
                '1571562285267419337', '1571566690062442671', '1571568452232024155',
                '1571567502343798905', '1571566973022638230', '1571568011859468328',
                '1571598558422110331'
            ];
            for (const emId of emojisToReact) {
                await sentMsg.react(emId).catch(() => {});
            }
            await interaction.editReply({ content: '✅ تم إرسال لوحة رتب الألعاب بنجاح!' });
        }

        if (commandName === 'club-roles') {
            if (interaction.channel.id !== CHANNELS.CLUB_ROLES) {
                return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 50 });
                await interaction.channel.bulkDelete(fetched, true).catch(() => {});
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setDescription(
                    `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                    `### 🌹 اختر ناديك المفضل واحصل على رتبته تلقائيًا !\n\n` +
                    `## 𝐂𝐋𝐔𝐁𝐒 🌍\n\n` +
                    `<:RMA:1571660508053114912> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.rma}>\n` +
                    `<:FCB:1571660548615966781> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.fcb}>\n` +
                    `<:PSG:1571659218761687232> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.psg}>\n` +
                    `<:MCI:1571663050124038254> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mci}>\n` +
                    `<:Arsenal:1571663557207265290> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.arsenal}>\n` +
                    `<:Bayern_Munich:1571663424763461754> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.bayern}>\n` +
                    `<:MCA:1571659714188808282> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mca}>\n` +
                    `<:MCO:1571659571003392082> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.mco}>\n` +
                    `<:USMA:1571659813442691173> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.CLUBS.usma}>`
                );

            const sentClubMsg = await interaction.channel.send({ embeds: [embed] });
            const clubEmojis = [
                '1571660508053114912', '1571660548615966781', '1571659218761687232',
                '1571663050124038254', '1571663557207265290', '1571663424763461754',
                '1571659714188808282', '1571659571003392082', '1571659813442691173'
            ];
            for (const emId of clubEmojis) {
                await sentClubMsg.react(emId).catch(() => {});
            }
            await interaction.editReply({ content: '✅ تم إرسال لوحة رتب الأندية بنجاح!' });
        }

        if (commandName === 'hobbies-roles') {
            if (interaction.channel.id !== CHANNELS.HOBBIES_ROLES) {
                return interaction.reply({ content: '❌ ليس الروم المخصص!', ephemeral: true });
            }
            await interaction.deferReply({ ephemeral: true });
            try {
                const fetched = await interaction.channel.messages.fetch({ limit: 50 });
                await interaction.channel.bulkDelete(fetched, true).catch(() => {});
            } catch (e) {}

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setDescription(
                    `### ✨ Choisis tes centres d’intérêt et récupère tes rôles ! 🎯🔥\n` +
                    `### 🌹 اختر اهتماماتك المفضلة واحصل على رتبك تلقائيًا !\n\n` +
                    `## 𝐇𝐎𝐁𝐁𝐈𝐄𝐒 ⭐\n\n` +
                    `<:Streamer:1571681414498488361> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.streamer}>\n` +
                    `<:Gamer:1571681755969229013> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.gamer}>\n` +
                    `<:Football:1571683136495165500> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.football}>\n` +
                    `<:Movie:1571682278030184519> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.movie}>\n` +
                    `<:Music:1571682535371706429> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.music}>\n` +
                    `<:Devloper:1571686904263348476> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.developer}>\n` +
                    `<:Gym:1571684136144605225> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.gym}>\n` +
                    `<:Designer:1571686439706697738> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.designer}>\n` +
                    `<:Trading:1571685791472812163> <a:BLUE_Arrow:1571334227008421979> <@&${ROLES.HOBBIES.trading}>`
                );

            const sentHobbiesMsg = await interaction.channel.send({ embeds: [embed] });
            const hobbiesEmojis = [
                '1571681414498488361', '1571681755969229013', '1571683136495165500',
                '1571682278030184519', '1571682535371706429', '1571686904263348476',
                '1571684136144605225', '1571686439706697738', '1571685791472812163'
            ];
            for (const emId of hobbiesEmojis) {
                await sentHobbiesMsg.react(emId).catch(() => {});
            }
            await interaction.editReply({ content: '✅ تم إرسال لوحة رتب الهوايات بنجاح!' });
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

            const embed = new EmbedBuilder().setColor('#2b2d31').setTitle(`تذكرة جديدة: ${ticketName.toUpperCase()}`).setDescription(`مرحباً ${member}، تم فتح تذكرتك.`);
            await channel.send({ content: `${pingRoles} ${member}`, embeds: [embed], components: [ticketButtons] }).catch(() => {});
            await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${channel}` });
        } catch (err) {
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء روم التذكرة، تأكد من صلاحيات البوت.' });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('role_')) {
        await interaction.deferReply({ ephemeral: true });
        let roleId = '';
        if (interaction.customId === 'role_districtian') roleId = ROLES.DISTRICTIAN;
        if (interaction.customId === 'role_minigames') roleId = ROLES.MINI_GAMES;
        if (interaction.customId === 'role_verify') roleId = ROLES.VERIFY;

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ الرتبة غير موجودة في السيرفر!' });
        
        const member = interaction.member;
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
            await interaction.editReply({ content: `✅ تمت إزالة رتبة **${role.name}** منك.` });
        } else {
            await member.roles.add(roleId).catch(() => {});
            await interaction.editReply({ content: `✅ تم إعطاؤك رتبة **${role.name}** بنجاح!` });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            await interaction.reply({ content: `🙋‍♂️ تم استلام التذكرة بواسطة ${interaction.member}.` }).catch(() => {});
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 سيتم إغلاق التذكرة خلال ثوانٍ...' }).catch(() => {});
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }
    }
});

// تسجيل الدخول الآمن
client.login(process.env.TOKEN).then(() => {
    console.log("🔐 Bot login process initiated successfully...");
}).catch(err => {
    console.error("❌ CRITICAL LOGIN ERROR: Failed to login to Discord. Check your TOKEN!");
    console.error(err);
});
