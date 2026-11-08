const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinVoiceConnection, getVoiceConnection } = require('@discordjs/voice');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District Bot is alive and running 24/7!');
});

app.listen(port, () => {
    console.log(`Web server is listening on port ${port}`);
});

// إعدادات التذاكر والتاغ (استبدل الآي دي أدناه بآي دي الإدارة أو الرتبة الخاصة بك إن أردت)
const SUPPORT_ROLE_OR_USER_ID = 'ضع_آي_دي_الشخص_أو_الرتبة_هنا';

// إيدي روم الترحيب (Welcome)
const WELCOME_CHANNEL_ID = '1560689193733324910';

// إيدي روم المغادرة (Leave)
const LEAVE_CHANNEL_ID = '1569090865551638709';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers // ضروري جداً لعمل الترحيب والمغادرة
    ]
});

// مجموعات لمنع تكرار الرسائل
const welcomedMembers = new Set();
const leftMembers = new Set();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const joinCommand = new SlashCommandBuilder()
        .setName('join')
        .setDescription('يجعل البوت يدخل القناة الصوتية معك');

    const leaveCommand = new SlashCommandBuilder()
        .setName('leave')
        .setDescription('يجعل البوت يغادر القناة الصوتية');

    const ticketCommand = new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('يرسل رسالة نظام التذاكر مع القائمة المنسدلة والصورة');

    try {
        await client.application.commands.create(joinCommand);
        await client.application.commands.create(leaveCommand);
        await client.application.commands.create(ticketCommand);
        console.log('Successfully registered all commands.');
    } catch (error) {
        console.error(error);
    }
});

// 1. نظام الترحيب بالأعضاء الجدد (مع حماية ضد التكرار)
client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;

    if (welcomedMembers.has(member.id)) return;
    welcomedMembers.add(member.id);
    setTimeout(() => welcomedMembers.delete(member.id), 60000);

    const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!welcomeChannel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🌹 𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓! 🎮')
        .setDescription(`👋 Welcome ${member}!\n\n🔥 Bienvenue dans notre communauté !\n🎮 Choisis tes jeux et partage tes meilleurs moments avec nous.\n\n❤️ مرحبًا بك في عائلة District!\n✨ هنا تبدأ المتعة، الصداقة والتحديات. نتمنى لك إقامة ممتعة معنا! \n🏆`)
        .setColor('#00ffcc')
        .setImage('https://cdn.discordapp.com/attachments/1528436682536259850/1569074974118125730/IMG_1065.jpg?ex=6af22271&is=6af0d0f1&hm=e3dd17b92e50e2a60a7a80ddcec5f855ee4b260bf8890d9e118a5bc531538d4d&')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member #${member.guild.memberCount} | District Community`, iconURL: member.guild.iconURL() });

    try {
        await welcomeChannel.send({ embeds: [welcomeEmbed] });
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});

