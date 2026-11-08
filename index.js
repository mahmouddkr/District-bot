const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

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
        .setDescription('يرسل رسالة نظام التذاكر مع الصورة والأزرار');

    try {
        await client.application.commands.create(joinCommand);
        await client.application.commands.create(leaveCommand);
        await client.application.commands.create(ticketCommand);
        console.log('Successfully registered all commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. التعامل مع الأوامر (/join, /leave, /ticket)
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

        // أمر التذاكر مع الصورة والرابط الذي أرسلته
        if (commandName === 'ticket') {
            const ticketEmbed = new EmbedBuilder()
                .setTitle('𝑫𝒊𝒔𝒕𝒓𝒊𝒄𝒕 𝑺𝒚𝒔𝒕𝒆𝒎 - الدعم الفني')
                .setDescription('أهلاً بك في قسم الدعم الخاص بسيرفر **District**.\nيرجى اختيار القسم المناسب أدناه لفتح تذكرة وسيتم الرد عليك فوراً.')
                .setColor('#0099ff')
                .setImage('https://cdn.discordapp.com/attachments/1528436682536259850/1569074974118125730/IMG_1065.jpg?ex=6af22271&is=6af0d0f1&hm=e3dd17b92e50e2a60a7a80ddcec5f855ee4b260bf8890d9e118a5bc531538d4d&')
                .setFooter({ text: 'District Community Support', iconURL: interaction.guild.iconURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('help_ticket')
                    .setLabel('NEED HELP')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('❓'),
                new ButtonBuilder()
                    .setCustomId('report_ticket')
                    .setLabel('REPORTS')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🚨')
            );

            await interaction.reply({
                embeds: [ticketEmbed],
                components: [row]
            });
        }
    }

    // 2. التعامل مع الأزرار (Buttons)
    if (interaction.isButton()) {
        const { guild, member, customId } = interaction;

        if (customId === 'help_ticket' || customId === 'report_ticket') {
            const ticketType = customId === 'help_ticket' ? 'help' : 'report';
            const channelName = `ticket-${ticketType}-${member.user.username}`;

            const existingChannel = guild.channels.cache.find(c => c.name === channelName);
            if (existingChannel) {
                return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });
            }

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

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({
                    content: `مرحباً بك ${member}!\nتم فتح التذكرة بنجاح، يرجى كتابة استفسارك أو بلاغك وسيصلك الرد قريباً.`,
                    components: [closeRow]
                });

                await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح: ${ticketChannel}` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'حدث خطأ أثناء إنشاء التذكرة.' });
            }
        }

        if (customId === 'close_ticket') {
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
