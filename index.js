const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

// خادم ويب لبقاء البوت شغال 24/7
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District System Bot is alive and running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// الآي دي الخاصة بالرومات والرتب بدقة
const WELCOME_CHANNEL_ID = '1560689193733324910';
const LEAVE_CHANNEL_ID = '1569090865551638709';
const LOG_CHANNEL_ID = '1569093925266784286';       
const ROLES_LOG_CHANNEL_ID = '1569094610217861171';
const SUPPORT_ROLE_ID = '1561461730545115276'; // رول الدعم الفني

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// حماية التكرار
const welcomedMembers = new Set();
const leftMembers = new Set();
const voiceCooldown = new Set();
const roleCooldown = new Set();
const messageLogCooldown = new Set();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! District System is online 24/7.`);

    const joinCommand = new SlashCommandBuilder().setName('join').setDescription('دخول البوت إلى روم الصوت الخاص بك');
    const leaveCommand = new SlashCommandBuilder().setName('leave').setDescription('خروج البوت من روم الصوت');
    const ticketCommand = new SlashCommandBuilder().setName('ticket').setDescription('إرسال لوحة نظام التذاكر والدعم الفني');

    try {
        await client.application.commands.create(joinCommand);
        await client.application.commands.create(leaveCommand);
        await client.application.commands.create(ticketCommand);
        console.log('Successfully registered all commands.');
    } catch (error) {
        console.error(error);
    }
});

// 1. الترحيب (Welcome)
client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;
    if (welcomedMembers.has(member.id)) return;
    welcomedMembers.add(member.id);
    setTimeout(() => welcomedMembers.delete(member.id), 30000);

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🌹 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓! 🎮')
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n🎮 Choisis tes jeux et partage tes meilleurs moments avec nous.\n\n❤️ مرحبًا بك في عائلة District!\n✨ هنا تبدأ المتعة، الصداقة والتحديات. نتمنى لك إقامة ممتعة معنا! \n🏆`)
        .setColor('#00ffcc')
        .setImage('https://cdn.discordapp.com/attachments/1528436682536259850/1569074974118125730/IMG_1065.jpg')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member #${member.guild.memberCount} | District Community`, iconURL: member.guild.iconURL() });

    try {
        await welcomeChannel.send({ embeds: [welcomeEmbed] });
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// 2. المغادرة واللوغ
client.on('guildMemberRemove', async member => {
    if (member.user.bot) return;
    if (leftMembers.has(member.id)) return;
    leftMembers.add(member.id);
    setTimeout(() => leftMembers.delete(member.id), 30000);

    const leaveChannel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
    if (leaveChannel) {
        const leaveEmbed = new EmbedBuilder()
            .setTitle('👋 𝐆𝐎𝐎𝐃𝐁𝐘𝐄 𝐅𝐑𝐎𝐌 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓!')
            .setDescription(`👋・Goodbye ${member} ! We hope to see you again soon. 💙`)
            .setColor('#ff3333')
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Member Left | District Community`, iconURL: member.guild.iconURL() });

        leaveChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
    }

    const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle('🚪 **Member Left / مغادرة عضو**')
            .setDescription(`**User:** ${member.user.tag} (${member})`)
            .setColor('#ff3333')
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

// 3. الحظر
client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`**User:** ${ban.user.tag}\n**Reason:** ${ban.reason || 'No reason provided'}`)
        .setColor('#8b0000')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 4. الفويس
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(LOG_CHANNEL_ID) || newState.guild.channels.cache.get(LOG_CHANNEL_ID);
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

// 5. لوغ الرتب
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = newMember.guild.channels.cache.get(ROLES_LOG_CHANNEL_ID);
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

// 6. مراقبة الرسائل
client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
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
    const logChannel = oldMessage.guild.channels.cache.get(LOG_CHANNEL_ID);
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

// 7. الأوامر والتذاكر (Ticket & Voice Join/Leave)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, member, guild } = interaction;

        if (commandName === 'join') {
            const voiceChannel = member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: '❌ يجب أن تكون متواجداً في روم صوتي (Voice Channel) لكي يتمكن البوت من الدخول معك!', ephemeral: true });
            }

            try {
                joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
                await interaction.reply({ content: `✅ تم انضمام البوت إلى روم الصوت: **${voiceChannel.name}** بنجاح!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة البوت دخول روم الصوت.', ephemeral: true });
            }
        }

        if (commandName === 'leave') {
            const connection = getVoiceConnection(guild.id);
            if (!connection) {
                return interaction.reply({ content: '❌ البوت ليس متواجداً في أي روم صوتي حالياً!', ephemeral: true });
            }

            try {
                connection.destroy();
                await interaction.reply({ content: '🚪 تم مغادرة البوت لروم الصوت بنجاح.', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: '❌ حدث خطأ أثناء إخراج البوت من الفويس.', ephemeral: true });
            }
        }

        if (commandName === 'ticket') {
            const ticketEmbed = new EmbedBuilder()
                .setTitle('الدعم الفني - District')
                .setDescription(
                    'أهلاً بك في قسم الدعم لـ District. اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.\n\n' +
                    '❓ **NEED HELP / الاستفسارات**\n' +
                    'للمساعدة العامة والأوامر وقوانين السيرفر.\n\n' +
                    '🚨 **REPORTS / الإبلاغات**\n' +
                    'للإبلاغ عن المخالفات والمشاكل (بسرية تامة).\n\n' +
                    '📌 **يرجى فتح التذكرة فقط عند الحاجة لضمان أسرع خدمة.**'
                )
                .setColor('#0099ff');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('اختر خيار التذكرة')
                .addOptions([
                    { label: 'NEED HELP', description: 'للمساعدة العامة والاستفسارات', value: 'help_ticket', emoji: '❓' },
                    { label: 'REPORTS', description: 'للإبلاغ عن المخالفات', value: 'report_ticket', emoji: '🚨' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ embeds: [ticketEmbed], components: [row] });
        }
    }

    // إنشاء التذكرة ومنشن رول الدعم
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const { guild, member, values } = interaction;
        const ticketType = values[0] === 'help_ticket' ? 'help' : 'report';
        const channelName = `ticket-${ticketType}-${member.user.username.toLowerCase()}`;

        const existingChannel = guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ],
            });

            // أزرار التحكم: Claim + Close
            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة 🙋‍♂️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة 🔒').setStyle(ButtonStyle.Danger)
            );

            // منشن العضو ورول الدعم معاً
            await ticketChannel.send({
                content: `مرحباً بك ${member}!\nتم فتح التذكرة بنجاح.\n<@&${SUPPORT_ROLE_ID}> يرجى الدعم هنا.`,
                components: [ticketRow]
            });

            await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح: ${ticketChannel}` });
        } catch (error) {
            await interaction.editReply({ content: 'حدث خطأ أثناء إنشاء التذكرة.' });
        }
    }

    // أزرار التذكرة (Claim & Close)
    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            // التحقق مما إذا كان المستخدم يملك رول الدعم
            if (!interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
                return interaction.reply({ content: '❌ عذراً، زر استلام التذكرة (Claim) مخصص لفريق الدعم فقط!', ephemeral: true });
            }
            await interaction.reply({ content: `✅ تم استلام هذه التذكرة بواسطة المشرف ${interaction.member}.` });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'سيتم حذف التذكرة خلال 5 ثوانٍ...' });
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }
});

client.login(process.env.TOKEN);