// 2. نظام المغادرة (Leave System)
client.on('guildMemberRemove', async member => {
    if (member.user.bot) return;

    if (leftMembers.has(member.id)) return;
    leftMembers.add(member.id);
    setTimeout(() => leftMembers.delete(member.id), 60000);

    const leaveChannel = member.guild.channels.cache.get(LEAVE_CHANNEL_ID);
    if (!leaveChannel) return;

    const leaveEmbed = new EmbedBuilder()
        .setTitle('👋 𝐆𝐎𝐎𝐃𝐁𝐘𝐄 𝐅𝐑𝐎𝐌 𝐃𝐈𝐒𝐓𝐑𝐈𝐂𝐓!')
        .setDescription(`👋・Goodbye ${member} ! We hope to see you again soon. 💙`)
        .setColor('#ff3333')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Member Left | District Community`, iconURL: member.guild.iconURL() });

    try {
        await leaveChannel.send({ embeds: [leaveEmbed] });
    } catch (error) {
        console.error('Error sending leave message:', error);
    }
});

client.on('interactionCreate', async interaction => {
    // 3. التعامل مع الأوامر (/join, /leave, /ticket)
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'join') {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) {
                return interaction.reply({ content: 'يجب أن تكون في قناة صوتية أولاً!', ephemeral: true });
            }
            try {
                joinVoiceConnection({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                await interaction.reply({ content: `تم الانضمام إلى: **${voiceChannel.name}** بنجاح!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'حدث خطأ أثناء الانضمام.', ephemeral: true });
            }
        }

        if (commandName === 'leave') {
            const connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                return interaction.reply({ content: 'البوت ليس في قناة صوتية حالياً!', ephemeral: true });
            }
            try {
                connection.destroy();
                await interaction.reply({ content: 'تم المغادرة بنجاح.', ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'حدث خطأ أثناء الخروج.', ephemeral: true });
            }
        }

        if (commandName === 'ticket') {
            const ticketEmbed = new EmbedBuilder()
                .setTitle('الدعم الفني - District')
                .setDescription('أهلاً بك في قسم الدعم لـ District. اختر القسم المناسب لفتح تذكرة وسيتم الرد عليك فوراً.\n\n❓ **NEED HELP / الاستفسارات**\nللمساعدة العامة والأوامر وقوانين السيرفر.\n\n🚨 **REPORTS / الإبلاغات**\nللإبلاغ عن المخالفات والمشاكل (بسرية تامة).\n\n📌 **يرجى فتح التذكرة فقط عند الحاجة لضمان أسرع خدمة.**')
                .setColor('#0099ff')
                .setImage('https://cdn.discordapp.com/attachments/1528436682536259850/1569074974118125730/IMG_1065.jpg?ex=6af22271&is=6af0d0f1&hm=e3dd17b92e50e2a60a7a80ddcec5f855ee4b260bf8890d9e118a5bc531538d4d&');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('اختر خيار التذكرة')
                .addOptions([
                    {
                        label: 'NEED HELP',
                        description: 'تحتاج مساعدة - Need Help ?',
                        value: 'help_ticket',
                        emoji: '❓'
                    },
                    {
                        label: 'REPORTS',
                        description: 'إبلاغ عن شخص - Report a Member',
                        value: 'report_ticket',
                        emoji: '🚨'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [ticketEmbed],
                components: [row]
            });
        }
    }

    // 4. نظام التذاكر بالقائمة المنسدلة (Select Menu)
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select_menu') {
            const { guild, member, values } = interaction;
            const selectedValue = values[0];
            
            const ticketType = selectedValue === 'help_ticket' ? 'help' : 'report';
            const channelName = `ticket-${ticketType}-${member.user.username}`;

            const existingChannel = guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const permissionOverwrites = [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ];

                if (SUPPORT_ROLE_OR_USER_ID !== 'ضع_آي_دي_الشخص_أو_الرتبة_هنا') {
                    permissionOverwrites.push({
                        id: SUPPORT_ROLE_OR_USER_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    });
                }

                const ticketChannel = await guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: permissionOverwrites,
                });

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                let pingContent = `مرحباً بك ${member}!\nتم فتح التذكرة بنجاح.`;
                if (SUPPORT_ROLE_OR_USER_ID !== 'ضع_آي_دي_الشخص_أو_الرتبة_هنا') {
                    pingContent += `\nتم استدعاء المسؤول: <@&${SUPPORT_ROLE_OR_USER_ID}> (أو <@${SUPPORT_ROLE_OR_USER_ID}>)`;
                }

                await ticketChannel.send({
                    content: pingContent,
                    components: [closeRow]
                });

                await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح: ${ticketChannel}` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'حدث خطأ أثناء إنشاء التذكرة.' });
            }
        }
    }

    // 5. زر إغلاق التذكرة
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'سيتم حذف التذكرة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error(err);
                }
            }, 5000);
        }
    }
});

client.login(process.env.TOKEN);
