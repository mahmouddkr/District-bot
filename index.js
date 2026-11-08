const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('District Bot is alive and running 24/7!');
});

app.listen(port, () => {
    console.log(`Web server is listening on port ${port}`);
});

// آي دي الرومات الخاصة بك بدقة
const WELCOME_CHANNEL_ID = '1560689193733324910';
const LEAVE_CHANNEL_ID = '1569090865551638709';
const LOG_CHANNEL_ID = '1569093925266784286';       
const ROLES_LOG_CHANNEL_ID = '1569094610217861171'; 

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

// حماية ضد السبام والتكرار
const welcomedMembers = new Set();
const leftMembers = new Set();
const voiceCooldown = new Set();
const roleCooldown = new Set();
const messageLogCooldown = new Set();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! District System is online 24/7.`);

    const joinCommand = new SlashCommandBuilder().setName('join').setDescription('تسجيل الانضمام للنظام');
    const leaveCommand = new SlashCommandBuilder().setName('leave').setDescription('تسجيل المغادرة من النظام');
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

// 2. المغادرة (Leave & Log)
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

// 3. الحظر (Server Log - Ban)
client.on('guildBanAdd', async ban => {
    const logChannel = ban.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('🔨 **Member Banned / حظر عضو**')
        .setDescription(`**User:** ${ban.user.tag}\n**Reason:** ${ban.reason || 'No
