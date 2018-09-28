Required ENV variables:

`TWITTER_CONSUMER_KEY`  
`TWITTER_CONSUMER_SECRET`  
`TWITTER_ACCESS_TOKEN_KEY`  
`TWITTER_ACCESS_TOKEN_SECRET`  
`MONGO_URI`  
`DISCORD_BOT_TOKEN`  
`DISCORD_CMD_PREFIX`  
`DISCORD_BOT_OWNER_ID`  

A Twitter application can be created here: https://apps.twitter.com  
The Twitter application only needs READ access permissions.

If you do not have a Discord Bot token you can create a Discord application here: https://discordapp.com/developers/applications/  
then add a 'Bot user' to the application to retrieve the Bot's token.

The following assumes the DISCORD_CMD_PREFIX is set to !

You can add/remove Discord channels to post Twitter feeds to by running `!twitter [add | remove] twitter_name` from that Discord channel.  
The `!twitter` commands do not function via DMs  
Only valid Twitter accounts can be added.  
Newly added Twitter feeds can take up to 5 minutes to sync and start posting to Discord.

The `!twitter list` command will list all the channels in a guild where Twitter feeds are being posted.  
The `!twitter list all` command lists channels for ALL guilds and is only accessible to the bot owner.
